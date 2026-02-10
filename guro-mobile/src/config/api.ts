import axios from 'axios';
import { auth } from './firebase';

// Cambia esta IP a la de tu computadora en la red local
export const API_BASE_URL = 'http://192.168.1.80:8001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

api.interceptors.request.use(
  async (config) => {
    try {
      const user = auth.currentUser;
      if (user) {
        const token = await user.getIdToken();
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error getting Firebase token:', error);
    }
    // Para FormData (uploads), dejar que Axios genere el Content-Type con boundary
    // En React Native, instanceof FormData puede fallar, así que también verificamos el constructor
    if (config.data instanceof FormData || (config.data && config.data.constructor && config.data.constructor.name === 'FormData')) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.log('Unauthorized');
    }
    return Promise.reject(error);
  }
);

export default api;
