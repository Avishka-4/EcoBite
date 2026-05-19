import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { Mail, Lock, LogIn, Eye, EyeOff } from 'lucide-react';
import { authApi } from '../../../api/auth';
import { useAuth } from '../../../context/AuthContext';
import { Logo } from '../Logo';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await authApi.login({ email, password });
      login(data.access_token, data.user);
      navigate('/');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Login failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-lime-50 flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="relative inline-block mb-4">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-lime-400 rounded-full blur-xl opacity-40 animate-pulse" />
            <Logo className="w-20 h-20 relative" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-lime-600 bg-clip-text text-transparent">
            EcoBite
          </h1>
          <p className="text-gray-600 text-sm mt-1">Sign in to your account</p>
        </div>

        <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl p-6 border-2 border-emerald-100">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3 mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                required
                className="w-full pl-12 pr-4 py-4 rounded-2xl bg-emerald-50 border-2 border-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition text-sm"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                className="w-full pl-12 pr-12 py-4 rounded-2xl bg-emerald-50 border-2 border-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-lime-500 text-white py-4 rounded-2xl font-bold transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <LogIn className="w-5 h-5" />
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-gray-600">
            Don't have an account?{' '}
            <Link to="/auth/register" className="font-bold text-emerald-600 hover:text-emerald-700">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
