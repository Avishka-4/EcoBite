import { useState, useEffect, useRef, useCallback } from 'react';
import {
  CheckCircle2, ChefHat, User, Camera, X, Loader2,
  Heart, Clock, ShoppingCart, ArrowLeft, Bookmark,
  BookOpen, Users, Star,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usersApi } from '../../api/users';
import { recipesApi, Recipe } from '../../api/recipes';
import { communityApi, CommunityQuestion } from '../../api/community';
import { ImageWithFallback } from './figma/ImageWithFallback';



const experienceLevels = [
  { level: 'beginner' as const, icon: '👨‍🍳', label: 'Beginner', desc: 'Just starting out' },
  { level: 'intermediate' as const, icon: '👩‍🍳', label: 'Intermediate', desc: 'Some cooking experience' },
  { level: 'advanced' as const, icon: '🧑‍🍳', label: 'Advanced', desc: 'Confident home chef' },
];

export function ProfileSetup() {
  const { user, updateUser } = useAuth();

  const [name, setName] = useState(user?.name ?? '');
  const [age, setAge] = useState(user?.age ? String(user.age) : '');
  const [cookingExperience, setCookingExperience] = useState<'beginner' | 'intermediate' | 'advanced'>(
    (user?.cooking_experience as 'beginner' | 'intermediate' | 'advanced') ?? 'beginner',
  );

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Profile photo state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');

  // ── Saved content state ──────────────────────────────────────────────────
  type SavedTab = 'recipes' | 'community';
  const [savedTab, setSavedTab] = useState<SavedTab>('recipes');
  const [savedRecipes, setSavedRecipes] = useState<Recipe[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [unsavingId, setUnsavingId] = useState<string | null>(null);
  const [myQuestions, setMyQuestions] = useState<CommunityQuestion[]>([]);

  const fetchSaved = useCallback(async () => {
    setSavedLoading(true);
    try {
      const data = await recipesApi.getSaved();
      setSavedRecipes(data.map((s) => s.recipe));
    } catch { /* silent */ } finally {
      setSavedLoading(false);
    }
  }, []);

  const fetchMyQuestions = useCallback(() => {
    const all = communityApi.getQuestions();
    const mine = all.filter((q) => q.authorName === (user?.name || 'Anonymous Chef'));
    setMyQuestions(mine);
  }, [user?.name]);

  useEffect(() => {
    fetchSaved();
    fetchMyQuestions();
  }, [fetchSaved, fetchMyQuestions]);

  const handleUnsave = async (recipe: Recipe) => {
    setUnsavingId(recipe.id);
    try {
      await recipesApi.unsave(recipe.id);
      setSavedRecipes((prev) => prev.filter((r) => r.id !== recipe.id));
      if (selectedRecipe?.id === recipe.id) setSelectedRecipe(null);
    } catch { /* silent */ } finally {
      setUnsavingId(null);
    }
  };

  useEffect(() => {
    if (user) {
      setName(user.name ?? '');
      setAge(user.age ? String(user.age) : '');
      setCookingExperience(
        (user.cooking_experience as 'beginner' | 'intermediate' | 'advanced') ?? 'beginner',
      );

    }
  }, [user]);

  const getInitials = (n: string) =>
    n
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?';

  // ── Handle Profile Photo Upload ──────────────────────────────────────────
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      setPhotoError('Please select a JPEG, PNG, WebP, or GIF image.');
      return;
    }

    // Validate file size (5 MB)
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Image must be smaller than 5 MB.');
      return;
    }

    setUploadingPhoto(true);
    setPhotoError('');

    try {
      const updatedUser = await usersApi.uploadProfilePhoto(file);
      updateUser(updatedUser);
    } catch (err: unknown) {
      console.error('Profile photo upload error:', err);
      const errorObj = err as { response?: { data?: { detail?: string } }; message?: string };
      const detail = errorObj.response?.data?.detail || errorObj.message || 'Upload failed';
      setPhotoError(detail);
    } finally {
      setUploadingPhoto(false);
      // Reset file input so same file can be re-selected
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // ── Handle Profile Photo Delete ──────────────────────────────────────────
  const handlePhotoDelete = async () => {
    setUploadingPhoto(true);
    setPhotoError('');
    try {
      const updatedUser = await usersApi.deleteProfilePhoto();
      updateUser(updatedUser);
    } catch (err: unknown) {
      console.error('Profile photo delete error:', err);
      setPhotoError('Could not remove photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !age) return;
    setSaving(true);
    setError('');
    try {
      const updated = await usersApi.updateMe({
        name: name.trim(),
        age: parseInt(age, 10),
        cooking_experience: cookingExperience,
      });
      updateUser(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      // If offline/local, still update local user state
      updateUser({
        ...user,
        name: name.trim(),
        age: parseInt(age, 10),
        cooking_experience: cookingExperience,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  // ── Recipe detail overlay ──────────────────────────────────────────────────
  if (selectedRecipe) {
    return (
      <div className="h-full bg-gradient-to-br from-emerald-50 via-teal-50 to-lime-50 flex flex-col">
        <div className="flex-1 overflow-y-auto pb-6">
          <div className="relative">
            <ImageWithFallback
              src={selectedRecipe.imageUrl}
              alt={selectedRecipe.name}
              className="w-full h-56 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute top-4 left-0 right-0 px-6 flex justify-between items-center">
              <button
                onClick={() => setSelectedRecipe(null)}
                className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg active:scale-95"
              >
                <ArrowLeft className="w-5 h-5 text-gray-700" />
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
              <div className="flex gap-4 mt-3 text-xs">
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" /><span>{selectedRecipe.cookTime}</span>
                </div>
                <div className="flex items-center gap-1">
                  <ChefHat className="w-4 h-4" /><span>{selectedRecipe.difficulty}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 mt-4 space-y-4">
            {selectedRecipe.missingIngredients.length > 0 && (
              <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ShoppingCart className="w-4 h-4 text-amber-600" />
                  <h3 className="font-semibold text-amber-900 text-xs uppercase tracking-wide">
                    You'll need to buy:
                  </h3>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedRecipe.missingIngredients.map((ing, i) => (
                    <span key={i} className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full font-medium text-xs">
                      {ing}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white/90 rounded-2xl p-4 border-2 border-emerald-100">
              <h3 className="text-xs font-bold mb-3 text-emerald-800 uppercase tracking-wide">All Ingredients</h3>
              <ul className="space-y-2">
                {selectedRecipe.ingredients.map((ing, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1.5 flex-shrink-0" />
                    {ing}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white/90 rounded-2xl p-4 border-2 border-emerald-100">
              <h3 className="text-xs font-bold mb-3 text-emerald-800 uppercase tracking-wide">Instructions</h3>
              <ol className="space-y-3">
                {selectedRecipe.instructions.map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <div className="w-6 h-6 bg-gradient-to-r from-emerald-500 to-lime-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0 text-xs mt-0.5">
                      {i + 1}
                    </div>
                    <p className="text-gray-700 text-sm leading-relaxed">{step}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-emerald-50 via-teal-50 to-lime-50 overflow-y-auto">
      <div className="min-h-full px-5 py-6">
        <div className="w-full max-w-sm mx-auto">

          {/* Avatar & Title Header */}
          <div className="text-center mb-6">
            <div className="relative inline-block mb-3">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-lime-400 rounded-full blur-xl opacity-40" />

              {/* Profile Photo / Avatar */}
              <div className="relative">
                {user?.profile_photo_url ? (
                  /* Show uploaded profile photo */
                  <div className="relative w-24 h-24">
                    <img
                      src={user.profile_photo_url}
                      alt="Profile"
                      className="w-24 h-24 rounded-full object-cover shadow-xl border-4 border-white"
                    />
                    {/* Delete photo button */}
                    <button
                      onClick={handlePhotoDelete}
                      disabled={uploadingPhoto}
                      className="absolute -top-1 -right-1 w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all z-10"
                      title="Remove photo"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  /* Show initials avatar */
                  <div className="relative w-24 h-24 bg-gradient-to-br from-emerald-500 to-lime-500 rounded-full flex items-center justify-center shadow-xl border-4 border-white">
                    {name.trim() ? (
                      <span className="text-2xl font-bold text-white">{getInitials(name)}</span>
                    ) : (
                      <User className="w-10 h-10 text-white" />
                    )}
                  </div>
                )}

                {/* Camera overlay button — upload trigger */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="absolute -bottom-1 -right-1 w-9 h-9 bg-gradient-to-r from-emerald-500 to-lime-500 text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white active:scale-90 transition-all z-10 hover:from-emerald-600 hover:to-lime-600"
                  title="Upload profile photo"
                >
                  {uploadingPhoto ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                </button>

                {/* Uploading overlay */}
                {uploadingPhoto && (
                  <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center backdrop-blur-sm">
                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                  </div>
                )}
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handlePhotoUpload}
              />
            </div>

            {/* Photo upload hint */}
            <p className="text-emerald-600 text-[11px] font-medium mb-1 flex items-center justify-center gap-1">
              <Camera className="w-3 h-3" />
              Tap camera to upload photo
            </p>

            {photoError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl p-2 mb-2 mx-auto max-w-xs">
                {photoError}
              </div>
            )}

            <h1 className="text-xl font-bold text-gray-800">
              Your Profile
            </h1>
            <p className="text-gray-500 text-xs mt-0.5">Manage your cooking preferences</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl p-3 mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name field */}
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-4 shadow-md border-2 border-emerald-100">
              <label className="block text-xs font-bold text-emerald-800 mb-1.5 uppercase tracking-wide">
                👤 Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-2.5 rounded-xl bg-white border border-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm text-gray-800 font-medium placeholder-gray-400"
                required
              />
            </div>

            {/* Age field */}
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-4 shadow-md border-2 border-emerald-100">
              <label className="block text-xs font-bold text-emerald-800 mb-1.5 uppercase tracking-wide">
                🎂 Age
              </label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="Enter your age"
                min="1"
                max="120"
                className="w-full px-4 py-2.5 rounded-xl bg-white border border-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm text-gray-800 font-medium placeholder-gray-400"
                required
              />
            </div>

            {/* Cooking Experience Selection */}
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-4 shadow-md border-2 border-emerald-100">
              <label className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 uppercase tracking-wide mb-2.5">
                <ChefHat className="w-4 h-4 text-emerald-600" />
                Cooking Experience
              </label>
              <div className="space-y-2">
                {experienceLevels.map((item) => (
                  <button
                    key={item.level}
                    type="button"
                    onClick={() => setCookingExperience(item.level)}
                    className={`w-full p-2.5 rounded-xl transition-all active:scale-98 flex items-center gap-3 text-left ${
                      cookingExperience === item.level
                        ? 'bg-gradient-to-r from-emerald-500 to-lime-500 text-white shadow-md'
                        : 'bg-emerald-50 text-gray-700 hover:bg-emerald-100'
                    }`}
                  >
                    <span className="text-xl">{item.icon}</span>
                    <div className="flex-1">
                      <div className="font-bold text-xs">{item.label}</div>
                      <div className={`text-[11px] ${cookingExperience === item.level ? 'text-emerald-100' : 'text-gray-500'}`}>
                        {item.desc}
                      </div>
                    </div>
                    {cookingExperience === item.level && <CheckCircle2 className="w-4 h-4 text-white" />}
                  </button>
                ))}
              </div>
            </div>



            {/* Submit Button */}
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-gradient-to-r from-emerald-500 to-lime-500 text-white py-3.5 rounded-2xl font-bold transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2 text-sm disabled:opacity-60"
            >
              <CheckCircle2 className="w-5 h-5" />
              {saving ? 'Saving…' : saved ? '✓ Profile Saved!' : 'Save Profile'}
            </button>
          </form>

          {/* ── Divider ─────────────────────────────────────── */}
          <div className="my-8 relative">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t-2 border-dashed border-emerald-200"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 bg-gradient-to-br from-emerald-50 via-teal-50 to-lime-50">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Saved Content</span>
              </span>
            </div>
          </div>

          {/* ── Saved Content Section ─────────────────────────────────────── */}
          <div className="mt-4">
            {/* Section header */}
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-lime-500 rounded-xl flex items-center justify-center shadow-sm">
                <Bookmark className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-gray-800 text-base">Saved</h2>
                <p className="text-xs text-gray-500">Your favourites in one place</p>
              </div>
            </div>

            {/* Tab switcher */}
            <div className="flex bg-white/80 rounded-2xl p-1 mb-4 border border-emerald-100 shadow-sm gap-1">
              <button
                onClick={() => setSavedTab('recipes')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  savedTab === 'recipes'
                    ? 'bg-gradient-to-r from-emerald-500 to-lime-500 text-white shadow-md'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Heart className={`w-3.5 h-3.5 ${savedTab === 'recipes' ? 'fill-white' : ''}`} />
                Recipes
                {savedRecipes.length > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    savedTab === 'recipes' ? 'bg-white/30 text-white' : 'bg-emerald-100 text-emerald-600'
                  }`}>
                    {savedRecipes.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setSavedTab('community')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  savedTab === 'community'
                    ? 'bg-gradient-to-r from-emerald-500 to-lime-500 text-white shadow-md'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Users className={`w-3.5 h-3.5`} />
                My Questions
                {myQuestions.length > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    savedTab === 'community' ? 'bg-white/30 text-white' : 'bg-emerald-100 text-emerald-600'
                  }`}>
                    {myQuestions.length}
                  </span>
                )}
              </button>
            </div>

            {/* ── Recipes tab ──────────────────────────────────────────────── */}
            {savedTab === 'recipes' && (
              <>
                {savedLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="w-7 h-7 text-emerald-400 animate-spin" />
                  </div>
                ) : savedRecipes.length === 0 ? (
                  <div className="text-center py-10 bg-white/60 rounded-2xl border border-dashed border-emerald-200">
                    <Heart className="w-12 h-12 text-emerald-200 mx-auto mb-3" />
                    <p className="text-gray-600 font-semibold text-sm">No saved recipes yet</p>
                    <p className="text-gray-400 text-xs mt-1">
                      Tap ♥ on any recipe to save it here
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {savedRecipes.map((recipe) => (
                      <div
                        key={recipe.id}
                        onClick={() => setSelectedRecipe(recipe)}
                        className="bg-white/90 rounded-2xl border border-emerald-100 overflow-hidden shadow-md active:scale-[0.99] transition-all cursor-pointer hover:border-emerald-300"
                      >
                        <div className="flex items-stretch gap-0">
                          {/* Thumbnail */}
                          <div className="relative w-24 flex-shrink-0">
                            <ImageWithFallback
                              src={recipe.imageUrl}
                              alt={recipe.name}
                              className="w-full h-full object-cover min-h-[80px]"
                            />
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/10" />
                          </div>
                          {/* Info */}
                          <div className="flex-1 p-3 min-w-0">
                            <div className="flex items-start justify-between gap-1">
                              <h4 className="font-bold text-gray-800 text-sm line-clamp-1 flex-1">
                                {recipe.name}
                              </h4>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleUnsave(recipe); }}
                                disabled={unsavingId === recipe.id}
                                className="w-7 h-7 flex items-center justify-center flex-shrink-0 active:scale-90 disabled:opacity-50"
                              >
                                <Heart className="w-4 h-4 fill-red-400 text-red-400" />
                              </button>
                            </div>
                            <div className="flex items-center gap-2 mt-1.5 text-[11px] text-gray-500">
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-emerald-500" />
                                {recipe.cookTime}
                              </div>
                              <div className="flex items-center gap-1">
                                <ChefHat className="w-3 h-3 text-emerald-500" />
                                {recipe.difficulty}
                              </div>
                            </div>
                            {recipe.missingIngredients.length === 0 ? (
                              <span className="mt-1.5 inline-block text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full font-bold">
                                ✓ All ingredients
                              </span>
                            ) : (
                              <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full font-bold">
                                <ShoppingCart className="w-2.5 h-2.5" />
                                Need {recipe.missingIngredients.length}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ── Community / My Questions tab ─────────────────────────────── */}
            {savedTab === 'community' && (
              <>
                {myQuestions.length === 0 ? (
                  <div className="text-center py-10 bg-white/60 rounded-2xl border border-dashed border-emerald-200">
                    <Users className="w-12 h-12 text-emerald-200 mx-auto mb-3" />
                    <p className="text-gray-600 font-semibold text-sm">No community posts yet</p>
                    <p className="text-gray-400 text-xs mt-1">
                      Head to Community to ask your first question
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {myQuestions.map((q) => (
                      <div
                        key={q.id}
                        className="bg-white/90 rounded-2xl border border-emerald-100 p-3.5 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <h4 className="font-bold text-gray-800 text-sm leading-snug line-clamp-2 flex-1">
                            {q.title}
                          </h4>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Heart className="w-3 h-3 text-pink-400" />
                            <span className="text-[11px] font-bold text-gray-500">{q.likes}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-gray-500">
                          <div className="flex items-center gap-1">
                            <BookOpen className="w-3 h-3 text-emerald-400" />
                            <span>{q.answers.length} answer{q.answers.length !== 1 ? 's' : ''}</span>
                          </div>
                          {q.answers.some((a) => a.aiVerified === true) && (
                            <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full font-bold text-[10px]">
                              <Star className="w-2.5 h-2.5" />
                              AI Verified
                            </span>
                          )}
                        </div>
                        {q.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {q.tags.slice(0, 3).map((t) => (
                              <span
                                key={t}
                                className="text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded-full font-medium"
                              >
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
