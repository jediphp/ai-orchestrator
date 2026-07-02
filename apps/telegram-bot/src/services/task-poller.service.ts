import type { OrchestratorClient, TaskDetails } from "../types/orchestrator.types.js";

const TERMINAL_STATUSES = new Set<TaskDetails["status"]>([
  "awaiting_approval",
  "approved",
  "rejected",
  "failed",
]);

export interface TaskPollerOptions {
  intervalMs?: number;
  maxAttempts?: number;
}

export class TaskPoller {
  constructor(
    private readonly orchestratorClient: OrchestratorClient,
    private readonly options: TaskPollerOptions = {},
  ) {}

  async waitForTerminalStatus(taskId: string): Promise<TaskDetails> {
    const intervalMs = this.options.intervalMs ?? 5_000;
    const maxAttempts = this.options.maxAttempts ?? 360;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const task = await this.orchestratorClient.getTask(taskId);

      if (TERMINAL_STATUSES.has(task.status)) {
        return task;
      }

      await sleep(intervalMs);
    }

    throw new Error("Task polling timed out");
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function formatApprovalRequest(task: TaskDetails): string {
  const files =
    task.changedFiles !== undefined && task.changedFiles.length > 0
      ? task.changedFiles.map((file) => `- ${file}`).join("\n")
      : "- no changed files detected";

  return [
    "Changes ready for review.",
    "",
    `Branch: ${task.branchName}`,
    `Summary: ${task.summary ?? "n/a"}`,
    "Files:",
    files,
    "",
    "Tap Approve below, or reply APPROVE.",
    "Tap Reject below, or reply REJECT.",
    "",
    `Fallback approve command: /approve ${task.taskId}`,
    `Fallback reject command: /reject ${task.taskId}`,
    "Push will not happen until you approve.",
  ].join("\n");
}

export function buildApprovalKeyboard(task: TaskDetails) {
  return {
    inline_keyboard: [
      [
        {
          text: "Approve",
          callback_data: `task:approve:${task.taskId}`,
        },
        {
          text: "Reject",
          callback_data: `task:reject:${task.taskId}`,
        },
      ],
    ],
  };
}
