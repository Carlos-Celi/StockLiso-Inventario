# Guía de Despliegue de StockLiso en Producción (Firebase Spark - Plan Gratuito)

Esta guía detalla el procedimiento paso a paso para desplegar **StockLiso** (el sistema de inventario cerámico) en producción utilizando el **Plan Spark (Gratuito)** de Firebase. Este plan incluye Hosting, Base de Datos NoSQL (Firestore), Autenticación de usuarios y Almacenamiento de imágenes de comprobantes sin costo alguno.

---

## 📋 Requisitos Previos

1. **Node.js** (versión 18 o superior) instalado en su equipo.
2. Una cuenta en [Firebase Console](https://console.firebase.google.com/).
3. La herramienta de comandos de Firebase (Firebase CLI) instalada de forma local (recomendado para evitar problemas de permisos) o global:
   ```bash
   npm install -D firebase-tools
   ```

---

## 🛠️ Paso 1: Configurar el Proyecto en Firebase Console

1. Inicie sesión en [Firebase Console](https://console.firebase.google.com/).
2. Presione **Agregar proyecto** (o *Add project*).
3. Nombre el proyecto como `stockliso-prod` (o el nombre que prefiera para su negocio).
4. **Google Analytics**: Se recomienda deshabilitarlo para este despliegue simplificado (puede activarlo más tarde si lo requiere).
5. Presione **Crear proyecto** y espere unos segundos a que finalice la inicialización.
6. Asegúrese de que el proyecto esté bajo el **Plan Spark (Gratuito)**.

---

## 🔐 Paso 2: Habilitar los Servicios en Firebase Console

Para que StockLiso funcione, debe activar los siguientes servicios desde el menú lateral izquierdo de la consola de Firebase:

### A. Firebase Authentication (Autenticación de Usuarios)
1. Vaya a **Build > Authentication** y presione **Comenzar** (*Get started*).
2. En la pestaña **Método de inicio de sesión** (*Sign-in method*), elija **Correo electrónico/Contraseña** (*Email/Password*).
3. Habilite el primer interruptor (Habilitar inicio de sesión por correo) y guarde los cambios.

### B. Cloud Firestore (Base de Datos NoSQL)
1. Vaya a **Build > Firestore Database** y presione **Crear base de datos** (*Create database*).
2. Seleccione **Modo producción** (*Production mode*) y presione Siguiente.
3. Elija la ubicación geográfica del servidor más cercana a sus tiendas (ej. `us-east1` o `southamerica-east1` para Latinoamérica) y presione **Habilitar** (*Enable*).

### C. Cloud Storage (Opcional - Almacenamiento de Comprobantes de Ventas)
> [!NOTE]
> **El servicio Cloud Storage es totalmente opcional.**
> Hemos integrado un compresor de imágenes local en la interfaz. Cuando subes un comprobante, la aplicación lo redimensiona automáticamente a un ancho máximo de 800px y lo almacena como texto en formato Base64 directamente dentro del documento de la venta en Firestore.
> 
> Esto significa que **puedes omitir por completo la configuración de Cloud Storage** y aun así poder adjuntar imágenes de comprobantes. El sistema funcionará 100% gratis dentro del **Plan Spark** sin requerir ninguna tarjeta de crédito.
> 
> Si aun así prefieres almacenar las imágenes físicamente en Cloud Storage:
> 1. Deberás actualizar el proyecto en Firebase al **Plan Blaze (Pago por uso)**. Google Cloud requiere una tarjeta de crédito o débito para activar buckets de almacenamiento (aunque el plan Blaze mantiene los mismos límites de gratuidad y no te cobrarán nada si almacenas menos de 5 GB).
> 2. Una vez actualizado a Blaze, ve a **Build > Storage** y presiona **Comenzar** (*Get started*).
> 3. Elija **Modo producción** (*Production mode*) y presione Siguiente.
> 4. Mantenga la ubicación por defecto y presione **Listo** (*Done*).

---

## 💻 Paso 3: Autenticación en Firebase CLI

En la terminal de su computadora, dentro del directorio del proyecto, inicie sesión en su cuenta de Firebase:

```bash
# Si instaló localmente (recomendado):
npx firebase login

# Si instaló globalmente:
firebase login
```

Esto abrirá una ventana en su navegador web para dar autorización de acceso a la CLI. Una vez hecho, vuelva a la terminal.

---

## 📄 Paso 4: Enlazar el Directorio Local con Firebase

El proyecto ya cuenta con archivos de configuración predefinidos (`firebase.json`, `.firebaserc`, `firestore.rules` y `storage.rules`). Para asociar el proyecto local al que acaba de crear en la nube, ejecute:

```bash
# Agregar la referencia del proyecto de producción (anteponer npx si se instaló localmente)
npx firebase use --add
```

*Seleccione el ID de su proyecto recién creado de la lista y asígnele el alias `default` o `production`.*

---

## 🗄️ Paso 5: Cargar Datos Iniciales (Seeding)

Para poblar la base de datos de producción con el administrador principal y las tiendas por defecto (obligatorio para operar el sistema), utilice el script local `seed.js`:

1. Vaya a **Firebase Console > Configuración del Proyecto ⚙️ > Cuentas de servicio** (*Service Accounts*).
2. Presione **Generar nueva clave privada** (*Generate new private key*) y descargue el archivo JSON.
3. Guarde este archivo en la raíz del proyecto local y **renómbrelo** exactamente a `serviceAccountKey.json`.
4. Ejecute el script de inicialización desde la terminal:
   * **Opción A: Solo Administrador y Tiendas (Base de datos limpia)**
     ```bash
     node seed.js --only-admin
     ```
   * **Opción B: Con catálogo de productos inicial de demostración**
     ```bash
     npm run seed
     ```
   *(Deberá ver el mensaje `✅ Seed completado con éxito!` en consola).*
5. ⚠️ **IMPORTANTE (SEGURIDAD)**: Elimine el archivo `serviceAccountKey.json` de su computadora de inmediato para evitar subirlo a repositorios de código públicos. Este archivo contiene llaves de acceso completo a su base de datos.

---

## ⚙️ Paso 6: Configurar las Credenciales de Producción en el HTML

Debe conectar la interfaz web a los servidores reales de su cuenta de Firebase:

1. Vaya a **Firebase Console > Configuración del Proyecto ⚙️ > General**.
2. Desplácese a la sección *Tus apps* y haga clic en el icono **Web** (</>) para registrar una nueva aplicación.
3. Nombre la aplicación como `StockLiso` y presione **Registrar app** (no active la casilla de Firebase Hosting en esta sección, ya está configurado).
4. Copie los valores del objeto `firebaseConfig` que le mostrarán en pantalla. Se verá algo así:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSyA1...",
     authDomain: "tu-proyecto.firebaseapp.com",
     projectId: "tu-proyecto",
     storageBucket: "tu-proyecto.appspot.com",
     messagingSenderId: "123456789...",
     appId: "1:123456789:web:abcdef..."
   };
   ```
5. Abra el archivo `public/index.html` y busque la declaración `const firebaseConfig` (aproximadamente en la línea ~1666).
6. Reemplace el objeto por las credenciales reales de producción que copió de la consola.

---

## 🚀 Paso 7: Desplegar en Firebase Hosting

Para desplegar las reglas de seguridad, índices de base de datos y la interfaz HTML a los servidores de producción de Firebase sin requerir Storage, ejecute el siguiente comando en su terminal:

```bash
# Desplegar solo base de datos e interfaz (bypasseando Storage)
npx firebase deploy --only firestore,hosting
```

Al terminar, la consola le indicará el éxito del proceso y le proveerá dos URL públicas de producción:
- `https://<tu-id-de-proyecto>.web.app`
- `https://<tu-id-de-proyecto>.firebaseapp.com`

Abra cualquiera de ellas en su navegador e inicie sesión con las credenciales de administrador por defecto creadas por el seed en el **Paso 5** (`admin@empresa.com` / `admin1234`) para comenzar a operar.

---

## 🛡️ Paso 8: Restricciones de Seguridad en Google Cloud (Muy Recomendado)

Las credenciales de Firebase son públicas en el código HTML. Para evitar que terceros usen su API Key de manera maliciosa, configure restricciones de dominio:

1. Vaya a [Google Cloud Console](https://console.cloud.google.com/).
2. Busque su proyecto en la barra superior.
3. Acceda a **API y servicios > Credenciales** (*APIs & Services > Credentials*).
4. Localice la clave bajo el nombre **Browser key (auto-created by Firebase)** y haga clic en el icono de edición 📝.
5. Bajo **Restricciones de la API** (*API restrictions*), configure:
   - **Restricciones de aplicaciones**: Seleccione **Sitios web (referentes HTTP)**.
   - En la sección **Aceptar solicitudes de estos referentes HTTP de sitios web**, agregue:
     - `https://<tu-proyecto>.web.app/*`
     - `https://<tu-proyecto>.firebaseapp.com/*`
     - `http://localhost/*` *(solo para poder seguir depurando localmente)*
6. Guarde los cambios. Esto asegura que nadie pueda usar sus recursos de Firebase fuera de sus dominios oficiales.
