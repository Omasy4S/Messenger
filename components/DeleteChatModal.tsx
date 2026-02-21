'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, UserMinus } from 'lucide-react';
import type { Room } from '@/lib/supabase';

interface DeleteChatModalProps {
  room: Room;
  canDeleteForEveryone: boolean;
  onClose: () => void;
  onDeleteForMe: () => void;
  onDeleteForEveryone: () => void;
}

export default function DeleteChatModal({
  room,
  canDeleteForEveryone,
  onClose,
  onDeleteForMe,
  onDeleteForEveryone,
}: DeleteChatModalProps) {
  const chatName = room.type === 'direct' && room.partner_profile
    ? room.partner_profile.username || 'Пользователь'
    : room.name || 'Личный чат';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Затемнение фона */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Модальное окно */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md glass rounded-2xl shadow-2xl border border-white/10 overflow-hidden"
        >
          {/* Заголовок */}
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Удалить чат</h2>
              <motion.button
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="p-2 glass-hover rounded-lg transition"
              >
                <X size={20} />
              </motion.button>
            </div>
            <p className="text-sm text-gray-400 mt-2">
              Выберите, как удалить чат "{chatName}"
            </p>
          </div>

          {/* Контент */}
          <div className="p-6 space-y-3">
            {/* Удалить для себя */}
            <motion.button
              whileHover={{ scale: 1.02, x: 4 }}
              whileTap={{ scale: 0.98 }}
              onClick={onDeleteForMe}
              className="w-full p-4 glass-hover rounded-xl text-left transition group"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 glass rounded-lg group-hover:bg-white/10 transition">
                  <UserMinus size={20} className="text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium mb-1">
                    {room.type === 'direct' ? 'Удалить для себя' : 'Выйти из группы'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {room.type === 'direct' 
                      ? 'Чат исчезнет только у вас. Собеседник по-прежнему сможет видеть переписку.'
                      : 'Вы покинете группу. Другие участники останутся в ней и смогут продолжить общение.'}
                  </p>
                </div>
              </div>
            </motion.button>

            {/* Удалить для всех / Распустить группу */}
            {canDeleteForEveryone && (
              <motion.button
                whileHover={{ scale: 1.02, x: 4 }}
                whileTap={{ scale: 0.98 }}
                onClick={onDeleteForEveryone}
                className="w-full p-4 glass-hover rounded-xl text-left transition group border border-red-500/20"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 glass rounded-lg group-hover:bg-red-500/10 transition">
                    <Trash2 size={20} className="text-red-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium mb-1 text-red-400">
                      {room.type === 'direct' ? 'Удалить для обоих' : 'Распустить группу'}
                    </p>
                    <p className="text-xs text-gray-400">
                      {room.type === 'direct'
                        ? 'Чат будет удален у вас и у собеседника. Все сообщения будут потеряны. Это действие нельзя отменить!'
                        : 'Группа будет удалена для всех участников. Все сообщения будут потеряны. Это действие нельзя отменить!'}
                    </p>
                  </div>
                </div>
              </motion.button>
            )}
          </div>

          {/* Кнопка отмены */}
          <div className="p-6 pt-0">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onClose}
              className="w-full py-3 glass-hover rounded-xl font-medium transition"
            >
              Отмена
            </motion.button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
