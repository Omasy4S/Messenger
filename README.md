# Real-Time Messenger

Современный мессенджер в реальном времени с поддержкой личных и групповых чатов, голосовых сообщений и обмена файлами.

![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Supabase](https://img.shields.io/badge/Supabase-Realtime-green)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38bdf8)

## Возможности

### Чаты
- Личные чаты (1 на 1)
- Групповые чаты с управлением участниками
- Редактирование и удаление сообщений
- Контекстное меню для сообщений

### Медиа
- Отправка фотографий и файлов (до 5 за раз)
- Голосовые сообщения с записью и воспроизведением
- Медиа-галерея (фото, файлы, голосовые)

### Realtime
- Мгновенная доставка сообщений
- Индикатор печати ("печатает...")
- Статус онлайн/оффлайн
- Последнее посещение
- Счетчик непрочитанных сообщений
- Галочки прочитанности (✓ / ✓✓)

### Группы
- Создание групп
- Добавление участников из контактов или поиском
- Удаление участников (только админ)
- Редактирование названия и аватара
- Уведомления при исключении

### UI/UX
- Современный дизайн с glassmorphism эффектами
- Темная тема
- Плавные анимации (Framer Motion)
- Полная адаптация под мобильные устройства
- Панель информации о чате (как в Telegram)

## Быстрый старт

### 1. Клонируй репозиторий

```bash
git clone https://github.com/your-username/messenger.git
cd messenger
```

### 2. Установи зависимости

```bash
npm install
```

### 3. Настрой Supabase

1. Создай проект на [supabase.com](https://supabase.com)
2. Скопируй `.env.local.example` в `.env.local`
3. Добавь свои ключи Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

4. Выполни SQL из файла `database-setup.sql` в Supabase SQL Editor

### 4. Запусти проект

```bash
npm run dev
```

Открой [http://localhost:3000](http://localhost:3000)

## Деплой

### Vercel (рекомендуется)

1. Зарегистрируйся на [vercel.com](https://vercel.com)
2. Импортируй репозиторий
3. Добавь переменные окружения
4. Деплой!

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/messenger)

### Netlify

```bash
npm run build
```

Загрузи папку `.next` на Netlify

## Технологии

- **Frontend**: Next.js 14, React, TypeScript
- **Styling**: Tailwind CSS, Framer Motion
- **Backend**: Supabase (PostgreSQL, Realtime, Storage, Auth)
- **Icons**: Lucide React

## Структура проекта

```
messenger/
├── app/                    # Next.js App Router
│   ├── auth/              # Страница авторизации
│   ├── globals.css        # Глобальные стили
│   ├── layout.tsx         # Корневой layout
│   └── page.tsx           # Главная страница
├── components/            # React компоненты
│   ├── ChatSidebar.tsx   # Боковая панель с чатами
│   ├── ChatWindow.tsx    # Окно чата
│   ├── ChatInfoPanel.tsx # Панель информации
│   ├── ChatMediaPanel.tsx # Медиа-галерея
│   ├── VoiceRecorder.tsx # Запись голосовых
│   ├── VoiceMessage.tsx  # Воспроизведение голосовых
│   └── ...               # Другие компоненты
├── lib/
│   └── supabase.ts       # Supabase клиент и типы
├── database-setup.sql    # SQL для настройки БД
└── package.json
```

## Безопасность

- Row Level Security (RLS) для всех таблиц
- Аутентификация через Supabase Auth
- Политики доступа к файлам в Storage
- Валидация на уровне БД

## Лицензия

MIT

