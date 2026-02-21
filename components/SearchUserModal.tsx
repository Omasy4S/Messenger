'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, User, Hash, MessageCircle, Loader2, AlertCircle } from 'lucide-react';
import { supabase, type Profile, type Room } from '@/lib/supabase';
import { createDirectRoom } from '@/lib/api-examples';
import Image from 'next/image';

interface SearchUserModalProps {
  currentUserId: string;
  onClose: () => void;
  onChatCreated: (room: Room) => void;
}

export default function SearchUserModal({ currentUserId, onClose, onChatCreated }: SearchUserModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [foundUser, setFoundUser] = useState<Profile | null>(null);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || searching) return;

    setSearching(true);
    setError('');
    setNotFound(false);
    setFoundUser(null);

    try {
      // Парсим username#tag
      const parts = searchQuery.trim().split('#');
      if (parts.length !== 2) {
        throw new Error('Неверный формат. Используй формат: username#1234');
      }

      const [username, tag] = parts;

      // Ищем пользователя
      const { data, error: searchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .eq('user_tag', tag)
        .single();

      if (searchError || !data) {
        setNotFound(true);
        return;
      }

      // Проверяем, не ищем ли мы сами себя
      if (data.id === currentUserId) {
        throw new Error('Это твой собственный ID 😊');
      }

      setFoundUser(data);
    } catch (err: any) {
      setError(err.message || 'Произошла ошибка при поиске');
    } finally {
      setSearching(false);
    }
  };

  const handleCreateChat = async () => {
    if (!foundUser || creating) return;

    setCreating(true);
    setError('');

    try {
      const { data: room, error: createError, isNew } = await createDirectRoom(currentUserId, foundUser.id);

      if (createError) throw createError;
      if (!room) throw new Error('Не удалось создать чат');

      onChatCreated(room);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Не удалось создать чат');
    } finally {
      setCreating(false);
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
                <Search size={20} />
              </div>
              <h2 className="text-xl font-bold">Найти пользователя</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 glass-hover rounded-lg transition"
            >
              <X size={20} />
            </button>
          </div>

          {/* Форма поиска */}
          <form onSubmit={handleSearch} className="mb-6">
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="username#1234"
                className="w-full pl-11 pr-4 py-3 glass rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
                autoFocus
              />
            </div>
            <p className="mt-2 text-xs text-gray-400">
              Введи уникальный ID пользователя в формате username#1234
            </p>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={!searchQuery.trim() || searching}
              className="w-full mt-4 py-3 gradient-bg rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {searching ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Поиск...
                </>
              ) : (
                <>
                  <Search size={18} />
                  Найти
                </>
              )}
            </motion.button>
          </form>

          {/* Результат поиска */}
          <AnimatePresence mode="wait">
            {notFound && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-4 glass rounded-lg text-center"
              >
                <AlertCircle className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p className="text-gray-300 mb-1">Пользователь не найден</p>
                <p className="text-xs text-gray-500">Проверь правильность ID</p>
              </motion.div>
            )}

            {foundUser && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-4 glass rounded-lg"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 gradient-bg rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                    {foundUser.avatar_url ? (
                      <Image
                        src={foundUser.avatar_url}
                        alt={foundUser.username || 'Avatar'}
                        width={64}
                        height={64}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-8 h-8" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-lg truncate">{foundUser.username}</p>
                    <p className="text-sm text-gray-400">#{foundUser.user_tag}</p>
                    <p className="text-xs text-gray-500 mt-1 truncate">{foundUser.email}</p>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleCreateChat}
                  disabled={creating}
                  className="w-full py-3 gradient-bg rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Создание чата...
                    </>
                  ) : (
                    <>
                      <MessageCircle size={18} />
                      Написать сообщение
                    </>
                  )}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Ошибка */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-sm text-red-200"
            >
              {error}
            </motion.div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
