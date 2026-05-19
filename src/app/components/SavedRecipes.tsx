import { useState, useEffect, useCallback } from 'react';
import { Heart, Clock, ChefHat, ShoppingCart, Users, Loader2 } from 'lucide-react';
import { recipesApi, Recipe } from '../../api/recipes';
import { ImageWithFallback } from './figma/ImageWithFallback';

export function SavedRecipes() {
  const [savedRecipes, setSavedRecipes] = useState<Recipe[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [unsavingId, setUnsavingId] = useState<string | null>(null);

  const fetchSaved = useCallback(async () => {
    setLoading(true);
    try {
      const data = await recipesApi.getSaved();
      setSavedRecipes(data.map((s) => s.recipe));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSaved(); }, [fetchSaved]);

  const handleUnsave = async (recipe: Recipe) => {
    setUnsavingId(recipe.id);
    try {
      await recipesApi.unsave(recipe.id);
      setSavedRecipes((prev) => prev.filter((r) => r.id !== recipe.id));
      if (selectedRecipe?.id === recipe.id) setSelectedRecipe(null);
    } catch {
      // silent
    } finally {
      setUnsavingId(null);
    }
  };

  // ── Recipe Detail ───────────────────────────────────────────────────────────
  if (selectedRecipe) {
    return (
      <div className="h-full bg-gradient-to-br from-emerald-50 via-teal-50 to-lime-50 flex flex-col">
        <div className="flex-1 overflow-y-auto pb-6">
          <div className="relative">
            <ImageWithFallback src={selectedRecipe.imageUrl} alt={selectedRecipe.name} className="w-full h-56 object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute top-4 left-0 right-0 px-6 flex justify-between items-center">
              <button onClick={() => setSelectedRecipe(null)} className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg active:scale-95">
                <span className="text-xl">←</span>
              </button>
              <button
                onClick={() => handleUnsave(selectedRecipe)}
                disabled={unsavingId === selectedRecipe.id}
                className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg active:scale-95 disabled:opacity-60"
              >
                <Heart className="w-5 h-5 fill-red-500 text-red-500" />
              </button>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
              <h1 className="text-xl font-bold mb-1">{selectedRecipe.name}</h1>
              <p className="opacity-90 text-xs">{selectedRecipe.description}</p>
              <div className="flex gap-4 mt-4 text-xs">
                <div className="flex items-center gap-1"><Clock className="w-4 h-4" /><span>{selectedRecipe.cookTime}</span></div>
                <div className="flex items-center gap-1"><Users className="w-4 h-4" /><span>{selectedRecipe.servings} servings</span></div>
                <div className="flex items-center gap-1"><ChefHat className="w-4 h-4" /><span>{selectedRecipe.difficulty}</span></div>
              </div>
            </div>
          </div>

          <div className="px-6 mt-4">
            {selectedRecipe.missingIngredients.length > 0 && (
              <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <ShoppingCart className="w-5 h-5 text-amber-600" />
                  <h3 className="font-semibold text-amber-900 text-sm">You'll need to buy:</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedRecipe.missingIngredients.map((ing, i) => (
                    <span key={i} className="bg-amber-100 text-amber-800 px-3 py-1.5 rounded-full font-medium text-xs">{ing}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-5">
              <h3 className="text-sm font-semibold mb-3 text-gray-800 uppercase tracking-wide">All Ingredients</h3>
              <ul className="space-y-2">
                {selectedRecipe.ingredients.map((ing, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1.5" />
                    <span className="text-gray-700 text-sm">{ing}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-3 text-gray-800 uppercase tracking-wide">Instructions</h3>
              <ol className="space-y-3">
                {selectedRecipe.instructions.map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <div className="w-6 h-6 bg-gradient-to-r from-emerald-500 to-lime-500 text-white rounded-full flex items-center justify-center font-semibold flex-shrink-0 text-xs">
                      {i + 1}
                    </div>
                    <p className="text-gray-700 text-sm pt-0.5">{step}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── List ────────────────────────────────────────────────────────────────────
  return (
    <div className="h-full bg-gradient-to-br from-emerald-50 via-teal-50 to-lime-50 flex flex-col">
      <div className="flex-shrink-0 px-6 pt-6 pb-4">
        <h1 className="text-lg font-bold text-center mb-1 bg-gradient-to-r from-emerald-600 to-lime-600 bg-clip-text text-transparent">
          Saved Recipes
        </h1>
        <p className="text-gray-600 text-center text-xs">
          {loading ? 'Loading…' : `${savedRecipes.length} saved ${savedRecipes.length === 1 ? 'recipe' : 'recipes'}`}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          </div>
        ) : savedRecipes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <Heart className="w-16 h-16 text-gray-300 mb-4" />
            <h3 className="font-semibold text-gray-700 mb-2">No saved recipes yet</h3>
            <p className="text-gray-500 text-sm">
              Tap the heart icon on any recipe to save it here
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {savedRecipes.map((recipe) => (
              <div key={recipe.id} className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden border-2 border-emerald-100">
                <div className="relative">
                  <ImageWithFallback src={recipe.imageUrl} alt={recipe.name} className="w-full h-40 object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                  <button
                    onClick={(e) => { e.stopPropagation(); handleUnsave(recipe); }}
                    disabled={unsavingId === recipe.id}
                    className="absolute top-3 right-3 w-11 h-11 bg-white/95 backdrop-blur-md rounded-full flex items-center justify-center shadow-2xl active:scale-90 border-2 border-white/50 disabled:opacity-60"
                  >
                    <Heart className="w-5 h-5 fill-red-500 text-red-500 scale-110" />
                  </button>
                </div>

                <div className="p-4 cursor-pointer active:bg-emerald-50/50" onClick={() => setSelectedRecipe(recipe)}>
                  <h3 className="font-bold text-gray-800 mb-1">{recipe.name}</h3>
                  <p className="text-gray-600 text-xs mb-3 line-clamp-2">{recipe.description}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                    <div className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /><span>{recipe.cookTime}</span></div>
                    <div className="flex items-center gap-1"><ChefHat className="w-3.5 h-3.5" /><span>{recipe.difficulty}</span></div>
                  </div>

                  {recipe.missingIngredients.length === 0 ? (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-2.5 text-center">
                      <span className="text-xs font-medium text-emerald-700">✓ You have all ingredients!</span>
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <ShoppingCart className="w-3.5 h-3.5 text-amber-600" />
                        <span className="text-xs font-medium text-amber-900">Need {recipe.missingIngredients.length} items</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
