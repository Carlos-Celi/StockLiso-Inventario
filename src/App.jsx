import React, { useState, useEffect, Suspense, lazy } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, collection, onSnapshot, query, orderBy, deleteDoc } from 'firebase/firestore';

import {
  Eye,
  EyeOff,
  Menu,
  LayoutDashboard,
  ShoppingCart,
  Package,
  FileText,
  MoreHorizontal
} from 'lucide-react';

import Sidebar from './components/Sidebar';
import {
  sanitizeString,
  checkLoginRateLimit,
  recordFailedLoginAttempt,
  resetLoginAttempts,
  isSafeImageUrl,
  logSecurityEvent
} from './utils/security';

// Lazy loading para optimizar el bundle inicial y tiempo de carga (Code-splitting)
const Dashboard = lazy(() => import('./components/Dashboard'));
const Ventas = lazy(() => import('./components/Ventas'));
const Stock = lazy(() => import('./components/Stock'));
const AgregarProducto = lazy(() => import('./components/AgregarProducto'));
const Tiendas = lazy(() => import('./components/Tiendas'));
const Transacciones = lazy(() => import('./components/Transacciones'));
const Usuarios = lazy(() => import('./components/Usuarios'));

// Modals Lazy Loaded
const ModalProducto = lazy(() => import('./components/Modals/ModalProducto'));
const ModalStockTienda = lazy(() => import('./components/Modals/ModalStockTienda'));
const ModalTienda = lazy(() => import('./components/Modals/ModalTienda'));
const ModalEditarProducto = lazy(() => import('./components/Modals/ModalEditarProducto'));
const ModalEditarUsuario = lazy(() => import('./components/Modals/ModalEditarUsuario'));
const ModalNuevoUsuario = lazy(() => import('./components/Modals/ModalNuevoUsuario'));
const ModalVenta = lazy(() => import('./components/Modals/ModalVenta'));

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activePage, setActivePage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // React states representing DB collections
  const [products, setProducts] = useState([]);
  const [stores, setStores] = useState([]);
  const [sales, setSales] = useState([]);
  const [repos, setRepos] = useState([]);
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);

  // Toast state
  const [toastMsg, setToastMsg] = useState('');
  const [showToast, setShowToast] = useState(false);

  // Modals Visibility
  const [modalStates, setModalStates] = useState({
    productDetail: false,
    stockTienda: false,
    tienda: false,
    editProducto: false,
    editUsuario: false,
    nuevoUsuario: false,
    saleDetail: false,
    lightbox: false
  });

  // Active items for detail overlays
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedStore, setSelectedStore] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedSale, setSelectedSale] = useState(null);
  const [lightboxUrl, setLightboxUrl] = useState('');

  // Local Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  // Trigger Toast helper
  const triggerToast = (msg) => {
    setToastMsg(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2800);
  };

  // Auth Status listener con suscripción reactiva a cambios de perfil en tiempo real (OWASP A07)
  useEffect(() => {
    let unsubProfile = () => {};

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setAuthLoading(true);
      unsubProfile();

      if (user) {
        try {
          // Escuchar cambios de perfil en tiempo real (ej. si el admin desactiva la cuenta)
          unsubProfile = onSnapshot(doc(db, 'usuarios', user.uid), async (docSnap) => {
            if (!docSnap.exists()) {
              triggerToast('⚠ Error: Perfil de usuario no encontrado.');
              logSecurityEvent('SESIÓN_REVOCADA_PERFIL_INEXISTENTE', { uid: user.uid });
              await signOut(auth);
              setCurrentUser(null);
              setProfile(null);
            } else {
              const profileData = docSnap.data();
              if (profileData.activo === false) {
                triggerToast('⚠ Su cuenta ha sido desactivada por un administrador.');
                logSecurityEvent('SESIÓN_REVOCADA_CUENTA_DESACTIVADA', { uid: user.uid });
                await signOut(auth);
                setCurrentUser(null);
                setProfile(null);
              } else {
                setCurrentUser(user);
                setProfile(profileData);
              }
            }
          }, (err) => {
            console.error('Error al escuchar perfil:', err);
            triggerToast('⚠ Error al sincronizar perfil');
          });
        } catch (err) {
          console.error(err);
          triggerToast('⚠ Error de autenticación: ' + err.message);
          await signOut(auth);
        }
      } else {
        setCurrentUser(null);
        setProfile(null);
      }
      setAuthLoading(false);
    });

    return () => {
      unsubscribe();
      unsubProfile();
    };
  }, []);

  // Firestore collections listeners optimizados
  useEffect(() => {
    if (!currentUser || !profile) {
      setProducts([]);
      setStores([]);
      setSales([]);
      setRepos([]);
      setUsers([]);
      setClients([]);
      return;
    }

    const unsubStores = onSnapshot(collection(db, 'tiendas'), (snap) => {
      setStores(snap.docs.map(d => ({
        id: d.id,
        nombre: d.data().nombre || '',
        direccion: d.data().direccion || '',
        activa: d.data().activa !== false
      })));
    });

    const unsubClients = onSnapshot(query(collection(db, 'clientes'), orderBy('nombre', 'asc')), (snap) => {
      setClients(snap.docs.map(d => ({
        id: d.id,
        nombre: d.data().nombre || '',
        documento: d.data().documento || '',
        telefono: d.data().telefono || '',
        email: d.data().email || '',
        direccion: d.data().direccion || ''
      })));
    });

    const unsubProd = onSnapshot(collection(db, 'productos'), (snap) => {
      setProducts(snap.docs.map(d => ({
        id: d.id,
        name: d.data().nombre || '',
        tipo: d.data().tipo || '',
        icon: d.data().icono || '',
        precio: Number(d.data().precioPz) || 0,
        precioCaja: Number(d.data().precioCaja) || 0,
        stock: d.data().stock || {},
        pct: Number(d.data().pctStock) || 0,
        descripcion: d.data().descripcion || '',
        oculto: !!d.data().oculto
      })));
    });

    const unsubSales = onSnapshot(query(collection(db, 'ventas'), orderBy('creadoEn', 'desc')), (snap) => {
      setSales(snap.docs.map(d => ({
        id: d.id,
        folio: d.data().folio || '',
        fecha: d.data().fecha || '',
        tienda: d.data().tienda || '',
        productos: d.data().productos || [],
        total: d.data().total || 0,
        hasImg: d.data().tieneComprobante || false,
        urlComprobante: d.data().urlComprobante || '',
        notas: d.data().notas || '',
        cliente: d.data().cliente || null,
        clienteNombre: d.data().clienteNombre || (d.data().cliente && d.data().cliente.nombre) || 'Público General',
        clienteDocumento: d.data().clienteDocumento || (d.data().cliente && d.data().cliente.documento) || '',
        clienteTelefono: d.data().clienteTelefono || (d.data().cliente && d.data().cliente.telefono) || '',
        registradoPor: d.data().registradoPor || '',
        creadoEnRaw: d.data().creadoEn
      })));
    });

    const unsubRepos = onSnapshot(collection(db, 'reposiciones'), (snap) => {
      setRepos(snap.docs.map(d => ({
        id: d.id,
        ref: d.data().ref || '',
        productoId: d.data().productoId || '',
        productoNombre: d.data().productoNombre || '',
        tienda: d.data().tienda || '',
        cantidad: Number(d.data().cantidad) || 0,
        unidad: d.data().unidad || 'pz',
        fecha: d.data().fecha || '',
        creadoEn: d.data().creadoEn
      })));
    });

    let unsubUsers = () => {};
    if (profile.rol === 'Administrador') {
      unsubUsers = onSnapshot(collection(db, 'usuarios'), (snap) => {
        setUsers(snap.docs.map(d => ({
          id: d.id,
          nombre: d.data().nombre || '',
          email: d.data().email || '',
          rol: d.data().rol || 'Vendedor',
          tienda: d.data().tienda || 'Todas las tiendas',
          activo: d.data().activo !== false
        })));
      });
    }

    return () => {
      unsubStores();
      unsubClients();
      unsubProd();
      unsubSales();
      unsubRepos();
      unsubUsers();
    };
  }, [currentUser, profile]);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    const email = sanitizeString(loginEmail.trim(), 100);
    const pass = loginPass.trim();

    // Verificación de Rate Limiting (OWASP A07 - Prevención de fuerza bruta)
    const rateStatus = checkLoginRateLimit();
    if (rateStatus.locked) {
      triggerToast(`⏳ Demasiados intentos fallidos. Espere ${rateStatus.remainingSeconds}s.`);
      logSecurityEvent('LOGIN_BLOQUEADO_POR_RATE_LIMIT', { email });
      return;
    }

    if (!email || !pass) {
      triggerToast('⚠ Completa usuario y contraseña');
      return;
    }

    try {
      setLoginLoading(true);
      triggerToast('🔑 Iniciando sesión...');
      await signInWithEmailAndPassword(auth, email, pass);
      resetLoginAttempts();
      setLoginPass('');
      logSecurityEvent('LOGIN_EXITOSO', { email });
    } catch (err) {
      console.error(err);
      const limitResult = recordFailedLoginAttempt();
      logSecurityEvent('LOGIN_FALLIDO', { email, attempts: limitResult.attempts });

      if (limitResult.locked) {
        triggerToast(`🛑 Cuenta bloqueada por 60s tras 5 intentos fallidos.`);
      } else {
        const remaining = 5 - limitResult.attempts;
        triggerToast(`⚠ Credenciales incorrectas (${remaining} intentos restantes)`);
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleOpenProductDetail = (productId) => {
    const p = products.find(x => x.id === productId);
    if (p) {
      setSelectedProduct(p);
      setModalStates(prev => ({ ...prev, productDetail: true }));
    }
  };

  const handleOpenStockModal = (productId) => {
    const p = products.find(x => x.id === productId);
    if (p) {
      setSelectedProduct(p);
      setModalStates(prev => ({ ...prev, stockTienda: true }));
    }
  };

  const handleOpenSaleDetail = (saleId) => {
    const s = sales.find(x => x.id === saleId);
    if (s) {
      setSelectedSale(s);
      setModalStates(prev => ({ ...prev, saleDetail: true }));
    }
  };

  const handleOpenEditProduct = (product) => {
    setSelectedProduct(product);
    setModalStates(prev => ({ ...prev, editProducto: true }));
  };

  const handleOpenStoreModal = (store = null) => {
    setSelectedStore(store);
    setModalStates(prev => ({ ...prev, tienda: true }));
  };

  const handleOpenEditUserModal = (user) => {
    setSelectedUser(user);
    setModalStates(prev => ({ ...prev, editUsuario: true }));
  };

  const handleOpenLightbox = (url) => {
    if (url && isSafeImageUrl(url)) {
      setLightboxUrl(url);
      setModalStates(prev => ({ ...prev, lightbox: true }));
    } else {
      triggerToast('⚠ Imagen no válida o formato no permitido');
    }
  };

  const handleDeleteProduct = async (id) => {
    const p = products.find(x => x.id === id);
    if (!p) return;
    if (window.confirm(`¿Está seguro de eliminar el producto "${p.name}" permanentemente?`)) {
      try {
        triggerToast('⚙ Eliminando producto...');
        await deleteDoc(doc(db, 'productos', id));
        logSecurityEvent('PRODUCTO_ELIMINADO', { id, name: p.name });
        triggerToast('✅ Producto eliminado');
        setModalStates(prev => ({ ...prev, productDetail: false }));
      } catch (err) {
        console.error(err);
        triggerToast('⚠ Error al eliminar producto: ' + err.message);
      }
    }
  };

  if (authLoading) {
    return (
      <div style={{ display: 'flex', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', color: 'var(--primary)', fontWeight: '700', fontSize: '15px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>📦</div>
          Cargando StockLiso...
        </div>
      </div>
    );
  }

  // LOGIN PAGE
  if (!currentUser) {
    return (
      <div className="login-backdrop" id="page-login" style={{ display: 'flex' }}>
        <form onSubmit={handleLoginSubmit} className="login-card" noValidate>
          <div className="login-header">
            <div className="login-logo">SL</div>
            <h2>StockLiso</h2>
            <p>Inicie sesión para acceder al inventario cerámico</p>
          </div>
          <div className="form-group">
            <label htmlFor="login-email">Correo electrónico</label>
            <input
              id="login-email"
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="admin@empresa.com"
              autoComplete="username"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="login-password">Contraseña</label>
            <div className="password-input-wrap">
              <input
                id="login-password"
                type={showLoginPass ? 'text' : 'password'}
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowLoginPass(!showLoginPass)}
                title={showLoginPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                aria-label={showLoginPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showLoginPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button type="submit" className="btn btn-primary btn-full" style={{ marginTop: '10px' }} disabled={loginLoading}>
            {loginLoading ? 'Ingresando...' : 'Ingresar al sistema'}
          </button>
        </form>
        {showToast && <div className="toast show" role="alert">{toastMsg}</div>}
      </div>
    );
  }

  const isAdmin = profile?.rol === 'Administrador';

  const pageTitles = {
    dashboard: 'Dashboard',
    ventas: 'Registrar Venta',
    stock: 'Stock & Productos',
    agregar: 'Agregar Producto',
    tiendas: 'Tiendas',
    transacciones: 'Transacciones',
    usuarios: 'Usuarios'
  };

  return (
    <div className="app" style={{ display: 'flex' }}>
      {/* MOBILE TOPBAR */}
      <header className="mobile-header">
        <button
          className="mobile-hamburger-btn"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Abrir menú de navegación"
        >
          <Menu size={22} />
        </button>
        <div className="mobile-brand-title">
          <span className="mb-app">StockLiso</span>
          <span className="mb-page"> · {pageTitles[activePage] || 'Sistema'}</span>
        </div>
      </header>

      {/* BACKDROP OVERLAY FOR MOBILE SIDEBAR */}
      {sidebarOpen && (
        <div
          className="sidebar-backdrop open"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* SIDEBAR NAVIGATION */}
      <Sidebar
        activePage={activePage}
        onNavigate={(page) => {
          setActivePage(page);
          setSidebarOpen(false);
        }}
        profile={profile}
        onShowToast={triggerToast}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* MAIN VIEW CONTENT CONTAINER CON SUSPENSE */}
      <main className="main">
        <Suspense fallback={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--primary)', fontWeight: '600' }}>
            Cargando vista...
          </div>
        }>
          {activePage === 'dashboard' && (
            <Dashboard
              products={products}
              sales={sales}
              onOpenStockModal={handleOpenStockModal}
              onOpenSaleDetail={handleOpenSaleDetail}
              onNavigate={setActivePage}
            />
          )}
          {activePage === 'ventas' && (
            <Ventas
              products={products}
              stores={stores}
              clients={clients}
              onShowToast={triggerToast}
            />
          )}
          {activePage === 'stock' && (
            <Stock
              products={products}
              onOpenProductDetail={handleOpenProductDetail}
            />
          )}
          {activePage === 'agregar' && isAdmin && (
            <AgregarProducto
              stores={stores}
              onNavigate={setActivePage}
              onShowToast={triggerToast}
            />
          )}
          {activePage === 'tiendas' && isAdmin && (
            <Tiendas
              stores={stores}
              products={products}
              isAdmin={isAdmin}
              onOpenStoreModal={handleOpenStoreModal}
              onShowToast={triggerToast}
            />
          )}
          {activePage === 'transacciones' && (
            <Transacciones
              sales={sales}
              repos={repos}
              products={products}
              clients={clients}
              isAdmin={isAdmin}
              onOpenSaleDetail={handleOpenSaleDetail}
              onShowToast={triggerToast}
            />
          )}
          {activePage === 'usuarios' && isAdmin && (
            <Usuarios
              users={users}
              isAdmin={isAdmin}
              onOpenNewUserModal={() => setModalStates(prev => ({ ...prev, nuevoUsuario: true }))}
              onOpenEditUserModal={handleOpenEditUserModal}
              onShowToast={triggerToast}
            />
          )}
        </Suspense>
      </main>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="mobile-nav" aria-label="Navegación móvil inferior">
        <div
          className={`mn-item ${activePage === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActivePage('dashboard')}
          role="button"
          tabIndex={0}
        >
          <LayoutDashboard size={20} className="mn-icon" />
          <span>Inicio</span>
        </div>
        <div
          className={`mn-item ${activePage === 'ventas' ? 'active' : ''}`}
          onClick={() => setActivePage('ventas')}
          role="button"
          tabIndex={0}
        >
          <ShoppingCart size={20} className="mn-icon" />
          <span>Ventas</span>
        </div>
        <div
          className={`mn-item ${activePage === 'stock' ? 'active' : ''}`}
          onClick={() => setActivePage('stock')}
          role="button"
          tabIndex={0}
        >
          <Package size={20} className="mn-icon" />
          <span>Stock</span>
        </div>
        <div
          className={`mn-item ${activePage === 'transacciones' ? 'active' : ''}`}
          onClick={() => setActivePage('transacciones')}
          role="button"
          tabIndex={0}
        >
          <FileText size={20} className="mn-icon" />
          <span>Historial</span>
        </div>
        <div
          className="mn-item"
          onClick={() => setSidebarOpen(true)}
          role="button"
          tabIndex={0}
        >
          <MoreHorizontal size={20} className="mn-icon" />
          <span>Menú</span>
        </div>
      </nav>

      {/* OVERLAY MODALS CON SUSPENSE */}
      <Suspense fallback={null}>
        {modalStates.productDetail && (
          <ModalProducto
            isOpen={modalStates.productDetail}
            onClose={() => setModalStates(prev => ({ ...prev, productDetail: false }))}
            product={selectedProduct}
            stores={stores}
            sales={sales}
            repos={repos}
            isAdmin={isAdmin}
            onEdit={handleOpenEditProduct}
            onDelete={handleDeleteProduct}
            onOpenSaleDetail={handleOpenSaleDetail}
            onShowToast={triggerToast}
          />
        )}

        {modalStates.stockTienda && (
          <ModalStockTienda
            isOpen={modalStates.stockTienda}
            onClose={() => setModalStates(prev => ({ ...prev, stockTienda: false }))}
            product={selectedProduct}
            stores={stores}
            onOpenProductDetail={handleOpenProductDetail}
          />
        )}

        {modalStates.tienda && (
          <ModalTienda
            isOpen={modalStates.tienda}
            onClose={() => setModalStates(prev => ({ ...prev, tienda: false }))}
            store={selectedStore}
            onShowToast={triggerToast}
          />
        )}

        {modalStates.editProducto && (
          <ModalEditarProducto
            isOpen={modalStates.editProducto}
            onClose={() => setModalStates(prev => ({ ...prev, editProducto: false }))}
            product={selectedProduct}
            onShowToast={triggerToast}
          />
        )}

        {modalStates.editUsuario && (
          <ModalEditarUsuario
            isOpen={modalStates.editUsuario}
            onClose={() => setModalStates(prev => ({ ...prev, editUsuario: false }))}
            user={selectedUser}
            stores={stores}
            onShowToast={triggerToast}
          />
        )}

        {modalStates.nuevoUsuario && (
          <ModalNuevoUsuario
            isOpen={modalStates.nuevoUsuario}
            onClose={() => setModalStates(prev => ({ ...prev, nuevoUsuario: false }))}
            stores={stores}
            onShowToast={triggerToast}
          />
        )}

        {modalStates.saleDetail && (
          <ModalVenta
            isOpen={modalStates.saleDetail}
            onClose={() => setModalStates(prev => ({ ...prev, saleDetail: false }))}
            sale={selectedSale}
            onOpenLightbox={handleOpenLightbox}
          />
        )}
      </Suspense>

      {/* RECEIPT LIGHTBOX */}
      {modalStates.lightbox && (
        <div className="lightbox" style={{ display: 'flex' }} onClick={() => setModalStates(prev => ({ ...prev, lightbox: false }))}>
          <button className="lightbox-close" onClick={() => setModalStates(prev => ({ ...prev, lightbox: false }))} aria-label="Cerrar imagen">✕</button>
          <img src={lightboxUrl} alt="Comprobante de Pago" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {/* TOAST SYSTEM CONTAINER */}
      {showToast && <div className="toast show" role="alert">{toastMsg}</div>}
    </div>
  );
}
