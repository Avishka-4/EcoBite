import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Edit3,
  Plus,
  X,
  Sparkles,
  AlertCircle,
  RefreshCw,
  ZapIcon,
  ArrowLeft,
  Info,
  Volume2,
  CheckCircle2,
} from 'lucide-react';
import { Logo } from './Logo';
import { useAuth } from '../../context/AuthContext';
import { ingredientsApi } from '../../api/ingredients';
import { getBaseUrl } from '../../api/client';
import { startWavRecording, VoiceRecorderSession } from '../utils/audioRecorder';

interface FoodInputProps {
  onGenerateRecipes: (ingredients: string[]) => void;
}

type InputMode = 'choice' | 'voice' | 'manual' | 'detected';

// Common typo corrections dictionary
const COMMON_TYPOS: Record<string, string> = {
  potatos: 'potatoes',
  potato: 'potatoes',
  tomatos: 'tomatoes',
  tomato: 'tomatoes',
  garlick: 'garlic',
  chiken: 'chicken',
  chikken: 'chicken',
  onon: 'onions',
  onion: 'onions',
  peper: 'bell peppers',
  peppers: 'bell peppers',
  brocoli: 'broccoli',
  brocolli: 'broccoli',
  spinich: 'spinach',
  mushrom: 'mushrooms',
  mushroom: 'mushrooms',
  lentil: 'lentils',
  chese: 'cheese',
  carot: 'carrots',
  carrot: 'carrots',
  egg: 'eggs',
  noodle: 'noodles',
  chilli: 'chillies',
  chili: 'chillies',
  curryleave: 'curry leaves',
  curryleaves: 'curry leaves',
  cocunut: 'coconut milk',
  coconut: 'coconut milk',
  curd: 'yogurt',
};

// Popular quick-add ingredients
const QUICK_SUGGESTIONS = [
  'tomatoes',
  'onions',
  'garlic',
  'potatoes',
  'chicken',
  'eggs',
  'rice',
  'broccoli',
  'carrots',
  'spinach',
];

function cleanAndNormalizeIngredient(raw: string): string {
  let s = raw.toLowerCase().trim();

  // Strip leading numbers, fractions and quantities
  s = s.replace(/^[\d\s\/\.\,\-\+]+/, '');
  s = s.replace(
    /^(cups?|tbsps?|tsps?|tablespoons?|teaspoons?|grams?|g|kgs?|kilograms?|oz|ounces?|lbs?|pounds?|ml|liters?|l|pinch(?:es)?|handfuls?|bunche?s?|cans?|bottles?|packets?|slices?|pieces?|heads?|stalks?|cloves?)\s+(of\s+)?/i,
    ''
  );
  s = s.replace(/^(a\s+|an\s+|some\s+|few\s+|fresh\s+|frozen\s+|canned\s+|chopped\s+|sliced\s+|diced\s+|grated\s+|shredded\s+)/i, '');
  s = s.replace(/[^\w\s]/g, '').trim();

  if (COMMON_TYPOS[s]) {
    return COMMON_TYPOS[s];
  }
  return s;
}

