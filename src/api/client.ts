import axios from 'axios';

/**
 * API client for EcoBite backend.
 *
 * Production (ECS Fargate):
 *   Set VITE_API_URL to the ALB URL from CDK output "BackendApiUrl"
 *   e.g. http://<alb-dns>.us-east-1.elb.amazonaws.com/api/v1
 *
 * Local dev:
 *   Set VITE_API_URL=http://localhost:8000/api/v1 in a .env.local file,
 *   or leave unset to use the localhost fallback below.
 */

// Default local dev address — override with VITE_API_URL for ECS / any remote host
const LOCAL_BACKEND = 'http://localhost:8000/api/v1';

// NOTE: Fallback hosts removed – the app now uses only the public BackendApiUrl.
// If you need a local dev backend, set VITE_API_URL in .env.local.
export const CANDIDATE_HOSTS = [];

export function getBaseUrl(): string {
  // VITE_API_URL is set at build time or via .env.local
  // In ECS production it must point to the ALB BackendApiUrl CDK output
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL as string;
  }
  return LOCAL_BACKEND;
}

export const apiClient = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

apiClient.interceptors.request.use((config) => {
  config.baseURL = getBaseUrl();
  const token = typeof window !== 'undefined' ? localStorage.getItem('ecobite_token') : null;
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
