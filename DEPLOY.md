# Деплой на Vercel

## Шаг 1: Подготовка

```bash
# Инициализируй git (если еще не сделал)
git init
git add .
git commit -m "Initial commit"

# Создай репозиторий на GitHub и залей код
git remote add origin https://github.com/your-username/messenger.git
git push -u origin main
```

## Шаг 2: Настройка Supabase

1. Открой [supabase.com](https://supabase.com)
2. Создай новый проект
3. Перейди в SQL Editor
4. Скопируй весь код из `database-setup.sql`
5. Нажми Run

## Шаг 3: Деплой на Vercel

1. Открой [vercel.com](https://vercel.com)
2. Нажми "Import Project"
3. Выбери свой GitHub репозиторий
4. Добавь Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL` = твой Supabase URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = твой Supabase Anon Key
5. Нажми Deploy

Готово! Твой мессенджер онлайн 🚀

## Обновления

```bash
git add .
git commit -m "Update"
git push
```

Vercel автоматически задеплоит изменения.
