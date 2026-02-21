'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, Loader2, UserPlus, Check } from 'lucide-react';
import { supabase, type Profile, type Room } from '@/lib/supabase';
import Image from 'next/image';

interface CreateGroupModalProps {
  user: Profile | null;
  onClose: () => void;
  onRoomCreated: (room: Room) => void;
}

export default function CreateGroupModal({ user, onClose, onRoomCreated }: CreateGroupModalProps) {
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showUserList, setShowUserList] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .neq('id', user.id)
      .order('username');
    
    setAllUsers(data || []);
  };

  const filteredUsers = allUsers.filter(u => 
    u.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleUser = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim() || !user || loading) return;

    setLoading(true);
    setError('');

    try {
      // Создаём комнату
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .insert({
          name: groupName.trim(),
          type: 'group',
          created_by: user.id,
        })
        .select()
        .single();

      if (roomError) throw roomError;

      // Добавляем создателя как участника
      const membersToAdd = [
        { room_id: room.id, user_id: user.id },
        ...selectedUsers.map(userId => ({ room_id: room.id, user_id: userId }))
      ];

      const { error: memberError } = await supabase
        .from('room_members')
        .insert(membersToAdd);

      if (memberError) throw memberError;

      onRoomCreated(room);
    } catch (err: any) {
      console.error('Ошибка создания группы:', err);
      setError(err.message || 'Не удалось создать группу');
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
                <Users size={20} />
              </div>
              <h2 className="text-xl font-bold">Создать группу</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 glass-hover rounded-lg transition"
            >
              <X size={20} />
            </button>
          </div>

          {/* Форма */}
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Название группы
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Например: Команда разработки"
                className="w-full px-4 py-3 glass rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
                autoFocus
                required
              />
            </div>

            {/* Добавление участников */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Участники (опционально)
              </label>
              <button
                type="button"
                onClick={() => setShowUserList(!showUserList)}
                className="w-full px-4 py-3 glass rounded-lg text-left flex items-center justify-between hover:bg-white/10 transition"
              >
                <span className="text-gray-400">
                  {selectedUsers.length > 0 
                    ? `Выбрано: ${selectedUsers.length}` 
                    : 'Добавить участников'}
                </span>
                <UserPlus size={18} />
              </button>

              {showUserList && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-2 glass rounded-lg p-3 max-h-60 overflow-y-auto"
                >
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Поиск..."
                    className="w-full px-3 py-2 glass rounded-lg text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  
                  {filteredUsers.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-2">
                      Пользователи не найдены
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {filteredUsers.map(u => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => toggleUser(u.id)}
                          className={`w-full p-2 rounded-lg flex items-center gap-2 transition ${
                            selectedUsers.includes(u.id)
                              ? 'bg-purple-500/20 border border-purple-500/50'
                              : 'hover:bg-white/5'
                          }`}
                        >
                          <div className="w-8 h-8 gradient-bg rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                            {u.avatar_url ? (
                              <Image
                                src={u.avatar_url}
                                alt={u.username || 'Avatar'}
                                width={32}
                                height={32}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-xs">{u.username?.[0]?.toUpperCase()}</span>
                            )}
                          </div>
                          <div className="flex-1 text-left min-w-0">
                            <p className="text-sm font-medium truncate">{u.username}</p>
                            <p className="text-xs text-gray-400 truncate">{u.email}</p>
                          </div>
                          {selectedUsers.includes(u.id) && (
                            <Check size={16} className="text-purple-400" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-sm text-red-200"
              >
                {error}
              </motion.div>
            )}

            <div className="flex gap-3">
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
                disabled={!groupName.trim() || loading}
                className="flex-1 py-3 gradient-bg rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50"
              >
                {loading ? 'Создание...' : 'Создать'}
              </motion.button>
            </div>
          </form>

          {/* Подсказка */}
          <p className="mt-4 text-xs text-gray-400 text-center">
            {selectedUsers.length > 0 
              ? `Будет создана группа с ${selectedUsers.length + 1} участниками`
              : 'Можно добавить участников позже'}
          </p>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
