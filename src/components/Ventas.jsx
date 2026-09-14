import React, { useState, useMemo, useEffect } from 'react';
import { Search, ShoppingCart, Image as ImageIcon, Trash2, Plus, Minus, UserPlus } from 'lucide-react';
import { db, auth } from '../firebase';
import { runTransaction, doc, collection, serverTimestamp } from 'firebase/firestore';
import { sanitizeString, sanitizeNumber, sanitizeInteger, logSecurityEvent } from '../utils/security';
import Pagination from './Pagination';

export default function Ventas({ products, stores, clients = [], onShowToast }) {
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [tienda, setTienda] = useState('');
  const [catalogStore, setCatalogStore] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [notas, setNotas] = useState('');
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados de Cliente
  const [selectedClientId, setSelectedClientId] = useState('general');
  const [clientName, setClientName] = useState('Público General');
  const [clientDoc, setClientDoc] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [isNewClient, setIsNewClient] = useState(false);

  // Estado de Paginación para Catálogo (15 en 15)
  const [catalogPage, setCatalogPage] = useState(1);

  // Auto-set initial store names
  useEffect(() => {
    if (stores && stores.length > 0) {
      if (!tienda) setTienda(stores[0].nombre);
      if (!catalogStore) setCatalogStore(stores[0].nombre);
    }
  }, [stores, tienda, catalogStore]);

  // Image compression function
  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const max_width = 500;
          const scale = max_width / img.width;
          canvas.width = max_width;
          canvas.height = img.height * scale;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.65));
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validación estricta de archivo según OWASP A03 / A04
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        onShowToast('⚠ Solo se admiten imágenes válidas (JPG, PNG o WebP)');
        e.target.value = '';
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        onShowToast('⚠ La imagen excede el límite de 5 MB');
        e.target.value = '';
        return;
      }

      setReceiptFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setReceiptPreview(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearReceipt = () => {
    setReceiptFile(null);
    setReceiptPreview('');
    const fileEl = document.getElementById('file-input');
    if (fileEl) fileEl.value = '';
  };

  const addToCart = (product) => {
    if (!stores || stores.length === 0) {
      onShowToast('⚠ Crea una tienda primero antes de agregar productos al carrito');
      return;
    }

    let targetOriginStore = catalogStore && catalogStore !== 'all' ? catalogStore : (tienda || stores[0].nombre);
    let targetOriginShort = targetOriginStore.replace('Tienda ', '');
    let availablePz = product.stock && product.stock[targetOriginShort] ? product.stock[targetOriginShort].pz || 0 : 0;

    if (catalogStore === 'all' && availablePz <= 0) {
      const availableStoreObj = stores.find(s => {
        const sShort = s.nombre.replace('Tienda ', '');
        return product.stock && product.stock[sShort] && product.stock[sShort].pz > 0;
      });
      if (availableStoreObj) {
        targetOriginStore = availableStoreObj.nombre;
        targetOriginShort = targetOriginStore.replace('Tienda ', '');
        availablePz = product.stock[targetOriginShort].pz || 0;
      }
    }

    if (availablePz <= 0) {
      onShowToast(`⚠ ${product.name} no tiene stock disponible en ${targetOriginStore}`);
      return;
    }

    const existingIndex = cart.findIndex(i => i.id === product.id && i.tiendaOrigen === targetOriginStore);

    if (existingIndex >= 0) {
      const existingItem = cart[existingIndex];
      if (existingItem.qty >= availablePz) {
        onShowToast(`⚠ Stock máximo alcanzado para ${product.name} en ${targetOriginStore} (${availablePz} pz disponibles)`);
        return;
      }
      setCart(cart.map((i, idx) => idx === existingIndex ? { ...i, qty: i.qty + 1 } : i));
    } else {
      setCart([...cart, {
        id: product.id,
        name: product.name,
        tipo: product.tipo,
        qty: 1,
        pu: product.precio,
        tiendaOrigen: targetOriginStore
      }]);
    }
    onShowToast(`+1 ${product.name} (${targetOriginStore})`);
  };

  const updateCartQty = (id, tiendaOrigen, delta) => {
    setCart(cart.map(i => {
      if (i.id === id && i.tiendaOrigen === tiendaOrigen) {
        const prod = products.find(p => p.id === id);
        const storeShort = tiendaOrigen.replace('Tienda ', '');
        const availablePz = prod && prod.stock && prod.stock[storeShort] ? prod.stock[storeShort].pz || 0 : 0;

        const currentQty = typeof i.qty === 'number' ? i.qty : 1;
        const newQty = currentQty + delta;

        if (delta > 0 && newQty > availablePz) {
          onShowToast(`⚠ Solo hay ${availablePz} pz disponibles en ${tiendaOrigen}`);
          return i;
        }

        return { ...i, qty: Math.max(1, newQty) };
      }
      return i;
    }));
  };

  const updateCartQtyDirect = (id, tiendaOrigen, value) => {
    setCart(cart.map(i => {
      if (i.id === id && i.tiendaOrigen === tiendaOrigen) {
        const prod = products.find(p => p.id === id);
        const storeShort = tiendaOrigen.replace('Tienda ', '');
        const availablePz = prod && prod.stock && prod.stock[storeShort] ? prod.stock[storeShort].pz || 0 : 0;

        if (value === '') return { ...i, qty: '' };
        let parsed = parseInt(value, 10);
        if (isNaN(parsed) || parsed < 1) parsed = 1;
        if (parsed > availablePz) {
          parsed = availablePz;
          onShowToast(`⚠ Stock máximo alcanzado (${availablePz} pz disponibles)`);
        }
        return { ...i, qty: parsed };
      }
      return i;
    }));
  };

  const handleQtyBlur = (id, tiendaOrigen) => {
    setCart(cart.map(i => {
      if (i.id === id && i.tiendaOrigen === tiendaOrigen) {
        if (i.qty === '' || typeof i.qty !== 'number' || i.qty < 1) {
          return { ...i, qty: 1 };
        }
      }
      return i;
    }));
  };

  const updateItemPrice = (id, tiendaOrigen, value) => {
    setCart(cart.map(i => {
      if (i.id === id && i.tiendaOrigen === tiendaOrigen) {
        if (value === '') return { ...i, pu: '' };
        const parsed = Math.max(0, parseFloat(value) || 0);
        return { ...i, pu: parsed };
      }
      return i;
    }));
  };

  const handlePriceBlur = (id, tiendaOrigen) => {
    setCart(cart.map(i => {
      if (i.id === id && i.tiendaOrigen === tiendaOrigen) {
        if (i.pu === '' || typeof i.pu !== 'number' || i.pu < 0) {
          const prod = products.find(p => p.id === id);
          return { ...i, pu: prod ? prod.precio : 0 };
        }
      }
      return i;
    }));
  };

  const updateItemStore = (id, oldTiendaOrigen, newStoreFullName) => {
    const item = cart.find(i => i.id === id && i.tiendaOrigen === oldTiendaOrigen);
    if (!item) return;

    const prod = products.find(p => p.id === id);
    if (!prod) return;

    const newStoreShort = newStoreFullName.replace('Tienda ', '');
    const availablePz = prod.stock && prod.stock[newStoreShort] ? prod.stock[newStoreShort].pz || 0 : 0;

    if (availablePz <= 0) {
      onShowToast(`⚠ ${newStoreFullName} no tiene stock disponible para ${prod.name}`);
      return;
    }

    const currentQty = typeof item.qty === 'number' ? item.qty : 1;
    const adjustedQty = Math.min(currentQty, availablePz);
    if (adjustedQty < currentQty) {
      onShowToast(`⚠ Cantidad ajustada a ${adjustedQty} pz (máximo disponible en ${newStoreFullName})`);
    }

    setCart(cart.map(i => (i.id === id && i.tiendaOrigen === oldTiendaOrigen) ? { ...i, tiendaOrigen: newStoreFullName, qty: adjustedQty } : i));
  };

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (!cart.length) {
      onShowToast('⚠ Agrega al menos un producto al carrito');
      return;
    }

    if (!auth.currentUser) {
      onShowToast('⚠ Sesión no válida. Inicia sesión nuevamente.');
      return;
    }

    const selectedStore = tienda || (stores[0] && stores[0].nombre);
    if (!selectedStore) {
      onShowToast('⚠ Debes seleccionar una tienda');
      return;
    }

    const total = cart.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.pu) || 0), 0);

    let urlComprobante = null;
    if (receiptFile) {
      try {
        onShowToast('📸 Procesando comprobante...');
        urlComprobante = await compressImage(receiptFile);
      } catch (err) {
        console.error(err);
        onShowToast('⚠ Error al procesar comprobante, procediendo sin imagen.');
      }
    }

    try {
      setIsSubmitting(true);
      onShowToast('⚙ Guardando venta...');

      await runTransaction(db, async (transaction) => {
        const productRefs = cart.map(item => ({
          item,
          ref: doc(db, 'productos', item.id)
        }));

        const productsSnap = [];
        for (const pr of productRefs) {
          const snap = await transaction.get(pr.ref);
          if (!snap.exists()) {
            throw new Error(`Producto ${pr.item.name} no existe.`);
          }
          productsSnap.push({ ...pr, data: snap.data() });
        }

        // Validar stock antes de escribir
        for (const ps of productsSnap) {
          const itemStoreFullName = ps.item.tiendaOrigen || selectedStore;
          const itemStoreShort = itemStoreFullName.replace('Tienda ', '');
          const currentStock = ps.data.stock || {};
          const storeStock = currentStock[itemStoreShort] || { pz: 0, cj: 0 };
          const requestedQty = sanitizeInteger(ps.item.qty, 1, 100000, 1);
          if (storeStock.pz < requestedQty) {
            throw new Error(`Stock insuficiente para ${ps.item.name} en ${itemStoreFullName}. Disp: ${storeStock.pz} pz.`);
          }
        }

        // Descontar stock atómicamente
        for (const ps of productsSnap) {
          const itemStoreFullName = ps.item.tiendaOrigen || selectedStore;
          const itemStoreShort = itemStoreFullName.replace('Tienda ', '');
          const currentStock = { ...(ps.data.stock || {}) };
          const storeStock = { ...(currentStock[itemStoreShort] || { pz: 0, cj: 0 }) };
          const requestedQty = sanitizeInteger(ps.item.qty, 1, 100000, 1);

          storeStock.pz -= requestedQty;
          currentStock[itemStoreShort] = storeStock;

          // Calcular porcentaje global de stock
          const totalPzLocal = Object.values(currentStock).reduce((sum, s) => sum + (s.pz || 0) + (s.cj || 0) * 10, 0);
          const newPct = Math.min(100, Math.round((totalPzLocal / 50) * 100));

          transaction.update(ps.ref, {
            stock: currentStock,
            pctStock: newPct,
            actualizadoEn: serverTimestamp()
          });
        }

        // Preparar y sanitizar datos de cliente
        const finalClientName = sanitizeString(clientName.trim(), 100) || 'Público General';
        const finalClientDoc = sanitizeString(clientDoc.trim(), 30);
        const finalClientPhone = sanitizeString(clientPhone.trim(), 30);

        let assignedClientId = selectedClientId && selectedClientId !== 'new' && selectedClientId !== 'general' ? selectedClientId : null;

        // Si es un cliente nuevo registrado en la venta, guardarlo en la colección clientes
        if ((isNewClient || selectedClientId === 'new') && finalClientName !== 'Público General') {
          const newClientRef = doc(collection(db, 'clientes'));
          transaction.set(newClientRef, {
            nombre: finalClientName,
            documento: finalClientDoc,
            telefono: finalClientPhone,
            creadoEn: serverTimestamp()
          });
          assignedClientId = newClientRef.id;
        }

        // Crear registro de venta con esquema validado (OWASP A01/A04)
        const folio = 'VTA-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-4);
        const saleRef = doc(collection(db, 'ventas'));

        transaction.set(saleRef, {
          folio,
          tienda: selectedStore,
          fecha: new Date(fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }),
          cliente: {
            id: assignedClientId,
            nombre: finalClientName,
            documento: finalClientDoc,
            telefono: finalClientPhone
          },
          clienteNombre: finalClientName,
          clienteDocumento: finalClientDoc,
          clienteTelefono: finalClientPhone,
          productos: cart.map(i => ({
            productoId: i.id, // Trazabilidad directa para reversión
            nombre: sanitizeString(i.name, 100),
            tipo: sanitizeString(i.tipo, 50),
            qty: sanitizeInteger(i.qty, 1, 100000, 1),
            unidad: 'pz',
            pu: sanitizeNumber(i.pu, 0, 1000000, 0),
            tiendaOrigen: sanitizeString(i.tiendaOrigen || selectedStore, 100)
          })),
          total: sanitizeNumber(total, 0, 10000000, 0),
          tieneComprobante: !!urlComprobante,
          urlComprobante: urlComprobante || '',
          notas: sanitizeString(notas, 500),
          registradoPor: auth.currentUser.uid,
          creadoEn: serverTimestamp()
        });
      });

      logSecurityEvent('VENTA_REGISTRADA', { total, items: cart.length, cliente: clientName });
      onShowToast('✅ Venta registrada — stock actualizado');
      setCart([]);
      setNotas('');
      setSelectedClientId('general');
      setClientName('Público General');
      setClientDoc('');
      setClientPhone('');
      setIsNewClient(false);
      clearReceipt();
    } catch (err) {
      console.error(err);
      onShowToast('⚠ Venta rechazada: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtrado reactivo de catálogo memoizado (Optimización de rendimiento)
  const cleanSearch = useMemo(() => sanitizeString(searchQuery.trim(), 50).toLowerCase(), [searchQuery]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (p.oculto) return false;
      const matchesQuery = !cleanSearch ||
        p.name.toLowerCase().includes(cleanSearch) ||
        p.tipo.toLowerCase().includes(cleanSearch);
      
      const matchesType = filterType === 'all' ||
        (filterType === 'listelo' && p.tipo === 'Listelo') ||
        (filterType === 'decorado' && p.tipo === 'Decorado');

      if (!matchesQuery || !matchesType) return false;

      if (catalogStore && catalogStore !== 'all') {
        const cShort = catalogStore.replace('Tienda ', '');
        const pz = p.stock && p.stock[cShort] ? p.stock[cShort].pz || 0 : 0;
        return pz > 0;
      }
      return true;
    });
  }, [products, cleanSearch, filterType, catalogStore]);

  // Reiniciar a página 1 al buscar o cambiar tienda/tipo
  useEffect(() => {
    setCatalogPage(1);
  }, [cleanSearch, filterType, catalogStore]);

  const paginatedCatalogProducts = useMemo(() => {
    return filteredProducts.slice((catalogPage - 1) * 15, catalogPage * 15);
  }, [filteredProducts, catalogPage]);

  const cartTotal = useMemo(() => {
    return cart.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.pu) || 0), 0);
  }, [cart]);

  return (
    <div className="page active" id="pg-ventas">
      <div className="section-head">
        <h2>Registrar Venta</h2>
      </div>

      <div className="venta-layout">
        {/* IZQUIERDA: CARRITO Y DATOS */}
        <div>
          <form onSubmit={handleCheckout} className="card" style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--stone)', marginBottom: '12px' }}>
              1. Tienda de la Venta (Cobro / Registro)
            </div>
            <div className="form-row">
              <div className="form-group" style={{ margin: 0 }}>
                <label htmlFor="vta-tienda">Tienda donde se hace la venta</label>
                <select id="vta-tienda" value={tienda} onChange={(e) => {
                  const newStore = e.target.value;
                  setTienda(newStore);
                  setCatalogStore(newStore);
                }}>
                  {stores.map(s => (
                    <option key={s.id} value={s.nombre}>{s.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label htmlFor="vta-fecha">Fecha</label>
                <input id="vta-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </div>
            </div>

            {/* SECCIÓN CLIENTE */}
            <div style={{ marginTop: '16px', marginBottom: '6px', padding: '12px 14px', background: '#f8fafc', borderRadius: 'var(--radius)', border: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--primary)' }}>
                  👤 Datos del Cliente
                </span>
                {selectedClientId !== 'new' && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setSelectedClientId('new');
                      setClientName('');
                      setClientDoc('');
                      setClientPhone('');
                      setIsNewClient(true);
                    }}
                    style={{ fontSize: '11px', padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <UserPlus size={12} /> + Nuevo Cliente
                  </button>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: '8px' }}>
                <label htmlFor="vta-cliente-select" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Seleccionar de lista de clientes</label>
                <select
                  id="vta-cliente-select"
                  value={selectedClientId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedClientId(val);
                    if (val === 'general') {
                      setClientName('Público General');
                      setClientDoc('');
                      setClientPhone('');
                      setIsNewClient(false);
                    } else if (val === 'new') {
                      setClientName('');
                      setClientDoc('');
                      setClientPhone('');
                      setIsNewClient(true);
                    } else {
                      const c = clients.find(cl => cl.id === val);
                      if (c) {
                        setClientName(c.nombre);
                        setClientDoc(c.documento || '');
                        setClientPhone(c.telefono || '');
                        setIsNewClient(false);
                      }
                    }
                  }}
                  style={{ width: '100%', padding: '7px 10px', fontSize: '13px', fontWeight: '600', borderRadius: '4px', border: '1px solid var(--border)', background: 'white' }}
                >
                  <option value="general">Público General (Venta Mostrador)</option>
                  <option value="new">+ Registrar Nuevo Cliente...</option>
                  {clients.length > 0 && <option disabled>────────── Clientes Registrados ──────────</option>}
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} {c.documento ? `(${c.documento})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row" style={{ marginTop: '6px' }}>
                <div className="form-group" style={{ margin: 0, flex: 1.5 }}>
                  <label htmlFor="vta-cli-nombre" style={{ fontSize: '11px' }}>Nombre / Razón Social *</label>
                  <input
                    id="vta-cli-nombre"
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Nombre o empresa del cliente"
                    required
                    style={{ fontSize: '12.5px', padding: '6px 10px' }}
                  />
                </div>
                <div className="form-group" style={{ margin: 0, flex: 1 }}>
                  <label htmlFor="vta-cli-doc" style={{ fontSize: '11px' }}>DNI / RUC</label>
                  <input
                    id="vta-cli-doc"
                    type="text"
                    value={clientDoc}
                    onChange={(e) => setClientDoc(e.target.value)}
                    placeholder="Ej. 20601234567"
                    style={{ fontSize: '12.5px', padding: '6px 10px' }}
                  />
                </div>
                <div className="form-group" style={{ margin: 0, flex: 1 }}>
                  <label htmlFor="vta-cli-tel" style={{ fontSize: '11px' }}>Teléfono / WhatsApp</label>
                  <input
                    id="vta-cli-tel"
                    type="text"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="Ej. 987654321"
                    style={{ fontSize: '12.5px', padding: '6px 10px' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--stone)' }}>
                Productos en el carrito
              </span>
            </div>
            <div className="cart-table-wrap table-responsive" style={{ overflowX: 'auto', marginBottom: '14px' }}>
              <table className="table" style={{ width: '100%', minWidth: '440px' }}>
                <thead>
                  <tr>
                    <th style={{ paddingLeft: '10px' }}>Producto</th>
                    <th>Descontar stock de</th>
                    <th>Cant.</th>
                    <th>Precio</th>
                    <th>Subtotal</th>
                    <th style={{ width: '40px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>
                        El carrito está vacío. Elige la tienda a la derecha y añade productos.
                      </td>
                    </tr>
                  ) : (
                    cart.map((item, idx) => {
                      const prod = products.find(p => p.id === item.id);
                      const itemStoreShort = (item.tiendaOrigen || tienda).replace('Tienda ', '');
                      const availPz = prod && prod.stock && prod.stock[itemStoreShort] ? prod.stock[itemStoreShort].pz || 0 : 0;
                      const subtotal = (Number(item.qty) || 0) * (Number(item.pu) || 0);

                      return (
                        <tr key={`${item.id}-${item.tiendaOrigen}-${idx}`}>
                          <td style={{ paddingLeft: '10px', fontWeight: '600' }}>{item.name}</td>
                          <td>
                            <select
                              value={item.tiendaOrigen || tienda}
                              onChange={(e) => updateItemStore(item.id, item.tiendaOrigen, e.target.value)}
                              style={{ padding: '3px 6px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border)' }}
                              aria-label="Tienda de origen de stock"
                            >
                              {stores.map(s => {
                                const short = s.nombre.replace('Tienda ', '');
                                const avail = prod && prod.stock && prod.stock[short] ? prod.stock[short].pz || 0 : 0;
                                return (
                                  <option key={s.id} value={s.nombre}>
                                    {s.nombre} ({avail} pz)
                                  </option>
                                );
                              })}
                            </select>
                          </td>
                          <td>
                            <div className="qty-ctrl" style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', border: '1px solid var(--border)', borderRadius: '4px', background: '#fff', padding: '2px 4px' }}>
                              <button type="button" className="qty-btn" style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px 4px', display: 'flex', alignItems: 'center' }} onClick={() => updateCartQty(item.id, item.tiendaOrigen, -1)} aria-label="Restar cantidad">
                                <Minus size={11} />
                              </button>
                              <input
                                type="number"
                                min="1"
                                max={availPz}
                                value={item.qty}
                                onChange={(e) => updateCartQtyDirect(item.id, item.tiendaOrigen, e.target.value)}
                                onBlur={() => handleQtyBlur(item.id, item.tiendaOrigen)}
                                style={{ width: '44px', textAlign: 'center', border: 'none', fontWeight: '700', fontSize: '12.5px', outline: 'none' }}
                                aria-label="Cantidad"
                              />
                              <button type="button" className="qty-btn" style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px 4px', display: 'flex', alignItems: 'center' }} onClick={() => updateCartQty(item.id, item.tiendaOrigen, 1)} aria-label="Sumar cantidad">
                                <Plus size={11} />
                              </button>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: '#fff', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 6px' }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>S/.</span>
                              <input
                                type="number"
                                step="0.50"
                                min="0"
                                value={item.pu}
                                onChange={(e) => updateItemPrice(item.id, item.tiendaOrigen, e.target.value)}
                                onBlur={() => handlePriceBlur(item.id, item.tiendaOrigen)}
                                style={{ width: '54px', border: 'none', outline: 'none', fontWeight: '600', fontSize: '12px' }}
                                aria-label="Precio unitario"
                              />
                            </div>
                          </td>
                          <td style={{ fontWeight: '700', color: 'var(--primary)' }}>
                            S/. {subtotal.toFixed(2)}
                          </td>
                          <td>
                            <button
                              type="button"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)' }}
                              onClick={() => setCart(cart.filter(i => !(i.id === item.id && i.tiendaOrigen === item.tiendaOrigen)))}
                              aria-label="Quitar producto del carrito"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', fontSize: '15px', borderTop: '1px solid var(--border)', paddingTop: '12px', marginBottom: '14px' }}>
              <span>Total a pagar</span>
              <span style={{ color: 'var(--primary)' }}>S/. {cartTotal.toFixed(2)}</span>
            </div>

            <div className="form-group">
              <label htmlFor="file-input">Comprobante de pago (Imagen JPG, PNG o WebP - Max 5MB)</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="file"
                  id="file-input"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => document.getElementById('file-input').click()}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <ImageIcon size={14} /> Adjuntar imagen
                </button>
                {receiptPreview && (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Imagen seleccionada ({receiptFile ? `${Math.round(receiptFile.size / 1024)} KB` : ''})</span>
                )}
              </div>
              {receiptPreview && (
                <div style={{ marginTop: '10px', position: 'relative', display: 'inline-block' }}>
                  <img
                    id="preview-img"
                    src={receiptPreview}
                    alt="Vista previa del comprobante"
                    style={{ maxHeight: '110px', borderRadius: '4px', border: '1px solid var(--border)' }}
                  />
                  <button
                    type="button"
                    onClick={clearReceipt}
                    style={{ position: 'absolute', top: '-6px', right: '-6px', background: 'var(--error)', color: 'white', border: 'none', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '10px' }}
                    aria-label="Eliminar comprobante"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="vta-notas">Notas de la venta</label>
              <textarea
                id="vta-notas"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Observaciones adicionales, cliente, número de pedido..."
                rows="2"
                maxLength={500}
              />
            </div>

            <button type="submit" className="btn btn-primary btn-full" style={{ marginTop: '10px' }} disabled={cart.length === 0 || isSubmitting}>
              {isSubmitting ? 'Procesando venta...' : 'Confirmar y Registrar Venta'}
            </button>
          </form>
        </div>

        {/* DERECHA: CATÁLOGO DE PRODUCTOS */}
        <div className="card">
          <div style={{ fontSize: '11.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--stone)', marginBottom: '8px' }}>
            2. Seleccionar Productos por Tienda
          </div>

          <div style={{ marginBottom: '14px', background: '#f8fafc', padding: '10px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border-light)' }}>
            <label htmlFor="cat-store" style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--primary)', display: 'block', marginBottom: '4px' }}>
              🏬 Ver stock disponible en:
            </label>
            <select
              id="cat-store"
              value={catalogStore}
              onChange={(e) => setCatalogStore(e.target.value)}
              style={{ width: '100%', padding: '6px 10px', fontSize: '12.5px', fontWeight: '600', borderRadius: '4px', border: '1px solid var(--border)', background: 'white' }}
            >
              {stores.map(s => (
                <option key={s.id} value={s.nombre}>
                  {s.nombre} {s.nombre === tienda ? '(Tienda de la venta)' : ''}
                </option>
              ))}
              <option value="all">Todas las tiendas (Stock global)</option>
            </select>
          </div>

          <div className="prod-search-box">
            <Search className="psb-icon-lucide" size={18} />
            <input
              type="text"
              placeholder="Buscar por nombre o tipo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Buscar en catálogo"
            />
          </div>
          <div className="filter-bar" style={{ gap: '6px', marginBottom: '14px' }}>
            <button type="button" className={`filter-chip ${filterType === 'all' ? 'active' : ''}`} onClick={() => setFilterType('all')}>Todos</button>
            <button type="button" className={`filter-chip ${filterType === 'listelo' ? 'active' : ''}`} onClick={() => setFilterType('listelo')}>Listelos</button>
            <button type="button" className={`filter-chip ${filterType === 'decorado' ? 'active' : ''}`} onClick={() => setFilterType('decorado')}>Decorados</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '440px', overflowY: 'auto' }}>
            {paginatedCatalogProducts.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '16px' }}>
                No hay productos con stock en {catalogStore === 'all' ? 'ninguna tienda' : catalogStore}.
              </div>
            ) : (
              paginatedCatalogProducts.map(p => {
                const targetStoreName = catalogStore && catalogStore !== 'all' ? catalogStore : (tienda || (stores[0] && stores[0].nombre));
                const storeShort = targetStoreName ? targetStoreName.replace('Tienda ', '') : '';
                const stock = p.stock && p.stock[storeShort] ? p.stock[storeShort] : { pz: 0, cj: 0 };
                const totalPzAll = Object.values(p.stock || {}).reduce((s, t) => s + (t.pz || 0), 0);
                const initials = p.name ? p.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'PR';

                let stockLabel = '';
                let isAvailable = false;

                if (catalogStore === 'all') {
                  stockLabel = `Total: ${totalPzAll} pz en stock`;
                  isAvailable = totalPzAll > 0;
                } else {
                  stockLabel = `Disp: ${stock.pz} pz en ${targetStoreName.replace('Tienda ', 'T. ')}`;
                  isAvailable = stock.pz > 0;
                }

                return (
                  <div
                    key={p.id}
                    className="product-card-m"
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '4px', border: '1px solid var(--border-light)', cursor: 'pointer' }}
                    onClick={() => addToCart(p)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className={`prod-badge-avatar ${p.tipo === 'Listelo' ? 'tb-l' : 'tb-d'}`} style={{ width: '32px', height: '32px', fontSize: '11px', fontWeight: '700' }}>
                      {initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12.5px', fontWeight: '600', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                        S/. {Number(p.precio).toFixed(2)} pz &nbsp;·&nbsp; <span style={{ fontWeight: '700', color: isAvailable ? 'var(--primary)' : 'var(--error)' }}>{stockLabel}</span>
                      </div>
                    </div>
                    <div className="btn btn-secondary btn-sm" style={{ padding: '4px 6px', fontSize: '10.5px' }}>
                      + Añadir
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {filteredProducts.length > 0 && (
            <div style={{ marginTop: '10px' }}>
              <Pagination
                currentPage={catalogPage}
                totalItems={filteredProducts.length}
                pageSize={15}
                onPageChange={setCatalogPage}
                itemLabel="productos"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
