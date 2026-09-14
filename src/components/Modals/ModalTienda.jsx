import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { db } from '../../firebase';
import { collection, addDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { sanitizeString, logSecurityEvent } from '../../utils/security';

export default function ModalTienda({ isOpen, onClose, store, onShowToast }) {
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (store) {
      setNombre(store.nombre || '');
      setDireccion(store.direccion || '');
    } else {
      setNombre('');
      setDireccion('');
    }
  }, [store, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nameVal = sanitizeString(nombre.trim(), 80);
    const addressVal = sanitizeString(direccion.trim(), 150);

    if (!nameVal) {
      onShowToast('⚠ El nombre de la tienda es requerido');
      return;
    }

    try {
      setIsSubmitting(true);
      onShowToast('⚙ Guardando tienda...');
      if (!store) {
        // Nueva tienda
        await addDoc(collection(db, 'tiendas'), {
          nombre: nameVal,
          direccion: addressVal,
          activa: true,
          creadoEn: serverTimestamp()
        });
        logSecurityEvent('TIENDA_CREADA', { nombre: nameVal });
        onShowToast('✅ Tienda creada con éxito');
      } else {
        // Editar tienda
        await setDoc(doc(db, 'tiendas', store.id), {
          nombre: nameVal,
          direccion: addressVal
        }, { merge: true });
        logSecurityEvent('TIENDA_ACTUALIZADA', { id: store.id, nombre: nameVal });
        onShowToast('✅ Tienda actualizada con éxito');
      }
      onClose();
    } catch (err) {
      console.error(err);
      onShowToast('⚠ Error al guardar tienda: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop open" onClick={(e) => e.target.classList.contains('modal-backdrop') && onClose()}>
      <div className="modal" style={{ maxWidth: '400px' }}>
        <div className="modal-header">
          <h3>{store ? 'Editar tienda' : 'Nueva tienda'}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label htmlFor="mt-nombre">Nombre de la tienda</label>
            <input
              id="mt-nombre"
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="ej. Tienda Oriente"
              maxLength={80}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="mt-dir">Dirección</label>
            <input
              id="mt-dir"
              type="text"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder="ej. Av. 8 de Octubre #2400"
              maxLength={150}
            />
          </div>
          <button type="submit" className="btn btn-primary btn-full" style={{ marginTop: '6px' }} disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Guardar Tienda'}
          </button>
        </form>
      </div>
    </div>
  );
}
