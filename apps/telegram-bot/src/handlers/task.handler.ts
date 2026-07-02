import type { Context, Telegraf } from "telegraf";

import {
  buildApprovalKeyboard,
  formatApprovalRequest,
  TaskPoller,
} from "../services/task-poller.service.js";
import type {
  ChatSessionStore,
  OrchestratorClient,
} from "../types/orchestrator.types.js";

export function createTaskMessageHandler(
  orchestratorClient: OrchestratorClient,
  chatSessionStore: ChatSessionStore,
  taskPoller: TaskPoller,
) {
  return async (ctx: Context): Promise<void> => {
    if (ctx.message === undefined || !("text" in ctx.message)) {
      return;
    }

    const text = ctx.message.text;
    const chatId = ctx.chat?.id;

    if (chatId === undefined) {
      return;
    }

    try {
      const result = await orchestratorClient.createTask(text);
      chatSessionStore.setActiveTaskId(chatId, result.taskId);

      await ctx.reply(
        `Task accepted. ID: ${result.taskId}\nRunning worker...`,
      );

      void notifyWhenTaskReady(
        ctx.telegram,
        chatId,
        result.taskId,
        chatSessionStore,
        taskPoller,
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Task failed to register";

      await ctx.reply(message);
      chatSessionStore.clearActiveTaskId(chatId);
    }
  };
}

async function notifyWhenTaskReady(
  telegram: Telegraf["telegram"],
  chatId: number,
  taskId: string,
  chatSessionStore: ChatSessionStore,
  taskPoller: TaskPoller,
): Promise<void> {
  try {
    const task = await taskPoller.waitForTerminalStatus(taskId);

    if (task.status === "failed") {
      await telegram.sendMessage(
        chatId,
        `Task failed: ${task.errorMessage ?? "Unknown error"}`,
      );
      chatSessionStore.clearActiveTaskId(chatId);
      return;
    }

    if (task.status === "awaiting_approval") {
      await telegram.sendMessage(chatId, formatApprovalRequest(task), {
        reply_markup: buildApprovalKeyboard(task),
      });
      return;
    }

    await telegram.sendMessage(
      chatId,
      `Task finished with status: ${task.status}`,
    );
    chatSessionStore.clearActiveTaskId(chatId);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Task status polling failed";

    console.error(`Task notification failed for ${taskId}:`, error);

    try {
      await telegram.sendMessage(chatId, message);
    } catch (sendError: unknown) {
      console.error(`Failed to notify chat ${chatId}:`, sendError);
    }

    chatSessionStore.clearActiveTaskId(chatId);
  }
}
