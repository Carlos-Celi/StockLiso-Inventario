import React, { useState, useMemo, useEffect } from 'react';
import { Search } from 'lucide-react';
import { sanitizeString } from '../utils/security';
import Pagination from './Pagination';

export default function Stock({ products, onOpenProductDetail }) {
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Helper stock calculators
  const totalPz = (p) => Object.values(p.stock || {}).reduce((s, t) => s + (t.pz || 0), 0);
  const totalCj = (p) => Object.values(p.stock || {}).reduce((s, t) => s + (t.cj || 0), 0);
  const totalVal = (p) => totalPz(p) * (p.precio || 0) + totalCj(p) * (p.precioCaja || 0);

  const cleanQuery = useMemo(() => sanitizeString(searchQuery.trim(), 50).toLowerCase(), [searchQuery]);

  // Filters logic memoized (Optimización de rendimiento)
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesQuery = !cleanQuery || 
        p.name.toLowerCase().includes(cleanQuery) || 
        p.tipo.toLowerCase().includes(cleanQuery);
      
      if (!matchesQuery) return false;
      if (filterType === 'listelo') return p.tipo === 'Listelo';
      if (filterType === 'decorado') return p.tipo === 'Decorado';
      if (filterType === 'low') return (p.pct || 0) <= 25;
      return true;
    });
  }, [products, cleanQuery, filterType]);

  // Reiniciar a la página 1 cuando cambia el filtro o la búsqueda
  useEffect(() => {
    setCurrentPage(1);
  }, [cleanQuery, filterType]);

  // Paginación de 15 en 15
  const paginatedProducts = useMemo(() => {
    return filteredProducts.slice((currentPage - 1) * 15, currentPage * 15);
  }, [filteredProducts, currentPage]);

  const getProductBadge = (name, tipo) => {
    const initials = name ? name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'PR';
    const badgeClass = tipo === 'Listelo' ? 'tb-l' : 'tb-d';
    return <div className={`prod-badge-avatar ${badgeClass}`}>{initials}</div>;
  };

  return (
    <div className="page active" id="pg-stock">
      <div className="section-head">
        <h2>Stock & Productos</h2>
      </div>

      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="prod-search-box" style={{ flex: 1, minWidth: '240px' }}>
            <Search className="psb-icon-lucide" size={18} />
            <input
              type="text"
              placeholder="Buscar producto por nombre o tipo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Buscar productos"
            />
          </div>
          <div className="filter-bar" style={{ margin: 0, gap: '6px' }}>
            <button className={`filter-chip ${filterType === 'all' ? 'active' : ''}`} onClick={() => setFilterType('all')}>Todos</button>
            <button className={`filter-chip ${filterType === 'listelo' ? 'active' : ''}`} onClick={() => setFilterType('listelo')}>Listelos</button>
            <button className={`filter-chip ${filterType === 'decorado' ? 'active' : ''}`} onClick={() => setFilterType('decorado')}>Decorados</button>
            <button className={`filter-chip ${filterType === 'low' ? 'active' : ''}`} onClick={() => setFilterType('low')}>Stock bajo (≤25%)</button>
          </div>
        </div>
      </div>

      {/* TABLE VIEW (DESKTOP) */}
      <div className="card product-table-wrap table-responsive" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ paddingLeft: '20px' }}>Producto</th>
              <th>Tipo</th>
              <th>Tiendas en stock</th>
              <th>Pz.</th>
              <th>Cajas</th>
              <th>P. Unitario</th>
              <th>Valor total</th>
              <th>Estado de Stock</th>
              <th style={{ paddingRight: '20px', width: '70px', textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody id="prod-table-body">
            {paginatedProducts.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  No se encontraron productos coincidentes.
                </td>
              </tr>
            ) : (
              paginatedProducts.map(p => {
                const fillClass = p.pct >= 50 ? '' : p.pct >= 25 ? 'mid' : 'low';
                const activeStores = Object.keys(p.stock || {})
                  .filter(s => (p.stock[s].pz || 0) > 0 || (p.stock[s].cj || 0) > 0)
                  .map(s => s.startsWith('Tienda') ? s : 'Tienda ' + s)
                  .join(', ') || '—';
                const pz = totalPz(p);
                const cj = totalCj(p);
                const val = totalVal(p);

                return (
                  <tr key={p.id} onClick={() => onOpenProductDetail(p.id)} style={{ cursor: 'pointer' }}>
                    <td style={{ paddingLeft: '20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        {getProductBadge(p.name, p.tipo)}
                        <strong style={{ marginLeft: '8px' }}>{p.name}</strong>
                        {p.oculto && (
                          <span className="tipo-badge tb-d" style={{ background: '#fee2e2', color: '#ef4444', marginLeft: '6px', fontSize: '9px' }}>Oculto</span>
                        )}
                      </div>
                    </td>
                    <td><span className={`tipo-badge ${p.tipo === 'Listelo' ? 'tb-l' : 'tb-d'}`}>{p.tipo}</span></td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{activeStores}</td>
                    <td>{pz.toLocaleString()} pz</td>
                    <td>{cj ? cj.toLocaleString() + ' cj' : '—'}</td>
                    <td>S/. {Number(p.precio).toFixed(2)}</td>
                    <td><strong>S/. {val.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
                    <td>
                      <div className="stock-indicator">
                        <div className="stock-bar"><div className={`stock-fill ${fillClass}`} style={{ width: `${Math.min(100, Math.max(0, p.pct))}%` }}></div></div>
                        <span style={{ fontSize: '11px', color: p.pct < 25 ? 'var(--error)' : 'var(--text-muted)' }}>{p.pct}%</span>
                      </div>
                    </td>
                    <td style={{ paddingRight: '20px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <button className="btn btn-secondary btn-sm" onClick={() => onOpenProductDetail(p.id)}>Ver →</button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <Pagination
          currentPage={currentPage}
          totalItems={filteredProducts.length}
          pageSize={15}
          onPageChange={setCurrentPage}
          itemLabel="productos"
        />
      </div>

      {/* CARDS VIEW (MOBILE) */}
      <div className="product-cards" id="prod-cards">
        {paginatedProducts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', width: '100%' }}>
            No hay productos registrados.
          </div>
        ) : (
          paginatedProducts.map(p => {
            const pz = totalPz(p);
            const cj = totalCj(p);
            return (
              <div key={p.id} className="product-card-m" onClick={() => onOpenProductDetail(p.id)} role="button" tabIndex={0}>
                <div className="pcm-icon">{getProductBadge(p.name, p.tipo)}</div>
                <div className="pcm-info" style={{ flex: 1 }}>
                  <div className="pcm-name">{p.name}</div>
                  <div className="pcm-sub">
                    <span className={`tipo-badge ${p.tipo === 'Listelo' ? 'tb-l' : 'tb-d'}`} style={{ fontSize: '9px' }}>{p.tipo}</span>
                    <span style={{ marginLeft: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>S/. {Number(p.precio).toFixed(2)}</span>
                  </div>
                </div>
                <div className="pcm-right" style={{ textAlign: 'right' }}>
                  <div className="pcm-qty" style={{ color: p.pct < 25 ? 'var(--error)' : '' }}>{pz ? pz + ' pz' : cj + ' cj'}</div>
                  <div className="pcm-type" style={{ color: p.pct < 25 ? 'var(--error)' : '', fontSize: '10.5px' }}>{p.pct < 25 ? '⚠ Stock bajo' : cj ? cj + ' cajas' : ''}</div>
                </div>
              </div>
            );
          })
        )}
        <div style={{ marginTop: '12px' }}>
          <Pagination
            currentPage={currentPage}
            totalItems={filteredProducts.length}
            pageSize={15}
            onPageChange={setCurrentPage}
            itemLabel="productos"
          />
        </div>
      </div>
    </div>
  );
}
