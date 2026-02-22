// Примеры использования API для расширения функционала

import { supabase } from './supabase';

// ============================================
// РАБОТА С ПОЛЬЗОВАТЕЛЯМИ
// ============================================

/**
 * Поиск пользователей по username или email
 */
export async function searchUsers(query: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .or(`username.ilike.%${query}%,email.ilike.%${query}%`)
    .limit(10);

  return { data, error };
}

/**
 * Обновление профиля пользователя
 */
export async function updateProfile(userId: string, updates: {
  username?: string;
  avatar_url?: string;
  status?: 'online' | 'offline' | 'away';
}) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  return { data, error };
}

/**
 * Получить список всех пользователей (для приглашения в группу)
 */
export async function getAllUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, email, avatar_url, status')
    .order('username');

  return { data, error };
}

// ============================================
// РАБОТА С КОМНАТАМИ
// ============================================

/**
 * Создать личный чат между двумя пользователями
 */
export async function createDirectRoom(userId1: string, userId2: string) {
  // Проверяем, нет ли уже такого чата
  const { data: existingRooms } = await supabase
    .from('room_members')
    .select('room_id')
    .eq('user_id', userId1);

  if (existingRooms) {
    for (const room of existingRooms) {
      const { data: members } = await supabase
        .from('room_members')
        .select('user_id')
        .eq('room_id', room.room_id);

      if (members?.length === 2 && members.some((m: any) => m.user_id === userId2)) {
        // Чат уже существует
        const { data: existingRoom } = await supabase
          .from('rooms')
          .select('*')
          .eq('id', room.room_id)
          .single();
        
        return { data: existingRoom, error: null, isNew: false };
      }
    }
  }

  // Создаём новый чат
  const { data: newRoom, error: roomError } = await supabase
    .from('rooms')
    .insert({
      type: 'direct',
      created_by: userId1,
    })
    .select()
    .single();

  if (roomError) {
    console.error('Error creating room:', roomError);
    return { data: null, error: roomError, isNew: false };
  }

  // Добавляем участников по одному, чтобы обойти RLS
  // Сначала добавляем создателя
  const { error: member1Error } = await supabase
    .from('room_members')
    .insert({ room_id: newRoom.id, user_id: userId1 });

  if (member1Error) {
    console.error('Error adding creator:', member1Error);
    return { data: null, error: member1Error, isNew: false };
  }

  // Затем добавляем второго участника
  const { error: member2Error } = await supabase
    .from('room_members')
    .insert({ room_id: newRoom.id, user_id: userId2 });

  if (member2Error) {
    console.error('Error adding second member:', member2Error);
    return { data: null, error: member2Error, isNew: false };
  }

  return { data: newRoom, error: null, isNew: true };
}

/**
 * Добавить участника в группу
 */
export async function addMemberToRoom(roomId: string, userId: string) {
  const { data, error } = await supabase
    .from('room_members')
    .insert({
      room_id: roomId,
      user_id: userId,
    })
    .select()
    .single();

  return { data, error };
}

/**
 * Удалить участника из группы
 */
export async function removeMemberFromRoom(roomId: string, userId: string) {
  const { error } = await supabase
    .from('room_members')
    .delete()
    .eq('room_id', roomId)
    .eq('user_id', userId);

  return { error };
}

/**
 * Получить список участников комнаты
 */
export async function getRoomMembers(roomId: string) {
  const { data, error } = await supabase
    .from('room_members')
    .select(`
      *,
      profiles (*)
    `)
    .eq('room_id', roomId);

  return { data, error };
}

/**
 * Обновить название группы
 */
export async function updateRoomName(roomId: string, name: string) {
  const { data, error } = await supabase
    .from('rooms')
    .update({ name })
    .eq('id', roomId)
    .select()
    .single();

  return { data, error };
}

// ============================================
// РАБОТА С СООБЩЕНИЯМИ
// ============================================

/**
 * Получить последние N сообщений из комнаты
 */
export async function getRecentMessages(roomId: string, limit = 50) {
  const { data, error } = await supabase
    .from('messages')
    .select(`
      *,
      profiles (*)
    `)
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(limit);

  // Переворачиваем, чтобы старые были сверху
  return { data: data?.reverse(), error };
}

