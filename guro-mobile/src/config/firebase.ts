import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyB-TWe1iahn5waeM0APbK5kB5UhIZlNQI0',
  authDomain: 'guro-b3911.firebaseapp.com',
  projectId: 'guro-b3911',
  storageBucket: 'guro-b3911.appspot.com',
  messagingSenderId: '247210515853',
  appId: '1:247210515853:web:b4dbcf9d456423be4071c4',
  measurementId: 'G-8NM1YK3WNR',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
} catch (e) {
  auth = getAuth(app);
}

export { auth };
export default app;
