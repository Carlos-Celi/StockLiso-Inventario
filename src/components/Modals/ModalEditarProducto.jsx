import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { db } from '../../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { sanitizeString, sanitizeNumber, logSecurityEvent } from '../../utils/security';

export default function ModalEditarProducto({ isOpen, onClose, product, onShowToast }) {
  const [tipo, setTipo] = useState('Listelo');
  const [nombre, setNombre] = useState('');
  const [precioPz, setPrecioPz] = useState('');
  const [precioCaja, setPrecioCaja] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [oculto, setOculto] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (product) {
      setTipo(product.tipo || 'Listelo');
      setNombre(product.name || '');
      setPrecioPz(product.precio !== undefined ? product.precio : '');
      setPrecioCaja(product.precioCaja !== undefined ? product.precioCaja : '');
      setDescripcion(product.descripcion || '');
      setOculto(product.oculto === true);
    }
  }, [product, isOpen]);

  if (!isOpen || !product) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nameVal = sanitizeString(nombre.trim(), 100);
    if (!nameVal) {
      onShowToast('⚠ El nombre es requerido');
      return;
    }

    const pricePzVal = sanitizeNumber(precioPz, 0, 1000000, 0);
    const priceCjVal = sanitizeNumber(precioCaja, 0, 1000000, 0);
    const descVal = sanitizeString(descripcion.trim(), 500);
    const icono = tipo === 'Listelo' ? '🪨' : '🟩';

    try {
      setIsSubmitting(true);
      onShowToast('⚙ Actualizando producto...');
      await setDoc(doc(db, 'productos', product.id), {
        nombre: nameVal,
        tipo: tipo === 'Decorado' ? 'Decorado' : 'Listelo',
        icono,
        precioPz: pricePzVal,
        precioCaja: priceCjVal,
        descripcion: descVal,
        oculto: !!oculto,
        actualizadoEn: serverTimestamp()
      }, { merge: true });

      logSecurityEvent('PRODUCTO_ACTUALIZADO', { id: product.id, nombre: nameVal });
      onShowToast('✅ Producto actualizado');
      onClose();
    } catch (err) {
      console.error(err);
      onShowToast('⚠ Error al actualizar producto: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop open" onClick={(e) => e.target.classList.contains('modal-backdrop') && onClose()}>
      <div className="modal" style={{ maxWidth: '460px' }}>
        <div className="modal-header">
          <h3>Editar Producto</h3>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="mep-tipo">Tipo</label>
              <select id="mep-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                <option value="Listelo">Listelo</option>
                <option value="Decorado">Decorado</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="mep-nombre">Modelo / Nombre</label>
              <input
                id="mep-nombre"
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="ej. Mármol Blanco"
                maxLength={100}
                required
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="mep-preciopz">Precio unitario (pz)</label>
              <input
                id="mep-preciopz"
                type="number"
                step="0.01"
                min="0"
                value={precioPz}
                onChange={(e) => setPrecioPz(e.target.value)}
                placeholder="S/. 0.00"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="mep-preciocj">Precio por caja</label>
              <input
                id="mep-preciocj"
                type="number"
                step="0.01"
                min="0"
                value={precioCaja}
                onChange={(e) => setPrecioCaja(e.target.value)}
                placeholder="S/. 0.00"
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="mep-desc">Descripción</label>
            <textarea
              id="mep-desc"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows="2"
              placeholder="Medidas, acabado, colección…"
              maxLength={500}
            />
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0 12px 0' }}>
            <input
              type="checkbox"
              id="mep-oculto"
              checked={oculto}
              onChange={(e) => setOculto(e.target.checked)}
              style={{ width: 'auto', margin: '0', cursor: 'pointer' }}
            />
            <label htmlFor="mep-oculto" style={{ margin: '0', cursor: 'pointer', fontWeight: 'normal', color: 'var(--text-main)' }}>
              Ocultar producto (no se mostrará en catálogo ni en búsquedas)
            </label>
          </div>
          <button type="submit" className="btn btn-primary btn-full" style={{ marginTop: '6px' }} disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </form>
      </div>
    </div>
  );
}
