import React from 'react';
import { X } from 'lucide-react';

export default function ModalVenta({ isOpen, onClose, sale, onOpenLightbox }) {
  if (!isOpen || !sale) return null;

  return (
    <div className="modal-backdrop open" onClick={(e) => e.target.classList.contains('modal-backdrop') && onClose()}>
      <div className="modal" style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <h3>Detalle de Venta</h3>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '6px' }}>
            <span className="vdm-folio" style={{ fontWeight: '700', fontSize: '15px', color: 'var(--primary)' }}>
              Folio: {sale.folio}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {sale.fecha} · {sale.tienda}
            </span>
          </div>

          {/* DATOS DEL CLIENTE */}
          <div style={{ background: '#f8fafc', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', marginBottom: '14px' }}>
            <div style={{ fontSize: '10.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.4px', color: 'var(--stone)', marginBottom: '3px' }}>
              👤 Datos del Cliente
            </div>
            <div style={{ fontWeight: '700', fontSize: '13.5px', color: 'var(--text-main)' }}>
              {sale.clienteNombre || (sale.cliente && sale.cliente.nombre) || 'Público General'}
            </div>
            {(sale.clienteDocumento || (sale.cliente && sale.cliente.documento) || sale.clienteTelefono || (sale.cliente && sale.cliente.telefono)) && (
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {(sale.clienteDocumento || (sale.cliente && sale.cliente.documento)) && (
                  <span><strong>Doc / RUC:</strong> {sale.clienteDocumento || (sale.cliente && sale.cliente.documento)}</span>
                )}
                {(sale.clienteTelefono || (sale.cliente && sale.cliente.telefono)) && (
                  <span><strong>Tel:</strong> {sale.clienteTelefono || (sale.cliente && sale.cliente.telefono)}</span>
                )}
              </div>
            )}
          </div>

          <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.4px', color: 'var(--stone)', marginBottom: '8px' }}>
            Productos Vendidos
          </div>
          <div className="vdm-items" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
            {sale.productos.map((p, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                <div>
                  <span style={{ fontWeight: '600' }}>{p.nombre || p.name}</span> <span style={{ color: 'var(--text-muted)' }}>({p.tipo})</span>
                  {p.tiendaOrigen && p.tiendaOrigen !== sale.tienda && (
                    <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: '500', marginTop: '2px' }}>
                      📦 Stock descontado de: {p.tiendaOrigen}
                    </div>
                  )}
                </div>
                <div>
                  {p.qty} {p.unidad || p.unit || 'pz'} x S/. {p.pu} = <span style={{ fontWeight: '600' }}>S/. {p.qty * p.pu}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="vdm-total" style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', fontSize: '16px', borderTop: '2px solid var(--border)', paddingTop: '10px', marginBottom: '14px' }}>
            <span>Total</span>
            <span style={{ color: 'var(--primary)' }}>S/. {sale.total}</span>
          </div>

          {sale.notas && (
            <div style={{ marginBottom: '12px', fontSize: '12px', color: 'var(--text-muted)', background: '#fffbeb', padding: '8px 10px', borderRadius: '4px', border: '1px solid #fef3c7' }}>
              <strong>Notas:</strong> {sale.notas}
            </div>
          )}

          {sale.urlComprobante && (
            <div id="mv-img-wrap" style={{ marginTop: '14px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', textAlign: 'left' }}>Comprobante de Pago</div>
              <img
                src={sale.urlComprobante}
                alt="Comprobante"
                style={{ maxWidth: '100%', maxHeight: '180px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', cursor: 'pointer' }}
                onClick={() => onOpenLightbox(sale.urlComprobante)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
