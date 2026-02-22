'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, Image as ImageIcon, UserMinus, Edit2, UserPlus } from 'lucide-react';
import { supabase, type Room, type Profile } from '@/lib/supabase';
import Image from 'next/image';
import ChatMediaPanel from './ChatMediaPanel';
import ConfirmModal from './ConfirmModal';

interface ChatInfoPanelProps {
  room: Room;
  currentUserId: string;
  onClose: () => void;
  onRoomUpdated?: (room: Room) => void;
  onDeleteRoom?: (roomId: string, deleteForEveryone: boolean) => void;
}

interface RoomMemberWithProfile {
  id: string;
  user_id: string;
  profiles: Profile;
}

export default function ChatInfoPanel({ room, currentUserId, onClose, onRoomUpdated, onDeleteRoom }: ChatInfoPanelProps) {
  const [activeTab, setActiveTab] = useState<'info' | 'media'>('info');
  const [members, setMembers] = useState<RoomMemberWithProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<RoomMemberWithProfile | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newRoomName, setNewRoomName] = useState(room.name || '');
  const [isEditingAvatar, setIsEditingAvatar] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [contacts, setContacts] = useState<Profile[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [addMemberTab, setAddMemberTab] = useState<'contacts' | 'search'>('contacts');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const isAdmin = room.type === 'group' && room.created_by === currentUserId;
  const canDeleteForEveryone = room.type === 'direct' || (room.type === 'group' && isAdmin);

  // Загружаем участников группы
  useEffect(() => {
    if (room.type === 'group') {
      loadMembers();
    }
  }, [room.id]);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('room_members')
        .select(`
          id,
          user_id,
          profiles (*)
        `)
        .eq('room_id', room.id);

      if (error) throw error;
      
      setMembers((data || []).map((item: any) => ({
        ...item,
        profiles: Array.isArray(item.profiles) ? item.profiles[0] : item.profiles
      })) as RoomMemberWithProfile[]);
    } catch (error) {
      console.error('Ошибка загрузки участников:', error);
      setMembers([]); // Устанавливаем пустой массив при ошибке
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;

    try {
      const { error } = await supabase
        .from('room_members')
        .delete()
        .eq('id', memberToRemove.id);

      if (error) throw error;

      setMembers(prev => prev.filter(m => m.id !== memberToRemove.id));
      setMemberToRemove(null);
    } catch (error) {
      console.error('Ошибка удаления участника:', error);
      alert('Не удалось удалить участника');
    }
  };

  const handleUpdateRoomName = async () => {
    if (!newRoomName.trim() || newRoomName === room.name) {
      setIsEditingName(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('rooms')
        .update({ name: newRoomName.trim() })
        .eq('id', room.id);

      if (error) throw error;

      if (onRoomUpdated) {
        onRoomUpdated({ ...room, name: newRoomName.trim() });
      }
      setIsEditingName(false);
    } catch (error) {
      console.error('Ошибка обновления названия:', error);
      alert('Не удалось обновить название');
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsEditingAvatar(true);

      // Удаляем старый аватар если есть
      if (room.avatar_url) {
        const oldPath = room.avatar_url.split('/').pop();
        if (oldPath) {
          await supabase.storage
            .from('avatars')
            .remove([`${room.id}/${oldPath}`]);
        }
      }

      // Загружаем новый
      const fileExt = file.name.split('.').pop();
      const fileName = `${room.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Получаем публичный URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Обновляем в БД
      const { error: updateError } = await supabase
        .from('rooms')
        .update({ avatar_url: publicUrl })
        .eq('id', room.id);

      if (updateError) throw updateError;

      if (onRoomUpdated) {
        onRoomUpdated({ ...room, avatar_url: publicUrl });
      }
    } catch (error) {
      console.error('Ошибка загрузки аватара:', error);
      alert('Не удалось загрузить аватар');
    } finally {
      setIsEditingAvatar(false);
    }
  };

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

  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .or(`username.ilike.%${query}%,user_tag.ilike.%${query}%`)
        .limit(10);

      if (error) throw error;

      // Фильтруем пользователей которые уже в группе
      const memberIds = members.map(m => m.user_id);
      const filtered = (data || []).filter((user: Profile) => 
        !memberIds.includes(user.id) && user.id !== currentUserId
      );

      setSearchResults(filtered);
    } catch (error) {
      console.error('Ошибка поиска пользователей:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const loadContacts = async () => {
    setContactsLoading(true);
    try {
      const { data: roomMembers } = await supabase
        .from('room_members')
        .select('room_id')
        .eq('user_id', currentUserId);

      const roomIds = (roomMembers || []).map((rm: any) => rm.room_id);
      if (roomIds.length === 0) {
        setContacts([]);
        return;
      }

      const { data: directRooms } = await supabase
        .from('rooms')
        .select('id')
        .eq('type', 'direct')
        .in('id', roomIds);

      const directRoomIds = (directRooms || []).map((r: any) => r.id);
      if (directRoomIds.length === 0) {
        setContacts([]);
        return;
      }

      const { data: partners } = await supabase
        .from('room_members')
        .select('user_id, profiles(*)')
        .in('room_id', directRoomIds)
        .neq('user_id', currentUserId);

      const memberIds = members.map(m => m.user_id);
      const uniqueContacts = (partners || [])
        .map((p: any) => Array.isArray(p.profiles) ? p.profiles[0] : p.profiles)
        .filter((profile: any, index: number, self: any[]) => 
          profile && 
          !memberIds.includes(profile.id) &&
          self.findIndex((p: any) => p?.id === profile.id) === index
        ) as Profile[];

      setContacts(uniqueContacts);
    } catch (error) {
      console.error('Ошибка загрузки контактов:', error);
      setContacts([]);
    } finally {
      setContactsLoading(false);
    }
  };

  const handleAddMember = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('room_members')
        .insert({
          room_id: room.id,
          user_id: userId,
        });

      if (error) throw error;

      // Перезагружаем список участников
      await loadMembers();
      setShowAddMember(false);
      setSearchQuery('');
      setSearchResults([]);
    } catch (error) {
      console.error('Ошибка добавления участника:', error);
      alert('Не удалось добавить участника');
    }
  };

  if (activeTab === 'media') {
    return <ChatMediaPanel room={room} onClose={() => setActiveTab('info')} />;
  }

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

        {/* Панель информации */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md h-[80vh] glass rounded-2xl shadow-2xl border border-white/10 overflow-hidden flex flex-col"
        >
          {/* Заголовок */}
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Информация</h2>
              <motion.button
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="p-2 glass-hover rounded-lg transition"
              >
                <X size={20} />
              </motion.button>
            </div>
          </div>

          {/* Контент */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Аватар и название */}
            <div className="text-center mb-6">
              <div className="relative inline-block mb-4">
                <div className="w-24 h-24 gradient-bg rounded-2xl flex items-center justify-center shadow-lg overflow-hidden mx-auto">
                  {room.type === 'direct' && room.partner_profile?.avatar_url ? (
                    <Image
                      src={room.partner_profile.avatar_url}
                      alt={room.partner_profile.username || 'Avatar'}
                      width={96}
                      height={96}
                      className="w-full h-full object-cover"
                    />
                  ) : room.avatar_url ? (
                    <Image
                      src={`${room.avatar_url}?t=${Date.now()}`}
                      alt={room.name || 'Group'}
                      width={96}
                      height={96}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  ) : room.type === 'group' ? (
                    <Users size={40} />
                  ) : (
                    <Users size={40} />
                  )}
                </div>
                
                {/* Кнопка редактирования аватара (только для админа группы) */}
                {isAdmin && (
                  <label className="absolute bottom-0 right-0 p-2 gradient-bg rounded-lg cursor-pointer hover:opacity-90 transition">
                    <Edit2 size={14} />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                      disabled={isEditingAvatar}
                    />
                  </label>
                )}

                {/* Индикатор онлайн для личных чатов */}
                {room.type === 'direct' && room.partner_profile && (
                  <div className={`absolute bottom-2 right-2 w-4 h-4 rounded-full border-2 border-[#0a0a0f] status-${room.partner_profile.status || 'offline'}`} />
                )}
              </div>

              {/* Название/имя */}
              {isEditingName ? (
                <div className="flex items-center gap-2 justify-center">
                  <input
                    type="text"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleUpdateRoomName();
                      if (e.key === 'Escape') setIsEditingName(false);
                    }}
                    className="px-3 py-1 glass rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-purple-500"
                    autoFocus
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2 justify-center">
                  <h3 className="text-2xl font-semibold">
                    {room.type === 'direct' && room.partner_profile
                      ? room.partner_profile.username || 'Пользователь'
                      : room.name || 'Группа'}
                  </h3>
                  {isAdmin && (
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setIsEditingName(true)}
                      className="p-1 glass-hover rounded-lg"
                    >
                      <Edit2 size={14} />
                    </motion.button>
                  )}
                </div>
              )}

              {/* Статус/описание */}
              <p className="text-sm text-gray-400 mt-2">
                {room.type === 'direct' && room.partner_profile
                  ? room.partner_profile.status === 'online'
                    ? 'в сети'
                    : `был(а) ${formatLastSeen(room.partner_profile.last_seen)}`
                  : room.type === 'group'
                  ? `${members.length} участников`
                  : 'Личный чат'}
              </p>
            </div>

            {/* Кнопки действий */}
            <div className="space-y-2 mb-6">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveTab('media')}
                className="w-full p-4 glass-hover rounded-xl text-left transition flex items-center gap-3"
              >
                <div className="p-2 glass rounded-lg">
                  <ImageIcon size={20} className="text-purple-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Медиа и файлы</p>
                  <p className="text-xs text-gray-400">Фото, файлы, голосовые</p>
                </div>
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowDeleteModal(true)}
                className="w-full p-4 glass-hover hover:bg-red-500/10 rounded-xl text-left transition flex items-center gap-3 border border-transparent hover:border-red-500/30"
              >
                <div className="p-2 glass rounded-lg">
                  <X size={20} className="text-red-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-red-400">Удалить чат</p>
                  <p className="text-xs text-gray-400">
                    {canDeleteForEveryone ? 'Удалить для себя или для всех' : 'Удалить только для себя'}
                  </p>
                </div>
              </motion.button>
            </div>

            {/* Участники группы */}
            {room.type === 'group' && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">Участники ({members.length})</h4>
                  {isAdmin && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setShowAddMember(true);
                        loadContacts();
                      }}
                      className="px-3 py-1.5 gradient-bg rounded-lg text-sm flex items-center gap-1"
                    >
                      <UserPlus size={14} />
                      Добавить
                    </motion.button>
                  )}
                </div>
                
                {loading ? (
                  <div className="flex justify-center py-8">
                    <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {members.map((member) => {
                      const canRemove = isAdmin && member.user_id !== currentUserId;
                      
                      return (
                        <div
                          key={member.id}
                          className={`relative flex items-center gap-3 p-3 rounded-lg transition-all group ${
                            canRemove 
                              ? 'glass-hover hover:bg-red-500/10 hover:border-red-500/30 border border-transparent' 
                              : 'glass-hover'
                          }`}
                        >
                          <div className="relative">
                            <div className="w-10 h-10 gradient-bg rounded-full flex items-center justify-center overflow-hidden">
                              {member.profiles.avatar_url ? (
                                <Image
                                  src={member.profiles.avatar_url}
                                  alt={member.profiles.username || 'Avatar'}
                                  width={40}
                                  height={40}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Users size={20} />
                              )}
                            </div>
                            <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#0a0a0f] status-${member.profiles.status || 'offline'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {member.profiles.username || 'Пользователь'}
                              {member.user_id === room.created_by && (
                                <span className="ml-2 text-xs text-purple-400">админ</span>
                              )}
                            </p>
                            <p className="text-xs text-gray-400">
                              {member.profiles.status === 'online' ? 'в сети' : 'не в сети'}
                            </p>
                          </div>
                          
                          {/* Кнопка удаления (только для админа и не для себя) */}
                          {canRemove && (
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => setMemberToRemove(member)}
                              className="opacity-0 group-hover:opacity-100 transition-all duration-200 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-400 text-sm font-medium flex items-center gap-1.5"
                            >
                              <UserMinus size={14} />
                              Удалить
                            </motion.button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>

        {/* Модальное окно добавления участника */}
        {showAddMember && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => {
              setShowAddMember(false);
              setSearchQuery('');
              setSearchResults([]);
              setAddMemberTab('contacts');
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md glass rounded-2xl shadow-2xl border border-white/10 overflow-hidden"
            >
              <div className="p-6 border-b border-white/10">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold">Добавить участника</h3>
                  <motion.button
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                      setShowAddMember(false);
                      setSearchQuery('');
                      setSearchResults([]);
                      setAddMemberTab('contacts');
                    }}
                    className="p-2 glass-hover rounded-lg"
                  >
                    <X size={20} />
                  </motion.button>
                </div>

                {/* Вкладки */}
                <div className="flex gap-2 mb-4">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setAddMemberTab('contacts');
                      loadContacts();
                    }}
                    className={`flex-1 py-2 rounded-lg transition ${
                      addMemberTab === 'contacts'
                        ? 'gradient-bg'
                        : 'glass-hover'
                    }`}
                  >
                    Контакты
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setAddMemberTab('search')}
                    className={`flex-1 py-2 rounded-lg transition ${
                      addMemberTab === 'search'
                        ? 'gradient-bg'
                        : 'glass-hover'
                    }`}
                  >
                    Поиск
                  </motion.button>
                </div>

                {/* Поле поиска (только для вкладки "Поиск") */}
                {addMemberTab === 'search' && (
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      searchUsers(e.target.value);
                    }}
                    placeholder="Поиск по имени или тегу..."
                    className="w-full px-4 py-3 glass rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    autoFocus
                  />
                )}
              </div>
              
              <div className="max-h-96 overflow-y-auto p-4">
                {addMemberTab === 'contacts' ? (
                  // Вкладка контактов
                  contactsLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : contacts.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <p className="mb-2">Нет контактов</p>
                      <p className="text-sm">Начните общение в личных чатах</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {contacts.map((user) => (
                        <motion.button
                          key={user.id}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleAddMember(user.id)}
                          className="w-full flex items-center gap-3 p-3 glass-hover rounded-lg text-left"
                        >
                          <div className="relative">
                            <div className="w-10 h-10 gradient-bg rounded-full flex items-center justify-center overflow-hidden">
                              {user.avatar_url ? (
                                <Image
                                  src={user.avatar_url}
                                  alt={user.username || 'Avatar'}
                                  width={40}
                                  height={40}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Users size={20} />
                              )}
                            </div>
                            <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#0a0a0f] status-${user.status || 'offline'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{user.username || 'Пользователь'}</p>
                            {user.user_tag && (
                              <p className="text-xs text-gray-400">#{user.user_tag}</p>
                            )}
                          </div>
                          <UserPlus size={16} className="text-purple-400" />
                        </motion.button>
                      ))}
                    </div>
                  )
                ) : (
                  // Вкладка поиска
                  searchLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      {searchQuery.trim() ? 'Пользователи не найдены' : 'Начните вводить имя или тег'}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {searchResults.map((user) => (
                        <motion.button
                          key={user.id}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleAddMember(user.id)}
                          className="w-full flex items-center gap-3 p-3 glass-hover rounded-lg text-left"
                        >
                          <div className="relative">
                            <div className="w-10 h-10 gradient-bg rounded-full flex items-center justify-center overflow-hidden">
                              {user.avatar_url ? (
                                <Image
                                  src={user.avatar_url}
                                  alt={user.username || 'Avatar'}
                                  width={40}
                                  height={40}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Users size={20} />
                              )}
                            </div>
                            <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#0a0a0f] status-${user.status || 'offline'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{user.username || 'Пользователь'}</p>
                            {user.user_tag && (
                              <p className="text-xs text-gray-400">#{user.user_tag}</p>
                            )}
                          </div>
                          <UserPlus size={16} className="text-purple-400" />
                        </motion.button>
                      ))}
                    </div>
                  )
                )}
              </div>
            </motion.div>
          </motion.div>
        )}

        {memberToRemove && (
          <ConfirmModal
            isOpen={true}
            title="Удалить участника"
            message={`Вы уверены, что хотите удалить ${memberToRemove.profiles.username || 'этого участника'} из группы?`}
            confirmText="Удалить"
            cancelText="Отмена"
            onConfirm={handleRemoveMember}
            onCancel={() => setMemberToRemove(null)}
            danger
          />
        )}
        
        {showDeleteModal && onDeleteRoom && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setShowDeleteModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm glass rounded-2xl shadow-2xl border border-white/10"
            >
              <div className="p-6">
                <div className="w-16 h-16 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
                  <X size={32} className="text-red-400" />
                </div>
                
                <h3 className="text-xl font-semibold text-center mb-2">Удалить чат?</h3>
                <p className="text-gray-400 text-center mb-6">
                  {room.type === 'direct' 
                    ? 'Выберите, как удалить чат'
                    : isAdmin
                    ? 'Вы можете распустить группу или просто выйти'
                    : 'Вы можете только выйти из группы'}
                </p>
                
                <div className="space-y-2">
                  {canDeleteForEveryone && (
                    <button
                      onClick={() => {
                        onDeleteRoom(room.id, true);
                        setShowDeleteModal(false);
                        onClose();
                      }}
                      className="w-full py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg font-medium transition"
                    >
                      {room.type === 'direct' ? 'Удалить для всех' : 'Распустить группу'}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      onDeleteRoom(room.id, false);
                      setShowDeleteModal(false);
                      onClose();
                    }}
                    className="w-full py-3 glass-hover rounded-lg font-medium transition"
                  >
                    {room.type === 'direct' ? 'Удалить для меня' : 'Выйти из группы'}
                  </button>
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="w-full py-3 glass-hover rounded-lg font-medium transition"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </AnimatePresence>
  );
}
