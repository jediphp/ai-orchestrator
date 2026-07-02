# Contributing

Thanks for helping improve Remote AI Developer Agent.

## Development

Use Node.js 20+ and pnpm 10+.

```bash
pnpm install
pnpm typecheck
pnpm test
```

Keep changes small and aligned with the existing service-based TypeScript structure. Do not add dependencies unless they are required for the task.

## Pull Requests

Before opening a PR:

- run `pnpm typecheck`
- run `pnpm test`
- update `SETUP.md` when setup, environment variables, or large behavior changes
- avoid committing generated `dist/`, `node_modules/`, real `.env` files, tokens, or machine-specific config

## Current Priorities

- Telegram voice message transcription
- Docker-isolated worker execution
- task lifecycle hardening
- route and worker integration tests
- deployment documentation
