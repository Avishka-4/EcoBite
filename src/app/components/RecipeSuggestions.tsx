import { useState, useEffect, useCallback } from 'react';
import { Clock, Users, ChefHat, ShoppingCart, Sparkles, Heart, AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { recipesApi, Recipe } from '../../api/recipes';
import { ImageWithFallback } from './figma/ImageWithFallback';

export type { Recipe };

interface RecipeSuggestionsProps {
  ingredients: string[];
  onBack: () => void;
}

const CUISINES = [
  { name: 'Sri Lankan', emoji: '🇱🇰' },
  { name: 'Indian', emoji: '🇮🇳' },
  { name: 'Italian', emoji: '🇮🇹' },
  { name: 'Korean', emoji: '🇰🇷' },
  { name: 'Chinese', emoji: '🇨🇳' },
  { name: 'Malaysian', emoji: '🇲🇾' },
  { name: 'American', emoji: '🇺🇸' },
  { name: 'English', emoji: '🇬🇧' },
];


export function RecipeSuggestions({ ingredients, onBack }: RecipeSuggestionsProps) {
  const { user } = useAuth();
  const [selectedCuisine, setSelectedCuisine] = useState(user?.preferred_cuisine || 'Sri Lankan');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadRecipes = useCallback(async (cuisineToUse?: string) => {
    setLoading(true);
    setError('');
    const targetCuisine = cuisineToUse || selectedCuisine;
    try {
      const data = await recipesApi.generate({
        ingredients,
        cuisine: targetCuisine,
        experience_level: user?.cooking_experience ?? 'beginner',
        count: 4,
      });
      if (data && data.length > 0) {
        setRecipes(data);
      } else {
        setError('No recipes returned. Please try again.');
      }
    } catch (err: unknown) {
      console.error('Recipe generation error:', err);
      const message = err instanceof Error ? err.message : 'Failed to generate recipes.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [ingredients, selectedCuisine, user]);

  const loadSaved = useCallback(async () => {
    try {
      const saved = await recipesApi.getSaved();
      setSavedIds(new Set(saved.map((s) => s.recipe.id)));
    } catch {
      // not critical
    }
  }, []);

  useEffect(() => {
    loadRecipes(selectedCuisine);
    loadSaved();
  }, [selectedCuisine]); // Re-fetch whenever selected cuisine changes

  const handleCuisineSelect = (cName: string) => {
    if (cName !== selectedCuisine) {
      setSelectedCuisine(cName);
      loadRecipes(cName);
    }
  };

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
      // Toggle locally
      setSavedIds((prev) => {
        const s = new Set(prev);
        if (s.has(recipe.id)) s.delete(recipe.id);
        else s.add(recipe.id);
        return s;
      });
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
              <svg viewBox="0 0 120 120" className="w-28 h-28 mx-auto">
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
              <h3 className="font-bold text-gray-800 text-lg">Finding {selectedCuisine} Recipes</h3>
            </div>
            <p className="text-gray-600 text-xs mb-4">Generating recipes with AWS Bedrock AI…</p>
            <div className="space-y-2 text-left">
              {['Connecting to AWS Bedrock…', 'Matching your ingredients…', 'Generating personalized recipes…'].map((txt, i) => (
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
            <button onClick={() => loadRecipes()} className="bg-gradient-to-r from-emerald-500 to-lime-500 text-white px-4 py-2 rounded-xl font-semibold text-sm">
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
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
            <div className="absolute top-4 left-0 right-0 px-6 flex justify-between items-center">
              <button
                onClick={() => setSelectedRecipe(null)}
                className="w-10 h-10 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg active:scale-95 text-gray-700"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => toggleSave(selectedRecipe)}
                disabled={savingId === selectedRecipe.id}
                className="w-10 h-10 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg active:scale-95"
              >
                <Heart className={`w-5 h-5 ${isSaved ? 'fill-red-500 text-red-500' : 'text-gray-700'}`} />
              </button>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
              <h1 className="text-xl font-bold mb-1">{selectedRecipe.name}</h1>
              <p className="opacity-90 text-xs">{selectedRecipe.description}</p>
              <div className="flex gap-4 mt-3 text-xs">
                <div className="flex items-center gap-1"><Clock className="w-4 h-4" /><span>{selectedRecipe.cookTime}</span></div>
                <div className="flex items-center gap-1"><Users className="w-4 h-4" /><span>{selectedRecipe.servings} servings</span></div>
                <div className="flex items-center gap-1"><ChefHat className="w-4 h-4" /><span>{selectedRecipe.difficulty}</span></div>
              </div>
            </div>
          </div>

          <div className="px-6 mt-4">
            {selectedRecipe.missingIngredients.length > 0 && (
              <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 mb-5 shadow-sm">
                <div className="flex items-center gap-2 mb-2.5">
                  <ShoppingCart className="w-4 h-4 text-amber-600" />
                  <h3 className="font-bold text-amber-900 text-xs uppercase tracking-wide">
                    Missing Ingredients ({selectedRecipe.missingIngredients.length})
                  </h3>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedRecipe.missingIngredients.map((ing, i) => (
                    <span key={i} className="bg-amber-100 text-amber-900 px-3 py-1 rounded-full font-medium text-xs border border-amber-200">
                      + {ing}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-5 bg-white/90 backdrop-blur-sm p-4 rounded-2xl border-2 border-emerald-100 shadow-md">
              <h3 className="text-xs font-bold mb-3 text-emerald-800 uppercase tracking-wide">All Ingredients</h3>
              <ul className="space-y-2">
                {selectedRecipe.ingredients.map((ing, i) => {
                  const hasIt = ingredients.some(userIng => ing.toLowerCase().includes(userIng.toLowerCase()));
                  return (
                    <li key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${hasIt ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                        <span className={`capitalize ${hasIt ? 'font-semibold text-emerald-900' : 'text-gray-600'}`}>{ing}</span>
                      </div>
                      {hasIt && <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">✓ Have</span>}
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="bg-white/90 backdrop-blur-sm p-4 rounded-2xl border-2 border-emerald-100 shadow-md">
              <h3 className="text-xs font-bold mb-3 text-emerald-800 uppercase tracking-wide">Instructions</h3>
              <ol className="space-y-3">
                {selectedRecipe.instructions.map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <div className="w-5 h-5 bg-gradient-to-r from-emerald-500 to-lime-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0 text-[11px] mt-0.5">
                      {i + 1}
                    </div>
                    <p className="text-gray-700 text-xs leading-relaxed">{step}</p>
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
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-6 pb-2">
        <div className="flex items-center justify-between mb-3">
          <button onClick={onBack} className="w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-md active:scale-95 text-gray-700">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="text-center">
            <h1 className="text-lg font-bold bg-gradient-to-r from-emerald-600 to-lime-600 bg-clip-text text-transparent">
              Recipe Suggestions
            </h1>
            <p className="text-gray-500 text-xs">
              Matching your {ingredients.length} ingredient{ingredients.length > 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={() => loadRecipes()} className="w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-md active:scale-95 text-emerald-600" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* 8 Cuisines Tabs Bar */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none -mx-2 px-2">
          {CUISINES.map((c) => (
            <button
              key={c.name}
              onClick={() => handleCuisineSelect(c.name)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1 active:scale-95 ${
                selectedCuisine === c.name
                  ? 'bg-gradient-to-r from-emerald-500 to-lime-500 text-white shadow-md'
                  : 'bg-white/80 text-gray-600 border border-emerald-100 hover:bg-emerald-50'
              }`}
            >
              <span>{c.emoji}</span>
              <span>{c.name}</span>
            </button>
          ))}
        </div>
      </div>



      {/* Recipes Cards Scroll View */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="space-y-4">
          {recipes.map((recipe) => {
            const isSaved = savedIds.has(recipe.id);
            return (
              <div key={recipe.id} className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl overflow-hidden border-2 border-emerald-100 transition-all hover:border-emerald-300">
                <div className="relative">
                  <ImageWithFallback src={recipe.imageUrl} alt={recipe.name} className="w-full h-40 object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSave(recipe); }}
                    disabled={savingId === recipe.id}
                    className="absolute top-3 right-3 w-10 h-10 bg-white/95 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg active:scale-90 border border-white/50"
                  >
                    <Heart className={`w-4 h-4 ${isSaved ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} />
                  </button>
                  <div className="absolute bottom-2.5 left-4 right-4 text-white">
                    <h3 className="font-bold text-sm drop-shadow">{recipe.name}</h3>
                  </div>
                </div>

                <div className="p-4 cursor-pointer active:bg-emerald-50/50" onClick={() => setSelectedRecipe(recipe)}>
                  <p className="text-gray-600 text-xs mb-3 line-clamp-2">{recipe.description}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mb-3 font-medium">
                    <div className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-emerald-600" /><span>{recipe.cookTime}</span></div>
                    <div className="flex items-center gap-1"><ChefHat className="w-3.5 h-3.5 text-emerald-600" /><span>{recipe.difficulty}</span></div>
                    <div className="flex items-center gap-1"><Users className="w-3.5 h-3.5 text-emerald-600" /><span>{recipe.servings} servings</span></div>
                  </div>

                  {recipe.missingIngredients.length > 0 ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-2.5">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <ShoppingCart className="w-3.5 h-3.5 text-amber-600" />
                        <span className="text-xs font-bold text-amber-900">
                          Need: {recipe.missingIngredients.length} item{recipe.missingIngredients.length > 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {recipe.missingIngredients.slice(0, 3).map((ing, i) => (
                          <span key={i} className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full text-[11px] font-medium">+ {ing}</span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-2.5 text-center">
                      <span className="text-xs font-bold text-emerald-700">✓ You have all ingredients!</span>
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
