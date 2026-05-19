import { apiClient } from './client';

export interface DetectResponse {
  ingredients: string[];
  confidence: number;
  model_available: boolean;
}

export const ingredientsApi = {
  detect: async (imageFile: File): Promise<DetectResponse> => {
    const formData = new FormData();
    formData.append('file', imageFile);
    const response = await apiClient.post<DetectResponse>('/ingredients/detect', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};