/**
 * Редактировать сообщение
 */
export async function editMessage(messageId: string, newContent: string) {
  const { data, error } = await supabase
    .from('messages')
    .update({
      content: newContent,
      is_edited: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', messageId)
    .select()
    .single();

  return { data, error };
}

/**
 * Удалить сообщение
 */
export async function deleteMessage(messageId: string) {
  const { error } = await supabase
    .from('messages')
    .delete()
    .eq('id', messageId);

  return { error };
}

/**
 * Поиск сообщений в комнате
 */
export async function searchMessages(roomId: string, query: string) {
  const { data, error } = await supabase
    .from('messages')
    .select(`
      *,
      profiles (*)
    `)
    .eq('room_id', roomId)
    .ilike('content', `%${query}%`)
    .order('created_at', { ascending: false })
    .limit(20);

  return { data, error };
}

/**
 * Получить количество непрочитанных сообщений
 */
export async function getUnreadCount(roomId: string, userId: string) {
  // Получаем время последнего прочтения
  const { data: member } = await supabase
    .from('room_members')
    .select('last_read_at')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .single();

  if (!member) return { count: 0, error: null };

  // Считаем сообщения после этого времени
  const { count, error } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('room_id', roomId)
    .gt('created_at', member.last_read_at)
    .neq('user_id', userId); // Исключаем свои сообщения

  return { count: count || 0, error };
}

// ============================================
// REALTIME ПОДПИСКИ
// ============================================

/**
 * Подписка на новые сообщения в комнате
 */
export function subscribeToMessages(
  roomId: string,
  callback: (message: any) => void
) {
  const channel = supabase
    .channel(`room:${roomId}:messages`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `room_id=eq.${roomId}`,
      },
      async (payload: any) => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', payload.new.user_id)
          .single();

        callback({ ...payload.new, profiles: profile });
      }
    )
    .subscribe();

  return () => channel.unsubscribe();
}

/**
 * Подписка на изменения статуса пользователя
 */
export function subscribeToUserStatus(
  userId: string,
  callback: (status: string) => void
) {
  const channel = supabase
    .channel(`user:${userId}:status`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${userId}`,
      },
      (payload: any) => {
        callback(payload.new.status);
      }
    )
    .subscribe();

  return () => channel.unsubscribe();
}

/**
 * Подписка на новые комнаты пользователя
 */
export function subscribeToUserRooms(
  userId: string,
  callback: (room: any) => void
) {
  const channel = supabase
    .channel(`user:${userId}:rooms`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'room_members',
        filter: `user_id=eq.${userId}`,
      },
      async (payload: any) => {
        const { data: room } = await supabase
          .from('rooms')
          .select('*')
          .eq('id', payload.new.room_id)
          .single();

        if (room) callback(room);
      }
    )
    .subscribe();

  return () => channel.unsubscribe();
}

// ============================================
// УТИЛИТЫ
// ============================================

/**
 * Загрузить аватарку пользователя
 */
export async function uploadAvatar(userId: string, file: File) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}-${Date.now()}.${fileExt}`;
  const filePath = `avatars/${fileName}`;

  // Загружаем файл в Storage
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file);

  if (uploadError) return { data: null, error: uploadError };

  // Получаем публичный URL
  const { data } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath);

  // Обновляем профиль
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url: data.publicUrl })
    .eq('id', userId);

  if (updateError) return { data: null, error: updateError };

  return { data: data.publicUrl, error: null };
}

/**
 * Форматирование времени сообщения
 */
export function formatMessageTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'только что';
  if (diffMins < 60) return `${diffMins} мин назад`;
  if (diffHours < 24) return `${diffHours} ч назад`;
  if (diffDays < 7) return `${diffDays} дн назад`;

  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Проверка, онлайн ли пользователь
 */
export function isUserOnline(lastSeen: string, status: string): boolean {
  if (status !== 'online') return false;

  const lastSeenDate = new Date(lastSeen);
  const now = new Date();
  const diffMs = now.getTime() - lastSeenDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  // Считаем онлайн, если активность была менее 5 минут назад
  return diffMins < 5;
}
