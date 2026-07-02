import "dotenv/config";

import { createBot } from "./bot.js";
import { InMemoryChatSessionStore } from "./services/chat-session.service.js";
import { FetchOrchestratorClient } from "./services/orchestrator.client.js";
import type { BotAccessOptions } from "./types/orchestrator.types.js";

function getBotToken(): string {
  const token = process.env.BOT_TOKEN;

  if (!token) {
    throw new Error("BOT_TOKEN environment variable is required");
  }

  return token;
}

function getOrchestratorUrl(): string {
  const url = process.env.ORCHESTRATOR_URL;

  if (!url) {
    throw new Error("ORCHESTRATOR_URL environment variable is required");
  }

  return url;
}

function getBotAccessOptions(): BotAccessOptions {
  const rawAllowedUserId = process.env.TELEGRAM_ALLOWED_USER_ID?.trim();

  if (rawAllowedUserId === undefined || rawAllowedUserId.length === 0) {
    return {};
  }

  const allowedUserId = Number(rawAllowedUserId);

  if (!Number.isInteger(allowedUserId) || allowedUserId <= 0) {
    throw new Error("TELEGRAM_ALLOWED_USER_ID must be a positive integer");
  }

  return { allowedUserId };
}

const orchestratorClient = new FetchOrchestratorClient(getOrchestratorUrl());
const chatSessionStore = new InMemoryChatSessionStore();
const bot = createBot(
  getBotToken(),
  orchestratorClient,
  chatSessionStore,
  getBotAccessOptions(),
);

process.on("unhandledRejection", (reason: unknown) => {
  console.error("Unhandled rejection:", reason);
});

void bot.launch().then(() => {
  console.log("Telegram bot started");
});

process.once("SIGINT", () => {
  void bot.stop("SIGINT");
});

process.once("SIGTERM", () => {
  void bot.stop("SIGTERM");
});
