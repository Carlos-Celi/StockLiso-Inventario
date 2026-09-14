import React, { useState, useMemo, useEffect } from 'react';
import { Search, ShoppingBag, PlusCircle, RotateCcw } from 'lucide-react';
import { db } from '../firebase';
import { runTransaction, doc, collection, query, where, getDocs } from 'firebase/firestore';
import { sanitizeString, logSecurityEvent } from '../utils/security';
import Pagination from './Pagination';

export default function Transacciones({ sales, repos, products, clients = [], isAdmin, onOpenSaleDetail, onShowToast }) {
  const [filterTx, setFilterTx] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Merge Sales and Additions (Reposiciones) con useMemo para rendimiento
  const allTxs = useMemo(() => {
    const list = [];

    sales.forEach(s => {
      const names = s.productos.map(p => p.nombre || p.name).join(', ');
      const qtySum = s.productos.reduce((sum, p) => sum + (Number(p.qty) || 0), 0);
      const originStores = Array.from(new Set(s.productos.map(p => p.tiendaOrigen).filter(Boolean)));
      const hasDifferentOrigin = originStores.some(st => st !== s.tienda);
      const storeDisplay = hasDifferentOrigin
        ? `${s.tienda} (Stock: ${originStores.join(', ')})`
        : s.tienda;
      const clientName = s.clienteNombre || (s.cliente && s.cliente.nombre) || 'Público General';

      list.push({
        id: s.id,
        ref: s.folio,
        type: 'venta',
        date: s.fecha,
        store: storeDisplay,
        desc: names,
        cliente: clientName,
        qty: `-${qtySum} pz`,
        total: `S/. ${Number(s.total).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        timestamp: s.creadoEnRaw ? (s.creadoEnRaw.seconds ? s.creadoEnRaw.seconds * 1000 : new Date(s.creadoEnRaw).getTime()) : Date.now()
      });
    });

    repos.forEach(r => {
      const storeName = r.tienda ? (r.tienda.startsWith('Tienda') ? r.tienda : 'Tienda ' + r.tienda) : 'Tienda General';
      list.push({
        id: r.id,
        ref: r.ref || 'REP-N/A',
        type: 'ingreso',
        date: r.fecha,
        store: storeName,
        desc: r.productoNombre || 'Reposición de stock',
        qty: `+${r.cantidad} ${r.unidad || 'pz'}`,
        total: '—',
        timestamp: r.creadoEn ? (r.creadoEn.seconds ? r.creadoEn.seconds * 1000 : new Date(r.creadoEn).getTime()) : Date.now()
      });
    });

    // Orden descendente por fecha / timestamp
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [sales, repos]);

  const cleanQuery = useMemo(() => sanitizeString(searchQuery.trim(), 50).toLowerCase(), [searchQuery]);

  // Filtrado de transacciones memoizado
  const filteredTxs = useMemo(() => {
    return allTxs.filter(t => {
      const matchesFilter = filterTx === 'all' || t.type === filterTx;
      const matchesQuery = !cleanQuery ||
        t.ref.toLowerCase().includes(cleanQuery) ||
        t.desc.toLowerCase().includes(cleanQuery) ||
        t.store.toLowerCase().includes(cleanQuery) ||
        (t.cliente || '').toLowerCase().includes(cleanQuery);
      return matchesFilter && matchesQuery;
    });
  }, [allTxs, filterTx, cleanQuery]);

  // Reiniciar a página 1 al cambiar filtro o búsqueda
  useEffect(() => {
    setCurrentPage(1);
  }, [cleanQuery, filterTx]);

  // Paginación de 15 en 15
  const paginatedTxs = useMemo(() => {
    return filteredTxs.slice((currentPage - 1) * 15, currentPage * 15);
  }, [filteredTxs, currentPage]);

  const handleRowClick = (tx) => {
    if (tx.type === 'venta') {
      onOpenSaleDetail(tx.id);
    }
  };

  const handleRevertTx = async (tx) => {
    if (!isAdmin) {
      onShowToast('⚠ Solo los administradores pueden anular o revertir transacciones');
      return;
    }

    if (tx.type === 'venta') {
      const saleObj = sales.find(s => s.id === tx.id);
      if (!saleObj) {
        onShowToast('⚠ No se encontró el registro de la venta');
        return;
      }

      if (!window.confirm(`¿Estás seguro de anular la venta con folio ${saleObj.folio}? El stock retirado será devuelto automáticamente al inventario.`)) {
        return;
      }

      try {
        onShowToast('⚙ Revertiendo venta y devolviendo stock...');

        // Paso 1: Resolver referencias a productos FUERA de la transacción para cumplir con las reglas de Firestore (OWASP A08 - Integridad de datos)
        const productRefMap = new Map();
        for (const item of saleObj.productos) {
          const prodName = item.nombre || item.name;
          if (item.productoId) {
            productRefMap.set(prodName, doc(db, 'productos', item.productoId));
          } else if (!productRefMap.has(prodName)) {
            // Consulta de fallback para registros anteriores
            const q = query(collection(db, 'productos'), where('nombre', '==', prodName));
            const snap = await getDocs(q);
            if (!snap.empty) {
              productRefMap.set(prodName, snap.docs[0].ref);
            }
          }
        }

        // Paso 2: Ejecutar transacción atómica pura
        await runTransaction(db, async (transaction) => {
          // Fase de lectura
          const productSnapshots = new Map();
          for (const [prodName, ref] of productRefMap.entries()) {
            const snap = await transaction.get(ref);
            if (snap.exists()) {
              productSnapshots.set(prodName, { ref, data: snap.data() });
            }
          }

          // Fase de escritura: Devolver el stock
          for (const item of saleObj.productos) {
            const prodName = item.nombre || item.name;
            const pObj = productSnapshots.get(prodName);
            if (pObj) {
              const currentStock = { ...(pObj.data.stock || {}) };
              const originStoreName = item.tiendaOrigen || saleObj.tienda;
              const storeShort = originStoreName.replace('Tienda ', '');

              const currentStoreStock = { ...(currentStock[storeShort] || { pz: 0, cj: 0 }) };
              currentStoreStock.pz = (currentStoreStock.pz || 0) + (Number(item.qty) || 0);
              currentStock[storeShort] = currentStoreStock;

              // Recalcular porcentaje global
              const totalPzLocal = Object.values(currentStock).reduce((sum, s) => sum + (s.pz || 0) + (s.cj || 0) * 10, 0);
              const newPct = Math.min(100, Math.round((totalPzLocal / 50) * 100));

              transaction.update(pObj.ref, {
                stock: currentStock,
                pctStock: newPct
              });
            }
          }

          // Eliminar documento de venta
          const saleRef = doc(db, 'ventas', saleObj.id);
          transaction.delete(saleRef);
        });

        logSecurityEvent('VENTA_ANULADA_STOCK_REVERTIDO', { folio: saleObj.folio, total: saleObj.total });
        onShowToast('✅ Venta anulada — el stock fue devuelto correctamente');
      } catch (err) {
        console.error(err);
        onShowToast('⚠ Error al anular la venta: ' + err.message);
      }
    } else if (tx.type === 'ingreso') {
      const repoObj = repos.find(r => r.id === tx.id);
      if (!repoObj) {
        onShowToast('⚠ No se encontró el registro del ingreso');
        return;
      }

      if (!window.confirm(`¿Estás seguro de anular el ingreso de stock (${repoObj.ref || repoObj.productoNombre})? El stock ingresado será revertido.`)) {
        return;
      }

      try {
        onShowToast('⚙ Revertiendo ingreso y actualizando stock...');

        // Paso 1: Resolver referencia al producto antes de la transacción
        let prodRef = null;
        if (repoObj.productoId) {
          prodRef = doc(db, 'productos', repoObj.productoId);
        } else {
          const q = query(collection(db, 'productos'), where('nombre', '==', repoObj.productoNombre));
          const snap = await getDocs(q);
          if (!snap.empty) {
            prodRef = snap.docs[0].ref;
          }
        }

        if (!prodRef) {
          throw new Error('No se encontró el producto asociado a este ingreso');
        }

        // Paso 2: Ejecutar transacción atómica pura
        await runTransaction(db, async (transaction) => {
          const prodSnap = await transaction.get(prodRef);
          if (prodSnap.exists()) {
            const currentStock = { ...(prodSnap.data().stock || {}) };
            const storeShort = (repoObj.tienda || '').replace('Tienda ', '');
            const currentStoreStock = { ...(currentStock[storeShort] || { pz: 0, cj: 0 }) };
            const qtyNum = Number(repoObj.cantidad) || 0;

            if (repoObj.unidad === 'pz') {
              currentStoreStock.pz = Math.max(0, (currentStoreStock.pz || 0) - qtyNum);
            } else {
              currentStoreStock.cj = Math.max(0, (currentStoreStock.cj || 0) - qtyNum);
            }
            currentStock[storeShort] = currentStoreStock;

            const totalPzLocal = Object.values(currentStock).reduce((sum, s) => sum + (s.pz || 0) + (s.cj || 0) * 10, 0);
            const newPct = Math.min(100, Math.round((totalPzLocal / 50) * 100));

            transaction.update(prodRef, {
              stock: currentStock,
              pctStock: newPct
            });
          }

          const repoRef = doc(db, 'reposiciones', repoObj.id);
          transaction.delete(repoRef);
        });

        logSecurityEvent('INGRESO_STOCK_ANULADO', { ref: repoObj.ref, producto: repoObj.productoNombre });
        onShowToast('✅ Ingreso de stock anulado — el inventario fue actualizado');
      } catch (err) {
        console.error(err);
        onShowToast('⚠ Error al anular el ingreso: ' + err.message);
      }
    }
  };

  return (
    <div className="page active" id="pg-transacciones">
      <div className="section-head">
        <h2>Transacciones</h2>
        <div className="spacer"></div>
        <div className="filter-bar" style={{ margin: 0, gap: '6px' }}>
          <button className={`filter-chip ${filterTx === 'all' ? 'active' : ''}`} onClick={() => setFilterTx('all')}>Todas</button>
          <button className={`filter-chip ${filterTx === 'venta' ? 'active' : ''}`} onClick={() => setFilterTx('venta')}>Ventas</button>
          <button className={`filter-chip ${filterTx === 'ingreso' ? 'active' : ''}`} onClick={() => setFilterTx('ingreso')}>Ingresos</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="prod-search-box">
          <Search className="psb-icon-lucide" size={18} />
          <input
            type="text"
            placeholder="Buscar por folio, producto o tienda..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Buscar transacciones"
          />
        </div>
      </div>

      {/* DESKTOP TABLE VIEW */}
      <div className="card tx-table-wrap table-responsive" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ paddingLeft: '20px', width: '130px' }}>Folio / Ref</th>
              <th style={{ width: '100px' }}>Tipo</th>
              <th style={{ width: '130px' }}>Fecha</th>
              <th>Tienda</th>
              <th>Detalle / Productos</th>
              <th>Cantidad</th>
              <th>Total</th>
              {isAdmin && <th style={{ paddingRight: '20px', textAlign: 'center', width: '90px' }}>Acción</th>}
            </tr>
          </thead>
          <tbody>
            {paginatedTxs.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 8 : 7} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  No se encontraron transacciones.
                </td>
              </tr>
            ) : (
              paginatedTxs.map(t => {
                const isVenta = t.type === 'venta';
                return (
                  <tr
                    key={t.id}
                    onClick={() => handleRowClick(t)}
                    style={{ cursor: isVenta ? 'pointer' : 'default' }}
                  >
                    <td style={{ paddingLeft: '20px' }}>
                      <strong>{t.ref}</strong>
                    </td>
                    <td>
                      <span className={`tipo-badge ${isVenta ? 'tb-d' : 'tb-l'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        {isVenta ? <ShoppingBag size={11} /> : <PlusCircle size={11} />}
                        {isVenta ? 'Venta' : 'Ingreso'}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t.date}</td>
                    <td style={{ fontSize: '13px' }}>{t.store}</td>
                    <td style={{ maxWidth: '280px' }} title={t.desc}>
                      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: '500' }}>{t.desc}</div>
                      {isVenta && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                          <span style={{ color: 'var(--primary)', fontWeight: '700' }}>👤</span> {t.cliente}
                        </div>
                      )}
                    </td>
                    <td style={{ fontWeight: '600', color: isVenta ? 'var(--error)' : 'var(--primary)' }}>
                      {t.qty}
                    </td>
                    <td style={{ fontWeight: '700' }}>{t.total}</td>
                    {isAdmin && (
                      <td style={{ paddingRight: '20px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleRevertTx(t)}
                          style={{ padding: '4px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          title="Anular transacción y revertir inventario"
                        >
                          <RotateCcw size={12} /> Anular
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <Pagination
          currentPage={currentPage}
          totalItems={filteredTxs.length}
          pageSize={15}
          onPageChange={setCurrentPage}
          itemLabel="transacciones"
        />
      </div>

      {/* MOBILE CARDS VIEW */}
      <div className="tx-cards" id="tx-cards">
        {paginatedTxs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', width: '100%' }}>
            No se encontraron transacciones.
          </div>
        ) : (
          paginatedTxs.map(t => {
            const isVenta = t.type === 'venta';
            return (
              <div
                key={t.id}
                className="tx-card-m"
                onClick={() => handleRowClick(t)}
                style={{ cursor: isVenta ? 'pointer' : 'default' }}
                role="button"
                tabIndex={0}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <span className={`tipo-badge ${isVenta ? 'tb-d' : 'tb-l'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px' }}>
                      {isVenta ? <ShoppingBag size={10} /> : <PlusCircle size={10} />}
                      {isVenta ? 'Venta' : 'Ingreso'}
                    </span>
                    <strong style={{ marginLeft: '8px', fontSize: '13px' }}>{t.ref}</strong>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.date}</div>
                </div>

                <div style={{ fontSize: '12.5px', color: 'var(--text-main)', marginBottom: '4px', fontWeight: '500' }}>
                  {t.desc}
                </div>

                {isVenta && (
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    👤 Cliente: <strong style={{ color: 'var(--text-main)' }}>{t.cliente}</strong>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.store}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontWeight: '700', fontSize: '13px', color: isVenta ? 'var(--error)' : 'var(--primary)' }}>
                      {t.qty}
                    </span>
                    {isVenta && <strong style={{ fontSize: '13px' }}>{t.total}</strong>}
                    {isAdmin && (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={(e) => { e.stopPropagation(); handleRevertTx(t); }}
                        style={{ padding: '3px 6px', fontSize: '10px' }}
                        title="Anular"
                      >
                        <RotateCcw size={11} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div style={{ marginTop: '12px' }}>
          <Pagination
            currentPage={currentPage}
            totalItems={filteredTxs.length}
            pageSize={15}
            onPageChange={setCurrentPage}
            itemLabel="transacciones"
          />
        </div>
      </div>
    </div>
  );
}
