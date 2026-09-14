import React, { useState, useMemo, useEffect } from 'react';
import { Store, Edit3, Trash2, Search } from 'lucide-react';
import { db } from '../firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { sanitizeString } from '../utils/security';
import Pagination from './Pagination';

export default function Tiendas({ stores, products, isAdmin, onOpenStoreModal, onShowToast }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const cleanQuery = useMemo(() => sanitizeString(searchQuery.trim(), 50).toLowerCase(), [searchQuery]);

  // Filtrado de tiendas memoizado
  const filteredStores = useMemo(() => {
    if (!cleanQuery) return stores;
    return stores.filter(s =>
      (s.nombre || '').toLowerCase().includes(cleanQuery) ||
      (s.direccion || '').toLowerCase().includes(cleanQuery)
    );
  }, [stores, cleanQuery]);

  // Reiniciar a página 1 al buscar
  useEffect(() => {
    setCurrentPage(1);
  }, [cleanQuery]);

  // Paginación de 15 en 15
  const paginatedStores = useMemo(() => {
    return filteredStores.slice((currentPage - 1) * 15, currentPage * 15);
  }, [filteredStores, currentPage]);

  const handleDeleteStore = async (id, nombre) => {
    if (window.confirm(`¿Está seguro de eliminar la tienda "${nombre}"? Esto no eliminará los productos, pero afectará el stock asignado a esta tienda.`)) {
      try {
        onShowToast('⚙ Eliminando tienda...');
        await deleteDoc(doc(db, 'tiendas', id));
        onShowToast('✅ Tienda eliminada');
      } catch (err) {
        console.error(err);
        onShowToast('⚠ Error al eliminar tienda: ' + err.message);
      }
    }
  };

  return (
    <div className="page active" id="pg-tiendas">
      <div className="section-head">
        <h2>Tiendas</h2>
        <div className="spacer"></div>
        {isAdmin && (
          <button className="btn btn-primary btn-sm" onClick={() => onOpenStoreModal()}>
            + Nueva tienda
          </button>
        )}
      </div>

      {/* BUSCADOR DE TIENDAS */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="prod-search-box">
          <Search className="psb-icon-lucide" size={18} />
          <input
            type="text"
            placeholder="Buscar tienda por nombre o dirección..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Buscar tiendas"
          />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }} id="tiendas-list">
        {paginatedStores.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', width: '100%' }}>
            {stores.length === 0 ? 'No hay tiendas registradas. Agrega una para comenzar.' : 'No se encontraron tiendas coincidentes.'}
          </div>
        ) : (
          paginatedStores.map(s => {
            const storeShortName = s.nombre.replace('Tienda ', '');
            let totalPz = 0;
            let totalCj = 0;

            products.forEach(p => {
              const stock = p.stock && p.stock[storeShortName];
              if (stock) {
                totalPz += stock.pz || 0;
                totalCj += stock.cj || 0;
              }
            });

            const hasPz = totalPz > 0;
            const hasCj = totalCj > 0;
            let stockText = '';
            if (hasPz && hasCj) {
              stockText = `${totalPz} pz · ${totalCj} cj`;
            } else if (hasPz) {
              stockText = `${totalPz} pz`;
            } else if (hasCj) {
              stockText = `${totalCj} cj`;
            } else {
              stockText = 'Sin stock';
            }

            const lowStock = totalPz < 30;
            const statusLabel = lowStock ? 'Stock bajo' : 'Activa';
            const statusClass = lowStock
              ? { background: 'var(--error-light)', color: 'var(--error)' }
              : { background: 'var(--primary-light)', color: 'var(--primary)' };

            return (
              <div key={s.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '18px 24px' }}>
                <div style={{ width: '44px', height: '44px', background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(37,99,235,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Store size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '700', color: 'var(--text-main)' }}>{s.nombre}</div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>{s.direccion} · {stockText} en stock</div>
                </div>
                <span style={{ ...statusClass, padding: '4px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: '700' }}>
                  {statusLabel}
                </span>

                {isAdmin && (
                  <div style={{ display: 'flex', gap: '6px', marginLeft: '12px' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => onOpenStoreModal(s)}
                      style={{ padding: '5px 8px' }}
                      title="Editar"
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleDeleteStore(s.id, s.nombre)}
                      style={{ padding: '5px 8px', color: 'var(--error)' }}
                      title="Eliminar"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {filteredStores.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <Pagination
            currentPage={currentPage}
            totalItems={filteredStores.length}
            pageSize={15}
            onPageChange={setCurrentPage}
            itemLabel="tiendas"
          />
        </div>
      )}
    </div>
  );
}

