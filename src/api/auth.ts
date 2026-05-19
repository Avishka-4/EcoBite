import { apiClient } from './client';

export interface RegisterData {
  email: string;
  password: string;
  name: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface UserData {
  id: number;
  email: string;
  name?: string;
  age?: number;
  cooking_experience?: string;
  preferred_cuisine?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: UserData;
}

export const authApi = {
  register: (data: RegisterData) =>
    apiClient.post<AuthResponse>('/auth/register', data).then((r) => r.data),

  login: (data: LoginData) =>
    apiClient.post<AuthResponse>('/auth/login', data).then((r) => r.data),
};
