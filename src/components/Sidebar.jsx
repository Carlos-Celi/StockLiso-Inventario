import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  PlusCircle,
  Store,
  FileText,
  Users,
  LogOut,
  X
} from 'lucide-react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

export default function Sidebar({ activePage, onNavigate, profile, onShowToast, isOpen, onClose }) {
  const handleLogout = async () => {
    try {
      if (onClose) onClose();
      onShowToast('👋 Cerrando sesión...');
      await signOut(auth);
    } catch (err) {
      console.error(err);
    }
  };

  if (!profile) return null;

  const initials = profile.nombre
    ? profile.nombre.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : 'US';

  const isAdmin = profile.rol === 'Administrador';

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, visible: true },
    { id: 'ventas', label: 'Registrar Venta', icon: ShoppingCart, visible: true },
    { id: 'stock', label: 'Stock & Productos', icon: Package, visible: true },
    { id: 'agregar', label: 'Agregar Producto', icon: PlusCircle, visible: isAdmin },
    { id: 'tiendas', label: 'Tiendas', icon: Store, visible: isAdmin },
    { id: 'transacciones', label: 'Transacciones', icon: FileText, visible: true },
    { id: 'usuarios', label: 'Usuarios', icon: Users, visible: isAdmin },
  ];

  const handleItemClick = (id) => {
    onNavigate(id);
    if (onClose) onClose();
  };

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-logo">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div>
            <div className="brand">StockLiso</div>
            <div className="sub">Inventario Cerámico</div>
          </div>
          {onClose && (
            <button className="sidebar-close-btn" onClick={onClose} aria-label="Cerrar menú">
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      <div className="sidebar-user">
        <div className="avatar">{initials}</div>
        <div className="profile-info">
          <div className="uname">{profile.nombre}</div>
          <div className="urole">{profile.rol}</div>
        </div>
      </div>

      <nav className="sidebar-menu">
        {menuItems.filter(item => item.visible).map(item => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              className={`nav-item ${activePage === item.id ? 'active' : ''}`}
              onClick={() => handleItemClick(item.id)}
            >
              <Icon size={16} />
              {item.label}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <button className="btn btn-secondary btn-full btn-sm logout-btn" onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <LogOut size={14} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

