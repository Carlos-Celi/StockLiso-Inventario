import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({
  currentPage = 1,
  totalItems = 0,
  pageSize = 15,
  onPageChange,
  itemLabel = 'elementos'
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  if (totalItems === 0) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Generador de lista de páginas con elipsis inteligente
  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) {
        pages.push('ellipsis-left');
      }

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push('ellipsis-right');
      }
      if (!pages.includes(totalPages)) {
        pages.push(totalPages);
      }
    }
    return pages;
  };

  const pages = getPageNumbers();

  return (
    <div className="pagination-wrap">
      <div className="pagination-info">
        Mostrando <strong>{startItem}</strong>–<strong>{endItem}</strong> de <strong>{totalItems}</strong> {itemLabel}
      </div>

      {totalPages > 1 && (
        <div className="pagination-controls" role="navigation" aria-label="Paginación de resultados">
          <button
            type="button"
            className="pagination-btn nav-btn"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            aria-label="Ir a la página anterior"
          >
            <ChevronLeft size={15} />
            <span className="pagination-text-btn">Anterior</span>
          </button>

          <div className="pagination-pages">
            {pages.map((p, idx) => {
              if (p === 'ellipsis-left' || p === 'ellipsis-right') {
                return (
                  <span key={`${p}-${idx}`} className="pagination-ellipsis">
                    …
                  </span>
                );
              }
              const isActive = p === currentPage;
              return (
                <button
                  key={p}
                  type="button"
                  className={`pagination-btn num-btn ${isActive ? 'active' : ''}`}
                  onClick={() => onPageChange(p)}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={`Página ${p}`}
                >
                  {p}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="pagination-btn nav-btn"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            aria-label="Ir a la página siguiente"
          >
            <span className="pagination-text-btn">Siguiente</span>
            <ChevronRight size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
