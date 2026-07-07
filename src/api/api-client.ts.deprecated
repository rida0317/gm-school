// API Client (Axios Instance)
// src/api/api-client.ts

import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds
});

// Request interceptor - Add auth token
apiClient.interceptors.request.use(
  (config) => {
    // Get token from localStorage
    const token = localStorage.getItem('access_token');
    
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add school ID if available
    const schoolId = localStorage.getItem('school_id');
    if (schoolId && config.headers) {
      config.headers['X-School-ID'] = schoolId;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    // Handle 401 Unauthorized - Token expired
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (originalRequest._retry) {
        // Already tried to refresh, redirect to login
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      try {
        // Try to refresh token
        const refreshToken = localStorage.getItem('refresh_token');
        
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const { access_token } = response.data;
        localStorage.setItem('access_token', access_token);

        // Retry original request with new token
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
        }

        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed, redirect to login
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    // Handle other errors
    return Promise.reject(error);
  }
);

// Helper methods for common operations
export const api = {
  get: (url: string, config?: AxiosRequestConfig) => 
    apiClient.get(url, config),
  
  post: (url: string, data?: any, config?: AxiosRequestConfig) => 
    apiClient.post(url, data, config),
  
  put: (url: string, data?: any, config?: AxiosRequestConfig) => 
    apiClient.put(url, data, config),
  
  patch: (url: string, data?: any, config?: AxiosRequestConfig) => 
    apiClient.patch(url, data, config),
  
  delete: (url: string, config?: AxiosRequestConfig) => 
    apiClient.delete(url, config),
  
  upload: (url: string, formData: FormData, config?: AxiosRequestConfig) => 
    apiClient.post(url, formData, {
      ...config,
      headers: {
        ...config?.headers,
        'Content-Type': 'multipart/form-data',
      },
    }),
};

export default apiClient;