export function FoodInput({ onGenerateRecipes }: FoodInputProps) {
  const { user } = useAuth();

  // Voice Session Ref & State
  const voiceSessionRef = useRef<VoiceRecorderSession | null>(null);
  const timerRef = useRef<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  // Shared State
  const [inputMode, setInputMode] = useState<InputMode>('choice');
  const [detecting, setDetecting] = useState(false);
  const [detectingMessage, setDetectingMessage] = useState('Analyzing ingredients…');
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [modelWarning, setModelWarning] = useState(false);

  // ── Stop Voice Recording helper ───────────────────────────────────────────
  const stopVoiceStream = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (voiceSessionRef.current) {
      voiceSessionRef.current.cancel();
      voiceSessionRef.current = null;
    }
    setIsRecording(false);
  }, []);

  // ── Start Voice Recording ──────────────────────────────────────────────────
  const startVoiceRecording = useCallback(async () => {
    setVoiceError(null);
    setApiError(null);
    setRecordSeconds(0);

    try {
      const session = await startWavRecording();
      voiceSessionRef.current = session;
      setIsRecording(true);

      timerRef.current = window.setInterval(() => {
        setRecordSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: unknown) {
      const error = err as { name?: string; message?: string };
      console.error('Voice recording failed:', error);
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setVoiceError('Microphone permission was denied. Please allow microphone access in your browser or device settings.');
      } else {
        setVoiceError('Could not access microphone. You can type your ingredients manually.');
      }
      setIsRecording(false);
    }
  }, []);

  // ── Finish Voice Recording & Detect with Vosk ──────────────────────────────
  const handleStopAndDetectVoice = async () => {
    if (!voiceSessionRef.current || !isRecording) return;

    setDetecting(true);
    setDetectingMessage('Processing speech with Vosk vocabulary…');
    setModelWarning(false);
    setApiError(null);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      const session = voiceSessionRef.current;
      voiceSessionRef.current = null;
      setIsRecording(false);

      const audioWavBlob = await session.stop();

      const result = await ingredientsApi.detectVoice(audioWavBlob);
      const normalized = result.ingredients.map(cleanAndNormalizeIngredient).filter(Boolean);
      const unique = Array.from(new Set(normalized));

      // Put recognized ingredients directly into the ingredients list
      setIngredients(unique);
      if (unique.length === 0) {
        setModelWarning(true);
      }
      setInputMode('detected');
    } catch (err: unknown) {
      console.error('Vosk speech recognition error:', err);
      const errorObj = err as { message?: string; response?: { data?: { detail?: string } } };
      const detail = errorObj.response?.data?.detail || errorObj.message || 'Network connection failed';
      setApiError(`Could not reach backend at ${getBaseUrl()}. ${detail}`);
      setModelWarning(true);
      setInputMode('detected');
    } finally {
      setDetecting(false);
      stopVoiceStream();
    }
  };

  // Clean up streams when mode changes or unmounts
  useEffect(() => {
    if (inputMode === 'voice') {
      startVoiceRecording();
    } else {
      stopVoiceStream();
    }

    return () => {
      stopVoiceStream();
    };
  }, [inputMode, startVoiceRecording, stopVoiceStream]);

  // ── Add manual ingredient (with auto-cleaning & typo correction) ───────────
  const handleAddIngredient = (nameOverride?: string) => {
    const raw = (nameOverride ?? inputValue).trim();
    if (!raw) return;

    const cleaned = cleanAndNormalizeIngredient(raw);
    if (cleaned && !ingredients.includes(cleaned)) {
      setIngredients((prev) => [...prev, cleaned]);
    }
    if (!nameOverride) setInputValue('');
  };

  // ── Remove ingredient ──────────────────────────────────────────────────────
  const handleRemoveIngredient = (index: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Trigger recipe generation ──────────────────────────────────────────────
  const handleGenerate = () => {
    if (ingredients.length > 0) {
      onGenerateRecipes(ingredients);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ── 1. CHOICE SCREEN ───────────────────────────────────────────────────────
  if (inputMode === 'choice') {
    return (
      <div className="h-full bg-gradient-to-br from-emerald-50 via-teal-50 to-lime-50 flex flex-col">
        <div className="flex-1 flex flex-col justify-center px-6 py-8">
          <div className="flex flex-col items-center mb-8">
            <div className="mb-4 relative">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-lime-400 rounded-full blur-xl opacity-40 animate-pulse" />
              <Logo className="w-20 h-20 relative" />
            </div>
            <h1 className="text-2xl font-bold mb-1.5 bg-gradient-to-r from-emerald-600 to-lime-600 bg-clip-text text-transparent">
              Hi {user?.name || 'Chef'}! 👋
            </h1>
            <p className="text-gray-600 text-sm text-center">
              How would you like to add your available ingredients?
            </p>
          </div>

          <div className="space-y-4 max-w-sm mx-auto w-full">
            {/* Vosk Voice Input Option */}
            <button
              onClick={() => {
                setIngredients([]);
                setInputMode('voice');
              }}
              className="w-full bg-white/95 backdrop-blur-sm rounded-3xl shadow-lg p-5 active:scale-95 transition-all flex items-center gap-4 border-2 border-emerald-200 hover:border-emerald-400 hover:shadow-xl group text-left relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-bold px-3 py-0.5 rounded-bl-xl uppercase tracking-wider">
                Vosk Voice AI
              </div>
              <div className="bg-gradient-to-br from-emerald-500 to-teal-500 w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md group-hover:scale-105 transition-transform text-white">
                <Mic className="w-7 h-7" />
              </div>
              <div className="flex-1 pr-2">
                <h3 className="font-bold text-gray-800 text-base mb-0.5">
                  Speak Ingredients
                </h3>
                <p className="text-gray-500 text-xs">
                  Constrained vocabulary speech recognition with editable review
                </p>
              </div>
            </button>

            {/* Manual Typing Option */}
            <button
              onClick={() => {
                setIngredients([]);
                setInputMode('manual');
              }}
              className="w-full bg-white/95 backdrop-blur-sm rounded-3xl shadow-lg p-5 active:scale-95 transition-all flex items-center gap-4 border-2 border-emerald-100 hover:border-emerald-300 hover:shadow-xl group text-left"
            >
              <div className="bg-gradient-to-br from-teal-500 to-emerald-500 w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md group-hover:scale-105 transition-transform text-white">
                <Edit3 className="w-7 h-7" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-800 text-base mb-0.5">Type Manually</h3>
                <p className="text-gray-500 text-xs">Type ingredient names with instant auto-formatting</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── 2. VOICE INPUT SCREEN (VOSK) ───────────────────────────────────────────
  if (inputMode === 'voice') {
    if (voiceError) {
      return (
        <div className="h-full bg-gradient-to-br from-emerald-50 via-teal-50 to-lime-50 flex flex-col items-center justify-center px-6">
          <div className="text-center max-w-sm w-full bg-white/95 backdrop-blur-md p-6 rounded-3xl border border-emerald-100 shadow-xl">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MicOff className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">Microphone Unavailable</h2>
            <p className="text-gray-500 text-xs mb-6 leading-relaxed">{voiceError}</p>
            <div className="flex flex-col gap-2.5">
              <button
                onClick={startVoiceRecording}
                className="w-full bg-gradient-to-r from-emerald-500 to-lime-500 text-white py-3 rounded-2xl font-bold active:scale-95 shadow-md flex items-center justify-center gap-2 text-sm"
              >
                <RefreshCw className="w-4 h-4" /> Retry Microphone
              </button>
              <button
                onClick={() => setInputMode('manual')}
                className="w-full bg-white border border-gray-200 text-gray-700 py-3 rounded-2xl font-semibold active:scale-95 text-sm"
              >
                Type Manually Instead
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="h-full bg-gradient-to-br from-emerald-50 via-teal-50 to-lime-50 flex flex-col relative overflow-hidden">
        {/* Top bar */}
        <div className="px-6 pt-6 pb-2 flex items-center justify-between z-10">
          <button
            onClick={() => {
              stopVoiceStream();
              setInputMode('choice');
            }}
            className="w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-md active:scale-95"
          >
            <ArrowLeft className="w-4 h-4 text-gray-700" />
          </button>
          <div className="text-center">
            <h1 className="text-lg font-bold bg-gradient-to-r from-emerald-600 to-lime-600 bg-clip-text text-transparent">
              Speak Ingredients
            </h1>
            <p className="text-gray-500 text-xs">Vosk Constrained Vocabulary</p>
          </div>
          <div className="w-9" />
        </div>

        {/* Voice Studio Main Content */}
        <div className="flex-1 px-6 flex flex-col items-center justify-center text-center">
          {detecting ? (
            <div className="bg-white/90 backdrop-blur-md p-8 rounded-3xl border border-emerald-100 shadow-xl max-w-xs w-full flex flex-col items-center">
              <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
              <h3 className="font-bold text-gray-800 text-base mb-1">Recognizing Speech</h3>
              <p className="text-gray-500 text-xs">{detectingMessage}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center max-w-sm w-full">
              {/* Pulse & Mic Button */}
              <div className="relative mb-6">
                {isRecording && (
                  <>
                    <div className="absolute -inset-4 bg-emerald-400 rounded-full blur-xl opacity-40 animate-ping" />
                    <div className="absolute -inset-8 bg-teal-400 rounded-full blur-2xl opacity-25 animate-pulse" />
                  </>
                )}
                <div
                  className={`w-28 h-28 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 relative ${
                    isRecording
                      ? 'bg-gradient-to-tr from-emerald-500 to-teal-500 scale-105 ring-4 ring-emerald-300'
                      : 'bg-gray-300'
                  }`}
                >
                  <Mic className="w-12 h-12 text-white animate-bounce" />
                </div>
              </div>

              {/* Live Timer */}
              <div className="inline-flex items-center gap-2 bg-white/90 backdrop-blur-sm px-4 py-1.5 rounded-full border border-emerald-200 shadow-sm mb-3">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                <span className="font-mono text-sm font-bold text-gray-700">
                  {formatTimer(recordSeconds)}
                </span>
                <span className="text-gray-400 text-xs font-medium">Recording</span>
              </div>

              <h2 className="text-lg font-bold text-gray-800 mb-1">
                Listening for ingredients…
              </h2>
              <p className="text-gray-500 text-xs max-w-xs mb-6 leading-relaxed">
                Speak clearly, e.g. <span className="font-semibold text-emerald-700">"tomatoes, onions, garlic, chicken and potatoes"</span>
              </p>

              {/* Guidance card */}
              <div className="bg-emerald-100/60 backdrop-blur-sm rounded-2xl p-3.5 mb-6 text-left border border-emerald-200 w-full flex items-start gap-2.5">
                <Volume2 className="w-4 h-4 text-emerald-700 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-900 leading-snug">
                  Vosk AI maps your speech directly to culinary ingredients. You can edit the list in the next step!
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-3 w-full">
                <button
                  onClick={handleStopAndDetectVoice}
                  disabled={!isRecording || recordSeconds < 1}
                  className="w-full bg-gradient-to-r from-emerald-500 to-lime-500 text-white py-4 rounded-2xl font-bold text-sm active:scale-95 shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" /> Done Speaking — Detect Items
                </button>
                <button
                  onClick={() => {
                    stopVoiceStream();
                    setInputMode('manual');
                  }}
                  className="text-gray-500 hover:text-gray-700 text-xs font-semibold py-1"
                >
                  Switch to Manual Typing
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── 3. DETECTED / EDIT INGREDIENTS SCREEN ───────────────────────────────────
  if (inputMode === 'detected') {
    return (
      <div className="h-full bg-gradient-to-br from-emerald-50 via-teal-50 to-lime-50 flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 px-6 pt-6 pb-2">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => setInputMode('choice')}
              className="w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-md active:scale-95"
            >
              <ArrowLeft className="w-4 h-4 text-gray-700" />
            </button>
            <div className="text-center">
              <h1 className="text-lg font-bold bg-gradient-to-r from-emerald-600 to-lime-600 bg-clip-text text-transparent">
                Review & Edit Items
              </h1>
              <p className="text-gray-500 text-xs">Verify your ingredients before cooking</p>
            </div>
            <button
              onClick={() => {
                setIngredients([]);
                setInputMode('voice');
              }}
              className="w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-md active:scale-95"
              title="Re-record voice"
            >
              <Mic className="w-4 h-4 text-emerald-600" />
            </button>
          </div>

          {apiError && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-3 mb-2">
              <div className="flex items-start gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-800 leading-snug">{apiError}</p>
              </div>
              <p className="text-[11px] font-semibold text-gray-600 mb-1.5">Tap to switch backend host:</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: 'Emulator (10.0.2.2)', host: '10.0.2.2:8000' },
                  { label: 'Wi-Fi IP (172.24.63.121)', host: '172.24.63.121:8000' },
                  { label: 'Localhost (8000)', host: 'localhost:8000' },
                ].map((item) => (
                  <button
                    key={item.host}
                    onClick={() => {
                      localStorage.setItem('ecobite_backend_ip', item.host);
                      setApiError(null);
                    }}
                    className="text-[11px] bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 px-2 py-1 rounded-lg font-medium shadow-sm active:scale-95"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {modelWarning && ingredients.length === 0 && !apiError && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-2.5 mb-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <p className="text-xs text-amber-800">
                No ingredients were recognized from audio. You can type them below or re-speak.
              </p>
            </div>
          )}
        </div>

        <div className="flex-1 px-6 pb-6 flex flex-col overflow-hidden">
          {/* Add Missing Ingredient input */}
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-md p-3 mb-2.5 border-2 border-emerald-100">
            <label className="block text-xs font-bold text-emerald-700 mb-1 uppercase tracking-wide flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add Missing Ingredient
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddIngredient()}
                placeholder="e.g. chicken, coconut milk, onions"
                className="flex-1 px-3.5 py-2 rounded-xl bg-white border border-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
              />
              <button
                onClick={() => handleAddIngredient()}
                className="bg-gradient-to-r from-emerald-500 to-lime-500 text-white px-3.5 py-2 rounded-xl active:scale-95 shadow font-semibold text-sm flex items-center justify-center"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-1 mt-1.5 text-gray-500 text-[11px]">
              <Info className="w-3 h-3 text-emerald-600 flex-shrink-0" />
              <span>Type only ingredient names — no quantities like '200g' or '2 cups'.</span>
            </div>
          </div>

          {/* Quick suggestion shortcuts */}
          <div className="mb-2.5">
            <p className="text-[11px] font-semibold text-gray-500 mb-1.5">Quick Add Suggestions:</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_SUGGESTIONS.filter((s) => !ingredients.includes(s))
                .slice(0, 5)
                .map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleAddIngredient(suggestion)}
                    className="text-xs bg-white/80 hover:bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3 h-3 text-emerald-600" />
                    <span className="capitalize">{suggestion}</span>
                  </button>
                ))}
            </div>
          </div>

          {/* List of ingredients */}
          <div className="flex-1 overflow-y-auto mb-3">
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-md p-4 border-2 border-emerald-100 min-h-[140px]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-emerald-800 uppercase tracking-wide flex items-center gap-1.5">
                  <ZapIcon className="w-3.5 h-3.5 text-emerald-600" />
                  Your Ingredients ({ingredients.length})
                </h3>
                <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-0.5 rounded-full font-semibold">
                  Editable
                </span>
              </div>

              {ingredients.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-xs">
                  <p className="mb-2">No ingredients in list yet.</p>
                  <p>Add some using the field above or click speak/type.</p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {ingredients.map((ingredient, index) => (
                    <div
                      key={index}
                      className="bg-gradient-to-r from-emerald-50 to-lime-50 px-3 py-1.5 rounded-full flex items-center gap-2 border border-emerald-200 shadow-sm"
                    >
                      <span className="text-emerald-900 font-semibold text-xs capitalize">
                        {ingredient}
                      </span>
                      <button
                        onClick={() => handleRemoveIngredient(index)}
                        className="text-emerald-500 hover:text-red-500 transition-colors"
                        title="Remove ingredient"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Action button */}
          <button
            onClick={handleGenerate}
            disabled={ingredients.length === 0}
            className="w-full bg-gradient-to-r from-emerald-500 to-lime-500 text-white py-3.5 rounded-2xl font-bold active:scale-95 shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-all text-sm"
          >
            <Sparkles className="w-4 h-4" /> Find Recipes ({ingredients.length} items)
          </button>
        </div>
      </div>
    );
  }

  // ── 4. MANUAL INPUT SCREEN ─────────────────────────────────────────────────
  return (
    <div className="h-full bg-gradient-to-br from-emerald-50 via-teal-50 to-lime-50 flex flex-col">
      <div className="flex-shrink-0 px-6 pt-6 pb-2">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setInputMode('choice')}
            className="w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-md active:scale-95"
          >
            <ArrowLeft className="w-4 h-4 text-gray-700" />
          </button>
          <div className="text-center">
            <h1 className="text-lg font-bold bg-gradient-to-r from-emerald-600 to-lime-600 bg-clip-text text-transparent">
              Type Ingredients
            </h1>
            <p className="text-gray-500 text-xs">Add foods you have available</p>
          </div>
          <div className="w-9" />
        </div>
      </div>

      <div className="flex-1 px-6 pb-6 flex flex-col overflow-hidden">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-md p-3.5 mb-2.5 border-2 border-emerald-100">
          <label className="block text-xs font-bold text-emerald-700 mb-1 uppercase tracking-wide flex items-center gap-1.5">
            <Edit3 className="w-3.5 h-3.5" /> Type Ingredient Name
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddIngredient()}
              placeholder="e.g. tomatoes, chicken, potatoes"
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-white border border-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
              autoFocus
            />
            <button
              onClick={() => handleAddIngredient()}
              className="bg-gradient-to-r from-emerald-500 to-lime-500 text-white px-4 py-2.5 rounded-xl active:scale-95 shadow font-bold text-sm"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-gray-500 text-[11px]">
            <Info className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
            <span>Type only ingredient names — no quantities like '200g' or '2 cups'.</span>
          </div>
        </div>

        {/* Quick Suggestions */}
        <div className="mb-2.5">
          <p className="text-[11px] font-semibold text-gray-500 mb-1.5">Popular Quick Adds:</p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_SUGGESTIONS.filter((s) => !ingredients.includes(s))
              .slice(0, 6)
              .map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => handleAddIngredient(suggestion)}
                  className="text-xs bg-white/80 hover:bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3 h-3 text-emerald-600" />
                  <span className="capitalize">{suggestion}</span>
                </button>
              ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto mb-3">
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-md p-4 border-2 border-emerald-100 min-h-[120px]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-emerald-800 uppercase tracking-wide flex items-center gap-1.5">
                <Edit3 className="w-3.5 h-3.5 text-emerald-600" />
                Ingredients List ({ingredients.length})
              </h3>
            </div>

            {ingredients.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-xs">
                Type an ingredient above or tap quick adds to get started.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {ingredients.map((ingredient, index) => (
                  <div
                    key={index}
                    className="bg-gradient-to-r from-emerald-50 to-lime-50 px-3 py-1.5 rounded-full flex items-center gap-2 border border-emerald-200 shadow-sm"
                  >
                    <span className="text-emerald-900 font-semibold text-xs capitalize">{ingredient}</span>
                    <button
                      onClick={() => handleRemoveIngredient(index)}
                      className="text-emerald-500 hover:text-red-500 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setInputMode('detected')}
            disabled={ingredients.length === 0}
            className="flex-1 bg-white border-2 border-emerald-300 text-emerald-700 py-3 rounded-2xl font-bold active:scale-95 shadow text-sm disabled:opacity-50"
          >
            Review List
          </button>
          <button
            onClick={handleGenerate}
            disabled={ingredients.length === 0}
            className="flex-[2] bg-gradient-to-r from-emerald-500 to-lime-500 text-white py-3.5 rounded-2xl font-bold active:scale-95 shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-all text-sm"
          >
            <Sparkles className="w-4 h-4" /> Find Recipes ({ingredients.length})
          </button>
        </div>
      </div>
    </div>
  );
}
