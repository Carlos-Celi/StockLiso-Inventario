import React, { useState, useMemo, useEffect } from 'react';
import { Search, UserPlus, Edit3, Trash2 } from 'lucide-react';
import { db, auth } from '../firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { sanitizeString } from '../utils/security';
import Pagination from './Pagination';

export default function Usuarios({ users, isAdmin, onOpenNewUserModal, onOpenEditUserModal, onShowToast }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const cleanQuery = useMemo(() => sanitizeString(searchQuery.trim(), 50).toLowerCase(), [searchQuery]);

  // Filtrado reactivo de usuarios
  const filteredUsers = useMemo(() => {
    if (!cleanQuery) return users;
    return users.filter(u =>
      (u.nombre || '').toLowerCase().includes(cleanQuery) ||
      (u.email || '').toLowerCase().includes(cleanQuery) ||
      (u.rol || '').toLowerCase().includes(cleanQuery) ||
      (u.tienda || '').toLowerCase().includes(cleanQuery)
    );
  }, [users, cleanQuery]);

  // Reiniciar a página 1 al buscar
  useEffect(() => {
    setCurrentPage(1);
  }, [cleanQuery]);

  // Paginación de 15 en 15
  const paginatedUsers = useMemo(() => {
    return filteredUsers.slice((currentPage - 1) * 15, currentPage * 15);
  }, [filteredUsers, currentPage]);

  const handleDeleteUser = async (id, nombre) => {
    const isSelf = auth.currentUser && auth.currentUser.uid === id;
    if (isSelf) {
      onShowToast('⚠ No puedes eliminar tu propia cuenta');
      return;
    }

    if (window.confirm(`¿Está seguro de eliminar permanentemente al usuario "${nombre}" del sistema?`)) {
      try {
        onShowToast('⚙ Eliminando usuario...');
        await deleteDoc(doc(db, 'usuarios', id));
        onShowToast('✅ Usuario eliminado');
      } catch (err) {
        console.error(err);
        onShowToast('⚠ Error al eliminar usuario: ' + err.message);
      }
    }
  };

  const rolBadgeClass = (rol) => {
    if (rol === 'Administrador') return 'rb-admin';
    if (rol === 'Vendedor') return 'rb-vendedor';
    if (rol === 'Almacenista') return 'rb-almacen';
    return 'rb-lectura';
  };

  return (
    <div className="page active" id="pg-usuarios">
      <div className="section-head">
        <h2>Usuarios</h2>
        <div className="spacer"></div>
        {isAdmin && (
          <button className="btn btn-primary btn-sm" onClick={onOpenNewUserModal}>
            + Nuevo usuario
          </button>
        )}
      </div>

      {/* BUSCADOR DE USUARIOS */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="prod-search-box">
          <Search className="psb-icon-lucide" size={18} />
          <input
            type="text"
            placeholder="Buscar usuario por nombre, correo, rol o tienda..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Buscar usuarios"
          />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }} id="users-list">
        {paginatedUsers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', width: '100%' }}>
            {users.length === 0 ? 'No hay usuarios registrados.' : 'No se encontraron usuarios coincidentes.'}
          </div>
        ) : (
          paginatedUsers.map(u => {
            const isSelf = auth.currentUser && auth.currentUser.uid === u.id;
            const initials = u.nombre ? u.nombre.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() : 'US';
            const avatarClass = `avatar-${(u.nombre ? u.nombre.length : 5) % 5}`; // Auto initials background helper

            return (
              <div
                key={u.id}
                className="user-card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '16px 20px',
                  opacity: u.activo === false ? 0.75 : 1
                }}
              >
                <div className={`user-avatar ${avatarClass}`}>{initials}</div>
                <div className="user-info" style={{ flex: 1 }}>
                  <div className="user-name" style={{ fontWeight: '700', color: 'var(--text-main)' }}>
                    {u.nombre} {isSelf && <strong>(Tú)</strong>}
                  </div>
                  <div className="user-meta" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {u.email} · {u.tienda}
                  </div>
                </div>
                {u.activo === false && (
                  <span className="role-badge rb-lectura" style={{ background: '#fee2e2', color: '#ef4444', marginRight: '8px' }}>
                    Inactivo
                  </span>
                )}
                <span className={`role-badge ${rolBadgeClass(u.rol)}`}>{u.rol}</span>

                {isAdmin && (
                  <div style={{ display: 'flex', gap: '6px', marginLeft: '12px' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => onOpenEditUserModal(u)}
                      style={{ padding: '5px 8px' }}
                      title="Editar"
                    >
                      <Edit3 size={13} />
                    </button>
                    {!isSelf && (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleDeleteUser(u.id, u.nombre)}
                        style={{ padding: '5px 8px', color: 'var(--error)' }}
                        title="Eliminar"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {filteredUsers.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <Pagination
            currentPage={currentPage}
            totalItems={filteredUsers.length}
            pageSize={15}
            onPageChange={setCurrentPage}
            itemLabel="usuarios"
          />
        </div>
      )}
    </div>
  );
}

