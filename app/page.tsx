'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase, type Profile, type Room, type Message } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import ChatSidebar from '@/components/ChatSidebar';
import ChatWindow from '@/components/ChatWindow';
import CreateGroupModal from '@/components/CreateGroupModal';
import EditProfileModal from '@/components/EditProfileModal';
import SearchUserModal from '@/components/SearchUserModal';
import KickedFromGroupNotification from '@/components/KickedFromGroupNotification';

export default function HomePage() {
  const [user, setUser] = useState<Profile | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const selectedRoomRef = useRef<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showSearchUser, setShowSearchUser] = useState(false);
  const [kickedFromGroup, setKickedFromGroup] = useState<string | null>(null);
  const router = useRouter();

  // Синхронизируем ref с state
  useEffect(() => {
    selectedRoomRef.current = selectedRoom;
  }, [selectedRoom]);

  // Обновляем заголовок вкладки с количеством непрочитанных
  useEffect(() => {
    const totalUnread = rooms.reduce((sum, room) => sum + (room.unread_count || 0), 0);
    
    if (totalUnread > 0) {
      document.title = `(${totalUnread}) Messenger`;
    } else {
      document.title = 'Messenger - Общайся в реальном времени';
    }
  }, [rooms]);

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (user) {
      subscribeToRoomUpdates();
      subscribeToNewRooms();
      subscribeToRoomDeletions();
      subscribeToProfileUpdates();
      subscribeToMessages();

      // Обновляем last_seen каждые 30 секунд
      const interval = setInterval(async () => {
        await supabase
          .from('profiles')
          .update({ last_seen: new Date().toISOString() })
          .eq('id', user.id);
        
        // Вызываем функцию для автоматической установки offline
        await supabase.rpc('auto_set_offline_status');
      }, 30000);

      // Обработчик закрытия вкладки/окна
      const handleBeforeUnload = () => {
        supabase
          .from('profiles')
          .update({ status: 'offline', last_seen: new Date().toISOString() })
          .eq('id', user.id);
      };

      window.addEventListener('beforeunload', handleBeforeUnload);

      return () => {
        clearInterval(interval);
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }

    return () => {
      supabase.channel('rooms-updates').unsubscribe();
      supabase.channel('new-rooms').unsubscribe();
      supabase.channel('room-deletions').unsubscribe();
      supabase.channel('profile-updates').unsubscribe();
      supabase.channel('messages-updates').unsubscribe();
    };
  }, [user, rooms]);

  const subscribeToRoomUpdates = () => {
    if (!user) return;

    // Подписываемся на изменения комнат
    const channel = supabase
      .channel('rooms-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
        },
        (payload) => {
          const updatedRoom = payload.new as Room;
          
          // Обновляем комнату в списке, сохраняя partner_profile и room_member_id
          setRooms(prevRooms => 
            prevRooms.map(r => 
              r.id === updatedRoom.id 
                ? { ...updatedRoom, partner_profile: r.partner_profile, room_member_id: (r as any).room_member_id }
                : r
            )
          );

          // Обновляем выбранную комнату если это она, сохраняя partner_profile и room_member_id
          setSelectedRoom(prevRoom => 
            prevRoom?.id === updatedRoom.id 
              ? { ...updatedRoom, partner_profile: prevRoom.partner_profile, room_member_id: (prevRoom as any).room_member_id }
              : prevRoom
          );
        }
      )
      .subscribe();
  };

  const subscribeToNewRooms = () => {
    if (!user) return;

    // Подписываемся на добавление пользователя в новые комнаты
    const channel = supabase
      .channel('new-rooms')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_members',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          // Получаем данные новой комнаты
          const { data: newRoom } = await supabase
            .from('rooms')
            .select('*')
            .eq('id', payload.new.room_id)
            .single();

          if (newRoom) {
            let roomWithPartner = { ...newRoom, room_member_id: payload.new.id };

            // Если это личный чат, загружаем информацию о собеседнике
            if (newRoom.type === 'direct') {
              const { data: members } = await supabase
                .from('room_members')
                .select('user_id')
                .eq('room_id', newRoom.id)
                .neq('user_id', user.id);

              if (members && members.length > 0) {
                const { data: partner } = await supabase
                  .from('profiles')
                  .select('*')
                  .eq('id', members[0].user_id)
                  .single();

                if (partner) {
                  roomWithPartner = {
                    ...roomWithPartner,
                    partner_profile: partner,
                  };
                }
              }
            }

            // Добавляем или обновляем комнату в списке
            setRooms(prevRooms => {
              const existingIndex = prevRooms.findIndex(r => r.id === roomWithPartner.id);
              if (existingIndex >= 0) {
                // Комната уже есть - обновляем её, сохраняя room_member_id
                const updated = [...prevRooms];
                updated[existingIndex] = {
                  ...updated[existingIndex],
                  ...roomWithPartner,
                };
                return updated;
              } else {
                // Новая комната - добавляем в начало
                return [roomWithPartner, ...prevRooms];
              }
            });
          }
        }
      )
      .subscribe();
  };

  const subscribeToRoomDeletions = () => {
    if (!user) return;

    // Подписываемся на удаление пользователя из комнат
    const channel = supabase
      .channel('room-deletions')
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'room_members',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          // Ищем комнату по room_member_id
          const deletedMemberId = payload.old.id;
          
          setRooms(prevRooms => {
            // Находим комнату по room_member_id
            const roomToDelete = prevRooms.find(r => (r as any).room_member_id === deletedMemberId);
            
            if (roomToDelete) {
              // Если пользователь сейчас в этом чате, показываем уведомление
              if (selectedRoomRef.current?.id === roomToDelete.id) {
                const roomName = roomToDelete.name || 'Группа';
                setKickedFromGroup(roomName);
                setSelectedRoom(null);
              }
              
              // Удаляем комнату из списка
              return prevRooms.filter(r => r.id !== roomToDelete.id);
            }
            
            return prevRooms;
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'rooms',
        },
        (payload) => {
          // Комната полностью удалена - убираем из списка
          const deletedRoomId = payload.old.id;
          setRooms(prevRooms => prevRooms.filter(r => r.id !== deletedRoomId));
          
          // Если это была выбранная комната, сбрасываем выбор
          setSelectedRoom(prevRoom => 
            prevRoom?.id === deletedRoomId ? null : prevRoom
          );
        }
      )
      .subscribe();
  };

  const subscribeToProfileUpdates = () => {
    if (!user) return;

    // Подписываемся на обновления профилей (статус, last_seen)
    const channel = supabase
      .channel('profile-updates', {
        config: {
          broadcast: { self: false },
          presence: { key: user.id },
        },
      })
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
        },
        (payload) => {
          // Обновляем профиль в комнатах
          setRooms(prevRooms => 
            prevRooms.map(room => {
              if (room.type === 'direct' && room.partner_profile?.id === payload.new.id) {
                return {
                  ...room,
                  partner_profile: {
                    ...room.partner_profile,
                    ...payload.new,
                  } as Profile,
                };
              }
              return room;
            })
          );

          // Обновляем профиль в выбранной комнате
          setSelectedRoom(prevRoom => {
            if (prevRoom?.type === 'direct' && prevRoom.partner_profile?.id === payload.new.id) {
              return {
                ...prevRoom,
                partner_profile: {
                  ...prevRoom.partner_profile,
                  ...payload.new,
                } as Profile,
              };
            }
            return prevRoom;
          });
        }
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('Profile subscription error, retrying...');
          setTimeout(() => {
            channel.unsubscribe();
            subscribeToProfileUpdates();
          }, 1000);
        }
      });
  };

  const subscribeToMessages = () => {
    if (!user) return;

    // Подписываемся на новые сообщения для обновления счетчика непрочитанных
    const channel = supabase
      .channel('messages-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          const message = payload.new as Message;
          
          // Если сообщение не от текущего пользователя
          if (message.user_id !== user.id) {
            // Обновляем счетчик непрочитанных для этой комнаты
            setRooms(prevRooms => 
              prevRooms.map(room => {
                if (room.id === message.room_id) {
                  // Если комната не выбрана, увеличиваем счетчик
                  if (selectedRoomRef.current?.id !== room.id) {
                    return {
                      ...room,
                      unread_count: (room.unread_count || 0) + 1,
                    };
                  }
                }
                return room;
              })
            );
          }
        }
      )
      .subscribe();
  };

  const checkUser = async () => {
    try {
      // Проверяем авторизацию
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/auth');
        return;
      }

      // Получаем профиль пользователя
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profile) {
        // Обновляем статус на "онлайн"
        await supabase
          .from('profiles')
          .update({ status: 'online', last_seen: new Date().toISOString() })
          .eq('id', session.user.id);
        
        // Устанавливаем профиль с обновленным статусом
        setUser({
          ...profile,
          status: 'online',
          last_seen: new Date().toISOString()
        });
        
        await loadRooms(session.user.id);
      }
    } catch (error) {
      console.error('Ошибка загрузки пользователя:', error);
      router.push('/auth');
    } finally {
      setLoading(false);
    }
  };

  const loadRooms = async (userId: string) => {
    try {
      // Получаем все комнаты, где пользователь является участником
      const { data: roomMembers } = await supabase
        .from('room_members')
        .select('id, room_id, last_read_at')
        .eq('user_id', userId);

      if (!roomMembers || roomMembers.length === 0) {
        setRooms([]);
        return;
      }

      const roomIds = roomMembers.map(rm => rm.room_id);

      const { data: roomsData } = await supabase
        .from('rooms')
        .select('*')
        .in('id', roomIds)
        .order('updated_at', { ascending: false });

      if (!roomsData) {
        setRooms([]);
        return;
      }

      // Для личных чатов загружаем информацию о собеседнике и считаем непрочитанные
      const roomsWithPartners = await Promise.all(
        roomsData.map(async (room) => {
          // Находим room_member_id для этой комнаты
          const roomMember = roomMembers.find(rm => rm.room_id === room.id);
          const lastReadAt = roomMember?.last_read_at || new Date(0).toISOString();
          const roomMemberId = roomMember?.id;
          
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('room_id', room.id)
            .neq('user_id', userId) // Не считаем свои сообщения
            .gt('created_at', lastReadAt);

          if (room.type === 'direct') {
            // Находим собеседника
            const { data: members } = await supabase
              .from('room_members')
              .select('user_id')
              .eq('room_id', room.id)
              .neq('user_id', userId);

            if (members && members.length > 0) {
              // Получаем профиль собеседника
              const { data: partner } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', members[0].user_id)
                .single();

              if (partner) {
                return {
                  ...room,
                  partner_profile: partner,
                  unread_count: count || 0,
                  room_member_id: roomMemberId,
                };
              }
            } else {
              // Если в личном чате нет второго участника, помечаем комнату как битую
              return null;
            }
          }
          return {
            ...room,
            unread_count: count || 0,
            room_member_id: roomMemberId,
          };
        })
      );

      // Фильтруем битые комнаты (null)
      const validRooms = roomsWithPartners.filter(room => room !== null);

      setRooms(validRooms);
    } catch (error) {
      console.error('Ошибка загрузки комнат:', error);
    }
  };

  const handleLogout = async () => {
    if (user) {
      // Обновляем статус на "оффлайн"
      await supabase
        .from('profiles')
        .update({ status: 'offline', last_seen: new Date().toISOString() })
        .eq('id', user.id);
    }
    await supabase.auth.signOut();
    router.push('/auth');
  };

  const handleRoomCreated = (newRoom: Room) => {
    setRooms([newRoom, ...rooms]);
    setSelectedRoom(newRoom);
    setShowCreateGroup(false);
  };

  const handleProfileUpdated = (updatedProfile: Profile) => {
    setUser(updatedProfile);
  };

  const handleChatCreated = async (room: Room) => {
    // Проверяем, есть ли уже этот чат в списке
    const exists = rooms.find(r => r.id === room.id);
    
    if (!exists) {
      // Для личных чатов загружаем информацию о собеседнике
      if (room.type === 'direct' && user) {
        const { data: members } = await supabase
          .from('room_members')
          .select('user_id')
          .eq('room_id', room.id)
          .neq('user_id', user.id);

        if (members && members.length > 0) {
          const { data: partner } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', members[0].user_id)
            .single();

          if (partner) {
            const roomWithPartner = {
              ...room,
              partner_profile: partner,
            };
            setRooms([roomWithPartner, ...rooms]);
            setSelectedRoom(roomWithPartner);
            setShowSearchUser(false);
            return;
          }
        }
      }
      
      setRooms([room, ...rooms]);
    }
    
    setSelectedRoom(room);
    setShowSearchUser(false);
  };

  const handleDeleteRoom = async (roomId: string, deleteForEveryone: boolean) => {
    if (!user) return;

    try {
      if (deleteForEveryone) {
        // Удаляем комнату полностью (для всех участников)
        // Сначала удаляем сообщения
        const { error: messagesError } = await supabase
          .from('messages')
          .delete()
          .eq('room_id', roomId);

        if (messagesError) {
          console.error('Error deleting messages:', messagesError);
        }

        // Затем удаляем участников
        const { error: membersError } = await supabase
          .from('room_members')
          .delete()
          .eq('room_id', roomId);

        if (membersError) {
          console.error('Error deleting members:', membersError);
        }

        // И наконец удаляем саму комнату
        const { error: roomError } = await supabase
          .from('rooms')
          .delete()
          .eq('id', roomId);

        if (roomError) {
          console.error('Error deleting room:', roomError);
          throw new Error('Ошибка удаления комнаты');
        }
      } else {
        // Удаляем только для себя (выходим из комнаты)
        const { error } = await supabase
          .from('room_members')
          .delete()
          .eq('room_id', roomId)
          .eq('user_id', user.id);

        if (error) throw error;
      }

      // Убираем комнату из списка
      setRooms(prevRooms => prevRooms.filter(r => r.id !== roomId));
      
      // Если это была выбранная комната, сбрасываем выбор
      if (selectedRoom?.id === roomId) {
        setSelectedRoom(null);
      }
    } catch (error) {
      console.error('Ошибка удаления комнаты:', error);
      alert('Не удалось удалить чат');
    }
  };

  const handleSelectRoom = async (room: Room) => {
    setSelectedRoom(room);
    
    // Сбрасываем счетчик непрочитанных
    if (room.unread_count && room.unread_count > 0) {
      setRooms(prevRooms => 
        prevRooms.map(r => 
          r.id === room.id ? { ...r, unread_count: 0 } : r
        )
      );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden bg-[#0a0a0f]">
      {/* Боковая панель с чатами - скрывается на мобильных когда выбран чат */}
      <div className={`${selectedRoom ? 'hidden md:flex' : 'flex'} flex-shrink-0`}>
        <ChatSidebar
          user={user}
          rooms={rooms}
          selectedRoom={selectedRoom}
          onSelectRoom={handleSelectRoom}
          onCreateGroup={() => setShowCreateGroup(true)}
          onSearchUser={() => setShowSearchUser(true)}
          onEditProfile={() => setShowEditProfile(true)}
          onLogout={handleLogout}
          onDeleteRoom={handleDeleteRoom}
        />
      </div>

      {/* Окно чата - на мобильных занимает весь экран */}
      <div className={`${selectedRoom ? 'flex' : 'hidden md:flex'} flex-1`}>
        <ChatWindow
          user={user}
          room={selectedRoom}
          onRoomUpdated={(updatedRoom) => {
            setSelectedRoom(updatedRoom);
            setRooms(rooms.map(r => r.id === updatedRoom.id ? updatedRoom : r));
          }}
          onBack={() => setSelectedRoom(null)}
        />
      </div>

      {/* Модальное окно создания группы */}
      {showCreateGroup && (
        <CreateGroupModal
          user={user}
          onClose={() => setShowCreateGroup(false)}
          onRoomCreated={handleRoomCreated}
        />
      )}

      {/* Модальное окно редактирования профиля */}
      {showEditProfile && user && (
        <EditProfileModal
          user={user}
          onClose={() => setShowEditProfile(false)}
          onProfileUpdated={handleProfileUpdated}
        />
      )}

      {/* Модальное окно поиска пользователей */}
      {showSearchUser && user && (
        <SearchUserModal
          currentUserId={user.id}
          onClose={() => setShowSearchUser(false)}
          onChatCreated={handleChatCreated}
        />
      )}

      {/* Уведомление об исключении из группы */}
      {kickedFromGroup && (
        <KickedFromGroupNotification
          groupName={kickedFromGroup}
          onClose={() => setKickedFromGroup(null)}
        />
      )}
    </div>
  );
}
