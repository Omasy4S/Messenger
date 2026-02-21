# Что делать дальше

## 1. Настрой Supabase (5 минут)

1. Открой https://supabase.com
2. Создай проект
3. SQL Editor → New Query
4. Скопируй весь код из `database-setup.sql`
5. Run

## 2. Локальный запуск

```bash
# Скопируй пример
cp .env.local.example .env.local

# Добавь свои ключи в .env.local
NEXT_PUBLIC_SUPABASE_URL=твой-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=твой-ключ

# Установи и запусти
npm install
npm run dev
```

Открой http://localhost:3000

## 3. Деплой на Vercel (2 минуты)

```bash
# Залей на GitHub
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/твой-username/messenger.git
git push -u origin main
```

Затем:
1. Открой https://vercel.com
2. Import Project → выбери репозиторий
3. Добавь те же переменные окружения
4. Deploy

Готово! 🎉
