import type { Context, Telegraf } from "telegraf";

import {
  createApproveHandler,
  createRejectHandler,
  parseApprovalCommand,
} from "./handlers/approval.handler.js";
import { createTaskMessageHandler } from "./handlers/task.handler.js";
import { TaskPoller } from "./services/task-poller.service.js";
import type {
  BotAccessOptions,
  ChatSessionStore,
  OrchestratorClient,
} from "./types/orchestrator.types.js";

export function registerHandlers(
  bot: Telegraf,
  orchestratorClient: OrchestratorClient,
  chatSessionStore: ChatSessionStore,
  accessOptions: BotAccessOptions = {},
): void {
  const taskPoller = new TaskPoller(orchestratorClient);
  const taskHandler = createTaskMessageHandler(
    orchestratorClient,
    chatSessionStore,
    taskPoller,
  );
  const approveHandler = createApproveHandler(
    orchestratorClient,
    chatSessionStore,
  );
  const rejectHandler = createRejectHandler(
    orchestratorClient,
    chatSessionStore,
  );

  bot.action(/^task:(approve|reject):(.+)$/, async (ctx) => {
    if (!isAllowedUser(ctx, accessOptions)) {
      await ctx.answerCbQuery("This bot is private.");
      return;
    }

    const action = ctx.match[1];
    const taskId = ctx.match[2];

    await ctx.answerCbQuery("Processing...");
    await clearInlineKeyboard(ctx);

    if (action === "approve") {
      await approveHandler(ctx, taskId);
      return;
    }

    await rejectHandler(ctx, taskId);
  });

  bot.on("text", async (ctx) => {
    if (!isAllowedUser(ctx, accessOptions)) {
      await ctx.reply("This bot is private.");
      return;
    }

    if (ctx.message === undefined || !("text" in ctx.message)) {
      return;
    }

    const text = ctx.message.text;

    if (isIgnoredBotCommand(text)) {
      return;
    }

    const approvalCommand = parseApprovalCommand(text);

    if (approvalCommand !== undefined) {
      if (approvalCommand.action === "approve") {
        await approveHandler(ctx, approvalCommand.taskId);
        return;
      }

      await rejectHandler(ctx, approvalCommand.taskId);
      return;
    }

    await taskHandler(ctx);
  });
}

async function clearInlineKeyboard(ctx: Context): Promise<void> {
  try {
    await ctx.editMessageReplyMarkup(undefined);
  } catch (error: unknown) {
    console.warn("Failed to clear Telegram inline keyboard:", error);
  }
}

function isAllowedUser(ctx: Context, accessOptions: BotAccessOptions): boolean {
  if (accessOptions.allowedUserId === undefined) {
    return true;
  }

  return ctx.from?.id === accessOptions.allowedUserId;
}

function isIgnoredBotCommand(text: string): boolean {
  const trimmed = text.trim();

  if (!trimmed.startsWith("/")) {
    return false;
  }

  return parseApprovalCommand(text) === undefined;
}
