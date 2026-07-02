# Первый запуск — пошаговая настройка

Инструкция для текущего состояния проекта:

- monorepo (pnpm + TypeScript)
- **Telegram Bot** — приём текстовых сообщений
- **Orchestrator API** — endpoint `POST /task`

Worker подключён к Orchestrator. После approval в Telegram выполняются **commit → push → PR** через GitHub CLI. Docker и голосовые сообщения **ещё не реализованы**.

---

## Что уже работает

| Сервис            | Статус | Описание                                              |
|-------------------|--------|-------------------------------------------------------|
| Telegram Bot      | ✅     | Принимает текст, отправляет задачу в Orchestrator     |
| Orchestrator API  | ✅     | lifecycle задачи + Worker + approval API              |
| Bot → API         | ✅     | задача, diff summary, APPROVE / REJECT                |
| Approval flow     | ✅     | push/PR только после approve                          |
| Git push / PR       | ✅     | commit, push, `gh pr create` после approve            |

---

## Что понадобится

| Требование | Минимальная версия |
|------------|-------------------|
| Node.js    | 20+               |
| pnpm       | 10+               |
| Telegram   | аккаунт           |
| Git        | установленный `git` в PATH (для Worker) |
| GitHub CLI | установленный `gh` в PATH               |
| Codex CLI  | установленный `codex` в PATH (для Codex Runner) |

---

## Шаг 1. Установить инструменты

### Node.js

```bash
node -v
```

Должно быть `v20` или выше.

### pnpm

Если pnpm не установлен:

```bash
corepack enable
corepack prepare pnpm@10.12.1 --activate
pnpm -v
```

### Codex CLI

Codex CLI нужен для Worker (`packages/codex-runner`). На этой машине уже установлен **codex-cli 0.142.0** и выполнен вход через ChatGPT.

#### Установка

```bash
npm install -g @openai/codex@latest
```

Альтернатива (macOS/Linux, официальный скрипт):

```bash
curl -fsSL https://chatgpt.com/codex/install.sh | sh
```

Проверка:

```bash
codex --version
which codex
```

Если `codex: command not found`, добавьте npm global bin в `PATH`:

```bash
export PATH="$(npm prefix -g)/bin:$PATH"
```

Для постоянной настройки в `~/.zshrc`:

```bash
export PATH="$(npm prefix -g)/bin:$PATH"
```

#### Авторизация

```bash
codex login
```

Или проверка текущего состояния:

```bash
codex doctor
```

В блоке **Auth** должно быть `auth is configured`. Поддерживаются:

- вход через **ChatGPT** (Plus/Pro/Team)
- или **API key** OpenAI через `codex login`

#### Профиль для автоматизации Worker

Worker запускает Codex в неинтерактивном режиме с профилем `automation`:

```
~/.codex/automation.config.toml
```

```toml
approval_policy = "never"
```

Команда, которую вызывает `@remote-dev-agent/codex-runner`:

```bash
codex exec -p automation -s workspace-write -C <projectPath> "<task>"
```

Опционально можно переопределить профиль:

```bash
export CODEX_PROFILE=automation
```

#### Доверие проекту

В `~/.codex/config.toml` для репозитория добавлено:

```toml
[projects."/Users/jedi/Developer/ai_automation"]
trust_level = "trusted"
```

При работе с другими путями клонируемых репозиториев добавьте аналогичные секции `[projects."..."]`.

#### Быстрая проверка Codex

```bash
codex doctor
codex exec -p automation -s workspace-write -C . "Summarize this repository in one sentence"
```

---

## Шаг 2. Установить зависимости проекта

Из корня репозитория:

```bash
cd /path/to/ai_automation
pnpm install
```

---

## Шаг 3. Создать Telegram-бота

