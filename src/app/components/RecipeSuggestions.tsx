import { useState, useEffect, useCallback } from 'react';
import { Clock, Users, ChefHat, ShoppingCart, Sparkles, Heart, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { recipesApi, Recipe } from '../../api/recipes';
import { ImageWithFallback } from './figma/ImageWithFallback';

export type { Recipe };

interface RecipeSuggestionsProps {
  ingredients: string[];
  onBack: () => void;
}

export function RecipeSuggestions({ ingredients, onBack }: RecipeSuggestionsProps) {
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadRecipes = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await recipesApi.generate({
        ingredients,
        cuisine: user?.preferred_cuisine ?? undefined,
        experience_level: user?.cooking_experience ?? 'beginner',
        count: 3,
      });
      setRecipes(data);
    } catch {
      setError('Failed to generate recipes. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [ingredients, user]);

  const loadSaved = useCallback(async () => {
    try {
      const saved = await recipesApi.getSaved();
      setSavedIds(new Set(saved.map((s) => s.recipe.id)));
    } catch {
      // not critical
    }
  }, []);

  useEffect(() => {
    loadRecipes();
    loadSaved();
  }, [loadRecipes, loadSaved]);

  const toggleSave = async (recipe: Recipe) => {
    setSavingId(recipe.id);
    try {
      if (savedIds.has(recipe.id)) {
        await recipesApi.unsave(recipe.id);
        setSavedIds((prev) => { const s = new Set(prev); s.delete(recipe.id); return s; });
      } else {
        await recipesApi.save(recipe);
        setSavedIds((prev) => new Set(prev).add(recipe.id));
      }
    } catch {
      // silent fail
    } finally {
      setSavingId(null);
    }
  };

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="h-full bg-gradient-to-br from-emerald-50 via-teal-50 to-lime-50 flex flex-col items-center justify-center px-6">
        <div className="text-center max-w-sm w-full">
          <div className="relative mb-8">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-32 h-32 bg-gradient-to-r from-emerald-400 via-teal-400 to-lime-400 rounded-full blur-3xl opacity-40 animate-pulse" />
            </div>
            <div className="relative">
              <svg viewBox="0 0 120 120" className="w-32 h-32 mx-auto">
                <circle cx="40" cy="20" r="3" fill="#10b981" opacity="0.6" className="animate-ping" style={{ animationDelay: '0s' }} />
                <circle cx="60" cy="15" r="4" fill="#14b8a6" opacity="0.6" className="animate-ping" style={{ animationDelay: '0.3s' }} />
                <circle cx="80" cy="20" r="3" fill="#84cc16" opacity="0.6" className="animate-ping" style={{ animationDelay: '0.6s' }} />
                <rect x="30" y="50" width="60" height="45" rx="8" fill="url(#potGradient)" stroke="#059669" strokeWidth="3" />
                <ellipse cx="60" cy="50" rx="30" ry="6" fill="#d1fae5" stroke="#059669" strokeWidth="3" />
                <path d="M28 60 Q20 60, 20 68 Q20 76, 28 76" fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" />
                <path d="M92 60 Q100 60, 100 68 Q100 76, 92 76" fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" />
                <ellipse cx="60" cy="45" rx="28" ry="5" fill="#10b981" stroke="#059669" strokeWidth="2.5" className="animate-bounce" style={{ animationDuration: '1.5s' }} />
                <circle cx="60" cy="40" r="4" fill="#059669" className="animate-bounce" style={{ animationDuration: '1.5s' }} />
                <circle cx="50" cy="70" r="4" fill="#ef4444" opacity="0.8" />
                <circle cx="70" cy="75" r="3.5" fill="#fb923c" opacity="0.8" />
                <circle cx="60" cy="80" r="3" fill="#84cc16" opacity="0.8" />
                <defs>
                  <linearGradient id="potGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#6ee7b7" />
                    <stop offset="100%" stopColor="#34d399" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-md rounded-3xl p-6 shadow-2xl border-2 border-emerald-200">
            <div className="flex items-center justify-center gap-2 mb-3">
              <ChefHat className="w-6 h-6 text-emerald-600 animate-bounce" />
              <h3 className="font-bold text-gray-800 text-xl">Cooking up ideas</h3>
              <span className="flex gap-1">
                {[0, 0.2, 0.4].map((delay) => (
                  <span key={delay} className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce" style={{ animationDelay: `${delay}s` }} />
                ))}
              </span>
            </div>
            <p className="text-gray-600 text-sm mb-4">Claude AI is crafting your personalized recipes</p>
            <div className="space-y-2 text-left">
              {['Analyzing your ingredients…', 'Matching your cuisine style…', 'Personalizing for your level…'].map((txt, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-gray-500">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500 animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
                  <span>{txt}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="h-full flex items-center justify-center px-6">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h3 className="font-bold text-gray-800 mb-2">Something went wrong</h3>
          <p className="text-gray-600 text-sm mb-4">{error}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={onBack} className="px-4 py-2 rounded-xl border-2 border-emerald-200 text-emerald-700 font-semibold text-sm">
              Go Back
            </button>
            <button onClick={loadRecipes} className="bg-gradient-to-r from-emerald-500 to-lime-500 text-white px-4 py-2 rounded-xl font-semibold text-sm">
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Recipe Detail ───────────────────────────────────────────────────────────
  if (selectedRecipe) {
    const isSaved = savedIds.has(selectedRecipe.id);
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
                onClick={() => toggleSave(selectedRecipe)}
                disabled={savingId === selectedRecipe.id}
                className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg active:scale-95"
              >
                <Heart className={`w-5 h-5 ${isSaved ? 'fill-red-500 text-red-500' : 'text-gray-700'}`} />
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

  // ── Recipe List ─────────────────────────────────────────────────────────────
  return (
    <div className="h-full bg-gradient-to-br from-emerald-50 via-teal-50 to-lime-50 flex flex-col">
      <div className="flex-shrink-0 px-6 pt-6 pb-4">
        <div className="relative">
          <button onClick={onBack} className="absolute left-0 top-0 w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-md active:scale-95">
            <span className="text-lg">←</span>
          </button>
          <div className="text-center">
            <h1 className="text-lg font-bold mb-1 bg-gradient-to-r from-emerald-600 to-lime-600 bg-clip-text text-transparent">
              Recipe Suggestions
            </h1>
            <p className="text-gray-600 text-xs">
              {recipes.length} {user?.preferred_cuisine} recipes for you
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="space-y-4">
          {recipes.map((recipe) => {
            const isSaved = savedIds.has(recipe.id);
            return (
              <div key={recipe.id} className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden border-2 border-emerald-100">
                <div className="relative">
                  <ImageWithFallback src={recipe.imageUrl} alt={recipe.name} className="w-full h-40 object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSave(recipe); }}
                    disabled={savingId === recipe.id}
                    className="absolute top-3 right-3 w-11 h-11 bg-white/95 backdrop-blur-md rounded-full flex items-center justify-center shadow-2xl active:scale-90 border-2 border-white/50 disabled:opacity-60"
                  >
                    <Heart className={`w-5 h-5 ${isSaved ? 'fill-red-500 text-red-500 scale-110' : 'text-gray-600'}`} />
                  </button>
                </div>

                <div className="p-4 cursor-pointer active:bg-emerald-50/50" onClick={() => setSelectedRecipe(recipe)}>
                  <h3 className="font-bold text-gray-800 mb-1">{recipe.name}</h3>
                  <p className="text-gray-600 text-xs mb-3 line-clamp-2">{recipe.description}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                    <div className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /><span>{recipe.cookTime}</span></div>
                    <div className="flex items-center gap-1"><ChefHat className="w-3.5 h-3.5" /><span>{recipe.difficulty}</span></div>
                  </div>

                  {recipe.missingIngredients.length > 0 ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <ShoppingCart className="w-3.5 h-3.5 text-amber-600" />
                        <span className="text-xs font-medium text-amber-900">
                          Need: {recipe.missingIngredients.length} item{recipe.missingIngredients.length > 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {recipe.missingIngredients.slice(0, 2).map((ing, i) => (
                          <span key={i} className="bg-amber-100 text-amber-800 px-2 py-1 rounded-full text-xs">{ing}</span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-2.5 text-center">
                      <span className="text-xs font-medium text-emerald-700">✓ You have all ingredients!</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
