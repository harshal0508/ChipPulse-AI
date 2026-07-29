import axios from 'axios';
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const client = axios.create({ baseURL: BASE_URL, timeout: 30000 });
export const api = {
  simulate: (payload) => client.post('/api/v1/simulate', payload),
  getProjects: (sessionId) => client.get(`/api/v1/projects?session_id=${sessionId}`),
  saveProject: (data) => client.post('/api/v1/projects', data),
  getProject: (id) => client.get(`/api/v1/projects/${id}`),
  deleteProject: (id) => client.delete(`/api/v1/projects/${id}`),
  health: () => client.get('/api/v1/health'),
};
