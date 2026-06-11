# Supabase: аккаунты и облачные сохранения

Игра умеет работать в двух режимах:

- **Гостевой режим** (по умолчанию) — всё сохраняется локально на устройстве, ничего настраивать не нужно.
- **Облачный режим** — вход по email/паролю, прогресс можно синхронизировать между устройствами.

## Подключение (5 минут)

1. Создай проект на [supabase.com](https://supabase.com) (бесплатного тарифа достаточно).
2. В корне репозитория создай файл `.env` (он в `.gitignore`):

   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key из Settings → API>
   ```

3. В SQL-редакторе Supabase выполни схему:

   ```sql
   -- Облачные сохранения: один слот на пользователя
   create table public.saves (
     user_id uuid primary key references auth.users (id) on delete cascade,
     data jsonb not null,
     updated_at timestamptz not null default now()
   );

   alter table public.saves enable row level security;

   create policy "Users manage own save"
     on public.saves for all
     using (auth.uid() = user_id)
     with check (auth.uid() = user_id);
   ```

4. (Опционально) В Authentication → Providers включи/выключи подтверждение
   email. Без подтверждения вход работает сразу после регистрации.

5. Перезапусти Expo (`bun start -- --clear`) — экран «Аккаунт» автоматически
   переключится из гостевого режима в форму входа.

## Что дальше (роадмап)

- **Серверная валидация покупок**: edge-функция, принимающая чек из
  App Store / Google Play и начисляющая кристаллы в таблицу `wallets`
  (см. TODO(iap) в `src/services/iap.ts`). Никогда не доверяй клиенту.
- **Автосинк**: вызывать `uploadSave()` после рассвета и `downloadSave()`
  при входе (код уже готов в `src/services/supabase.ts`).
