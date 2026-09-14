import React from 'react';
import { X } from 'lucide-react';

export default function ModalStockTienda({ isOpen, onClose, product, stores, onOpenProductDetail }) {
  if (!isOpen || !product) return null;

  const handleFullDetail = () => {
    onClose();
    onOpenProductDetail(product.id);
  };

  return (
    <div className="modal-backdrop open" onClick={(e) => e.target.classList.contains('modal-backdrop') && onClose()}>
      <div className="modal" style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <h3>Stock por Tienda</h3>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', color: 'var(--text-main)' }}>{product.name}</h4>
          <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className={`tipo-badge ${product.tipo === 'Listelo' ? 'tb-l' : 'tb-d'}`}>{product.tipo}</span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>S/. {product.precio} / pz</span>
          </div>

          <div className="store-stock-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {stores.map(s => {
              const short = s.nombre.replace('Tienda ', '');
              const qty = product.stock && product.stock[short] ? product.stock[short] : { pz: 0, cj: 0 };
              const hasPz = qty.pz > 0;
              const hasCj = qty.cj > 0;

              return (
                <div key={s.id} className="ssm-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
                  <div className="ssm-store">
                    <div className="ssm-sname" style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '13.5px' }}>{s.nombre}</div>
                    <div className="ssm-saddr" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.direccion || 'Dirección no registrada'}</div>
                  </div>
                  <div className="ssm-badges" style={{ display: 'flex', gap: '6px' }}>
                    {hasPz && <span className="ssm-badge pz" style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>{qty.pz} pz</span>}
                    {hasCj && <span className="ssm-badge cj" style={{ background: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>{qty.cj} cj</span>}
                    {!hasPz && !hasCj && <span className="ssm-badge none" style={{ background: '#f3f4f6', color: '#9ca3af', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>Sin stock</span>}
                  </div>
                </div>
              );
            })}
          </div>

          <button className="btn btn-secondary btn-full" style={{ marginTop: '20px' }} onClick={handleFullDetail}>
            Ver detalle completo →
          </button>
        </div>
      </div>
    </div>
  );
}
