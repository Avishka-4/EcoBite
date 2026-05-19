import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router';
import { Home, Bookmark, User, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Login } from './components/auth/Login';
import { Register } from './components/auth/Register';
import { ProfileSetup } from './components/ProfileSetup';
import { FoodInput } from './components/FoodInput';
import { RecipeSuggestions } from './components/RecipeSuggestions';
import { SavedRecipes } from './components/SavedRecipes';
import { Recipe } from '../api/recipes';

type Screen = 'home' | 'saved' | 'profile';

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-lime-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-emerald-600 font-semibold">Loading EcoBite…</p>
      </div>
    </div>
  );
}

function MainApp() {
  const [screen, setScreen] = useState<Screen>('home');
  const [ingredients, setIngredients] = useState<string[]>([]);
  const { user, logout } = useAuth();

  const needsProfile = !user?.preferred_cuisine || !user?.age;

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-gradient-to-br from-emerald-50 via-teal-50 to-lime-50">
      <div className="flex-1 overflow-hidden">
        {screen === 'profile' && <ProfileSetup />}

        {screen === 'home' && needsProfile && (
          <div className="h-full flex items-center justify-center px-8">
            <div className="text-center">
              <User className="w-16 h-16 mx-auto mb-4 text-emerald-500" />
              <h3 className="font-bold text-gray-800 mb-2">Complete Your Profile</h3>
              <p className="text-gray-600 text-sm mb-4">
                Set up your cooking preferences to get personalized recipes
              </p>
              <button
                onClick={() => setScreen('profile')}
                className="bg-gradient-to-r from-emerald-500 to-lime-500 text-white px-6 py-3 rounded-2xl font-semibold active:scale-95 transition-all shadow-lg"
              >
                Set Up Profile
              </button>
            </div>
          </div>
        )}

        {screen === 'home' && !needsProfile && (
          <>
            {ingredients.length === 0 ? (
              <FoodInput onGenerateRecipes={setIngredients} />
            ) : (
              <RecipeSuggestions
                ingredients={ingredients}
                onBack={() => setIngredients([])}
              />
            )}
          </>
        )}

        {screen === 'saved' && <SavedRecipes />}
      </div>

      {/* Bottom Navigation */}
      <div className="flex-shrink-0 bg-white/95 backdrop-blur-xl border-t-2 border-emerald-100/50 shadow-2xl">
        <div className="flex items-center justify-around px-2 py-1">
          {(
            [
              {
                key: 'home' as Screen,
                Icon: Home,
                label: 'Home',
                onClick: () => {
                  setScreen('home');
                  setIngredients([]);
                },
              },
              { key: 'saved' as Screen, Icon: Bookmark, label: 'Saved', onClick: () => setScreen('saved') },
              { key: 'profile' as Screen, Icon: User, label: 'Profile', onClick: () => setScreen('profile') },
            ] as const
          ).map(({ key, Icon, label, onClick }) => (
            <button
              key={key}
              onClick={onClick}
              className={`relative flex flex-col items-center justify-center py-2 px-6 transition-all active:scale-95 rounded-2xl ${
                screen === key ? 'text-white' : 'text-gray-400'
              }`}
            >
              {screen === key && (
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-lime-500 rounded-2xl shadow-lg" />
              )}
              <Icon
                className={`w-6 h-6 mb-0.5 relative z-10 ${
                  screen === key && (key === 'saved' || key === 'profile') ? 'fill-white' : ''
                }`}
              />
              <span className="text-xs font-bold relative z-10">{label}</span>
            </button>
          ))}

          {/* Logout */}
          <button
            onClick={logout}
            className="flex flex-col items-center justify-center py-2 px-4 text-gray-400 active:scale-95 transition-all"
          >
            <LogOut className="w-5 h-5 mb-0.5" />
            <span className="text-xs font-bold">Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;

  return (
    <Routes>
      <Route
        path="/auth/login"
        element={user ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        path="/auth/register"
        element={user ? <Navigate to="/" replace /> : <Register />}
      />
      <Route
        path="/*"
        element={user ? <MainApp /> : <Navigate to="/auth/login" replace />}
      />
    </Routes>
  );
}
