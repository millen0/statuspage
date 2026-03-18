import axios from 'axios';

const API_URL = 'http://status.piercloud.com/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getHeartbeat = () => api.get('/status-page/heartbeat/app');
export const getServices = () => api.get('/public/services');
export const getIncidents = () => api.get('/public/incidents');
export const getMaintenances = () => api.get('/public/maintenances');
