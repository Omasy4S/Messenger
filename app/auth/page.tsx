'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Mail, Lock, Loader2, Eye, EyeOff } from 'lucide-react';

// Перевод ошибок Supabase
const translateError = (error: string): string => {
  const translations: Record<string, string> = {
    'Invalid login credentials': 'Неверный email или пароль',
    'Email not confirmed': 'Email не подтверждён. Проверь почту',
    'User already registered': 'Пользователь уже зарегистрирован',
    'Password should be at least 6 characters': 'Пароль должен быть минимум 6 символов',
    'Unable to validate email address: invalid format': 'Неверный формат email',
    'Email rate limit exceeded': 'Слишком много попыток. Попробуй позже',
    'Invalid email or password': 'Неверный email или пароль',
    'Email link is invalid or has expired': 'Ссылка недействительна или истекла',
    'Token has expired or is invalid': 'Токен истёк или недействителен',
    'User not found': 'Пользователь не найден',
  };

  for (const [key, value] of Object.entries(translations)) {
    if (error.includes(key)) return value;
  }
  
  return error;
};

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setSuccess('Регистрация успешна! Проверь почту для подтверждения.');
      } else {
        // Вход
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push('/');
      }
    } catch (err: any) {
      setError(translateError(err.message || 'Произошла ошибка'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Анимированный фон */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="glass rounded-2xl p-8 shadow-2xl">
          {/* Заголовок */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="w-20 h-20 mx-auto mb-4 relative"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-full h-full drop-shadow-2xl">
                <defs>
                  <linearGradient id="bg-grad-auth" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#18181b" />
                    <stop offset="100%" stopColor="#09090b" />
                  </linearGradient>
                  <linearGradient id="front-grad-auth" x1="20" y1="38" x2="70" y2="86" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#818cf8" />
                    <stop offset="100%" stopColor="#4f46e5" />
                  </linearGradient>
                  <linearGradient id="back-grad-auth" x1="36" y1="20" x2="82" y2="62" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#3f3f46" />
                    <stop offset="100%" stopColor="#18181b" />
                  </linearGradient>
                  <filter id="shadow-auth" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#000000" floodOpacity="0.6"/>
                  </filter>
                  <filter id="glow-auth" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="10" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>
                <rect width="100" height="100" rx="24" fill="url(#bg-grad-auth)"/>
                <rect x="0.5" y="0.5" width="99" height="99" rx="23.5" fill="none" stroke="#27272a" strokeWidth="1"/>
                <circle cx="45" cy="59" r="18" fill="#4f46e5" filter="url(#glow-auth)" opacity="0.4" />
                <g>
                  <rect x="36" y="20" width="46" height="34" rx="14" fill="url(#back-grad-auth)" />
                  <path d="M 60 40 L 84 62 L 70 52 Z" fill="url(#back-grad-auth)" />
                  <rect x="36" y="20" width="46" height="34" rx="14" fill="none" stroke="#52525b" strokeWidth="0.75" />
                </g>
                <g filter="url(#shadow-auth)">
                  <rect x="20" y="40" width="50" height="38" rx="16" fill="url(#front-grad-auth)" />
                  <path d="M 35 60 L 14 86 L 45 76 Z" fill="url(#front-grad-auth)" />
                  <rect x="20.5" y="40.5" width="49" height="37" rx="15.5" fill="none" stroke="white" strokeOpacity="0.25" strokeWidth="1" />
                </g>
                <circle cx="33" cy="59" r="3.5" fill="white" opacity="1"/>
                <circle cx="45" cy="59" r="3.5" fill="white" opacity="0.75"/>
                <circle cx="57" cy="59" r="3.5" fill="white" opacity="0.4"/>
              </svg>
            </motion.div>
            <h1 className="text-3xl font-bold mb-2">
              {isSignUp ? 'Создать аккаунт' : 'Добро пожаловать'}
            </h1>
            <p className="text-gray-400">
              {isSignUp ? 'Присоединяйся к нам' : 'Войди в свой аккаунт'}
            </p>
          </div>

          {/* Форма */}
          <form onSubmit={handleAuth} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 glass rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition relative"
                  placeholder="your@email.com"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Пароль</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-12 py-3 glass rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition relative"
                  placeholder="••••••••"
                  required
                  minLength={6}
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition z-10"
                  title={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {password.length > 0 && password.length < 6 && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 text-xs text-amber-400 flex items-center gap-1"
                >
                  <span className="w-4 h-4 rounded-full bg-amber-500/20 flex items-center justify-center text-[10px]">!</span>
                  Минимум 6 символов (сейчас: {password.length})
                </motion.p>
              )}
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-sm text-red-200"
              >
                {error}
              </motion.div>
            )}

            {success && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-green-500/20 border border-green-500/50 rounded-lg text-sm text-green-200"
              >
                {success}
              </motion.div>
            )}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="w-full py-3 gradient-bg rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Загрузка...
                </>
              ) : (
                isSignUp ? 'Зарегистрироваться' : 'Войти'
              )}
            </motion.button>
          </form>

          {/* Переключатель */}
          <div className="mt-6 text-center">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm text-gray-400 hover:text-white transition"
            >
              {isSignUp ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
