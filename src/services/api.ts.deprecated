import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const gradesApi = {
  getAll: () => api.get('/grades'),
  getById: (id: string) => api.get(`/grades/${id}`),
  create: (data: any) => api.post('/grades', data),
  update: (id: string, data: any) => api.put(`/grades/${id}`, data),
  delete: (id: string) => api.delete(`/grades/${id}`),
  import: (data: any) => api.post('/grades/import', data),
};

export const massarApi = {
  getAnalytics: () => api.get('/massar/analytics'),
};

export default api;
