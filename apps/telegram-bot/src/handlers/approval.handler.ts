import type { Context } from "telegraf";

import type {
  ChatSessionStore,
  OrchestratorClient,
  ParsedApprovalCommand,
} from "../types/orchestrator.types.js";
import {
  APPROVE_COMMAND,
  REJECT_COMMAND,
} from "../types/orchestrator.types.js";

export function parseApprovalCommand(
  text: string,
): ParsedApprovalCommand | undefined {
  const trimmed = text.trim();
  const approveMatch = trimmed.match(/^\/approve(?:\s+(\S+))?$/i);

  if (approveMatch) {
    return approveMatch[1] === undefined
      ? { action: "approve" }
      : { action: "approve", taskId: approveMatch[1] };
  }

  const rejectMatch = trimmed.match(/^\/reject(?:\s+(\S+))?$/i);

  if (rejectMatch) {
    return rejectMatch[1] === undefined
      ? { action: "reject" }
      : { action: "reject", taskId: rejectMatch[1] };
  }

  const normalized = trimmed.toUpperCase();

  if (normalized === APPROVE_COMMAND) {
    return { action: "approve" };
  }

  if (normalized === REJECT_COMMAND) {
    return { action: "reject" };
  }

  return undefined;
}

export function isApprovalCommand(text: string): boolean {
  return parseApprovalCommand(text) !== undefined;
}

export function createApprovalHandler(
  orchestratorClient: OrchestratorClient,
  chatSessionStore: ChatSessionStore,
  action: "approve" | "reject",
) {
  return async (ctx: Context, explicitTaskId?: string): Promise<void> => {
    const chatId = ctx.chat?.id;

    if (chatId === undefined) {
      return;
    }

    const taskId = explicitTaskId ?? chatSessionStore.getActiveTaskId(chatId);

    if (taskId === undefined) {
      await ctx.reply("No task is waiting for approval.");
      return;
    }

    try {
      const result =
        action === "approve"
          ? await orchestratorClient.approveTask(taskId)
          : await orchestratorClient.rejectTask(taskId);

      chatSessionStore.clearActiveTaskId(chatId);

      if (result.status === "approved") {
        await ctx.reply(formatApprovalSuccessMessage(result.prUrl));
        return;
      }

      await ctx.reply("Task rejected. Push will not happen.");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Approval action failed";

      await ctx.reply(message);
    }
  };
}

export function formatApprovalSuccessMessage(prUrl?: string): string {
  const lines = ["Task completed.", "PR created successfully."];

  if (prUrl !== undefined && prUrl.length > 0) {
    lines.push(prUrl);
  }

  return lines.join("\n");
}

export function createApproveHandler(
  orchestratorClient: OrchestratorClient,
  chatSessionStore: ChatSessionStore,
) {
  return createApprovalHandler(orchestratorClient, chatSessionStore, "approve");
}

export function createRejectHandler(
  orchestratorClient: OrchestratorClient,
  chatSessionStore: ChatSessionStore,
) {
  return createApprovalHandler(orchestratorClient, chatSessionStore, "reject");
}
