import axios from 'axios';
import { getBaseUrl } from './client';

export interface DetectResponse {
  ingredients: string[];
  confidence: number;
  model_available: boolean;
}

// Build request headers with optional auth token
function getHeaders(extra: Record<string, string> = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('ecobite_token') : null;
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

export const ingredientsApi = {
  detectVoice: async (audioBlob: Blob): Promise<DetectResponse> => {
    const file = new File([audioBlob], 'voice_input.wav', { type: 'audio/wav' });
    const formData = new FormData();
    formData.append('file', file);

    // 1. Try current configured baseURL first
    const primaryUrl = `${getBaseUrl()}/ingredients/voice-detect`;
    try {
      const response = await axios.post<DetectResponse>(primaryUrl, formData, {
        headers: getHeaders({ 'Content-Type': 'multipart/form-data' }),
        timeout: 30000,
      });
      return response.data;
    } catch (primaryErr) {
      console.warn(`Primary URL ${primaryUrl} failed, trying candidate fallback hosts...`, primaryErr);
    }

    // No fallback hosts – if primary fails, propagate the error
    throw new Error(`Could not connect to backend server at ${primaryUrl}`);
  },

  /** Detect food ingredients from an image using AWS Rekognition */
  detectImage: async (imageFile: File): Promise<DetectResponse> => {
    const formData = new FormData();
    formData.append('file', imageFile);

    // 1. Try current configured baseURL first
    const primaryUrl = `${getBaseUrl()}/ingredients/image-detect`;
    try {
      const response = await axios.post<DetectResponse>(primaryUrl, formData, {
        headers: getHeaders({ 'Content-Type': 'multipart/form-data' }),
        timeout: 30000,
      });
      return response.data;
    } catch (primaryErr) {
      console.warn(`Primary URL ${primaryUrl} failed, trying candidate fallback hosts...`, primaryErr);
    }

    // No fallback hosts – if primary fails, propagate the error
    throw new Error(`Could not connect to backend server at ${primaryUrl}`);
  },
};
