import axios from 'axios';

// Known backend candidate addresses for Android Emulator, Physical LAN, and Localhost
export const CANDIDATE_HOSTS = [
  'http://10.0.2.2:8000/api/v1',
  'http://172.24.63.121:8000/api/v1',
  'http://192.168.56.1:8000/api/v1',
  'http://127.0.0.1:8000/api/v1',
  'http://localhost:8000/api/v1',
];

export function getBaseUrl(): string {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL as string;
  }
  if (typeof window !== 'undefined') {
    const customIp = localStorage.getItem('ecobite_backend_ip');
    if (customIp) {
      const cleanIp = customIp.trim().replace(/^https?:\/\//, '').replace(/[\.\/]+$/, '');
      const hasPort = cleanIp.includes(':');
      return `http://${hasPort ? cleanIp : cleanIp + ':8000'}/api/v1`;
    }

    const isAndroid = /android/i.test(navigator.userAgent) || window.location.protocol === 'capacitor:';
    if (isAndroid) {
      return 'http://10.0.2.2:8000/api/v1';
    }
  }
  return 'http://localhost:8000/api/v1';
}

export const apiClient = axios.create({
  baseURL: getBaseUrl(),
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

apiClient.interceptors.request.use((config) => {
  config.baseURL = getBaseUrl();
  const token = localStorage.getItem('ecobite_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    return Promise.reject(error);
  }
);
