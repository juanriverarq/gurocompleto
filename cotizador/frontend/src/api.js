import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// ---- Conexiones ----
export const getConnections = () => api.get('/connections').then(r => r.data);
export const saveCredentials = (methodId, creds) => api.post(`/connections/${methodId}/credentials`, creds).then(r => r.data);
export const removeConnection = (methodId) => api.delete(`/connections/${methodId}`).then(r => r.data);
export const toggleConnection = (methodId, active) => api.post(`/connections/${methodId}/toggle`, { active }).then(r => r.data);
export const testConnection = (methodId) => api.post(`/connections/${methodId}/test`).then(r => r.data);

// ---- Vehículos ----
export const getBrands = () => api.get('/vehicles/brands').then(r => r.data);
export const getLines = (brand) => api.get('/vehicles/lines', { params: { brand } }).then(r => r.data);
export const getModels = (brand, line) => api.get('/vehicles/models', { params: { brand, line } }).then(r => r.data);
export const searchVehicles = (brand, line, model) => api.get('/vehicles/search', { params: { brand, line, model } }).then(r => r.data);

// ---- Cotización ----
export const createQuote = (vehicle, client) => api.post('/quote', { vehicle, client }).then(r => r.data);
export const getQuote = (id) => api.get(`/quote/${id}`).then(r => r.data);
export const getAllQuotes = () => api.get('/quotes').then(r => r.data);

// ---- Aseguradoras ----
export const getInsurers = () => api.get('/insurers').then(r => r.data);
