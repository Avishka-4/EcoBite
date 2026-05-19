import { useState } from 'react';
import { Camera, Plus, X, Sparkles, Edit3, AlertCircle } from 'lucide-react';
import { Logo } from './Logo';
import { useAuth } from '../../context/AuthContext';
import { ingredientsApi } from '../../api/ingredients';

interface FoodInputProps {
  onGenerateRecipes: (ingredients: string[]) => void;
}

type InputMode = 'choice' | 'photo' | 'manual';

export function FoodInput({ onGenerateRecipes }: FoodInputProps) {
  const { user } = useAuth();
  const [inputMode, setInputMode] = useState<InputMode>('choice');
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [modelWarning, setModelWarning] = useState(false);

  const handleAddIngredient = () => {
    const val = inputValue.trim();
    if (val) {
      setIngredients((prev) => [...prev, val]);
      setInputValue('');
    }
  };

  const handleRemoveIngredient = (index: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDetecting(true);
    setModelWarning(false);
    try {
      const result = await ingredientsApi.detect(file);
      setIngredients(result.ingredients);
      if (!result.model_available) setModelWarning(true);
    } catch {
      // Fall back to a few placeholder ingredients so the UX isn't broken
      setIngredients(['tomatoes', 'onions', 'garlic']);
      setModelWarning(true);
    } finally {
      setDetecting(false);
    }
  };

  const handleGenerate = () => {
    if (ingredients.length > 0) onGenerateRecipes(ingredients);
  };

  const IngredientChips = () => (
    <div className="flex flex-wrap gap-2">
      {ingredients.map((ingredient, index) => (
        <div
          key={index}
          className="bg-gradient-to-r from-emerald-100 to-lime-100 px-3 py-1.5 rounded-full flex items-center gap-2 border border-emerald-200"
        >
          <span className="text-emerald-800 font-semibold text-sm">{ingredient}</span>
          <button
            onClick={() => handleRemoveIngredient(index)}
            className="text-emerald-600 active:text-red-500 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );

  // ── Choice Screen ───────────────────────────────────────────────────────────
  if (inputMode === 'choice') {
    return (
      <div className="h-full bg-gradient-to-br from-emerald-50 via-teal-50 to-lime-50 flex flex-col">
        <div className="flex-1 flex flex-col justify-center px-6 py-8">
          <div className="flex flex-col items-center mb-12">
            <div className="mb-6 relative">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-lime-400 rounded-full blur-xl opacity-40 animate-pulse" />
              <Logo className="w-20 h-20 relative" />
            </div>
            <h1 className="text-2xl font-bold mb-2 bg-gradient-to-r from-emerald-600 to-lime-600 bg-clip-text text-transparent">
              Hi {user?.name}! 👋
            </h1>
            <p className="text-gray-600 text-sm">How would you like to add ingredients?</p>
          </div>

          <div className="space-y-4 max-w-sm mx-auto w-full">
            <button
              onClick={() => setInputMode('photo')}
              className="w-full bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-6 active:scale-95 transition-all flex items-center gap-4 border-2 border-emerald-100 hover:shadow-2xl"
            >
              <div className="bg-gradient-to-br from-emerald-400 to-lime-400 w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg">
                <Camera className="w-8 h-8 text-white" />
              </div>
              <div className="text-left flex-1">
                <h3 className="font-bold text-gray-800 mb-1">Take a Photo</h3>
                <p className="text-gray-500 text-xs">AI will identify ingredients</p>
              </div>
            </button>

            <button
              onClick={() => setInputMode('manual')}
              className="w-full bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-6 active:scale-95 transition-all flex items-center gap-4 border-2 border-emerald-100 hover:shadow-2xl"
            >
              <div className="bg-gradient-to-br from-emerald-400 to-lime-400 w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg">
                <Edit3 className="w-8 h-8 text-white" />
              </div>
              <div className="text-left flex-1">
                <h3 className="font-bold text-gray-800 mb-1">Add Manually</h3>
                <p className="text-gray-500 text-xs">Type ingredients one by one</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Photo Mode ──────────────────────────────────────────────────────────────
  if (inputMode === 'photo') {
    return (
      <div className="h-full bg-gradient-to-br from-emerald-50 via-teal-50 to-lime-50 flex flex-col">
        <div className="flex-shrink-0 px-6 pt-8 pb-4">
          <div className="relative">
            <button
              onClick={() => { setInputMode('choice'); setIngredients([]); setInputValue(''); }}
              className="absolute left-0 top-0 w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-md active:scale-95"
            >
              <span className="text-lg">←</span>
            </button>
            <h1 className="text-xl font-bold text-center mb-1 bg-gradient-to-r from-emerald-600 to-lime-600 bg-clip-text text-transparent">
              Take a Photo
            </h1>
            <p className="text-gray-600 text-center text-sm">Upload a picture of your ingredients</p>
          </div>
        </div>

        <div className="flex-1 px-6 pb-6 flex flex-col">
          {modelWarning && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <p className="text-xs text-amber-800">
                YOLO model not yet trained — showing sample ingredients. You can edit them below.
              </p>
            </div>
          )}

          {ingredients.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              {detecting ? (
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-emerald-600 font-semibold text-sm">Detecting ingredients…</p>
                </div>
              ) : (
                <label className="block cursor-pointer w-full max-w-sm">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                  <div className="border-3 border-dashed border-emerald-300 rounded-3xl p-12 text-center transition-all bg-white">
                    <Camera className="w-20 h-20 mx-auto mb-4 text-emerald-500" />
                    <p className="font-semibold text-gray-700 mb-1">Take or upload a photo</p>
                    <p className="text-xs text-gray-500">AI will detect ingredients</p>
                  </div>
                </label>
              )}
            </div>
          ) : (
            <>
              <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-4 mb-4 border-2 border-emerald-100">
                <label className="block text-xs font-bold text-emerald-700 mb-2 uppercase tracking-wide flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Add More Ingredients
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddIngredient()}
                    placeholder="e.g., olive oil, salt"
                    className="flex-1 px-4 py-3 rounded-2xl bg-white border-2 border-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition text-sm"
                  />
                  <button onClick={handleAddIngredient} className="bg-gradient-to-r from-emerald-500 to-lime-500 text-white p-3 rounded-2xl active:scale-95 shadow-lg">
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 mb-4 overflow-y-auto">
                <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-5 border-2 border-emerald-100">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-emerald-700 uppercase tracking-wide flex items-center gap-2">
                      <Camera className="w-4 h-4" /> Ingredients ({ingredients.length})
                    </h3>
                    <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> AI Detected
                    </span>
                  </div>
                  <IngredientChips />
                </div>
              </div>

              <button onClick={handleGenerate} className="w-full bg-gradient-to-r from-emerald-500 to-lime-500 text-white py-4 rounded-2xl font-bold active:scale-95 shadow-xl flex items-center justify-center gap-2">
                <Sparkles className="w-5 h-5" /> Generate Recipe Ideas
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Manual Mode ─────────────────────────────────────────────────────────────
  return (
    <div className="h-full bg-gradient-to-br from-emerald-50 via-teal-50 to-lime-50 flex flex-col">
      <div className="flex-shrink-0 px-6 pt-8 pb-4">
        <div className="relative">
          <button
            onClick={() => { setInputMode('choice'); setIngredients([]); setInputValue(''); }}
            className="absolute left-0 top-0 w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-md active:scale-95"
          >
            <span className="text-lg">←</span>
          </button>
          <h1 className="text-xl font-bold text-center mb-1 bg-gradient-to-r from-emerald-600 to-lime-600 bg-clip-text text-transparent">
            Add Ingredients
          </h1>
          <p className="text-gray-600 text-center text-sm">Type them one by one</p>
        </div>
      </div>

      <div className="flex-1 px-6 pb-6 flex flex-col">
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-4 mb-4 border-2 border-emerald-100">
          <label className="block text-xs font-bold text-emerald-700 mb-2 uppercase tracking-wide flex items-center gap-2">
            <Edit3 className="w-4 h-4" /> Type Your Ingredients
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddIngredient()}
              placeholder="e.g., tomatoes, eggs"
              className="flex-1 px-4 py-3 rounded-2xl bg-white border-2 border-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition text-sm"
            />
            <button onClick={handleAddIngredient} className="bg-gradient-to-r from-emerald-500 to-lime-500 text-white p-3 rounded-2xl active:scale-95 shadow-lg">
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {ingredients.length > 0 && (
          <>
            <div className="flex-1 mb-4 overflow-y-auto">
              <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-5 border-2 border-emerald-100">
                <h3 className="text-xs font-bold text-emerald-700 mb-3 uppercase tracking-wide flex items-center gap-2">
                  <Edit3 className="w-4 h-4" /> Your Ingredients ({ingredients.length})
                </h3>
                <IngredientChips />
              </div>
            </div>

            <button onClick={handleGenerate} className="w-full bg-gradient-to-r from-emerald-500 to-lime-500 text-white py-4 rounded-2xl font-bold active:scale-95 shadow-xl flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5" /> Generate Recipe Ideas
            </button>
          </>
        )}
      </div>
    </div>
  );
}
