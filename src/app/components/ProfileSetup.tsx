import { useState, useEffect } from 'react';
import { CheckCircle2, ChefHat, User, Utensils } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usersApi } from '../../api/users';

const cuisines = [
  { name: 'Sri Lankan', emoji: '🇱🇰', color: 'from-amber-500 to-orange-500' },
  { name: 'Indian', emoji: '🇮🇳', color: 'from-orange-500 to-pink-500' },
  { name: 'Korean', emoji: '🇰🇷', color: 'from-purple-500 to-pink-500' },
  { name: 'Chinese', emoji: '🇨🇳', color: 'from-red-500 to-yellow-500' },
  { name: 'Malaysian', emoji: '🇲🇾', color: 'from-yellow-500 to-red-500' },
  { name: 'English', emoji: '🇬🇧', color: 'from-blue-500 to-indigo-500' },
  { name: 'American', emoji: '🇺🇸', color: 'from-blue-600 to-red-500' },
  { name: 'Italian', emoji: '🇮🇹', color: 'from-green-500 to-red-500' },
];

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
  const [preferredCuisine, setPreferredCuisine] = useState(user?.preferred_cuisine ?? 'Sri Lankan');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setName(user.name ?? '');
      setAge(user.age ? String(user.age) : '');
      setCookingExperience(
        (user.cooking_experience as 'beginner' | 'intermediate' | 'advanced') ?? 'beginner',
      );
      setPreferredCuisine(user.preferred_cuisine ?? 'Sri Lankan');
    }
  }, [user]);

  const getInitials = (n: string) =>
    n
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !age || !preferredCuisine) return;
    setSaving(true);
    setError('');
    try {
      const updated = await usersApi.updateMe({
        name: name.trim(),
        age: parseInt(age, 10),
        cooking_experience: cookingExperience,
        preferred_cuisine: preferredCuisine,
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
        preferred_cuisine: preferredCuisine,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full bg-gradient-to-br from-emerald-50 via-teal-50 to-lime-50 overflow-y-auto">
      <div className="min-h-full px-5 py-6">
        <div className="w-full max-w-sm mx-auto">

          {/* Avatar & Title Header */}
          <div className="text-center mb-6">
            <div className="relative inline-block mb-3">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-lime-400 rounded-full blur-xl opacity-40" />
              <div className="relative w-20 h-20 bg-gradient-to-br from-emerald-500 to-lime-500 rounded-full flex items-center justify-center shadow-xl border-4 border-white">
                {name.trim() ? (
                  <span className="text-2xl font-bold text-white">{getInitials(name)}</span>
                ) : (
                  <User className="w-10 h-10 text-white" />
                )}
              </div>
            </div>
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

            {/* Favorite Cuisine Selection (8 Cuisines) */}
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-4 shadow-md border-2 border-emerald-100">
              <label className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 uppercase tracking-wide mb-2.5">
                <Utensils className="w-4 h-4 text-emerald-600" />
                Preferred Cuisine
              </label>
              <div className="grid grid-cols-2 gap-2">
                {cuisines.map((cuisine) => (
                  <button
                    key={cuisine.name}
                    type="button"
                    onClick={() => setPreferredCuisine(cuisine.name)}
                    className={`p-2.5 rounded-xl transition-all active:scale-95 text-center ${
                      preferredCuisine === cuisine.name
                        ? `bg-gradient-to-br ${cuisine.color} text-white shadow-md font-bold`
                        : 'bg-emerald-50 text-gray-700 hover:bg-emerald-100 font-medium'
                    }`}
                  >
                    <div className="text-xl mb-0.5">{cuisine.emoji}</div>
                    <div className="text-xs">{cuisine.name}</div>
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
        </div>
      </div>
    </div>
  );
}
