import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { db } from '../../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { sanitizeString, isValidEmail, logSecurityEvent } from '../../utils/security';

export default function ModalEditarUsuario({ isOpen, onClose, user, stores, onShowToast }) {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState('Vendedor');
  const [tienda, setTienda] = useState('Todas las tiendas');
  const [activo, setActivo] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setNombre(user.nombre || '');
      setEmail(user.email || '');
      setRol(user.rol || 'Vendedor');
      setTienda(user.tienda || 'Todas las tiendas');
      setActivo(user.activo !== false);
    } else {
      setNombre('');
      setEmail('');
      setRol('Vendedor');
      setTienda('Todas las tiendas');
      setActivo(true);
    }
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nameVal = sanitizeString(nombre.trim(), 100);
    const emailVal = sanitizeString(email.trim().toLowerCase(), 120);

    if (!nameVal) {
      onShowToast('⚠ El nombre es requerido');
      return;
    }

    if (!isValidEmail(emailVal)) {
      onShowToast('⚠ Ingresa un correo electrónico válido');
      return;
    }

    const validRoles = ['Administrador', 'Vendedor', 'Almacenista', 'Solo lectura'];
    const assignedRole = validRoles.includes(rol) ? rol : 'Vendedor';

    try {
      setIsSubmitting(true);
      onShowToast('⚙ Actualizando usuario...');
      await setDoc(doc(db, 'usuarios', user.id), {
        nombre: nameVal,
        email: emailVal,
        rol: assignedRole,
        tienda: sanitizeString(tienda, 100),
        activo: !!activo,
        actualizadoEn: serverTimestamp()
      }, { merge: true });

      logSecurityEvent('USUARIO_ACTUALIZADO', { id: user.id, email: emailVal, rol: assignedRole, activo });
      onShowToast('✅ Perfil de usuario actualizado');
      onClose();
    } catch (err) {
      console.error(err);
      onShowToast('⚠ Error al actualizar usuario: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop open" onClick={(e) => e.target.classList.contains('modal-backdrop') && onClose()}>
      <div className="modal" style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <h3>Editar perfil de usuario</h3>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body" noValidate>
          <div className="form-group">
            <label htmlFor="eu-nombre">Nombre</label>
            <input
              id="eu-nombre"
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="ej. María López"
              maxLength={100}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="eu-email">Correo Electrónico</label>
            <input
              id="eu-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              maxLength={120}
              required
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="eu-rol">Rol</label>
              <select id="eu-rol" value={rol} onChange={(e) => setRol(e.target.value)}>
                <option value="Administrador">Administrador</option>
                <option value="Vendedor">Vendedor</option>
                <option value="Almacenista">Almacenista</option>
                <option value="Solo lectura">Solo lectura</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="eu-tienda">Tienda asignada</label>
              <select id="eu-tienda" value={tienda} onChange={(e) => setTienda(e.target.value)}>
                <option value="Todas las tiendas">Todas las tiendas</option>
                {stores.map(s => (
                  <option key={s.id} value={s.nombre}>{s.nombre}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '10px 0 0 0' }}>
            <input
              type="checkbox"
              id="eu-activo"
              checked={activo}
              onChange={(e) => setActivo(e.target.checked)}
              style={{ width: 'auto', margin: '0', cursor: 'pointer' }}
            />
            <label htmlFor="eu-activo" style={{ margin: '0', cursor: 'pointer', fontWeight: 'normal' }}>
              Usuario activo (permite acceso al sistema)
            </label>
          </div>
          <button type="submit" className="btn btn-primary btn-full" style={{ marginTop: '16px' }} disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </form>
      </div>
    </div>
  );
}
