import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

// Configuración con soporte de variables de entorno y fallback seguro
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDM_A34Oo2TH3XiwaEqSzZz1yiEZCRO28c",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "stockliso-prod.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "stockliso-prod",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "stockliso-prod.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "794323147847",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:794323147847:web:22e4f97d4a66bdbdc66562"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const isEmulator = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// Conectar emuladores si corremos en localhost
if (isEmulator) {
  console.log('🤖 Conectando a los emuladores locales de Firebase...');
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectAuthEmulator(auth, 'http://localhost:9099');
  connectStorageEmulator(storage, 'localhost', 9199);
}

/**
 * Crea una instancia secundaria de Firebase Auth para operaciones de administración
 * (como crear usuarios sin desconectar la sesión del administrador actual)
 * garantizando compatibilidad tanto en producción como en emulador local.
 */
export function getSecondaryAuthApp(uniqueName) {
  const secondaryApp = initializeApp(firebaseConfig, uniqueName);
  const secondaryAuth = getAuth(secondaryApp);
  if (isEmulator) {
    connectAuthEmulator(secondaryAuth, 'http://localhost:9099');
  }
  return { app: secondaryApp, auth: secondaryAuth };
}

export { app, auth, db, storage, firebaseConfig, isEmulator };
