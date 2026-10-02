import axios from 'axios';
import { apiClient, getBaseUrl, CANDIDATE_HOSTS } from './client';

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
  /** Generate recipes — tries primary URL then falls back through candidate hosts */
  generate: async (data: GenerateRequest): Promise<Recipe[]> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('ecobite_token') : null;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    // 1. Try current configured baseURL first
    const primaryUrl = `${getBaseUrl()}/recipes/generate`;
    try {
      const response = await axios.post<Recipe[]>(primaryUrl, data, {
        headers,
        timeout: 30000, // Bedrock can take time
      });
      return response.data;
    } catch (primaryErr) {
      console.warn(`Primary URL ${primaryUrl} failed, trying candidate fallback hosts...`, primaryErr);
    }

    // 2. Try candidate fallback hosts
    for (const host of CANDIDATE_HOSTS) {
      const testUrl = `${host}/recipes/generate`;
      if (testUrl === primaryUrl) continue;

      try {
        const response = await axios.post<Recipe[]>(testUrl, data, {
          headers,
          timeout: 15000,
        });

        // Removed local IP caching to ensure public URL remains active
        return response.data;
      } catch {
        // try next
      }
    }

    throw new Error(`Could not connect to backend server at ${getBaseUrl()}`);
  },

  getSaved: async (): Promise<SavedRecipeResponse[]> => {
    if (typeof window === 'undefined') return [];
    const saved = localStorage.getItem('ecobite_saved_recipes');
    return saved ? JSON.parse(saved) : [];
  },

  save: async (recipe: Recipe): Promise<SavedRecipeResponse> => {
    if (typeof window === 'undefined') throw new Error('No local storage');
    const saved = localStorage.getItem('ecobite_saved_recipes');
    const recipes: SavedRecipeResponse[] = saved ? JSON.parse(saved) : [];
    
    // Check if already saved
    const exists = recipes.find(r => r.recipe.id === recipe.id);
    if (exists) return exists;

    const newSaved: SavedRecipeResponse = { id: Date.now(), recipe };
    recipes.push(newSaved);
    localStorage.setItem('ecobite_saved_recipes', JSON.stringify(recipes));
    return newSaved;
  },

  unsave: async (recipeId: string): Promise<void> => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem('ecobite_saved_recipes');
    if (!saved) return;
    
    const recipes: SavedRecipeResponse[] = JSON.parse(saved);
    const filtered = recipes.filter(r => r.recipe.id !== recipeId);
    localStorage.setItem('ecobite_saved_recipes', JSON.stringify(filtered));
  },
};
