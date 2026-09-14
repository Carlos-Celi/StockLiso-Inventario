import React, { useState, useEffect, useMemo } from 'react';
import { X, Edit3, Trash2 } from 'lucide-react';
import { db } from '../../firebase';
import { runTransaction, doc, collection, serverTimestamp } from 'firebase/firestore';
import { sanitizeInteger, logSecurityEvent } from '../../utils/security';

export default function ModalProducto({
  isOpen,
  onClose,
  product,
  stores,
  sales,
  repos,
  isAdmin,
  onEdit,
  onDelete,
  onOpenSaleDetail,
  onShowToast
}) {
  const [activeTab, setActiveTab] = useState('stock');
  const [ingQty, setIngQty] = useState('');
  const [ingTipo, setIngTipo] = useState('Piezas');
  const [ingTienda, setIngTienda] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-set the first store name if empty
  useEffect(() => {
    if (stores && stores.length > 0 && !ingTienda) {
      setIngTienda(stores[0].nombre.replace('Tienda ', ''));
    }
  }, [stores, ingTienda]);

  if (!isOpen || !product) return null;

  const totalPz = Object.values(product.stock || {}).reduce((s, t) => s + (t.pz || 0), 0);
  const totalCj = Object.values(product.stock || {}).reduce((s, t) => s + (t.cj || 0), 0);
  const totalVal = totalPz * (product.precio || 0) + totalCj * (product.precioCaja || 0);

  // Generate Movement Logs memoized
  const hist = useMemo(() => {
    const list = [];
    sales.forEach(v => {
      const prodItem = (v.productos || []).find(prod =>
        prod.productoId === product.id || prod.nombre === product.name || prod.name === product.name
      );
      if (prodItem) {
        list.push({
          id: v.id,
          date: v.fecha,
          store: (v.tienda || '').replace('Tienda ', 'T. '),
          qty: `-${prodItem.qty} ${prodItem.unidad || prodItem.unit || 'pz'}`,
          val: `S/. ${(Number(prodItem.qty || 0) * Number(prodItem.pu || 0)).toFixed(2)}`,
          type: 'out',
          ventaId: v.id,
          timestamp: v.creadoEnRaw ? (v.creadoEnRaw.seconds ? v.creadoEnRaw.seconds * 1000 : new Date(v.creadoEnRaw).getTime()) : Date.now()
        });
      }
    });

    repos.forEach(r => {
      if (r.productoId === product.id || r.productoNombre === product.name) {
        list.push({
          id: r.id,
          date: r.fecha,
          store: 'T. ' + (r.tienda || ''),
          qty: `+${r.cantidad} ${r.unidad || 'pz'}`,
          val: '—',
          type: 'in',
          timestamp: r.creadoEn ? (r.creadoEn.seconds ? r.creadoEn.seconds * 1000 : new Date(r.creadoEn).getTime()) : Date.now()
        });
      }
    });

    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [sales, repos, product]);

  const handleGuardarIngreso = async (e) => {
    e.preventDefault();
    const qty = sanitizeInteger(ingQty, 1, 100000, 0);
    if (!qty || qty <= 0) {
      onShowToast('⚠ Ingresa una cantidad válida mayor a 0');
      return;
    }

    const unitKey = ingTipo === 'Piezas' ? 'pz' : 'cj';
    const storeShort = ingTienda || (stores[0] && stores[0].nombre.replace('Tienda ', ''));

    if (!storeShort) {
      onShowToast('⚠ Debes seleccionar una tienda');
      return;
    }

    try {
      setIsSubmitting(true);
      onShowToast('⚙ Actualizando stock...');

      await runTransaction(db, async (transaction) => {
        const prodRef = doc(db, 'productos', product.id);
        const snap = await transaction.get(prodRef);
        if (!snap.exists()) throw new Error('El producto no existe');
        if (snap.data().oculto) throw new Error('El producto está oculto y no admite registros');

        const pData = snap.data();
        const currentStock = { ...(pData.stock || {}) };
        const storeStock = { ...(currentStock[storeShort] || { pz: 0, cj: 0 }) };

        if (unitKey === 'pz') {
          storeStock.pz = (storeStock.pz || 0) + qty;
        } else {
          storeStock.cj = (storeStock.cj || 0) + qty;
        }
        currentStock[storeShort] = storeStock;

        // Calcular nuevo porcentaje
        const totalPzLocal = Object.values(currentStock).reduce((sum, s) => sum + (s.pz || 0) + (s.cj || 0) * 10, 0);
        const newPct = Math.min(100, Math.round((totalPzLocal / 50) * 100));

        // Registrar entrada de reposición
        const refCode = 'REP-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-4);
        const repoRef = doc(collection(db, 'reposiciones'));

        transaction.set(repoRef, {
          ref: refCode,
          productoId: product.id,
          productoNombre: pData.nombre,
          tienda: storeShort,
          cantidad: qty,
          unidad: unitKey,
          creadoEn: serverTimestamp(),
          fecha: new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
        });

        transaction.update(prodRef, {
          stock: currentStock,
          pctStock: newPct,
          actualizadoEn: serverTimestamp()
        });
      });

      logSecurityEvent('REPOSICION_CREADA', { productoId: product.id, tienda: storeShort, cantidad: qty, unidad: unitKey });
      onShowToast('✅ Stock actualizado correctamente');
      setIngQty('');
    } catch (err) {
      console.error(err);
      onShowToast('⚠ Error al actualizar stock: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRowClick = (item) => {
    if (item.type === 'out' && item.ventaId) {
      onClose();
      onOpenSaleDetail(item.ventaId);
    }
  };

  return (
    <div className="modal-backdrop open" onClick={(e) => e.target.classList.contains('modal-backdrop') && onClose()}>
      <div className="modal" style={{ maxWidth: '560px' }}>
        <div className="modal-header">
          <h3>Detalle de Producto</h3>
          {isAdmin && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center', marginRight: '8px' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => { onClose(); onEdit(product); }}
                style={{ padding: '4px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                title="Editar"
              >
                <Edit3 size={13} /> Editar
              </button>
              <button
                className="btn btn-warn btn-sm"
                onClick={() => onDelete(product.id)}
                style={{ padding: '4px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                title="Eliminar"
              >
                <Trash2 size={13} /> Eliminar
              </button>
            </div>
          )}
          <button className="modal-close" onClick={onClose} aria-label="Cerrar"><X size={16} /></button>
        </div>

        <div className="modal-body" style={{ paddingBottom: '0' }}>
          <div className="pdm-hero">
            <div className={`prod-badge-avatar ${product.tipo === 'Listelo' ? 'tb-l' : 'tb-d'}`} style={{ width: '48px', height: '48px', fontSize: '16px', fontWeight: 'bold' }}>
              {product.name ? product.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'PR'}
            </div>
            <div>
              <div style={{ fontWeight: '700', fontSize: '16px', color: 'var(--text-main)' }}>{product.name}</div>
              <div style={{ fontSize: '11px', margin: '4px 0' }}>
                <span className={`tipo-badge ${product.tipo === 'Listelo' ? 'tb-l' : 'tb-d'}`}>{product.tipo}</span>
              </div>
              <div className="pdm-meta" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Precio: S/. {Number(product.precio).toFixed(2)}/pz · Caja: S/. {product.precioCaja ? Number(product.precioCaja).toFixed(2) : '—'} · Valor: S/. {totalVal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
          <div className="pdm-stats">
            <div className="pdm-stat"><div className="sv">{totalPz.toLocaleString()}</div><div className="sl">Piezas</div></div>
            <div className="pdm-stat"><div className="sv">{totalCj.toLocaleString()}</div><div className="sl">Cajas</div></div>
            <div className="pdm-stat"><div className="sv">S/. {totalVal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</div><div className="sl">Valor</div></div>
          </div>

          <div style={{ display: 'flex', gap: '0', borderBottom: '2px solid var(--border)', margin: '0 -20px', padding: '0 20px' }}>
            <button className={`mp-tab ${activeTab === 'stock' ? 'active' : ''}`} onClick={() => setActiveTab('stock')}>
              ⊕ Agregar Stock
            </button>
            <button className={`mp-tab ${activeTab === 'reportes' ? 'active' : ''}`} onClick={() => setActiveTab('reportes')}>
              📊 Reportes
            </button>
          </div>
        </div>

        {activeTab === 'stock' ? (
          <div className="modal-body">
            <div style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--stone)', marginBottom: '10px' }}>
              Stock por tienda
            </div>
            <div className="store-stock-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {stores.length === 0 ? (
                <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0' }}>
                  No hay tiendas creadas. Crea una tienda para asignar stock.
                </div>
              ) : (
                stores.map(s => {
                  const short = s.nombre.replace('Tienda ', '');
                  const qty = product.stock && product.stock[short] ? product.stock[short] : { pz: 0, cj: 0 };
                  return (
                    <div key={s.id} className="ssl-row" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                      <div className="ssl-name" style={{ fontWeight: '500', color: 'var(--text-main)', fontSize: '13px' }}>{s.nombre}</div>
                      <div className="ssl-tags" style={{ display: 'flex', gap: '6px' }}>
                        {qty.pz ? <span className="ssl-tag" style={{ background: 'var(--primary-light)', color: 'var(--primary)', fontSize: '11px', padding: '2px 8px', borderRadius: '4px', fontWeight: '700' }}>{qty.pz} pz</span> : ''}
                        {qty.cj ? <span className="ssl-tag" style={{ background: '#e0e7ff', color: '#3730a3', fontSize: '11px', padding: '2px 8px', borderRadius: '4px', fontWeight: '700' }}>{qty.cj} cj</span> : ''}
                        {!qty.pz && !qty.cj ? <span className="ssl-tag warn" style={{ background: '#fef3c7', color: '#d97706', fontSize: '11px', padding: '2px 8px', borderRadius: '4px', fontWeight: '700' }}>Sin stock</span> : ''}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {product.oculto ? (
              <div style={{ marginTop: '18px', padding: '12px', background: '#fef2f2', color: '#b91c1c', borderRadius: 'var(--radius)', border: '1px solid #fca5a5', fontSize: '12.5px', fontWeight: '500', textAlign: 'center' }}>
                Este producto se encuentra oculto. Habilítalo en el menú de edición para permitir ingresos de stock.
              </div>
            ) : (
              stores.length > 0 && (
                <form onSubmit={handleGuardarIngreso} className="ingreso-form" style={{ marginTop: '18px', background: '#f8fafc', padding: '16px', borderRadius: 'var(--radius)', border: '1px solid var(--border-light)' }}>
                  <div className="if-title" style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-main)', marginBottom: '12px' }}>⊕ Ingresar stock</div>
                  <div className="ingreso-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '10px', alignItems: 'end' }}>
                    <div className="form-group" style={{ margin: '0' }}>
                      <label style={{ fontSize: '11.5px', marginBottom: '4px' }}>Cantidad</label>
                      <input
                        type="number"
                        min="1"
                        value={ingQty}
                        onChange={(e) => setIngQty(e.target.value)}
                        placeholder="ej. 10"
                        style={{ padding: '6px 10px', fontSize: '13px' }}
                        required
                      />
                    </div>
                    <div className="form-group" style={{ margin: '0' }}>
                      <label style={{ fontSize: '11.5px', marginBottom: '4px' }}>Tipo</label>
                      <select value={ingTipo} onChange={(e) => setIngTipo(e.target.value)} style={{ padding: '6px 10px', fontSize: '13px' }}>
                        <option value="Piezas">Piezas</option>
                        <option value="Cajas">Cajas</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ margin: '0' }}>
                      <label style={{ fontSize: '11.5px', marginBottom: '4px' }}>Tienda</label>
                      <select value={ingTienda} onChange={(e) => setIngTienda(e.target.value)} style={{ padding: '6px 10px', fontSize: '13px' }}>
                        {stores.map(s => {
                          const short = s.nombre.replace('Tienda ', '');
                          return <option key={s.id} value={short}>{s.nombre}</option>;
                        })}
                      </select>
                    </div>
                    <button type="submit" className="btn btn-primary btn-sm" style={{ padding: '8px 12px', fontSize: '12.5px', height: '36px' }} disabled={isSubmitting}>
                      {isSubmitting ? 'Guardando...' : 'Guardar'}
                    </button>
                  </div>
                </form>
              )
            )}
          </div>
        ) : (
          <div className="modal-body">
            <div style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--stone)', marginBottom: '10px' }}>
              Historial de movimientos
            </div>
            <div style={{ fontSize: '11px', color: 'var(--stone)', marginBottom: '8px' }}>
              Toca una salida para ver el detalle de la venta
            </div>
            <div id="mp-hist" style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
              {hist.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '16px' }}>
                  No se registran movimientos para este producto.
                </div>
              ) : (
                hist.map((item, idx) => (
                  <div
                    key={idx}
                    className={`hist-item ${item.type === 'out' ? 'out' : 'in'}`}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '12.5px',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: item.type === 'out' ? '#fff5f5' : '#f0fdf4',
                      borderLeft: item.type === 'out' ? '3px solid var(--error)' : '3px solid var(--primary)',
                      cursor: item.type === 'out' ? 'pointer' : 'default'
                    }}
                    onClick={() => handleRowClick(item)}
                    role={item.type === 'out' ? 'button' : undefined}
                    tabIndex={item.type === 'out' ? 0 : undefined}
                  >
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ fontWeight: '700', color: item.type === 'out' ? 'var(--error)' : 'var(--primary)' }}>
                        {item.qty}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                        {item.date} · {item.store}
                      </span>
                    </div>
                    <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>{item.val}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
