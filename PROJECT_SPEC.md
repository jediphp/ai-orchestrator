# PROJECT_SPEC.md

## Project Name

Remote AI Developer Agent

---

## Goal

Build a system that allows a developer to send development tasks from a mobile phone using Telegram (voice or text).

The system should automatically:

* receive task from Telegram
* transcribe voice to text
* parse task intent
* run autonomous coding agent against existing repository
* allow agent to analyze codebase independently
* generate code modifications
* generate diff summary
* wait for manual approval
* push branch to GitHub
* create Pull Request automatically

The goal is to allow remote development while away from the computer.

---

## MVP Scope

The MVP must support:

* one GitHub repository only
* one Telegram user only
* one task at a time
* manual approval before push
* Docker isolated execution
* autonomous Codex CLI execution
* text and voice Telegram messages

Do NOT implement:

* multiple repositories
* web dashboard
* persistent database
* parallel execution
* automatic merge
* multi-agent architecture

---

## Architecture

System contains 3 applications.

### 1. Telegram Bot

Responsibilities:

* receive text messages
* receive voice messages
* send task to orchestrator API
* send notifications to user
* receive approval commands

Tech stack:

* Node.js
* TypeScript
* Telegraf

---

### 2. Orchestrator API

Responsibilities:

* receive incoming task
* validate request
* parse task
* manage execution lifecycle
* communicate with worker

Tech stack:

* Node.js
* TypeScript
* Fastify

---

### 3. Worker

Responsibilities:

* clone repository
* create branch
* execute Codex CLI autonomous mode
* collect git diff
* wait approval
* push branch
* create PR

Tech stack:

* Node.js
* TypeScript
* Docker

---

## Folder Structure

remote-dev-agent/

apps/

telegram-bot/

orchestrator/

worker/

packages/

git-service/

codex-runner/

task-parser/

notification-service/

shared/

types/

---

## Execution Flow

Telegram message arrives

↓

Telegram Bot sends request to Orchestrator

↓

Orchestrator validates task

↓

Worker container starts

↓

Repository cloned

↓

New branch created

↓

Codex CLI autonomous mode executes task

↓

Git diff generated

↓

Telegram asks for approval

↓

User sends APPROVE

↓

Git push executed

↓

Pull Request created

↓

Telegram sends success notification

---

## Development Rules

Use TypeScript strict mode.

Avoid monolithic files.

Maximum file size 300 lines.

Use service-based architecture.

Every module must be independently testable.

Never use any global mutable state.

Use dependency injection where possible.

Use environment variables only via dotenv.

All services must expose interfaces.

---

## Security Requirements

GitHub token must never be hardcoded.

Telegram token must never be hardcoded.

Worker container must be isolated.

Worker should only have access to project repository.

No shell commands from user should be executed directly.

Validate all input before execution.

---

## Expected End Result

Developer sends:

"Fix debounce issue in search component"

System automatically:

* clones repo
* creates branch
* runs Codex autonomous mode
* modifies files
* shows diff summary
* waits approval
* pushes branch
* creates PR
