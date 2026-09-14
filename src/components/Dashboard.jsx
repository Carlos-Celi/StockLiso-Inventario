import React, { useState, useMemo } from 'react';
import { Search, ArrowRight, FileText } from 'lucide-react';
import { sanitizeString } from '../utils/security';

export default function Dashboard({ products, sales, onOpenStockModal, onOpenSaleDetail, onNavigate }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  // Memoización reactiva de estadísticas generales de inventario (Optimización de rendimiento)
  const { totalPz, totalCj, totalValue, lowStockCount } = useMemo(() => {
    let pzCount = 0;
    let cjCount = 0;
    let valueAcc = 0;
    let lowCount = 0;

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      if (p.oculto) continue;

      const stocks = p.stock ? Object.values(p.stock) : [];
      let pPz = 0;
      let pCj = 0;
      for (let j = 0; j < stocks.length; j++) {
        pPz += stocks[j].pz || 0;
        pCj += stocks[j].cj || 0;
      }

      pzCount += pPz;
      cjCount += pCj;
      valueAcc += (pPz * (p.precio || 0)) + (pCj * (p.precioCaja || 0));

      if (p.pct <= 25) {
        lowCount++;
      }
    }

    return {
      totalPz: pzCount,
      totalCj: cjCount,
      totalValue: valueAcc,
      lowStockCount: lowCount
    };
  }, [products]);

  // Memoización reactiva de gráfico y métricas semanales
  const { weekData, maxVal, totalWeeklyVal, totalWeeklySales, bestDay } = useMemo(() => {
    const daysShort = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const monthsShort = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const days = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      d.setHours(0, 0, 0, 0);
      days.push({
        day: daysShort[d.getDay()],
        val: 0,
        sales: 0,
        date: `${d.getDate()} ${monthsShort[d.getMonth()]}`,
        dateKey: d.toDateString(),
        today: i === 0
      });
    }

    sales.forEach(v => {
      if (v.creadoEnRaw) {
        const date = v.creadoEnRaw.toDate ? v.creadoEnRaw.toDate() : new Date(v.creadoEnRaw);
        const dateKey = date.toDateString();
        const dayObj = days.find(wd => wd.dateKey === dateKey);
        if (dayObj) {
          dayObj.val += (Number(v.total) || 0);
          dayObj.sales += 1;
        }
      }
    });

    const max = Math.max(...days.map(d => d.val), 1);
    const weeklyVal = days.reduce((s, d) => s + d.val, 0);
    const weeklySales = days.reduce((s, d) => s + d.sales, 0);
    const topDay = days.reduce((a, b) => b.val > a.val ? b : a, { day: '—', val: 0 });

    return {
      weekData: days,
      maxVal: max,
      totalWeeklyVal: weeklyVal,
      totalWeeklySales: weeklySales,
      bestDay: topDay
    };
  }, [sales]);

  // Autocomplete reactivo y memoizado
  const sanitizedQuery = useMemo(() => sanitizeString(searchQuery.trim(), 50).toLowerCase(), [searchQuery]);

  const matches = useMemo(() => {
    if (!sanitizedQuery) return [];
    return products.filter(p => !p.oculto && (
      p.name.toLowerCase().includes(sanitizedQuery) || 
      p.tipo.toLowerCase().includes(sanitizedQuery)
    ));
  }, [products, sanitizedQuery]);

  const handleSearchSelect = (productId) => {
    setSearchQuery('');
    setShowDropdown(false);
    onOpenStockModal(productId);
  };

  const getProductBadge = (name, tipo) => {
    const initials = name ? name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'PR';
    const badgeClass = tipo === 'Listelo' ? 'tb-l' : 'tb-d';
    return <div className={`prod-badge-avatar ${badgeClass}`}>{initials}</div>;
  };

  return (
    <div className="page active" id="pg-dashboard">
      <div className="section-head">
        <h2>Dashboard</h2>
      </div>

      {/* BUSCADOR DE ANCHO COMPLETO */}
      <div style={{ position: 'relative', marginBottom: '24px' }}>
        <div className="prod-search-box">
          <Search className="psb-icon-lucide" size={18} />
          <input
            type="text"
            id="dash-search"
            placeholder="Buscar stock de un producto específico (ej. Mármol Blanco)..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
            style={{ padding: '14px 16px 14px 46px', fontSize: '15px' }}
          />
        </div>
        {showDropdown && searchQuery.trim() && (
          <div className="ds-dropdown open" id="ds-dropdown">
            {matches.length === 0 ? (
              <div className="ds-drop-empty">Sin resultados para "<strong>{sanitizeString(searchQuery, 30)}</strong>"</div>
            ) : (
              matches.map(p => {
                const pz = Object.values(p.stock || {}).reduce((sum, t) => sum + (t.pz || 0), 0);
                const cj = Object.values(p.stock || {}).reduce((sum, t) => sum + (t.cj || 0), 0);
                return (
                  <div key={p.id} className="ds-drop-item" onClick={() => handleSearchSelect(p.id)}>
                    <div className="ds-drop-icon">{getProductBadge(p.name, p.tipo)}</div>
                    <div style={{ flex: 1 }}>
                      <div className="ds-drop-name">{p.name}</div>
                      <div className="ds-drop-meta">
                        <span className={`tipo-badge ${p.tipo === 'Listelo' ? 'tb-l' : 'tb-d'}`} style={{ fontSize: '9px' }}>{p.tipo}</span> &nbsp;·&nbsp; {pz} pz · {cj} cj
                      </div>
                    </div>
                    <span className="ds-drop-ver">Ver stock →</span>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* TARJETAS MÉTRICAS */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Stock Total</div>
          <div className="stat-val">{totalPz.toLocaleString()} pz</div>
          <div className="stat-sub">{totalCj.toLocaleString()} cajas en stock</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Valorización de Inventario</div>
          <div className="stat-val">S/. {totalValue.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div className="stat-sub">Valor de activos en almacén</div>
        </div>
        <div className="stat-card sc-g">
          <div className="stat-label">Ventas Semanales</div>
          <div className="stat-val">S/. {totalWeeklyVal.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div className="stat-sub">{totalWeeklySales} ventas en 7 días</div>
        </div>
        <div className="stat-card sc-r">
          <div className="stat-label">Productos con Bajo Stock</div>
          <div className="stat-val">{lowStockCount}</div>
          <div className="stat-sub">Requieren reabastecimiento (≤25%)</div>
        </div>
      </div>

      {/* GRÁFICO SEMANAL Y ÚLTIMAS VENTAS */}
      <div className="two-col" style={{ gridTemplateColumns: '1.6fr 1fr' }}>
        <div className="card" style={{ flex: 1.6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: 'var(--text-main)' }}>Desempeño Semanal</h3>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Montos de venta en los últimos 7 días</div>
            </div>
            <div className="week-summary" id="week-summary" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span className="ws-chip"><strong>{totalWeeklySales}</strong> ventas</span>
              <span className="ws-chip">Mejor día: <strong>{bestDay.day} S/.{bestDay.val.toLocaleString()}</strong></span>
            </div>
          </div>
          <div className="week-chart" id="week-chart">
            {weekData.map((d, idx) => (
              <div key={idx} className="wc-col">
                <div className="wc-val">
                  {d.val ? 'S/.' + d.val.toLocaleString() : ''}
                </div>
                <div className="wc-bar-wrap">
                  <div
                    className={`wc-bar ${d.today ? 'today' : ''} ${!d.val ? 'zero' : ''}`}
                    style={{
                      height: `${d.val ? Math.round((d.val / maxVal) * 88) : 6}px`
                    }}
                  >
                    <div className="wc-tooltip">{d.date} · {d.sales} ventas · S/.{d.val}</div>
                  </div>
                </div>
                <div className="wc-day">
                  {d.day}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ÚLTIMAS VENTAS */}
        <div className="card" style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: 'var(--text-main)' }}>Últimas ventas</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('transacciones')} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', padding: '4px 8px' }}>
              Ver todas <ArrowRight size={12} />
            </button>
          </div>
          <div className="venta-history" id="dash-ventas">
            {sales.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '24px' }}>
                Aún no hay ventas registradas.
              </div>
            ) : (
              sales.slice(0, 5).map(v => {
                const names = v.productos.map(p => p.nombre || p.name).join(', ');
                return (
                  <div key={v.id} className="venta-item" onClick={() => onOpenSaleDetail(v.id)}>
                    <div className={`venta-thumb ${v.hasImg ? 'has-img' : ''}`}>
                      <FileText size={15} />
                    </div>
                    <div className="venta-info">
                      <div className="vi-name">{names}</div>
                      <div className="vi-meta">{v.tienda} · {v.fecha}</div>
                    </div>
                    <span className="venta-monto">S/. {Number(v.total).toLocaleString()}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
