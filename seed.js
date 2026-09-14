// seed.js
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

const fs = require('fs');
const path = require('path');
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
const hasServiceAccount = fs.existsSync(serviceAccountPath);

// Si existe el archivo serviceAccountKey.json, asumimos producción; si no, conectamos al emulador
const isEmulator = !hasServiceAccount;

if (isEmulator) {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
  console.log('🔌 Conectando al emulador local de Firebase (127.0.0.1)...');
}

// Inicializar la app
let app;
if (isEmulator) {
  app = initializeApp({ projectId: 'stockliso-dev' });
} else {
  console.log('🌍 Conectando al proyecto de Firebase en producción...');
  const serviceAccount = require(serviceAccountPath);
  app = initializeApp({
    credential: require('firebase-admin').credential.cert(serviceAccount)
  });
}

const db = getFirestore();
const auth = getAuth();

async function seed() {
  const onlyAdmin = process.argv.includes('--only-admin');

  if (onlyAdmin) {
    console.log('🧹 Limpiando colección de tiendas...');
    const snapTiendas = await db.collection('tiendas').get();
    for (const doc of snapTiendas.docs) {
      await doc.ref.delete();
    }
  } else {
    console.log('🧹 Limpiando colecciones de tiendas y productos...');
    // Borrar productos anteriores para evitar duplicaciones
    const snapProd = await db.collection('productos').get();
    for (const doc of snapProd.docs) {
      await doc.ref.delete();
    }
    const snapTiendas = await db.collection('tiendas').get();
    for (const doc of snapTiendas.docs) {
      await doc.ref.delete();
    }
  }

  console.log('🏪 Insertando tiendas por defecto...');
  const tiendas = [
    { nombre: 'Tienda Centro', direccion: 'Av. Principal #100', activa: true },
    { nombre: 'Tienda Norte',  direccion: 'Blvd. Norte #450',   activa: true },
    { nombre: 'Tienda Sur',    direccion: 'Col. Industrial #22', activa: true },
  ];
  for (const t of tiendas) {
    await db.collection('tiendas').add(t);
  }

  if (!onlyAdmin) {
    console.log('📦 Insertando catálogo de productos inicial...');
    const productos = [
      { nombre:'Mármol Blanco', tipo:'Listelo', icono:'🪨', precioPz:45, precioCaja:320,
        stock:{ Centro:{pz:24,cj:3}, Norte:{pz:10,cj:1}, Sur:{pz:0,cj:0} }, pctStock:80 },
      { nombre:'Piedra Gris',   tipo:'Decorado',icono:'⬜', precioPz:62, precioCaja:0,
        stock:{ Centro:{pz:5,cj:0},  Norte:{pz:15,cj:0}, Sur:{pz:2,cj:0} }, pctStock:40 },
      { nombre:'Terrazo Verde', tipo:'Listelo', icono:'🟩', precioPz:28, precioCaja:320,
        stock:{ Centro:{pz:0,cj:2},  Norte:{pz:0,cj:5},  Sur:{pz:0,cj:0} }, pctStock:18 },
      { nombre:'Madera Oak',    tipo:'Decorado',icono:'🪵', precioPz:55, precioCaja:0,
        stock:{ Centro:{pz:30,cj:2}, Norte:{pz:8,cj:0},  Sur:{pz:4,cj:0} }, pctStock:90 },
      { nombre:'Cemento Topo',  tipo:'Listelo', icono:'🔶', precioPz:38, precioCaja:280,
        stock:{ Centro:{pz:12,cj:1}, Norte:{pz:0,cj:0},  Sur:{pz:6,cj:1} }, pctStock:55 },
      { nombre:'Rústico Beige', tipo:'Decorado',icono:'🟫', precioPz:70, precioCaja:0,
        stock:{ Centro:{pz:3,cj:0},  Norte:{pz:0,cj:0},  Sur:{pz:0,cj:0} }, pctStock:10 },
    ];
    for (const p of productos) {
      await db.collection('productos').add({
        ...p, creadoEn: new Date(), actualizadoEn: new Date()
      });
    }
  }

  console.log('👤 Creando usuario administrador por defecto...');
  const email = 'admin@empresa.com';
  const pass = 'admin1234';
  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(email);
    console.log(`El usuario ${email} ya existe en Firebase Auth.`);
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      userRecord = await auth.createUser({
        email,
        password: pass,
        displayName: 'Admin General'
      });
      console.log(`Usuario creado exitosamente en Auth: ${userRecord.uid}`);
    } else {
      throw error;
    }
  }

  // Guardar/actualizar perfil en Firestore
  await db.collection('usuarios').doc(userRecord.uid).set({
    uid: userRecord.uid,
    nombre: 'Admin General',
    email: email,
    rol: 'Administrador',
    tienda: 'Todas las tiendas',
    activo: true,
    creadoEn: new Date()
  });
  console.log('Perfil de administrador guardado en Firestore.');

  console.log('👥 Insertando clientes por defecto...');
  const snapClientes = await db.collection('clientes').get();
  if (snapClientes.empty) {
    const clientes = [
      { nombre: 'Constructora Los Andes SAC', documento: '20601234567', telefono: '987654321', email: 'compras@losandes.pe', direccion: 'Av. Javier Prado 2500' },
      { nombre: 'Inversiones Cerámicas del Sur EIRL', documento: '20559876543', telefono: '976543210', email: 'contacto@cersur.pe', direccion: 'Jr. Moquegua 320' },
      { nombre: 'María Elena Rojas', documento: '45892314', telefono: '951234567', email: 'mrojas@gmail.com', direccion: 'Calle Las Flores 142' },
      { nombre: 'Carlos Mendoza Quispe', documento: '10748291', telefono: '942384729', email: 'cmendoza@hotmail.com', direccion: 'Av. Primavera 889' },
      { nombre: 'Acabados y Diseños Modernos SAC', documento: '20491823746', telefono: '998877665', email: 'acabados@disenos.com', direccion: 'Av. Brasil 1250' }
    ];
    for (const c of clientes) {
      await db.collection('clientes').add({
        ...c, creadoEn: new Date()
      });
    }
    console.log('Clientes insertados correctamente.');
  }

  console.log('✅ Seed completado con éxito!');
}

seed().catch(console.error);
