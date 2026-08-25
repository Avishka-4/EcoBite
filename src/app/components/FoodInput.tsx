import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Edit3, Plus, X, Sparkles, AlertCircle, RefreshCw, ZapIcon, ArrowLeft, Info, Image as ImageIcon } from 'lucide-react';
import { Logo } from './Logo';
import { useAuth } from '../../context/AuthContext';
import { ingredientsApi } from '../../api/ingredients';

interface FoodInputProps {
  onGenerateRecipes: (ingredients: string[]) => void;
}

type InputMode = 'choice' | 'camera' | 'manual' | 'detected';
type CameraState = 'requesting' | 'active' | 'error';
type CameraError = 'permission_denied' | 'not_found' | 'in_use' | 'unknown';

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
};

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [inputMode, setInputMode] = useState<InputMode>('choice');
  const [cameraState, setCameraState] = useState<CameraState>('requesting');
  const [cameraError, setCameraError] = useState<CameraError | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [modelWarning, setModelWarning] = useState(false);
  const [scanAnimation, setScanAnimation] = useState(false);

  // ── Stop camera stream helper ──────────────────────────────────────────────
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // ── Start live camera stream ───────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setCameraState('requesting');
    setCameraError(null);
    stopStream();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraState('active');
    } catch (err: unknown) {
      stopStream();
      const error = err as { name?: string };
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setCameraError('permission_denied');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        setCameraError('not_found');
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        setCameraError('in_use');
      } else {
        setCameraError('unknown');
      }
      setCameraState('error');
    }
  }, [stopStream]);

  // Clean up camera stream when leaving camera mode or unmounting
  useEffect(() => {
    if (inputMode === 'camera') {
      startCamera();
    } else {
      stopStream();
    }
    return () => stopStream();
  }, [inputMode, startCamera, stopStream]);

  // ── File upload / snapshot handler ─────────────────────────────────────────
  const handleFileCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setDetecting(true);
    setModelWarning(false);
    try {
      const result = await ingredientsApi.detect(file);
      const normalized = result.ingredients.map(cleanAndNormalizeIngredient).filter(Boolean);
      setIngredients(Array.from(new Set(normalized)));
      if (!result.model_available) setModelWarning(true);
      setInputMode('detected');
    } catch {
      setIngredients(['tomatoes', 'onions', 'garlic']);
      setModelWarning(true);
      setInputMode('detected');
    } finally {
      setDetecting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Add manual ingredient (with auto-cleaning & typo correction) ───────────
  const handleAddIngredient = () => {
    const raw = inputValue.trim();
    if (!raw) return;

    const cleaned = cleanAndNormalizeIngredient(raw);
    if (cleaned && !ingredients.includes(cleaned)) {
      setIngredients((prev) => [...prev, cleaned]);
    }
    setInputValue('');
  };

  // ── Remove ingredient ──────────────────────────────────────────────────────
  const handleRemoveIngredient = (index: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Capture frame & detect ingredients ─────────────────────────────────────
  const handleScan = async () => {
    if (!videoRef.current || !canvasRef.current || detecting) return;

    setScanAnimation(true);
    setDetecting(true);
    setModelWarning(false);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      if (!blob) {
        setDetecting(false);
        setScanAnimation(false);
        return;
      }
      try {
        const file = new File([blob], 'scan_frame.jpg', { type: 'image/jpeg' });
        const result = await ingredientsApi.detect(file);
        const normalized = result.ingredients.map(cleanAndNormalizeIngredient).filter(Boolean);
        setIngredients(Array.from(new Set(normalized)));
        if (!result.model_available) setModelWarning(true);
        stopStream();
        setInputMode('detected');
      } catch {
        setIngredients(['tomatoes', 'onions', 'garlic']);
        setModelWarning(true);
        stopStream();
        setInputMode('detected');
      } finally {
        setDetecting(false);
        setScanAnimation(false);
      }
    }, 'image/jpeg', 0.92);
  };

  // ── Trigger recipe generation ──────────────────────────────────────────────
  const handleGenerate = () => {
    if (ingredients.length > 0) {
      onGenerateRecipes(ingredients);
    }
  };

  // ── Error messages ─────────────────────────────────────────────────────────
  const errorMessages: Record<CameraError, { title: string; body: string }> = {
    permission_denied: {
      title: 'Camera permission denied',
      body: 'Please allow camera access in your phone settings or tap Take Photo below.',
    },
    not_found: {
      title: 'No camera found',
      body: 'Camera viewfinder is not accessible. You can take a photo or type ingredients.',
    },
    in_use: {
      title: 'Camera is in use',
      body: 'Another app is currently using your camera. Please close it.',
    },
    unknown: {
      title: 'Camera unavailable',
      body: 'Could not access the live viewfinder. You can snap a photo or type manually.',
    },
  };

  // ── 1. CHOICE SCREEN ───────────────────────────────────────────────────────
  if (inputMode === 'choice') {
    return (
      <div className="h-full bg-gradient-to-br from-emerald-50 via-teal-50 to-lime-50 flex flex-col">
        {/* Hidden File Input for Native Camera Snapshot */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileCapture}
          className="hidden"
        />

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
            {/* Live Camera Scan */}
            <button
              onClick={() => {
                setIngredients([]);
                setInputMode('camera');
              }}
              className="w-full bg-white/90 backdrop-blur-sm rounded-3xl shadow-lg p-5 active:scale-95 transition-all flex items-center gap-4 border-2 border-emerald-100 hover:border-emerald-300 hover:shadow-xl group text-left"
            >
              <div className="bg-gradient-to-br from-emerald-500 to-lime-500 w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md group-hover:scale-105 transition-transform">
                <Camera className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-800 text-base mb-0.5">Scan with Camera</h3>
                <p className="text-gray-500 text-xs">YOLO Computer Vision auto-detection</p>
              </div>
            </button>

            {/* Manual Typing */}
            <button
              onClick={() => {
                setIngredients([]);
                setInputMode('manual');
              }}
              className="w-full bg-white/90 backdrop-blur-sm rounded-3xl shadow-lg p-5 active:scale-95 transition-all flex items-center gap-4 border-2 border-emerald-100 hover:border-emerald-300 hover:shadow-xl group text-left"
            >
              <div className="bg-gradient-to-br from-teal-500 to-emerald-500 w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md group-hover:scale-105 transition-transform">
                <Edit3 className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-800 text-base mb-0.5">Type Manually</h3>
                <p className="text-gray-500 text-xs">Type and search food items</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── 2. CAMERA SCAN SCREEN ──────────────────────────────────────────────────
  if (inputMode === 'camera') {
    if (cameraState === 'error' && cameraError) {
      const msg = errorMessages[cameraError];
      return (
        <div className="h-full bg-gradient-to-br from-emerald-50 via-teal-50 to-lime-50 flex flex-col items-center justify-center px-6">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileCapture}
            className="hidden"
          />
          <div className="text-center max-w-sm w-full bg-white/90 backdrop-blur-md p-6 rounded-3xl border border-emerald-100 shadow-xl">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Camera className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">{msg.title}</h2>
            <p className="text-gray-500 text-xs mb-6 leading-relaxed">{msg.body}</p>
            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-gradient-to-r from-emerald-500 to-lime-500 text-white py-3 rounded-2xl font-bold active:scale-95 shadow-md flex items-center justify-center gap-2 text-sm"
              >
                <ImageIcon className="w-4 h-4" /> Snap Photo with Camera
              </button>
              <button
                onClick={startCamera}
                className="w-full bg-emerald-50 text-emerald-700 py-3 rounded-2xl font-semibold active:scale-95 text-sm flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> Retry Live Viewfinder
              </button>
              <button
                onClick={() => setInputMode('manual')}
                className="w-full bg-white border border-gray-200 text-gray-700 py-3 rounded-2xl font-semibold active:scale-95 text-sm"
              >
                Type Manually
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="h-full bg-black flex flex-col relative overflow-hidden">
        <canvas ref={canvasRef} className="hidden" />

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 z-20 px-5 pt-7 pb-4 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent">
          <button
            onClick={() => setInputMode('choice')}
            className="w-10 h-10 bg-white/20 backdrop-blur-md text-white rounded-full flex items-center justify-center active:scale-95 shadow"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <h2 className="text-white font-bold text-sm drop-shadow">Scan Ingredients</h2>
            <p className="text-white/75 text-xs">Position food in frame</p>
          </div>
          <div className="w-10" />
        </div>

        {/* Video feed */}
        <div className="flex-1 relative flex items-center justify-center">
          {cameraState === 'requesting' && (
            <div className="absolute inset-0 bg-gray-955 flex items-center justify-center z-10">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-white/80 text-sm font-semibold">Starting camera feed…</p>
              </div>
            </div>
          )}

          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ display: cameraState === 'active' ? 'block' : 'none' }}
          />

          {/* Scan Animation */}
          {scanAnimation && (
            <div className="absolute inset-0 z-10 pointer-events-none">
              <div className="absolute inset-0 border-4 border-emerald-400 animate-pulse" />
              <div
                className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent opacity-95"
                style={{ animation: 'scanLine 1s linear infinite' }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-black/75 backdrop-blur-md rounded-2xl px-6 py-4 text-center border border-emerald-500/30">
                  <div className="w-10 h-10 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-emerald-300 font-semibold text-sm">Detecting ingredients…</p>
                </div>
              </div>
            </div>
          )}

          {/* Corner frame markers */}
          {cameraState === 'active' && !scanAnimation && (
            <div className="absolute inset-10 pointer-events-none border-2 border-dashed border-white/40 rounded-3xl flex items-center justify-center">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-2xl" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-2xl" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-2xl" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-2xl" />
            </div>
          )}
        </div>

        {/* Bottom capture button */}
        <div className="flex-shrink-0 px-6 pb-8 pt-4 bg-gradient-to-t from-black/90 to-transparent z-20">
          <button
            onClick={handleScan}
            disabled={cameraState !== 'active' || detecting}
            className="w-full bg-gradient-to-r from-emerald-500 to-lime-500 text-white py-4.5 rounded-2xl font-bold text-base active:scale-95 shadow-2xl flex items-center justify-center gap-2.5 disabled:opacity-50 transition-all"
          >
            <Camera className="w-5 h-5" />
            {detecting ? 'Scanning Food…' : 'Scan Ingredients'}
          </button>
        </div>

        <style>{`
          @keyframes scanLine {
            0%   { top: 10%; }
            100% { top: 90%; }
          }
        `}</style>
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
              <p className="text-gray-500 text-xs">Modify or add extra ingredients</p>
            </div>
            <button
              onClick={() => setInputMode('camera')}
              className="w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-md active:scale-95"
              title="Re-scan with camera"
            >
              <RefreshCw className="w-4 h-4 text-emerald-600" />
            </button>
          </div>

          {modelWarning && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-2 mb-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <p className="text-xs text-amber-800">
                Review and adjust items below before generating recipes.
              </p>
            </div>
          )}
        </div>

        <div className="flex-1 px-6 pb-6 flex flex-col overflow-hidden">
          {/* Add more ingredients input */}
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
                onClick={handleAddIngredient}
                className="bg-gradient-to-r from-emerald-500 to-lime-500 text-white px-3.5 py-2 rounded-xl active:scale-95 shadow font-semibold text-sm flex items-center justify-center"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {/* Helper guidance */}
            <div className="flex items-center gap-1 mt-1.5 text-gray-500 text-[11px]">
              <Info className="w-3 h-3 text-emerald-600 flex-shrink-0" />
              <span>Type only ingredient names — no quantities like '200g' or '2 cups'.</span>
            </div>
          </div>

          {/* List of ingredients */}
          <div className="flex-1 overflow-y-auto mb-3">
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-md p-4 border-2 border-emerald-100">
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
                  No ingredients in list. Add some using the field above or re-scan.
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
              onClick={handleAddIngredient}
              className="bg-gradient-to-r from-emerald-500 to-lime-500 text-white px-4 py-2.5 rounded-xl active:scale-95 shadow font-bold text-sm"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {/* Explicit User Guidance */}
          <div className="flex items-center gap-1.5 mt-2 text-gray-500 text-[11px]">
            <Info className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
            <span>Type only ingredient names (e.g. 'chicken', 'potatoes') — no quantities like '200g' or '2 cups'.</span>
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
                Type an ingredient above and press Enter or the + button.
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
