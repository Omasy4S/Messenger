// Клиент Supabase для работы с базой данных и авторизацией
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Типы для TypeScript
export type Profile = {
  id: string;
  email: string;
  username: string | null;
  user_tag: string | null;
  avatar_url: string | null;
  status: 'online' | 'offline' | 'away';
  last_seen: string;
  created_at: string;
  updated_at: string;
};

export type Room = {
  id: string;
  name: string | null;
  type: 'direct' | 'group';
  avatar_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  partner_profile?: Profile; // Для личных чатов - профиль собеседника
  unread_count?: number; // Количество непрочитанных сообщений
};

export type RoomMember = {
  id: string;
  room_id: string;
  user_id: string;
  joined_at: string;
  last_read_at: string;
};

export type MessageAttachment = {
  name: string;
  url: string;
  type: string; // MIME type
  size: number; // размер в байтах
  duration?: number; // для голосовых сообщений (в секундах)
};

export type Message = {
  id: string;
  room_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  is_edited: boolean;
  is_read: boolean; // Прочитано ли сообщение
  attachments?: MessageAttachment[]; // Вложенные файлы
  profiles?: Profile; // Для JOIN запросов
};

export type TypingIndicator = {
  id: string;
  room_id: string;
  user_id: string;
  started_at: string;
  profiles?: Profile;
};
