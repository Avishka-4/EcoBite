import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router';
import { Home, Users, User } from 'lucide-react';
import { ProfileSetup } from './components/ProfileSetup';
import { FoodInput } from './components/FoodInput';
import { RecipeSuggestions } from './components/RecipeSuggestions';
import { Community } from './components/Community';

type Screen = 'home' | 'community' | 'profile';

function useKeyboardOpen(): boolean {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        setIsKeyboardOpen(true);
      }
    };

    const onFocusOut = () => {
      // Small timeout to avoid flicker when switching inputs
      setTimeout(() => {
        const active = document.activeElement;
        if (!active || (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA')) {
          setIsKeyboardOpen(false);
        }
      }, 100);
    };

    const onViewportResize = () => {
      if (window.visualViewport) {
        const isShrunk = window.visualViewport.height < window.innerHeight * 0.8;
        if (isShrunk) {
          setIsKeyboardOpen(true);
        }
      }
    };

    window.addEventListener('focusin', onFocusIn);
    window.addEventListener('focusout', onFocusOut);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', onViewportResize);
    }

    return () => {
      window.removeEventListener('focusin', onFocusIn);
      window.removeEventListener('focusout', onFocusOut);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', onViewportResize);
      }
    };
  }, []);

  return isKeyboardOpen;
}

function MainApp() {
  const [screen, setScreen] = useState<Screen>('home');
  const [ingredients, setIngredients] = useState<string[]>([]);
  const isKeyboardOpen = useKeyboardOpen();

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

        {screen === 'community' && <Community />}
      </div>

      {/* Bottom Navigation — Hidden when keyboard is open while typing */}
      {!isKeyboardOpen && (
        <div className="flex-shrink-0 bg-white/95 backdrop-blur-xl border-t-2 border-emerald-100/50 shadow-2xl transition-all duration-200">
          <div className="flex items-center justify-around px-2 py-1">
            {(
              [
                {
                  key: 'home' as Screen,
                  Icon: Home,
                  label: 'Home',
                  activeGradient: 'from-emerald-500 to-lime-500',
                  onClick: () => { setScreen('home'); setIngredients([]); },
                },
                {
                  key: 'community' as Screen,
                  Icon: Users,
                  label: 'Community',
                  activeGradient: 'from-emerald-500 to-lime-500',
                  onClick: () => setScreen('community'),
                },
                {
                  key: 'profile' as Screen,
                  Icon: User,
                  label: 'Profile',
                  activeGradient: 'from-emerald-500 to-lime-500',
                  onClick: () => setScreen('profile'),
                },
              ] as const
            ).map(({ key, Icon, label, activeGradient, onClick }) => (
              <button
                key={key}
                onClick={onClick}
                className={`relative flex flex-col items-center justify-center py-2 px-6 transition-all active:scale-95 rounded-2xl ${
                  screen === key ? 'text-white' : 'text-gray-400'
                }`}
              >
                {screen === key && (
                  <div className={`absolute inset-0 bg-gradient-to-r ${activeGradient} rounded-2xl shadow-lg`} />
                )}
                <Icon
                  className={`w-6 h-6 mb-0.5 relative z-10 ${
                    screen === key && key === 'profile' ? 'fill-white' : ''
                  }`}
                />
                <span className="text-xs font-bold relative z-10">{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
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
