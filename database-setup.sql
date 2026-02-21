-- ============================================
-- ПОЛНАЯ НАСТРОЙКА БАЗЫ ДАННЫХ ДЛЯ МЕССЕНДЖЕРА
-- ============================================
-- Выполни этот файл в Supabase SQL Editor
-- ============================================

-- 1. СОЗДАНИЕ ТАБЛИЦ
-- ============================================

-- Таблица профилей пользователей
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  username TEXT,
  user_tag TEXT UNIQUE,
  avatar_url TEXT,
  status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'away')),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица комнат (чатов)
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  type TEXT NOT NULL CHECK (type IN ('direct', 'group')),
  avatar_url TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица участников комнат
CREATE TABLE IF NOT EXISTS room_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

-- Таблица сообщений
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]'::jsonb,
  is_edited BOOLEAN DEFAULT FALSE,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица индикаторов печати
CREATE TABLE IF NOT EXISTS typing_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

-- 2. ИНДЕКСЫ ДЛЯ ПРОИЗВОДИТЕЛЬНОСТИ
-- ============================================

CREATE INDEX IF NOT EXISTS idx_room_members_room_id ON room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_room_members_user_id ON room_members(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_room_id ON messages(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_typing_indicators_room_id ON typing_indicators(room_id);

-- 3. RLS ПОЛИТИКИ
-- ============================================

-- Включаем RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_indicators ENABLE ROW LEVEL SECURITY;

-- Политики для profiles
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
CREATE POLICY "Users can view all profiles" ON profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Политики для rooms
DROP POLICY IF EXISTS "Users can view rooms they are members of" ON rooms;
CREATE POLICY "Users can view rooms they are members of" ON rooms FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM room_members
    WHERE room_members.room_id = rooms.id
    AND room_members.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can create rooms" ON rooms;
CREATE POLICY "Users can create rooms" ON rooms FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Room creators can update rooms" ON rooms;
CREATE POLICY "Room creators can update rooms" ON rooms FOR UPDATE TO authenticated
USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Room creators can delete rooms" ON rooms;
CREATE POLICY "Room creators can delete rooms" ON rooms FOR DELETE TO authenticated
USING (created_by = auth.uid());

-- Политики для room_members
DROP POLICY IF EXISTS "Users can view room members" ON room_members;
CREATE POLICY "Users can view room members" ON room_members FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM room_members rm
    WHERE rm.room_id = room_members.room_id
    AND rm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can join rooms" ON room_members;
CREATE POLICY "Users can join rooms" ON room_members FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Users can leave rooms or admin can remove" ON room_members;
CREATE POLICY "Users can leave rooms or admin can remove" ON room_members FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM rooms
    WHERE rooms.id = room_members.room_id
    AND rooms.created_by = auth.uid()
  )
);

-- Политики для messages
DROP POLICY IF EXISTS "Users can view messages in their rooms" ON messages;
CREATE POLICY "Users can view messages in their rooms" ON messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM room_members
    WHERE room_members.room_id = messages.room_id
    AND room_members.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can send messages" ON messages;
CREATE POLICY "Users can send messages" ON messages FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM room_members
    WHERE room_members.room_id = messages.room_id
    AND room_members.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update own messages" ON messages;
CREATE POLICY "Users can update own messages" ON messages FOR UPDATE TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own messages or group admin can delete any" ON messages;
CREATE POLICY "Users can delete own messages or group admin can delete any" ON messages FOR DELETE TO authenticated
USING (
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1 FROM rooms
    WHERE rooms.id = messages.room_id
    AND rooms.type = 'group'
    AND rooms.created_by = auth.uid()
  )
);

-- Политики для typing_indicators
DROP POLICY IF EXISTS "Users can view typing in their rooms" ON typing_indicators;
CREATE POLICY "Users can view typing in their rooms" ON typing_indicators FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM room_members
    WHERE room_members.room_id = typing_indicators.room_id
    AND room_members.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can insert typing indicators" ON typing_indicators;
CREATE POLICY "Users can insert typing indicators" ON typing_indicators FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete own typing indicators" ON typing_indicators;
CREATE POLICY "Users can delete own typing indicators" ON typing_indicators FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- 4. REALTIME
-- ============================================

-- Включаем realtime для всех таблиц
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE room_members;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE typing_indicators;

-- Настраиваем REPLICA IDENTITY для корректной работы DELETE событий
ALTER TABLE profiles REPLICA IDENTITY FULL;
ALTER TABLE rooms REPLICA IDENTITY FULL;
ALTER TABLE room_members REPLICA IDENTITY FULL;
ALTER TABLE messages REPLICA IDENTITY FULL;
ALTER TABLE typing_indicators REPLICA IDENTITY FULL;

-- 5. ФУНКЦИИ И ТРИГГЕРЫ
-- ============================================

-- Функция для автоматической установки статуса offline
CREATE OR REPLACE FUNCTION auto_set_offline_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET status = 'offline'
  WHERE status = 'online'
  AND last_seen < NOW() - INTERVAL '1 minute';
END;
$$;

-- Функция для автоматической пометки сообщений как прочитанных
CREATE OR REPLACE FUNCTION mark_messages_as_read()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE messages
  SET is_read = TRUE
  WHERE room_id = NEW.room_id
  AND user_id != NEW.user_id
  AND created_at <= NEW.last_read_at
  AND is_read = FALSE;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_mark_messages_read ON room_members;
CREATE TRIGGER trigger_mark_messages_read
AFTER UPDATE OF last_read_at ON room_members
FOR EACH ROW
EXECUTE FUNCTION mark_messages_as_read();

-- Функция для создания профиля при регистрации
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION handle_new_user();

-- 6. STORAGE
-- ============================================

-- Создаем buckets для файлов
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES 
  ('avatars', 'avatars', true, 5242880),
  ('message-files', 'message-files', true, 52428800)
ON CONFLICT (id) DO NOTHING;

-- Политики для avatars
DROP POLICY IF EXISTS "Users can upload avatars" ON storage.objects;
CREATE POLICY "Users can upload avatars" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
CREATE POLICY "Anyone can view avatars" ON storage.objects FOR SELECT TO public
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can update own avatars" ON storage.objects;
CREATE POLICY "Users can update own avatars" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can delete own avatars" ON storage.objects;
CREATE POLICY "Users can delete own avatars" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Политики для message-files
DROP POLICY IF EXISTS "Users can upload message files" ON storage.objects;
CREATE POLICY "Users can upload message files" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'message-files');

DROP POLICY IF EXISTS "Anyone can view message files" ON storage.objects;
CREATE POLICY "Anyone can view message files" ON storage.objects FOR SELECT TO public
USING (bucket_id = 'message-files');

DROP POLICY IF EXISTS "Users can delete own message files" ON storage.objects;
CREATE POLICY "Users can delete own message files" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'message-files' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================
-- ГОТОВО! База данных настроена
-- ============================================
