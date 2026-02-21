'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Hash, Loader2, Copy, Check, Camera, Upload } from 'lucide-react';
import { supabase, type Profile } from '@/lib/supabase';
import Image from 'next/image';

interface EditProfileModalProps {
  user: Profile;
  onClose: () => void;
  onProfileUpdated: (profile: Profile) => void;
}

export default function EditProfileModal({ user, onClose, onProfileUpdated }: EditProfileModalProps) {
  const [username, setUsername] = useState(user.username || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user.avatar_url);
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const copyUserId = () => {
    const fullTag = `${user.username}#${user.user_tag}`;
    navigator.clipboard.writeText(fullTag);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Проверка типа файла
    if (!file.type.startsWith('image/')) {
      setError('Можно загружать только изображения');
      return;
    }

    // Проверка размера (макс 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError('Размер файла не должен превышать 2MB');
      return;
    }

    setAvatarFile(file);
    setError('');

    // Создаём превью
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadAvatar = async (): Promise<string | null> => {
    if (!avatarFile) return user.avatar_url;

    setUploadingAvatar(true);

    try {
      const fileExt = avatarFile.name.split('.').pop();
      // Добавляем timestamp чтобы избежать кеширования
      const timestamp = Date.now();
      const fileName = `${user.id}/avatar-${timestamp}.${fileExt}`;

      // Удаляем старую аватарку если есть
      if (user.avatar_url) {
        try {
          // Извлекаем путь из URL правильно
          const urlParts = user.avatar_url.split('/avatars/');
          if (urlParts.length > 1) {
            const oldPath = urlParts[1].split('?')[0]; // Убираем query параметры если есть
            await supabase.storage.from('avatars').remove([oldPath]);
          }
        } catch (err) {
          console.error('Не удалось удалить старую аватарку:', err);
          // Продолжаем даже если не удалось удалить старую
        }
      }

      // Загружаем новую
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, avatarFile, { upsert: true });

      if (uploadError) throw uploadError;

      // Получаем публичный URL с cache-busting параметром
      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      return `${data.publicUrl}?t=${timestamp}`;
    } catch (err: any) {
      throw new Error('Не удалось загрузить аватарку: ' + err.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || loading) return;

    setLoading(true);
    setError('');

    try {
      // Загружаем аватарку если выбрана
      const avatarUrl = await uploadAvatar();

      // Обновляем профиль
      const updateData: any = { username: username.trim() };
      if (avatarUrl) {
        updateData.avatar_url = avatarUrl;
      }

      const { data, error: updateError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id)
        .select()
        .single();

      if (updateError) {
        if (updateError.message.includes('duplicate key')) {
          throw new Error('Это имя уже занято');
        }
        throw updateError;
      }

      onProfileUpdated(data);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Не удалось обновить профиль');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Затемнённый фон */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Модальное окно */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-md glass rounded-2xl p-6 shadow-2xl"
        >
          {/* Заголовок */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 gradient-bg rounded-full flex items-center justify-center">
                <User size={20} />
              </div>
              <h2 className="text-xl font-bold">Редактировать профиль</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 glass-hover rounded-lg transition"
            >
              <X size={20} />
            </button>
          </div>

          {/* Форма */}
          <form onSubmit={handleSave} className="space-y-4">
            {/* Аватарка */}
            <div className="flex flex-col items-center mb-6">
              <div className="relative group">
                <div className="w-24 h-24 rounded-full overflow-hidden gradient-bg flex items-center justify-center">
                  {avatarPreview ? (
                    <Image
                      src={avatarPreview}
                      alt="Avatar"
                      width={96}
                      height={96}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-12 h-12" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                >
                  <Camera className="w-8 h-8" />
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-3 text-sm text-purple-400 hover:text-purple-300 transition flex items-center gap-1"
              >
                <Upload size={16} />
                {avatarPreview ? 'Изменить фото' : 'Загрузить фото'}
              </button>
              <p className="mt-1 text-xs text-gray-500">
                JPG, PNG или GIF. Макс 2MB
              </p>
            </div>
            {/* Имя пользователя */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Имя пользователя
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10 pointer-events-none" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Введи своё имя"
                  className="w-full pl-11 pr-4 py-3 glass rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
                  required
                  maxLength={30}
                />
              </div>
            </div>

            {/* Уникальный ID */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Твой уникальный ID
              </label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10 pointer-events-none" />
                <input
                  type="text"
                  value={`${user.username}#${user.user_tag}`}
                  readOnly
                  className="w-full pl-11 pr-12 py-3 glass rounded-lg bg-white/5 cursor-default"
                />
                <button
                  type="button"
                  onClick={copyUserId}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition z-10"
                  title="Скопировать ID"
                >
                  {copied ? (
                    <Check className="w-5 h-5 text-green-400" />
                  ) : (
                    <Copy className="w-5 h-5" />
                  )}
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-400">
                Поделись этим ID с друзьями, чтобы они могли найти тебя
              </p>
            </div>

            {/* Email (только для просмотра) */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Email
              </label>
              <input
                type="email"
                value={user.email}
                readOnly
                className="w-full px-4 py-3 glass rounded-lg bg-white/5 cursor-default text-gray-400"
              />
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

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 glass-hover rounded-lg font-semibold transition"
              >
                Отмена
              </button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={!username.trim() || loading || uploadingAvatar}
                className="flex-1 py-3 gradient-bg rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading || uploadingAvatar ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {uploadingAvatar ? 'Загрузка фото...' : 'Сохранение...'}
                  </>
                ) : (
                  'Сохранить'
                )}
              </motion.button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
