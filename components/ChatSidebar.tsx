'use client';

import { motion } from 'framer-motion';
import { MessageCircle, Users, LogOut, Plus, User, Search, Trash2 } from 'lucide-react';
import type { Profile, Room } from '@/lib/supabase';
import Image from 'next/image';
import { useState } from 'react';
import DeleteChatModal from './DeleteChatModal';

interface ChatSidebarProps {
  user: Profile | null;
  rooms: Room[];
  selectedRoom: Room | null;
  onSelectRoom: (room: Room) => void;
  onCreateGroup: () => void;
  onSearchUser: () => void;
  onEditProfile: () => void;
  onLogout: () => void;
  onDeleteRoom: (roomId: string, deleteForEveryone: boolean) => void;
}

export default function ChatSidebar({
  user,
  rooms,
  selectedRoom,
  onSelectRoom,
  onCreateGroup,
  onSearchUser,
  onEditProfile,
  onLogout,
  onDeleteRoom,
}: ChatSidebarProps) {
  const [roomToDelete, setRoomToDelete] = useState<Room | null>(null);

  const formatLastSeen = (lastSeen: string) => {
    const now = new Date();
    const lastSeenDate = new Date(lastSeen);
    const diffMs = now.getTime() - lastSeenDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'только что';
    if (diffMins < 60) return `${diffMins} мин. назад`;
    if (diffHours < 24) return `${diffHours} ч. назад`;
    if (diffDays === 1) return 'вчера';
    if (diffDays < 7) return `${diffDays} дн. назад`;
    
    return lastSeenDate.toLocaleDateString('ru-RU', { 
      day: 'numeric', 
      month: 'short' 
    });
  };

  const canDeleteForEveryone = (room: Room) => {
    // Для личных чатов - оба участника могут удалить для всех
    if (room.type === 'direct') return true;
    // Для групп - только создатель (админ) может распустить группу
    // Обычные участники могут только выйти
    return room.type === 'group' && room.created_by === user?.id;
  };

  const handleDeleteForMe = () => {
    if (roomToDelete) {
      onDeleteRoom(roomToDelete.id, false);
      setRoomToDelete(null);
    }
  };

  const handleDeleteForEveryone = () => {
    if (roomToDelete) {
      onDeleteRoom(roomToDelete.id, true);
      setRoomToDelete(null);
    }
  };

  return (
    <div className="w-full md:w-80 glass border-r border-white/10 flex flex-col">
      {/* Шапка с профилем */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-4">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onEditProfile}
            className="flex items-center gap-3 flex-1 min-w-0 glass-hover p-2 rounded-lg transition"
          >
            <div className="relative flex-shrink-0">
              <div className="w-12 h-12 gradient-bg rounded-full flex items-center justify-center overflow-hidden">
                {user?.avatar_url ? (
                  <Image
                    src={user.avatar_url}
                    alt={user.username || 'Avatar'}
                    width={48}
                    height={48}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-6 h-6" />
                )}
              </div>
              <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-[#0a0a0f] status-${user?.status || 'offline'}`} />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="font-semibold truncate">{user?.username || 'Пользователь'}</p>
              <p className="text-xs text-gray-400">
                {user?.user_tag ? `#${user.user_tag}` : 'Нажми для настройки'}
              </p>
            </div>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onLogout}
            className="p-2 glass-hover rounded-lg transition ml-2"
            title="Выйти"
          >
            <LogOut size={18} />
          </motion.button>
        </div>

        {/* Кнопки действий */}
        <div className="grid grid-cols-2 gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onSearchUser}
            className="py-2.5 glass-hover rounded-lg flex items-center justify-center gap-2 font-medium"
          >
            <Search size={18} />
            Найти
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onCreateGroup}
            className="py-2.5 gradient-bg rounded-lg flex items-center justify-center gap-2 font-medium shadow-lg"
          >
            <Plus size={18} />
            Группа
          </motion.button>
        </div>
      </div>

      {/* Список чатов */}
      <div className="flex-1 overflow-y-auto p-2">
        {rooms.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-16 h-16 mx-auto mb-4 glass rounded-full flex items-center justify-center">
              <MessageCircle size={32} className="text-gray-400" />
            </div>
            <p className="text-sm text-gray-300 mb-1">Нет активных чатов</p>
            <p className="text-xs text-gray-500">Создай группу, чтобы начать общение</p>
          </div>
        ) : (
          rooms.map((room) => (
            <motion.button
              key={room.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              whileHover={{ x: 4 }}
              onClick={() => onSelectRoom(room)}
              className={`w-full p-3 rounded-xl mb-2 text-left transition relative group ${
                selectedRoom?.id === room.id
                  ? 'glass border-2 border-purple-500/50 shadow-lg'
                  : 'glass-hover'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="relative flex-shrink-0">
                  <div className={`w-12 h-12 gradient-bg rounded-xl flex items-center justify-center overflow-hidden ${
                    selectedRoom?.id === room.id ? 'shadow-lg' : ''
                  }`}>
                    {room.type === 'direct' && room.partner_profile?.avatar_url ? (
                      <Image
                        src={room.partner_profile.avatar_url}
                        alt={room.partner_profile.username || 'Avatar'}
                        width={48}
                        height={48}
                        className="w-full h-full object-cover"
                      />
                    ) : room.avatar_url ? (
                      <Image
                        src={`${room.avatar_url}?t=${room.updated_at}`}
                        alt={room.name || 'Group'}
                        width={48}
                        height={48}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    ) : room.type === 'group' ? (
                      <Users size={22} />
                    ) : (
                      <MessageCircle size={22} />
                    )}
                  </div>
                  {/* Индикатор онлайн для личных чатов */}
                  {room.type === 'direct' && room.partner_profile && (
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#0a0a0f] status-${room.partner_profile.status || 'offline'}`} />
                  )}
                </div>
                <div className="flex-1 min-w-0 pr-8">
                  <p className="font-medium truncate">
                    {room.type === 'direct' && room.partner_profile
                      ? room.partner_profile.username || 'Пользователь'
                      : room.name || 'Личный чат'}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {room.type === 'direct' && room.partner_profile
                      ? room.partner_profile.status === 'online'
                        ? 'в сети'
                        : `был(а) ${formatLastSeen(room.partner_profile.last_seen)}`
                      : room.type === 'group'
                      ? 'Группа'
                      : 'Личное сообщение'}
                  </p>
                </div>
                {/* Счетчик непрочитанных */}
                {room.unread_count !== undefined && room.unread_count > 0 && (
                  <div className="absolute top-3 right-10 flex-shrink-0 min-w-[24px] h-6 px-2 bg-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold">
                      {room.unread_count > 99 ? '99+' : room.unread_count}
                    </span>
                  </div>
                )}
              </div>
              
              {/* Кнопка удаления (всегда видна) */}
              <motion.div
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="absolute top-2 right-2"
                onClick={(e) => {
                  e.stopPropagation();
                  setRoomToDelete(room);
                }}
              >
                <div className="p-1.5 glass-hover rounded-lg hover:bg-red-500/10 transition">
                  <Trash2 size={14} className="text-gray-400 hover:text-red-400 transition" />
                </div>
              </motion.div>
            </motion.button>
          ))
        )}
      </div>

      {/* Модальное окно удаления чата */}
      {roomToDelete && (
        <DeleteChatModal
          room={roomToDelete}
          canDeleteForEveryone={canDeleteForEveryone(roomToDelete)}
          onClose={() => setRoomToDelete(null)}
          onDeleteForMe={handleDeleteForMe}
          onDeleteForEveryone={handleDeleteForEveryone}
        />
      )}
    </div>
  );
}
