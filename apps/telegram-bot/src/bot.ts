import { Telegraf } from "telegraf";

import { registerHandlers } from "./handlers.js";
import type {
  BotAccessOptions,
  ChatSessionStore,
  OrchestratorClient,
} from "./types/orchestrator.types.js";

export function createBot(
  token: string,
  orchestratorClient: OrchestratorClient,
  chatSessionStore: ChatSessionStore,
  accessOptions: BotAccessOptions = {},
): Telegraf {
  const bot = new Telegraf(token);
  registerHandlers(bot, orchestratorClient, chatSessionStore, accessOptions);
  return bot;
}
