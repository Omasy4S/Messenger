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
    <div className="w-full md:w-80 h-full bg-[#18181b] border-r border-white/[0.08] flex flex-col relative z-10">
      <div className="p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onEditProfile}
            className="flex items-center gap-3 flex-1 min-w-0 hover:bg-white/5 p-1.5 -ml-1.5 rounded-xl transition group"
          >
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center overflow-hidden border border-white/5 group-hover:border-white/10 transition">
                {user?.avatar_url ? (
                  <Image
                    src={user.avatar_url}
                    alt={user.username || 'Avatar'}
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-5 h-5" />
                )}
              </div>
              <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full status-${user?.status || 'offline'}`} />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="font-semibold text-sm text-zinc-100 truncate">{user?.username || 'Пользователь'}</p>
              <p className="text-xs text-zinc-500 font-medium">
                {user?.user_tag ? `#${user.user_tag}` : 'Нажми для настройки'}
              </p>
            </div>
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onLogout}
            className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition ml-2"
            title="Выйти"
          >
            <LogOut size={18} />
          </motion.button>
        </div>

        <div className="flex gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onSearchUser}
            className="flex-1 py-2.5 bg-zinc-800/50 hover:bg-zinc-800 rounded-lg flex items-center justify-center gap-2 font-medium text-sm transition"
          >
            <Search size={18} />
            <span className="hidden xs:inline">Найти</span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onCreateGroup}
            className="flex-1 py-2.5 bg-indigo-500 hover:bg-indigo-600 rounded-lg flex items-center justify-center gap-2 font-medium shadow-sm text-sm transition"
          >
            <Plus size={18} />
            <span className="hidden xs:inline">Группа</span>
          </motion.button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {rooms.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-16 h-16 mx-auto mb-4 bg-zinc-800 rounded-full flex items-center justify-center">
              <MessageCircle size={32} className="text-zinc-400" />
            </div>
            <p className="text-sm text-zinc-300 mb-1">Нет активных чатов</p>
            <p className="text-xs text-zinc-500">Создай группу, чтобы начать общение</p>
          </div>
        ) : (
          rooms.map((room) => {
            const isActive = selectedRoom?.id === room.id;
            return (
              <motion.button
                key={room.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => onSelectRoom(room)}
                className={`w-full p-2.5 rounded-xl mb-1 text-left transition relative group flex items-center gap-3 ${
                  isActive
                    ? 'bg-zinc-800/80'
                    : 'hover:bg-white/5'
                }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-500 rounded-r-full" />
                )}
                
                <div className={`relative flex-shrink-0 ${isActive ? 'ml-1' : ''}`}>
                  <div className={`w-12 h-12 ${room.type === 'group' ? 'bg-zinc-700 rounded-2xl' : 'bg-zinc-800 rounded-full'} flex items-center justify-center overflow-hidden ${isActive ? 'shadow-sm' : ''}`}>
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
                      <Users size={24} className="text-zinc-400" />
                    ) : (
                      <MessageCircle size={24} className="text-zinc-400" />
                    )}
                  </div>
                  {room.type === 'direct' && room.partner_profile && (
                    <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full status-${room.partner_profile.status || 'offline'}`} />
                  )}
                </div>
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <p className={`font-medium text-sm truncate ${isActive ? 'text-white' : 'text-zinc-100'}`}>
                      {room.type === 'direct' && room.partner_profile
                        ? room.partner_profile.username || 'Пользователь'
                        : room.name || 'Личный чат'}
                    </p>
                  </div>
                  <p className={`text-xs truncate ${isActive ? 'text-indigo-200/70' : 'text-zinc-400'}`}>
                    {room.type === 'direct' && room.partner_profile
                      ? room.partner_profile.status === 'online'
                        ? 'в сети'
                        : `был(а) ${formatLastSeen(room.partner_profile.last_seen)}`
                      : room.type === 'group'
                      ? 'Группа'
                      : 'Личное сообщение'}
                  </p>
                </div>
                
                {room.unread_count !== undefined && room.unread_count > 0 && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 bg-indigo-500 min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center shadow-sm">
                    <span className="text-[10px] font-bold text-white">
                      {room.unread_count > 99 ? '99+' : room.unread_count}
                    </span>
                  </div>
                )}
              </motion.button>
            );
          })
        )}
      </div>

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
