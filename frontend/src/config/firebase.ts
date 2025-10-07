import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getAnalytics } from 'firebase/analytics';
import { getStorage } from 'firebase/storage';

// Configuración de Firebase - Proyecto Guro
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyB-TWe1iahn5waeM0APbK5kB5UhIZlNQI0",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "guro-b3911.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "guro-b3911",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "guro-b3911.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "247210515853",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:247210515853:web:b4dbcf9d456423be4071c4",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-8NM1YK3WNR"
};

// Verificar que las variables de entorno estén configuradas
if (import.meta.env.PROD && (!import.meta.env.VITE_FIREBASE_API_KEY || !import.meta.env.VITE_FIREBASE_PROJECT_ID)) {
}

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar Storage
export const storage = getStorage(app);

// Inicializar Authentication
export const auth = getAuth(app);

// Inicializar Analytics (solo en producción)
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

// Configurar Google Provider con opciones mejoradas
export const googleProvider = new GoogleAuthProvider();

// Configurar parámetros personalizados para Google Sign-In
googleProvider.setCustomParameters({
  prompt: 'select_account',
  // Reducir warnings de Cross-Origin-Opener-Policy
  hd: '', // Hosted domain (opcional)
});

// Añadir scopes adicionales si es necesario
googleProvider.addScope('email');
googleProvider.addScope('profile');


export default app; 