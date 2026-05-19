import { apiClient } from './client';

export interface Recipe {
  id: string;
  name: string;
  description: string;
  cookTime: string;
  servings: number;
  difficulty: string;
  ingredients: string[];
  missingIngredients: string[];
  instructions: string[];
  imageUrl: string;
}

export interface GenerateRequest {
  ingredients: string[];
  cuisine?: string;
  experience_level?: string;
  count?: number;
}

export interface SavedRecipeResponse {
  id: number;
  recipe: Recipe;
}

export const recipesApi = {
  generate: (data: GenerateRequest) =>
    apiClient.post<Recipe[]>('/recipes/generate', data).then((r) => r.data),

  getSaved: () =>
    apiClient.get<SavedRecipeResponse[]>('/recipes/saved').then((r) => r.data),

  save: (recipe: Recipe) =>
    apiClient.post<SavedRecipeResponse>('/recipes/saved', { recipe }).then((r) => r.data),

  unsave: (recipeId: string) =>
    apiClient.delete(`/recipes/saved/${recipeId}`).then((r) => r.data),
};
