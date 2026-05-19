import { apiClient } from './client';
import { UserData } from './auth';

export interface ProfileUpdate {
  name?: string;
  age?: number;
  cooking_experience?: string;
  preferred_cuisine?: string;
}

export const usersApi = {
  getMe: () => apiClient.get<UserData>('/users/me').then((r) => r.data),

  updateMe: (data: ProfileUpdate) =>
    apiClient.put<UserData>('/users/me', data).then((r) => r.data),
};