1. Откройте Telegram и найдите [@BotFather](https://t.me/BotFather).
2. Отправьте команду `/newbot`.
3. Укажите имя и username бота (username должен заканчиваться на `bot`, например `my_dev_agent_bot`).
4. BotFather пришлёт **токен** вида:

   ```
   <telegram-bot-token>
   ```

5. Сохраните токен — это значение для `BOT_TOKEN`.

> **Важно:** не публикуйте токен в git, чатах и скриншотах. Файлы `.env` уже добавлены в `.gitignore`.

---

## Шаг 4. Настроить переменные окружения

Можно начать с шаблонов:

```bash
cp apps/telegram-bot/.env.example apps/telegram-bot/.env
cp apps/orchestrator/.env.example apps/orchestrator/.env
```

Затем замените placeholder-значения на реальные токены и URL.

### Telegram Bot

Создайте файл:

```
apps/telegram-bot/.env
```

```env
BOT_TOKEN=replace_with_telegram_bot_token
ORCHESTRATOR_URL=http://127.0.0.1:3000
TELEGRAM_ALLOWED_USER_ID=123456789
```

### Orchestrator API

Создайте файл (опционально — есть значения по умолчанию):

```
apps/orchestrator/.env
```

```env
PORT=3000
HOST=0.0.0.0
REPO_URL=https://github.com/your-org/your-repo.git
WORKSPACE_BASE_PATH=/tmp/remote-dev-agent
GITHUB_TOKEN=replace_with_github_pat
CODEX_TASK_TIMEOUT_MS=1800000
```

| Переменная            | Обязательна | По умолчанию              | Описание                         |
|-----------------------|-------------|---------------------------|----------------------------------|
| `BOT_TOKEN`           | да          | —                         | Токен от @BotFather              |
| `ORCHESTRATOR_URL`    | да          | —                         | Базовый URL Orchestrator API     |
| `TELEGRAM_ALLOWED_USER_ID` | нет    | —                         | Единственный Telegram user id, которому разрешено пользоваться ботом |
| `REPO_URL`            | да          | —                         | GitHub repo для Worker           |
| `GITHUB_TOKEN`        | да          | —                         | PAT для `git push` и `gh pr`     |
| `WORKSPACE_BASE_PATH` | нет         | `/tmp/remote-dev-agent`   | Базовая папка для clone          |
| `CODEX_TASK_TIMEOUT_MS` | нет       | `1800000`                 | Timeout основного `codex exec` в миллисекундах |
| `PORT`                | нет         | `3000`                    | Порт Orchestrator API            |
| `HOST`                | нет         | `0.0.0.0`                 | Адрес прослушивания Orchestrator |

> `GITHUB_TOKEN` нужен в `apps/orchestrator/.env` — именно Orchestrator выполняет push и создаёт PR после approve.

### Почему `.env` в папках приложений?

Каждый сервис загружает `.env` из **текущей рабочей директории** процесса. Команды `pnpm --filter ... start` запускают процесс из соответствующей папки в `apps/`.

### Альтернатива без файлов `.env`

```bash
export BOT_TOKEN="replace_with_telegram_bot_token"
export ORCHESTRATOR_URL="http://127.0.0.1:3000"
export PORT=3000
export HOST=0.0.0.0
```

---

## Шаг 5. Собрать проект

Из корня репозитория:

```bash
pnpm build
```

Или отдельно по сервисам:

```bash
pnpm --filter @remote-dev-agent/telegram-bot build
pnpm --filter @remote-dev-agent/orchestrator build
```

---

## Шаг 6. Запустить сервисы

Нужны **два терминала**.

### Терминал 1 — Orchestrator API

```bash
pnpm --filter @remote-dev-agent/orchestrator start
```

При успешном запуске в логах появится строка вида:

```
Server listening at http://127.0.0.1:3000
```

### Терминал 2 — Telegram Bot

```bash
pnpm --filter @remote-dev-agent/telegram-bot start
```

При успешном запуске:

```
Telegram bot started
```

Остановка любого сервиса: `Ctrl+C`.

---

## Шаг 7. Проверить работу

### Orchestrator API

```bash
curl -X POST http://127.0.0.1:3000/task \
  -H 'Content-Type: application/json' \
  -d '{"text":"Fix debounce issue in search component"}'
```

Ожидаемый ответ (`201`):

```json
{"taskId":"5408e1dc-f49b-483c-b275-1d4a131ded71","status":"running"}
```

Статус задачи:

```bash
curl http://127.0.0.1:3000/task/5408e1dc-f49b-483c-b275-1d4a131ded71
```

Approval (после `awaiting_approval`) — выполняет commit, push и создаёт PR:

```bash
curl -X POST http://127.0.0.1:3000/task/5408e1dc-f49b-483c-b275-1d4a131ded71/approve
```

Ответ:

```json
{"taskId":"5408e1dc-...","status":"approved","prUrl":"https://github.com/org/repo/pull/42"}
```

Пустой `text` вернёт `400`:

```bash
curl -X POST http://127.0.0.1:3000/task \
  -H 'Content-Type: application/json' \
  -d '{"text":""}'
```

### Telegram Bot

1. **Сначала** убедитесь, что Orchestrator API запущен (терминал 1).
2. Найдите бота в Telegram по username из BotFather.
3. Нажмите **Start** (или отправьте `/start`).
4. Отправьте **текстовое** сообщение:

   ```
   Fix debounce issue in search component
   ```

5. Бот ответит и дождётся выполнения Worker:

   ```
   Task accepted. ID: 5408e1dc-...
   Running worker...
   ```

6. После Codex бот пришлёт diff summary:

   ```
   Changes ready for review.

   Summary: 2 files changed, 42 insertions, 12 deletions
   Files:
   - src/auth.service.ts

   Reply /approve <taskId> to continue.
   Push will not happen until you approve.
   ```

7. Отправьте **`/approve <taskId>`** или **`APPROVE`** (если это активная задача).

8. Система выполнит:
   - `git add .`
   - `git commit -m "feat: ai-generated update"`
   - `git push origin <branch>`
   - `gh pr create` с заголовком `AI Task <taskId>`

9. Бот ответит:

   ```
   Task completed.
   PR created successfully.
   https://github.com/org/repo/pull/42
   ```

10. Или отправьте **`/reject <taskId>`** / **`REJECT`** — push не будет.

11. Если Orchestrator недоступен или нет `GITHUB_TOKEN`, бот ответит с ошибкой.

---

## Что настраивать **не нужно** (пока)

| Компонент           | Переменные (будут позже) |
|---------------------|--------------------------|
| Голосовые сообщения | интеграция с транскрипцией |

---

## Структура проекта

```
ai_automation/
├── apps/
│   ├── telegram-bot/       ← Telegraf, POST к Orchestrator
│   │   ├── .env            ← BOT_TOKEN, ORCHESTRATOR_URL
│   │   └── src/
│   ├── orchestrator/       ← Fastify, POST /task
│   │   ├── .env            ← PORT, HOST (опционально)
│   │   └── src/
│   └── worker/             ← GitService, подготовка workspace
│       └── src/
│           ├── worker.ts
│           ├── types.ts
│           └── services/
│               └── git.service.ts
├── packages/
│   └── codex-runner/       ← runCodexTask(), spawn codex --autonomous
│       └── src/
└── shared/
    └── types/              ← общие TypeScript-типы
```

---

## Частые проблемы

### `ORCHESTRATOR_URL environment variable is required`

- Добавьте `ORCHESTRATOR_URL` в `apps/telegram-bot/.env`.
- Значение — базовый URL без пути, например `http://127.0.0.1:3000`.

### `Task failed to register` в Telegram

- Orchestrator API не запущен или недоступен по `ORCHESTRATOR_URL`.
- Неверный порт или URL (проверьте `PORT` в orchestrator и `ORCHESTRATOR_URL` в боте).
- Orchestrator вернул ошибку (например, пустой `text`).

### `BOT_TOKEN environment variable is required`

- Файл `.env` не создан или лежит не в `apps/telegram-bot/`.
- В `.env` опечатка в имени переменной (должно быть ровно `BOT_TOKEN`).
- Запускали `node dist/index.js` из другой директории — используйте `pnpm --filter` из корня.

### `PORT must be a positive integer`

- В `apps/orchestrator/.env` указано некорректное значение `PORT`.

### Бот не отвечает

- Убедитесь, что процесс запущен и в терминале нет ошибок.
- Проверьте, что токен скопирован полностью, без пробелов.
- Если задан `TELEGRAM_ALLOWED_USER_ID`, пишите боту именно с этого Telegram-аккаунта.
- Отправляйте **текст** — голосовые сообщения пока не обрабатываются.

### Orchestrator не отвечает на curl

- Убедитесь, что сервис запущен в отдельном терминале.
- Проверьте порт: по умолчанию `3000`, если не меняли `PORT`.
- Заголовок обязателен: `Content-Type: application/json`.

### `command not found: pnpm`

```bash
corepack enable
corepack prepare pnpm@10.12.1 --activate
```

### Ошибки TypeScript при сборке

```bash
pnpm typecheck
```

---

## Полезные команды

```bash
# Проверка типов во всём monorepo
pnpm typecheck

# Сборка всех пакетов
pnpm build

# Regression-тесты
pnpm test

# Telegram Bot
pnpm --filter @remote-dev-agent/telegram-bot build
pnpm --filter @remote-dev-agent/telegram-bot start

# Orchestrator API
pnpm --filter @remote-dev-agent/orchestrator build
pnpm --filter @remote-dev-agent/orchestrator start

# Worker (сборка библиотеки)
pnpm --filter @remote-dev-agent/worker build
pnpm --filter @remote-dev-agent/worker typecheck

# Codex Runner
pnpm --filter @remote-dev-agent/codex-runner build
pnpm --filter @remote-dev-agent/codex-runner typecheck
```

---

## Следующие этапы

По `TASKS.md` дальнейшая разработка добавит:

1. Голосовые сообщения

Когда эти части появятся, этот файл будет дополнен новыми переменными окружения и шагами запуска.
