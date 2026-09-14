import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { sanitizeString, sanitizeNumber, sanitizeInteger, logSecurityEvent } from '../utils/security';

export default function AgregarProducto({ stores, onNavigate, onShowToast }) {
  const [tipo, setTipo] = useState('Listelo');
  const [nombre, setNombre] = useState('');
  const [precioPz, setPrecioPz] = useState('');
  const [precioCaja, setPrecioCaja] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [stockInputs, setStockInputs] = useState({});
  const [oculto, setOculto] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleStockChange = (storeShort, field, value) => {
    const val = sanitizeInteger(value, 0, 100000, 0);
    setStockInputs(prev => ({
      ...prev,
      [storeShort]: {
        ...prev[storeShort],
        [field]: val
      }
    }));
  };

  const getProductBadge = (name, prodTipo) => {
    const initials = name ? name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'PR';
    const badgeClass = prodTipo === 'Listelo' ? 'tb-l' : 'tb-d';
    return <div className={`prod-badge-avatar ${badgeClass}`}>{initials}</div>;
  };

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

    // Construir stock dinámico
    const stock = {};
    let totalPz = 0;

    stores.forEach(s => {
      const short = s.nombre.replace('Tienda ', '');
      const inputs = stockInputs[short] || { pz: 0, cj: 0 };
      const pzNum = sanitizeInteger(inputs.pz, 0, 100000, 0);
      const cjNum = sanitizeInteger(inputs.cj, 0, 100000, 0);
      stock[short] = {
        pz: pzNum,
        cj: cjNum
      };
      totalPz += pzNum + (cjNum * 10);
    });

    const pctStock = Math.min(100, Math.round((totalPz / 50) * 100));
    const icono = tipo === 'Listelo' ? '🪨' : '🟩';

    try {
      setIsSubmitting(true);
      onShowToast('⚙ Guardando producto...');
      await addDoc(collection(db, 'productos'), {
        nombre: nameVal,
        tipo: tipo === 'Decorado' ? 'Decorado' : 'Listelo',
        icono,
        precioPz: pricePzVal,
        precioCaja: priceCjVal,
        descripcion: descVal,
        stock,
        pctStock,
        oculto: !!oculto,
        creadoEn: serverTimestamp(),
        actualizadoEn: serverTimestamp()
      });

      logSecurityEvent('PRODUCTO_CREADO', { nombre: nameVal, tipo });
      onShowToast('✅ Producto creado con éxito');
      setNombre('');
      setPrecioPz('');
      setPrecioCaja('');
      setDescripcion('');
      setStockInputs({});
      setOculto(false);
      onNavigate('stock');
    } catch (err) {
      console.error(err);
      onShowToast('⚠ Error al crear producto: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const previewName = sanitizeString(nombre.trim(), 40) || 'Nombre del producto';
  const previewPrice = sanitizeNumber(precioPz, 0, 1000000, 0);

  return (
    <div className="page active" id="pg-agregar">
      <div className="section-head">
        <h2>Agregar Producto</h2>
      </div>

      <form onSubmit={handleSubmit} className="venta-layout">
        {/* FORMULARIO */}
        <div>
          <div className="card" style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--stone)', marginBottom: '14px' }}>
              Información básica
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="ap-tipo">Tipo</label>
                <select id="ap-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                  <option value="Listelo">Listelo</option>
                  <option value="Decorado">Decorado</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="ap-nombre">Modelo / Nombre</label>
                <input
                  id="ap-nombre"
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
                <label htmlFor="ap-preciopz">Precio unitario (pz)</label>
                <input
                  id="ap-preciopz"
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
                <label htmlFor="ap-preciocj">Precio por caja</label>
                <input
                  id="ap-preciocj"
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
              <label htmlFor="ap-desc">Descripción</label>
              <textarea
                id="ap-desc"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Medidas, acabado, colección…"
                rows="2"
                maxLength={500}
              />
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0 0 0' }}>
              <input
                type="checkbox"
                id="ap-oculto"
                checked={oculto}
                onChange={(e) => setOculto(e.target.checked)}
                style={{ width: 'auto', margin: '0', cursor: 'pointer' }}
              />
              <label htmlFor="ap-oculto" style={{ margin: '0', cursor: 'pointer', fontWeight: 'normal', color: 'var(--text-main)' }}>
                Ocultar producto (no se mostrará en búsquedas ni catálogo)
              </label>
            </div>
          </div>

          <div className="card" id="ap-stores-card">
            <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Stock inicial por tienda
            </div>
            <div id="ap-stores-container" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {stores.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
                  No hay tiendas creadas. Por favor, crea una tienda primero en la sección Tiendas.
                </div>
              ) : (
                stores.map(s => {
                  const short = s.nombre.replace('Tienda ', '');
                  const currentPz = stockInputs[short]?.pz ?? '';
                  const currentCj = stockInputs[short]?.cj ?? '';
                  return (
                    <div key={s.id} className="store-assign" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                      <span>{s.nombre}</span>
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                        <input
                          type="number"
                          placeholder="Pz"
                          min="0"
                          value={currentPz}
                          onChange={(e) => handleStockChange(short, 'pz', e.target.value)}
                          style={{ width: '70px', padding: '6px 10px', fontSize: '13px' }}
                          aria-label={`Piezas en ${s.nombre}`}
                        />
                        <input
                          type="number"
                          placeholder="Cj"
                          min="0"
                          value={currentCj}
                          onChange={(e) => handleStockChange(short, 'cj', e.target.value)}
                          style={{ width: '70px', padding: '6px 10px', fontSize: '13px' }}
                          aria-label={`Cajas en ${s.nombre}`}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div style={{ marginTop: '14px' }}>
              <button type="submit" className="btn btn-primary btn-full" disabled={stores.length === 0 || isSubmitting}>
                {isSubmitting ? 'Guardando...' : 'Guardar producto'}
              </button>
            </div>
          </div>
        </div>

        {/* PREVIEW */}
        <div className="preview-card" style={{ height: 'fit-content' }}>
          <div className="pc-icon" id="ap-preview-icon">
            {getProductBadge(nombre, tipo)}
          </div>
          <div className="pc-name" id="ap-preview-name">{previewName}</div>
          <div className="pc-tipo" id="ap-preview-tipo">
            <span className={`tipo-badge ${tipo === 'Listelo' ? 'tb-l' : 'tb-d'}`}>{tipo}</span>
          </div>
          <div className="pc-precio" id="ap-preview-precio">S/. {previewPrice.toFixed(2)} / pz</div>
          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '14px 0' }} />
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
            Esta es una vista previa de cómo se mostrará el producto en el catálogo principal e inventario.
          </div>
        </div>
      </form>
    </div>
  );
}
