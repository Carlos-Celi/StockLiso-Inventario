<div align="center">

#  StockLiso

### Sistema Integral de Inventario Cerámico, Gestión Multi-Tienda y Registro simple de tiendas

[![React](https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.1-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore_%7C_Auth-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

<p align="center">
  <b>Plataforma web  para el control de inventario en tiempo real, facturación y gestión multi-sucursal de materiales cerámicos, listelos y acabados.</b>
</p>

</div>

---

## Descripción General

**StockLiso** es un proyecto sencillo para resolver las complejidades operativas en una empresa de distribución y venta de acabados cerámicos (listelos, decorados, porcelanatos) que lo solicito. Se diseño el sistema a base de sus necesidades y facil uso para tener rapida adopción. 

---


## 🛠️ Stack Tecnológico

```
Frontend:
├── React 19.2 (Hooks, Context, Suspense, Lazy loading)
├── Vite 8.1 (Bundler ultra-rápido con Code-Splitting)
├── Lucide React (Iconografía moderna y accesible)
└── CSS Tokens & Responsive Design (Arquitectura Vanilla CSS sin dependencias pesadas)

Backend & Cloud:
├── Google Cloud Firestore (Base de datos NoSQL reactiva en tiempo real)
├── Firebase Authentication (Gestión segura de identidades y tokens JWT)
└── Firebase Local Emulator Suite (Entorno completo de desarrollo offline)

Infraestructura:
└── Docker & Docker Compose (Contenedorización reproducible de servicios)
```

---

## 📁 Estructura del Repositorio

```
SistemaInventario/
├── src/
│   ├── components/
│   │   ├── Modals/               # Modales para productos, ventas, tiendas y usuarios
│   │   ├── AgregarProducto.jsx   # Formulario de alta de productos con validaciones
│   │   ├── Dashboard.jsx         # Panel de métricas y gráfico semanal
│   │   ├── Pagination.jsx        # Componente reutilizable de paginación uniforme (15x15)
│   │   ├── Sidebar.jsx           # Navegación lateral responsive
│   │   ├── Stock.jsx             # Vista de inventario, filtros y paginación
│   │   ├── Tiendas.jsx           # Gestión de sucursales con buscador y paginación
│   │   ├── Transacciones.jsx     # Historial de ventas/ingresos con clientes y anulación
│   │   ├── Usuarios.jsx          # Administración de cuentas RBAC con buscador y paginación
│   │   └── Ventas.jsx            # Punto de venta (POS) con selector y detalle de clientes
│   ├── utils/
│   │   └── security.js           # Sanitizadores OWASP, rate limiters y validadores
│   ├── App.jsx                   # Orquestador principal, listeners reactivos y sesión
│   ├── firebase.js               # Inicialización de Firebase con fallback a emuladores
│   ├── index.css                 # Sistema de diseño con variables, temas y utilidades
│   └── main.jsx                  # Punto de entrada de la aplicación React
├── Dockerfile                    # Configuración de imagen Docker para emuladores Firebase
├── docker-compose.yml            # Orquestador Docker (Puertos 5002, 8080, 9099, 4000)
├── firebase.json                 # Reglas de Hosting, headers CSP y puertos de emuladores
├── firestore.rules               # Reglas de seguridad NoSQL con control por roles
├── guia_pruebas.md               # Guía exhaustiva de pruebas paso a paso
├── guia_despliegue.md            # Manual de despliegue a producción (Firebase Spark)
├── seed.js                       # Script de inicialización de datos de prueba
└── package.json                  # Dependencias y scripts de construcción
```

---

## ⚡ Inicio Rápido

### 1. Clonar el Repositorio

```bash
git clone https://github.com/tu-usuario/stockliso.git
cd stockliso
```

### 2. Ejecutar con Docker (Recomendado)

```bash
# Construir e iniciar el contenedor
docker compose up --build -d
```

- **Aplicación Web**: [http://localhost:5002](http://localhost:5002)
- **Firebase Emulator Suite UI**: [http://localhost:4000](http://localhost:4000)

### 3. Ejecutar Localmente con Node.js

```bash
# 1. Instalar dependencias
npm install

# 2. Poblar datos iniciales
node seed.js

# 3. Compilar bundle de producción
npm run build

# 4. Iniciar servidor de desarrollo
npm run dev
```

### 4. Credenciales de Demostración

| Rol               | Correo              | Contraseña  |
| ----------------- | ------------------- | ----------- |
| **Administrador** | `admin@empresa.com` | `admin1234` |

---

## 📖 Documentación Adicional

- [🧪 Guía Completa de Pruebas](guia_pruebas.md): Casos de prueba detallados para validar cada módulo, escenarios de ventas, paginación y seguridad.
- [🚀 Guía de Despliegue en Producción](guia_despliegue.md): Paso a paso para publicar la plataforma en el Plan Spark (100% gratuito) de Firebase.

---

## 📄 Licencia

Este proyecto se encuentra bajo la Licencia MIT. Consulta el archivo `LICENSE` para más detalles.
