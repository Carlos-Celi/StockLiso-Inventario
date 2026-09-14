import React, { useState } from 'react';
import { X, Eye, EyeOff } from 'lucide-react';
import { db, getSecondaryAuthApp } from '../../firebase';
import { deleteApp } from 'firebase/app';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { sanitizeString, isValidEmail, validatePasswordStrength, logSecurityEvent } from '../../utils/security';

export default function ModalNuevoUsuario({ isOpen, onClose, stores, onShowToast }) {
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState('Vendedor');
  const [email, setEmail] = useState('');
  const [tienda, setTienda] = useState('Todas las tiendas');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showPass2, setShowPass2] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nameVal = sanitizeString(nombre.trim(), 100);
    const emailVal = sanitizeString(email.trim().toLowerCase(), 120);
    const passVal = pass;
    const pass2Val = pass2;

    if (!nameVal || !emailVal || !passVal) {
      onShowToast('⚠ Completa nombre, correo y contraseña');
      return;
    }

    if (!isValidEmail(emailVal)) {
      onShowToast('⚠ Ingresa un correo electrónico con formato válido');
      return;
    }

    if (passVal !== pass2Val) {
      onShowToast('⚠ Las contraseñas no coinciden');
      return;
    }

    // Validación de robustez de contraseña (OWASP A07 - Authentication Failures)
    const passCheck = validatePasswordStrength(passVal);
    if (!passCheck.valid) {
      onShowToast(`⚠ ${passCheck.message}`);
      return;
    }

    const validRoles = ['Administrador', 'Vendedor', 'Almacenista', 'Solo lectura'];
    const assignedRole = validRoles.includes(rol) ? rol : 'Vendedor';

    let secondaryInstance = null;
    try {
      setIsSubmitting(true);
      onShowToast('⚙ Creando usuario en el sistema...');

      // Inicializar instancia secundaria compatible con emulador y producción sin desloguear al admin
      const uniqueAppName = `SecondaryAuth_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      secondaryInstance = getSecondaryAuthApp(uniqueAppName);

      let userCredential;
      let isRecovered = false;

      try {
        userCredential = await createUserWithEmailAndPassword(secondaryInstance.auth, emailVal, passVal);
      } catch (authErr) {
        if (authErr.code === 'auth/email-already-in-use') {
          try {
            userCredential = await signInWithEmailAndPassword(secondaryInstance.auth, emailVal, passVal);
            isRecovered = true;
          } catch (loginErr) {
            throw authErr;
          }
        } else {
          throw authErr;
        }
      }

      const newUid = userCredential.user.uid;

      // Guardar perfil completo en Firestore
      await setDoc(doc(db, 'usuarios', newUid), {
        uid: newUid,
        nombre: nameVal,
        email: emailVal,
        rol: assignedRole,
        tienda: sanitizeString(tienda, 100),
        activo: true,
        creadoEn: serverTimestamp()
      });

      logSecurityEvent('USUARIO_REGISTRADO', { email: emailVal, rol: assignedRole, uid: newUid });
      onShowToast(isRecovered ? `✅ Perfil vinculado para ${nameVal}` : `✅ Usuario creado exitosamente · ${nameVal}`);
      
      setNombre('');
      setEmail('');
      setPass('');
      setPass2('');
      onClose();
    } catch (error) {
      console.error(error);
      if (error.code === 'auth/email-already-in-use') {
        onShowToast('⚠ Error: Este correo ya está registrado con otra credencial.');
      } else if (error.code === 'auth/invalid-email') {
        onShowToast('⚠ Error: Formato de correo electrónico inválido.');
      } else if (error.code === 'auth/weak-password') {
        onShowToast('⚠ Error: La contraseña no cumple con los requisitos de seguridad.');
      } else {
        onShowToast('⚠ Error al crear usuario: ' + error.message);
      }
    } finally {
      setIsSubmitting(false);
      if (secondaryInstance?.app) {
        try {
          await deleteApp(secondaryInstance.app);
        } catch (delErr) {
          console.warn('Limpieza de app secundaria completada con aviso:', delErr);
        }
      }
    }
  };

  return (
    <div className="modal-backdrop open" onClick={(e) => e.target.classList.contains('modal-backdrop') && onClose()}>
      <div className="modal" style={{ maxWidth: '460px' }}>
        <div className="modal-header">
          <h3>Nuevo usuario</h3>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar ventana"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body" noValidate>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="nu-nombre">Nombre completo</label>
              <input
                id="nu-nombre"
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="ej. María López"
                maxLength={100}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="nu-rol">Rol</label>
              <select id="nu-rol" value={rol} onChange={(e) => setRol(e.target.value)}>
                <option value="Administrador">Administrador</option>
                <option value="Vendedor">Vendedor</option>
                <option value="Almacenista">Almacenista</option>
                <option value="Solo lectura">Solo lectura</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="nu-email">Correo electrónico</label>
            <input
              id="nu-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@empresa.com"
              maxLength={120}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="nu-tienda">Tienda asignada</label>
            <select id="nu-tienda" value={tienda} onChange={(e) => setTienda(e.target.value)}>
              <option value="Todas las tiendas">Todas las tiendas</option>
              {stores.map(s => (
                <option key={s.id} value={s.nombre}>{s.nombre}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="nu-pass">Contraseña (Mín. 8 caracteres, letras y núms)</label>
              <div className="password-input-wrap">
                <input
                  id="nu-pass"
                  type={showPass ? 'text' : 'password'}
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  placeholder="mínimo 8 caracteres"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPass(!showPass)}
                  title={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="nu-pass2">Confirmar contraseña</label>
              <div className="password-input-wrap">
                <input
                  id="nu-pass2"
                  type={showPass2 ? 'text' : 'password'}
                  value={pass2}
                  onChange={(e) => setPass2(e.target.value)}
                  placeholder="repite la contraseña"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPass2(!showPass2)}
                  title={showPass2 ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-label={showPass2 ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPass2 ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>
          <button type="submit" className="btn btn-primary btn-full" style={{ marginTop: '10px' }} disabled={isSubmitting}>
            {isSubmitting ? 'Creando usuario...' : 'Crear usuario'}
          </button>
        </form>
      </div>
    </div>
  );
}
