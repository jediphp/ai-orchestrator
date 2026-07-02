# Remote AI Developer Agent

Remote AI Developer Agent lets a developer send coding tasks from Telegram and receive an AI-generated pull request for a single GitHub repository.

The current MVP accepts text messages, sends them to a Fastify orchestrator, runs Codex CLI against a cloned repository, summarizes the diff, waits for manual approval in Telegram, then pushes a branch and creates a GitHub pull request.

## Status

Implemented:

- Telegram text task flow
- Fastify Orchestrator API
- one active task at a time
- Codex CLI execution
- diff summary
- manual approve/reject flow
- Git push and GitHub PR creation
- optional single-user Telegram allowlist
- Codex task timeout and workspace cleanup after terminal states
- Docker Compose VPS deployment with isolated worker containers

Not implemented yet:

- Telegram voice transcription
- persistent database
- web dashboard

## Repository Layout

```text
apps/
  telegram-bot/    Telegraf bot
  orchestrator/    Fastify API and task lifecycle
  worker/          Git workspace and publish operations
packages/
  codex-runner/    Codex CLI integration and PR metadata
shared/
  types/           shared TypeScript package
```

## Getting Started

Copy environment examples and fill in local values:

```bash
cp apps/telegram-bot/.env.example apps/telegram-bot/.env
cp apps/orchestrator/.env.example apps/orchestrator/.env
pnpm install
pnpm build
pnpm test
```

There is also a root [.env.example](.env.example) with all variables in one place.

Full setup instructions are in [SETUP.md](SETUP.md).

For VPS deployment, copy [.env.vps.example](.env.vps.example), build with
`docker-compose.vps.yml`, and authorize Codex inside the `codex-home` Docker
volume.

## Security

Never commit real `.env` files, tokens, repository credentials, Codex auth files, or GitHub personal access tokens. This repository includes `.env.example` templates only.

## Contributing

Community help is welcome. Good first areas are tests, documentation, voice transcription, lifecycle hardening, and deployment examples. See [CONTRIBUTING.md](CONTRIBUTING.md).
