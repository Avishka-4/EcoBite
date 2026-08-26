import axios from 'axios';
import { apiClient, getBaseUrl, CANDIDATE_HOSTS } from './client';

export interface DetectResponse {
  ingredients: string[];
  confidence: number;
  model_available: boolean;
}

export const ingredientsApi = {
  detectVoice: async (audioBlob: Blob): Promise<DetectResponse> => {
    const file = new File([audioBlob], 'voice_input.wav', { type: 'audio/wav' });
    const formData = new FormData();
    formData.append('file', file);

    const token = typeof window !== 'undefined' ? localStorage.getItem('ecobite_token') : null;
    const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

    // 1. Try current configured baseURL first
    const primaryUrl = `${getBaseUrl()}/ingredients/voice-detect`;
    try {
      const response = await axios.post<DetectResponse>(primaryUrl, formData, {
        headers: { 'Content-Type': 'multipart/form-data', ...authHeader },
        timeout: 10000,
      });
      return response.data;
    } catch (primaryErr) {
      console.warn(`Primary URL ${primaryUrl} failed, trying candidate fallback hosts...`, primaryErr);
    }

    // 2. Try candidate fallback hosts
    for (const host of CANDIDATE_HOSTS) {
      const testUrl = `${host}/ingredients/voice-detect`;
      if (testUrl === primaryUrl) continue;

      try {
        const formDataCopy = new FormData();
        formDataCopy.append('file', file);
        const response = await axios.post<DetectResponse>(testUrl, formDataCopy, {
          headers: { 'Content-Type': 'multipart/form-data', ...authHeader },
          timeout: 4000,
        });

        // Remember the working host for all future requests!
        if (typeof window !== 'undefined') {
          const cleanHost = host.replace(/\/api\/v1$/, '');
          localStorage.setItem('ecobite_backend_ip', cleanHost);
        }
        return response.data;
      } catch {
        // try next
      }
    }

    throw new Error(`Could not connect to backend server at ${getBaseUrl()}`);
  },
};
