# MVP audit and next steps

Дата ревизии: 2026-06-25.

## Краткий вывод

MVP реализован частично. Основной текстовый сценарий уже работает:

1. Telegram Bot принимает текст.
2. Bot отправляет задачу в Orchestrator.
3. Orchestrator валидирует payload, создаёт задачу и запускает Worker.
4. Worker клонирует один репозиторий из `REPO_URL`, создаёт branch, запускает Codex CLI.
5. Система собирает changed files и diff summary.
6. Bot показывает результат и ждёт manual approval.
7. После approve выполняются commit, push и `gh pr create`.

Критичные пробелы относительно `PROJECT_SPEC.md`:

1. Нет voice messages и транскрипции.
2. Нет Docker isolated execution.
3. Нет ограничения на одного Telegram user.
4. Worker сейчас запускается как shell-процесс на хосте, а не как отдельный контейнер.
5. Нет тестового покрытия для ключевых lifecycle-сценариев.

## MVP status matrix

| Требование MVP | Статус | Комментарий |
|---|---:|---|
| One GitHub repository only | Готово | Используется один `REPO_URL` из env. |
| One Telegram user only | Не готово | Bot принимает сообщения от любого пользователя, у которого есть доступ к боту. |
| One task at a time | Готово | `InMemoryTaskStore.hasActiveTask()` блокирует вторую active-задачу. |
| Manual approval before push | Готово | Push/PR происходят только через `/approve` или `APPROVE`. |
| Docker isolated execution | Не готово | Dockerfile/compose/runtime отсутствуют, Worker работает на хосте. |
| Autonomous Codex CLI execution | Готово | `codex exec -p automation -s workspace-write -C <path> <task>`. |
| Text Telegram messages | Готово | `bot.on("text")`. |
| Voice Telegram messages | Не готово | Voice handler и transcription service отсутствуют. |
| Persistent database excluded | ОК | Используется in-memory store. |
| Parallel execution excluded | ОК | Вторая активная задача получает conflict. |
| Auto merge excluded | ОК | Реализован только PR. |

## Recommended implementation plan

### Phase 1. Закрыть обязательные MVP-пробелы

1. Добавить allowlist одного Telegram user.
   - Env: `TELEGRAM_ALLOWED_USER_ID`.
   - Проверять `ctx.from?.id` до обработки text/voice/approval.
   - Для чужих пользователей молча игнорировать или отвечать коротким отказом.
   - Обновить `SETUP.md`.

2. Добавить voice message flow.
   - Зарегистрировать `bot.on("voice")`.
   - Скачать voice file через Telegram API.
   - Добавить `TranscriptionService` с интерфейсом.
   - Преобразовать voice в text и отправить в существующий `createTask` flow.
   - Env: provider/model/API key для транскрипции.
   - Обновить `SETUP.md`.

3. Добавить Docker execution mode для Worker.
   - Добавить `Dockerfile.worker`.
   - Добавить минимальный `docker-compose.vps.yml` для VPS.
   - В Orchestrator добавить runtime-переключатель: `WORKER_EXECUTION_MODE=local|docker`.
   - `local` оставить удобным для разработки.
   - `docker` использовать на VPS и для MVP isolation requirement.
   - Передавать в контейнер только нужные env и workspace mount.
   - Обновить `SETUP.md`.

### Phase 2. Стабилизировать lifecycle

1. Добавить cleanup workspace после reject/failed/approved.
2. Явно хранить worker logs в `TaskRecord` или в отдельном временном log-файле.
3. Добавить timeout для Codex task execution.
4. Добавить статус `publishing`, чтобы approve нельзя было нажать повторно во время push/PR.
5. Проверить поведение, если Codex завершился успешно, но diff пустой.

### Phase 3. Тесты

1. Unit tests для:
   - approval command parser;
   - branch name generation;
   - task conflict / active task logic;
   - task state transitions.
2. Integration tests для Orchestrator routes:
   - `POST /task`;
   - `GET /task/:taskId`;
   - approve/reject state errors.
3. Mock-based tests для Worker:
   - clone → branch → codex → diff summary;
   - publish → commit → push → PR.

### Phase 4. VPS deployment

1. Подготовить `.env.example` для Bot/Orchestrator/VPS.
2. Добавить production compose:
   - telegram-bot;
   - orchestrator;
   - dockerized worker execution или отдельный worker image.
3. Настроить persistent workspace base path на VPS.
4. Описать установку GitHub CLI/Codex auth внутри VPS runtime.
5. Добавить healthcheck для Orchestrator.
6. Добавить systemd или compose restart policy.

## Можно ли локально не использовать Docker?

Да. Текущая реализация уже работает локально без Docker: Orchestrator вызывает Worker напрямую как TypeScript/Node service, а Worker запускает `git`, `gh` и `codex` на хосте.

Рекомендуемый режим:

| Среда | Режим |
|---|---|
| Local development | `WORKER_EXECUTION_MODE=local` |
| VPS / production-like run | `WORKER_EXECUTION_MODE=docker` |

Так локальная разработка остаётся быстрой и простой, а требование MVP про изолированное выполнение закрывается на VPS через Docker.

## Suggested next task

Следующим шагом лучше сделать `TELEGRAM_ALLOWED_USER_ID`, потому что это маленькое изменение с большим security-эффектом. После него логично добавлять voice flow, затем Docker runtime для VPS.
