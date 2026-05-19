import { useState, useEffect } from 'react';
import { Logo } from './Logo';
import { CheckCircle2, ChefHat, Sparkles, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usersApi } from '../../api/users';

const cuisines = [
  { name: 'Italian', emoji: '🍝', color: 'from-red-400 to-orange-400' },
  { name: 'Chinese', emoji: '🥢', color: 'from-red-500 to-yellow-500' },
  { name: 'Mexican', emoji: '🌮', color: 'from-orange-400 to-red-500' },
  { name: 'Indian', emoji: '🍛', color: 'from-orange-500 to-pink-500' },
  { name: 'Japanese', emoji: '🍱', color: 'from-pink-400 to-purple-400' },
  { name: 'Mediterranean', emoji: '🫒', color: 'from-blue-400 to-teal-400' },
  { name: 'American', emoji: '🍔', color: 'from-yellow-400 to-orange-500' },
  { name: 'Thai', emoji: '🌶️', color: 'from-red-400 to-pink-400' },
  { name: 'French', emoji: '🥐', color: 'from-blue-400 to-indigo-400' },
  { name: 'Korean', emoji: '🍜', color: 'from-purple-400 to-pink-400' },
];

const experienceLevels = [
  { level: 'beginner' as const, icon: '👨‍🍳', label: 'Beginner', desc: 'Just starting out' },
  { level: 'intermediate' as const, icon: '👩‍🍳', label: 'Intermediate', desc: 'Some experience' },
  { level: 'advanced' as const, icon: '🧑‍🍳', label: 'Advanced', desc: 'Experienced cook' },
];

export function ProfileSetup() {
  const { user, updateUser } = useAuth();

  const [name, setName] = useState(user?.name ?? '');
  const [age, setAge] = useState(user?.age ? String(user.age) : '');
  const [cookingExperience, setCookingExperience] = useState<'beginner' | 'intermediate' | 'advanced'>(
    (user?.cooking_experience as 'beginner' | 'intermediate' | 'advanced') ?? 'beginner',
  );
  const [preferredCuisine, setPreferredCuisine] = useState(user?.preferred_cuisine ?? '');
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
      setPreferredCuisine(user.preferred_cuisine ?? '');
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
    if (!name || !age || !preferredCuisine) return;
    setSaving(true);
    setError('');
    try {
      const updated = await usersApi.updateMe({
        name,
        age: parseInt(age),
        cooking_experience: cookingExperience,
        preferred_cuisine: preferredCuisine,
      });
      updateUser(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError('Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full bg-gradient-to-br from-emerald-50 via-teal-50 to-lime-50 overflow-y-auto">
      <div className="min-h-full px-5 py-6">
        <div className="w-full max-w-sm mx-auto">

          <div className="text-center mb-6">
            <div className="relative inline-block mb-4">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-lime-400 rounded-full blur-2xl opacity-50 animate-pulse" />
              <div className="relative w-24 h-24 bg-gradient-to-br from-emerald-500 to-lime-500 rounded-full flex items-center justify-center shadow-2xl border-4 border-white">
                {name ? (
                  <span className="text-3xl font-bold text-white">{getInitials(name)}</span>
                ) : (
                  <User className="w-12 h-12 text-white" />
                )}
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-1 bg-gradient-to-r from-emerald-600 to-lime-600 bg-clip-text text-transparent">
              ✨ Your Profile
            </h1>
            <p className="text-gray-600 text-sm">Update your cooking preferences</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3 mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-5 py-4 rounded-2xl bg-white/90 backdrop-blur-sm border-2 border-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition shadow-lg text-base peer"
                placeholder=" "
                required
              />
              <label className="absolute left-5 top-4 text-gray-500 text-sm transition-all peer-placeholder-shown:text-base peer-placeholder-shown:top-4 peer-focus:text-xs peer-focus:top-1 peer-focus:text-emerald-600 pointer-events-none">
                👤 What's your name?
              </label>
            </div>

            <div className="relative">
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="w-full px-5 py-4 rounded-2xl bg-white/90 backdrop-blur-sm border-2 border-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition shadow-lg text-base peer"
                placeholder=" "
                min="1"
                max="120"
                required
              />
              <label className="absolute left-5 top-4 text-gray-500 text-sm transition-all peer-placeholder-shown:text-base peer-placeholder-shown:top-4 peer-focus:text-xs peer-focus:top-1 peer-focus:text-emerald-600 pointer-events-none">
                🎂 Your age
              </label>
            </div>

            <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-4 shadow-lg border-2 border-emerald-200">
              <label className="flex items-center gap-2 text-sm font-bold text-emerald-700 mb-3">
                <ChefHat className="w-4 h-4" />
                Cooking Experience
              </label>
              <div className="space-y-2">
                {experienceLevels.map((item) => (
                  <button
                    key={item.level}
                    type="button"
                    onClick={() => setCookingExperience(item.level)}
                    className={`w-full p-3 rounded-xl transition-all active:scale-98 flex items-center gap-3 ${
                      cookingExperience === item.level
                        ? 'bg-gradient-to-r from-emerald-500 to-lime-500 text-white shadow-xl scale-105'
                        : 'bg-emerald-50 text-gray-700 hover:bg-emerald-100'
                    }`}
                  >
                    <span className="text-2xl">{item.icon}</span>
                    <div className="flex-1 text-left">
                      <div className="font-bold text-sm">{item.label}</div>
                      <div className={`text-xs ${cookingExperience === item.level ? 'text-emerald-100' : 'text-gray-500'}`}>
                        {item.desc}
                      </div>
                    </div>
                    {cookingExperience === item.level && <CheckCircle2 className="w-5 h-5" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-4 shadow-lg border-2 border-emerald-200">
              <label className="flex items-center gap-2 text-sm font-bold text-emerald-700 mb-3">
                <Sparkles className="w-4 h-4" />
                Favorite Cuisine
              </label>
              <div className="grid grid-cols-2 gap-2">
                {cuisines.map((cuisine) => (
                  <button
                    key={cuisine.name}
                    type="button"
                    onClick={() => setPreferredCuisine(cuisine.name)}
                    className={`p-3 rounded-xl transition-all active:scale-95 ${
                      preferredCuisine === cuisine.name
                        ? `bg-gradient-to-br ${cuisine.color} text-white shadow-xl scale-105`
                        : 'bg-emerald-50 text-gray-700 hover:bg-emerald-100'
                    }`}
                  >
                    <div className="text-2xl mb-1">{cuisine.emoji}</div>
                    <div className="text-xs font-semibold">{cuisine.name}</div>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-lime-500 text-white py-4 rounded-2xl font-bold transition-all shadow-2xl active:scale-95 flex items-center justify-center gap-2 text-lg disabled:opacity-60"
            >
              <CheckCircle2 className="w-6 h-6" />
              {saving ? 'Saving…' : saved ? '✓ Saved!' : '💾 Save Profile'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
