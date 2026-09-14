# 🧪 Guía Completa de Pruebas del Sistema — StockLiso

Esta guía proporciona un recorrido detallado y estructurado para probar y validar todas las funcionalidades de **StockLiso**, incluyendo el módulo de ventas con clientes detallados, la paginación uniforme de 15 en 15 con buscadores, y los mecanismos de ciberseguridad integrados.

---

## 🚀 1. Entorno de Ejecución

### Opción A: Con Docker (Recomendado)
El proyecto incluye un entorno preconfigurado con el emulador local de Firebase Suite (Auth, Firestore, Storage y Hosting):

```bash
# Iniciar los contenedores
docker compose up --build -d

# Visualizar logs
docker compose logs -f
```

- **Aplicación Web**: [http://localhost:5002](http://localhost:5002)
- **Firebase Emulator UI**: [http://localhost:4000](http://localhost:4000)

### Opción B: En Local con Node.js

```bash
# 1. Instalar dependencias
npm install

# 2. Compilar bundle de producción
npm run build

# 3. Iniciar servidor de desarrollo Vite
npm run dev
```

---

## 🔑 2. Credenciales y Carga de Datos Iniciales (Seeding)

Para poblar la base de datos local con datos de prueba realistas (tiendas, catálogo cerámico, clientes y el usuario administrador):

```bash
# Ejecutar script de seed
node seed.js
```

### Credenciales de Acceso por Defecto:
| Rol | Correo Electrónico | Contraseña |
|---|---|---|
| **Administrador** | `admin@empresa.com` | `admin1234` |

---

## 📋 3. Matriz de Casos de Prueba

---

### Caso 1: Autenticación, Rate Limiting y Ciberseguridad (OWASP A07)

1. Diríjase a [http://localhost:5002](http://localhost:5002).
2. **Prueba de Fuerza Bruta / Rate Limiting**:
   - Ingrese un correo y contraseña incorrecta 5 veces seguidas.
   - **Resultado esperado**: Tras el 5to intento fallido, el sistema bloquea temporalmente los intentos por 60 segundos y muestra una alerta: *"🛑 Cuenta bloqueada por 60s tras 5 intentos fallidos"*.
3. **Inicio de Sesión Exitoso**:
   - Ingrese `admin@empresa.com` y `admin1234`.
   - **Resultado esperado**: Acceso inmediato al sistema con token seguro de sesión.

---

### Caso 2: Dashboard en Tiempo Real y Gráfica Semanal

1. En el menú lateral, seleccione **Dashboard**.
2. **Métricas Principales**:
   - Verifique que las tarjetas superiores calculan reactivamente: *Stock Total (piezas y cajas)*, *Valorización de Inventario (S/.)*, *Ventas Semanales* y *Productos con Bajo Stock (≤25%)*.
3. **Buscador Rápido de Stock**:
   - Escriba el nombre de un producto (ej. *"Mármol"*).
   - Verifique el menú desplegable interactivo con las existencias por tienda.
4. **Gráfico Semanal**:
   - Pase el cursor sobre las barras de los últimos 7 días para ver el tooltip interactivo con monto de ventas y cantidad de pedidos.

---

### Caso 3: Registrar Venta con Detalle y Selección de Clientes

1. En el menú lateral, diríjase a **Registrar Venta**.
2. **Selección de Tienda y Fecha**:
   - Seleccione la tienda donde se factura la venta (ej. *Tienda Centro*).
3. **Sección "👤 Datos del Cliente"**:
   - **Opción A - Público General**:
     - Por defecto viene seleccionado *"Público General (Venta Mostrador)"*.
   - **Opción B - Cliente Registrado en Base de Datos**:
     - Despliegue el selector y elija un cliente existente (ej. *"Constructora Los Andes SAC"*).
     - **Resultado esperado**: Los campos *Nombre / Razón Social*, *DNI / RUC* (`20601234567`) y *Teléfono / WhatsApp* (`987654321`) se autocompletan instantáneamente.
   - **Opción C - Registro de Nuevo Cliente en Caliente**:
     - Presione el botón **+ Nuevo Cliente** o seleccione `+ Registrar Nuevo Cliente...`.
     - Ingrese:
       - **Nombre / Razón Social**: `Distribuidora Cerámica San Juan SAC`
       - **DNI / RUC**: `20778899001`
       - **Teléfono**: `912345678`
4. **Paginación en el Catálogo de Productos (15 en 15)**:
   - En la columna derecha *"2. Seleccionar Productos por Tienda"*, observe el catálogo cerámico.
   - Verifique que se muestran **15 productos por página** con la barra inferior: *"Mostrando 1–15 de X productos"*.
   - Haga clic en el botón de página **2** o **Siguiente**: Verifique que muestra fluidamente los productos restantes sin recargar la página.
5. **Agregar al Carrito y Ajustar Cantidades**:
   - Haga clic en **+ Añadir** en uno o más productos.
   - Modifique la cantidad con los botones `+` / `-` o escribiendo directamente.
   - El sistema valida en tiempo real que la cantidad solicitada no exceda el stock físico de la tienda seleccionada.
6. **Confirmar la Venta**:
   - (Opcional) Adjunte una imagen de comprobante (JPG, PNG o WebP).
   - Presione **Confirmar y Registrar Venta**.
   - **Resultado esperado**: 
     - Mensaje de confirmación: *"✅ Venta registrada — stock actualizado"*.
     - El stock se descuenta atómicamente en Firestore.
     - El nuevo cliente queda guardado en la colección `clientes` y disponible en el catálogo para futuras ventas.

---

### Caso 4: Stock & Productos (Buscador y Paginación 15 en 15)

1. En el menú lateral, seleccione **Stock & Productos**.
2. **Paginación 15 en 15**:
   - Verifique que la tabla desktop y las tarjetas móviles presentan 15 productos por página con el indicador: *"Mostrando 1–15 de 18 productos"*.
   - Presione **2**: La tabla muestra los 3 productos restantes.
   - Presione **Anterior**: Regresa a la página 1.
3. **Buscador Reactivo**:
   - En el campo de búsqueda escriba *"Calacatta"*.
   - **Resultado esperado**: La tabla filtra instantáneamente mostrando solo los productos coincidentes y la paginación se reinicia automáticamente a la página 1.
4. **Filtros de Tipo**:
   - Haga clic en los chips *Listelos*, *Decorados* o *Stock bajo (≤25%)* para filtrar por categoría.
5. **Detalle y Reposición de Stock**:
   - Haga clic sobre cualquier fila o presione **Ver →**.
   - Se abre el modal con stock desglosado por tienda e historial de movimientos.
   - En la pestaña **Ingreso**, registre un ingreso de 10 piezas y confirme. El stock se actualiza inmediatamente en todas las vistas.

---

### Caso 5: Tiendas (Buscador y Paginación 15 en 15)

1. En el menú lateral, seleccione **Tiendas**.
2. **Buscador de Tiendas**:
   - Escriba *"Norte"* en el buscador superior.
   - **Resultado esperado**: Se visualiza únicamente la *Tienda Norte* con su dirección y stock consolidado.
   - Limpie el buscador para ver todas las tiendas.
3. **Paginación 15 en 15**:
   - Verifique la presencia del componente de paginación en la parte inferior.
4. **Crear / Editar Tienda**:
   - Presione **+ Nueva tienda**, ingrese el nombre *"Tienda Sur 2"* y dirección.
   - Al guardar, aparece en el catálogo de tiendas y se integra de inmediato en los selectores de ventas y stock.

---

### Caso 6: Transacciones e Historial (Buscador con Clientes y Paginación 15 en 15)

1. En el menú lateral, seleccione **Transacciones**.
2. **Detalle de Cliente en el Historial**:
   - Localice la venta registrada en el Caso 3.
   - **Resultado esperado**: En la columna *Detalle / Productos* aparece visible el icono y nombre del cliente: `👤 Distribuidora Cerámica San Juan SAC`.
3. **Búsqueda por Cliente**:
   - En el buscador de transacciones escriba el nombre del cliente (ej. *"San Juan"* o *"Andes"*).
   - **Resultado esperado**: Se filtran instantáneamente solo las transacciones pertenecientes a ese cliente.
4. **Paginación de 15 en 15**:
   - Verifique que el historial se divide de 15 en 15 transacciones con navegación por botones numéricos y anterior/siguiente.
5. **Modal de Detalle de Venta**:
   - Haga clic en la fila de la venta.
   - Se abre el modal **Detalle de Venta** mostrando:
     - Folio, tienda y fecha.
     - Tarjeta destacada **👤 Datos del Cliente** (Nombre/Razón Social, Doc/RUC, Teléfono).
     - Lista de productos vendidos con subtotales y total general.
     - Comprobante adjunto ampliable en lightbox.
6. **Anulación y Reversión Atómica de Stock**:
   - Presione el botón **Anular** en la transacción.
   - Confirme el diálogo de confirmación.
   - **Resultado esperado**: La venta se anula y el inventario de cada producto se restituye automáticamente a sus tiendas de origen.

---

### Caso 7: Gestión de Usuarios (Buscador y Paginación 15 en 15)

1. En el menú lateral, seleccione **Usuarios** (disponible para rol Administrador).
2. **Buscador de Usuarios**:
   - Ingrese el nombre, correo o rol de un usuario en el nuevo buscador.
   - **Resultado esperado**: Filtrado dinámico instantáneo.
3. **Paginación 15 en 15**:
   - Verifique la barra de paginación inferior.
4. **Crear Nuevo Usuario**:
   - Presione **+ Nuevo usuario**, ingrese nombre, correo, contraseña y rol (ej. *Vendedor*).
   - El usuario se registra en Firebase Auth secundario sin cerrar la sesión actual del administrador.

---

## ✅ Resumen de Conformidad

| Requerimiento | Estado | Archivos Clave |
|---|---|---|
| Detalle y listado de cliente en Registrar Venta | **APROBADO** | `Ventas.jsx`, `firestore.rules`, `App.jsx` |
| Persistencia de cliente en registro de venta | **APROBADO** | `Ventas.jsx`, `ModalVenta.jsx` |
| Buscador en Stock & Productos | **APROBADO** | `Stock.jsx` |
| Paginación 15 en 15 en Stock & Productos | **APROBADO** | `Stock.jsx`, `Pagination.jsx` |
| Buscador en Usuarios | **APROBADO** | `Usuarios.jsx` |
| Paginación 15 en 15 en Usuarios | **APROBADO** | `Usuarios.jsx`, `Pagination.jsx` |
| Buscador en Tiendas | **APROBADO** | `Tiendas.jsx` |
| Paginación 15 en 15 en Tiendas | **APROBADO** | `Tiendas.jsx`, `Pagination.jsx` |
| Buscador ampliado y paginación en Transacciones | **APROBADO** | `Transacciones.jsx`, `Pagination.jsx` |
| Paginación 15 en 15 en Catálogo de Venta | **APROBADO** | `Ventas.jsx`, `Pagination.jsx` |
| Seguridad y mitigación OWASP Top 10 | **APROBADO** | `security.js`, `firestore.rules` |
