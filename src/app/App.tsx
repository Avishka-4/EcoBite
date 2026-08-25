import { useState } from 'react';
import { Routes, Route } from 'react-router';
import { Home, Bookmark, User } from 'lucide-react';
import { ProfileSetup } from './components/ProfileSetup';
import { FoodInput } from './components/FoodInput';
import { RecipeSuggestions } from './components/RecipeSuggestions';
import { SavedRecipes } from './components/SavedRecipes';

type Screen = 'home' | 'saved' | 'profile';

function MainApp() {
  const [screen, setScreen] = useState<Screen>('home');
  const [ingredients, setIngredients] = useState<string[]>([]);

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-gradient-to-br from-emerald-50 via-teal-50 to-lime-50">
      <div className="flex-1 overflow-hidden">
        {screen === 'profile' && <ProfileSetup />}

        {screen === 'home' && (
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
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/*" element={<MainApp />} />
    </Routes>
  );
}
