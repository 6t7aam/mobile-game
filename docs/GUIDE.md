# The Holdouts — полный гайд от А до Я

От «скачать на ПК» до публикации в Google Play и App Store.

---

## Часть 1. Скачать и запустить на ПК

### 1.1. Установи инструменты (один раз)

1. **Git** — https://git-scm.com/downloads (Windows: ставь с настройками по умолчанию).
2. **Node.js 20 LTS** — https://nodejs.org (кнопка LTS).
3. **Bun** (быстрый менеджер пакетов, опционально, можно npm):
   - Windows (PowerShell): `powershell -c "irm bun.sh/install.ps1 | iex"`
   - macOS/Linux: `curl -fsSL https://bun.sh/install | bash`

### 1.2. Склонируй репозиторий

```bash
git clone https://github.com/6t7aam/mobile-game.git
cd mobile-game
git checkout feat/sss-polish   # ветка со всеми изменениями (или смержи PR #1 в main)
```

### 1.3. Установи зависимости и запусти

```bash
bun install          # или: npm install
bun x expo start     # или: npx expo start
```

Дальше три варианта:

| Где играть | Что сделать |
|---|---|
| **Браузер на ПК** | нажми `w` в терминале — откроется http://localhost:8081 |
| **Свой телефон** | поставь приложение **Expo Go** (Play Market / App Store), отсканируй QR-код из терминала. Телефон и ПК должны быть в одной Wi-Fi сети |
| **Эмулятор Android** | поставь Android Studio → Device Manager → создай эмулятор → нажми `a` в терминале |

> Игра ландшафтная — в браузере сузь окно до пропорции ~2:1 или открой DevTools → режим устройства.

---

## Часть 2. Подключить Supabase (аккаунты + облако)

Сейчас игра работает в гостевом режиме (всё хранится локально). Чтобы заработали регистрация и вход:

1. Зайди на https://supabase.com → **Start your project** → создай бесплатный аккаунт.
2. **New project**: имя `the-holdouts`, придумай пароль БД, регион — Central EU (Frankfurt).
3. Когда проект создастся: **Project Settings → API**. Там нужны два значения:
   - **Project URL** (`https://<ref>.supabase.co`)
   - **anon / public key**
4. В корне проекта создай файл `.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://<твой-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<твой anon key>
```

5. Перезапусти `expo start`. На экране «Аккаунт» появятся регистрация и вход.
6. (Рекомендую) В Supabase: **Authentication → Providers → Email** — отключи «Confirm email», чтобы игроки не ждали письма.

Подробности и схема таблицы для облачных сохранений — в `docs/supabase.md`.

---

## Часть 3. Подготовка к публикации

### 3.1. Что уже готово

- Название: **The Holdouts**, bundle id: `com.theholdouts.app` (iOS и Android) — в `app.json`.
- Иконка, adaptive icon, splash — в `assets/images/`.
- 20 языков интерфейса.
- Магазин и валюта. ⚠️ Покупки сейчас **эмулируются** — для реальных денег см. шаг 3.4.

### 3.2. Заведи аккаунты разработчика

| Магазин | Где | Цена |
|---|---|---|
| Google Play | https://play.google.com/console | $25 один раз |
| App Store | https://developer.apple.com (нужен Mac/iPhone для теста) | $99 в год |

Регистрация в Google занимает день-два (проверка личности), у Apple — до недели.

### 3.3. Собери приложение через EAS (облачная сборка Expo)

Нативные сборки делает сервис EAS — компьютер с Xcode не обязателен (для iOS сборка идёт в облаке Expo).

```bash
npm install -g eas-cli
npx eas login          # создай бесплатный аккаунт expo.dev
npx eas build:configure
```

**Android (.aab для Play Market):**
```bash
npx eas build --platform android --profile production
```
Ключ подписи EAS создаст и сохранит сам. На выходе — ссылка на `.aab` файл.

**iOS (.ipa для App Store):**
```bash
npx eas build --platform ios --profile production
```
EAS спросит Apple ID и сам создаст сертификаты/профили. Нужен активный аккаунт Apple Developer.

Секреты (ключи Supabase) для сборки добавь так:
```bash
npx eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value https://<ref>.supabase.co
npx eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon key>
```

### 3.4. Включи реальные покупки (IAP)

Эмуляция заменяется на реальный биллинг так:

1. `bun x expo install react-native-iap`
2. В `src/services/iap.ts` найди метки `TODO(iap)` — там три точки подключения (инициализация, покупка, восстановление). ID товаров уже заданы: `holdouts.crystals.100 / 550 / 1200 / 3000`.
3. Заведи эти же ID как «Управляемые товары» (consumable) в Play Console → Монетизация → Товары, и в App Store Connect → Покупки в приложении.
4. Пересобери через EAS (IAP не работает в Expo Go — только в нативной сборке).
5. Для честной защиты от взлома добавь серверную проверку чеков (можно Supabase Edge Function) — напиши мне, сделаю.

---

## Часть 4. Публикация

### 4.1. Google Play (проще, начни с него)

1. Play Console → **Create app**: название The Holdouts, язык по умолчанию — русский, тип «Игра», бесплатно.
2. Заполни обязательные анкеты (Dashboard подсвечивает): политика конфиденциальности (страница-URL, могу сгенерировать), целевая аудитория (13+), рейтинг контента (анкета IARC → «мультяшное насилие»), Data safety.
3. Подготовь графику: иконка 512×512, feature graphic 1024×500, минимум 2 скриншота на телефон (ландшафт). Могу нарезать из игры.
4. **Production → Create release** → загрузи `.aab` из EAS (или одной командой: `npx eas submit --platform android`).
5. Отправь на проверку. Первая проверка — от пары дней до 2 недель. Для нового аккаунта Google требует закрытое тестирование (12 тестеров, 14 дней) перед продакшеном — учитывай это.

### 4.2. App Store

1. App Store Connect → **My Apps → +**: имя The Holdouts, bundle id `com.theholdouts.app`, SKU `theholdouts`.
2. Загрузи сборку: `npx eas submit --platform ios`.
3. Заполни страницу: описание, ключевые слова, скриншоты (обязательно 6.7" и 6.5" iPhone, ландшафт; iPad — если поддерживаешь), возрастной рейтинг (мультяшное насилие → 9+), политика конфиденциальности.
4. Если есть IAP — каждый товар тоже отправляется на ревью вместе с первой сборкой.
5. **Submit for Review**. Обычно 1-3 дня. Apple строже: проверь, что гостевой режим работает без регистрации (это у нас уже так — иначе реджект по guideline 2.1).

### 4.3. После релиза

- Обновления: поднимай `version` в `app.json` → `eas build` → `eas submit`.
- Мелкие JS-правки можно слать без ревью сторов через `npx eas update` (OTA-обновления).

---

## Шпаргалка: весь путь одной таблицей

| Шаг | Команда / действие | Время |
|---|---|---|
| Скачать | `git clone` + `bun install` | 10 мин |
| Запустить | `bun x expo start` → `w` или Expo Go | 1 мин |
| Supabase | создать проект + `.env` | 10 мин |
| Аккаунты сторов | Google $25 / Apple $99 | 1-7 дней |
| Сборка | `eas build -p android` / `-p ios` | ~20 мин |
| IAP | react-native-iap + товары в консолях | 2-3 часа |
| Публикация | `eas submit` + анкеты | 1-14 дней ревью |

Если застрянешь на любом шаге — пиши мне, пройдём вместе. 🚀
