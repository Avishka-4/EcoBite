import axios from 'axios';
import { apiClient, getBaseUrl, CANDIDATE_HOSTS } from './client';
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

  /** Upload a profile photo to AWS S3 via the backend */
  uploadProfilePhoto: async (imageFile: File): Promise<UserData> => {
    const formData = new FormData();
    formData.append('file', imageFile);

    const token = typeof window !== 'undefined' ? localStorage.getItem('ecobite_token') : null;
    const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

    // 1. Try current configured baseURL first
    const primaryUrl = `${getBaseUrl()}/users/me/profile-photo`;
    try {
      const response = await axios.post<UserData>(primaryUrl, formData, {
        headers: { 'Content-Type': 'multipart/form-data', ...authHeader },
        timeout: 30000,
      });
      return response.data;
    } catch (primaryErr) {
      console.warn(`Primary URL ${primaryUrl} failed, trying candidate fallback hosts...`, primaryErr);
    }

    // 2. Try candidate fallback hosts
    for (const host of CANDIDATE_HOSTS) {
      const testUrl = `${host}/users/me/profile-photo`;
      if (testUrl === primaryUrl) continue;

      try {
        const formDataCopy = new FormData();
        formDataCopy.append('file', imageFile);
        const response = await axios.post<UserData>(testUrl, formDataCopy, {
          headers: { 'Content-Type': 'multipart/form-data', ...authHeader },
          timeout: 15000,
        });

        if (typeof window !== 'undefined') {
          const cleanHost = host.replace(/\/api\/v1$/, '');
          localStorage.setItem('ecobite_backend_ip', cleanHost);
        }
        return response.data;
      } catch {
        // try next
      }
    }

    throw new Error(`Could not upload profile photo to server at ${getBaseUrl()}`);
  },

  /** Remove the user's profile photo */
  deleteProfilePhoto: () =>
    apiClient.delete<UserData>('/users/me/profile-photo').then((r) => r.data),
};
