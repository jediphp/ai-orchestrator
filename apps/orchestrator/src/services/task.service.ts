import { join } from "node:path";
import { randomUUID } from "node:crypto";

import { GhCommandError, GitCommandError } from "@remote-dev-agent/worker";

import type { PublishService } from "./publish.service.js";
import type {
  CreateTaskInput,
  CreateTaskResult,
  TaskRecord,
  TaskService,
  TaskStore,
  WorkerRunner,
} from "../types/task.types.js";
import {
  TaskConflictError,
  TaskNotFoundError,
  TaskPublishError,
  TaskStateError,
} from "../types/task.types.js";
import { buildBranchName } from "./branch-name.service.js";

export interface TaskServiceConfig {
  workspaceBasePath: string;
}

export class DefaultTaskService implements TaskService {
  constructor(
    private readonly taskStore: TaskStore,
    private readonly workerRunner: WorkerRunner,
    private readonly publishService: PublishService,
    private readonly config: TaskServiceConfig,
  ) {}

  async createTask(input: CreateTaskInput): Promise<CreateTaskResult> {
    if (this.taskStore.hasActiveTask()) {
      throw new TaskConflictError(
        "Another task is already running or awaiting approval",
      );
    }

    const taskId = randomUUID();
    const branchName = buildBranchName(input.text, taskId);
    const workspacePath = join(this.config.workspaceBasePath, taskId);

    const task: TaskRecord = {
      taskId,
      text: input.text,
      status: "running",
      createdAt: new Date().toISOString(),
      branchName,
      workspacePath,
    };

    this.taskStore.save(task);
    void this.runWorker(taskId);

    return {
      taskId,
      status: "running",
    };
  }

  getTask(taskId: string): TaskRecord | undefined {
    return this.taskStore.get(taskId);
  }

  async approveTask(taskId: string): Promise<TaskRecord> {
    const task = this.getTaskOrThrow(taskId);

    if (task.status !== "awaiting_approval") {
      throw new TaskStateError(
        `Task ${taskId} cannot be approved from status ${task.status}`,
      );
    }

    try {
      const publishResult = await this.publishService.publish(task);

      return this.taskStore.update(taskId, {
        status: "approved",
        prUrl: publishResult.prUrl,
      });
    } catch (error: unknown) {
      throw new TaskPublishError(formatWorkerError(error));
    }
  }

  rejectTask(taskId: string): TaskRecord {
    const task = this.getTaskOrThrow(taskId);

    if (task.status !== "awaiting_approval") {
      throw new TaskStateError(
        `Task ${taskId} cannot be rejected from status ${task.status}`,
      );
    }

    return this.taskStore.update(taskId, { status: "rejected" });
  }

  private getTaskOrThrow(taskId: string): TaskRecord {
    const task = this.taskStore.get(taskId);

    if (task === undefined) {
      throw new TaskNotFoundError(`Task not found: ${taskId}`);
    }

    return task;
  }

  private async runWorker(taskId: string): Promise<void> {
    const task = this.getTaskOrThrow(taskId);

    try {
      const result = await this.workerRunner.execute({
        taskId: task.taskId,
        task: task.text,
        branchName: task.branchName,
      });

      if (!result.success) {
        this.taskStore.update(taskId, {
          status: "failed",
          changedFiles: result.changedFiles,
          summary: result.summary,
          errorMessage: "Codex execution failed",
        });
        return;
      }

      this.taskStore.update(taskId, {
        status: "awaiting_approval",
        changedFiles: result.changedFiles,
        summary: result.summary,
      });
    } catch (error: unknown) {
      const message = formatWorkerError(error);

      this.taskStore.update(taskId, {
        status: "failed",
        errorMessage: message,
      });
    }
  }
}

function formatWorkerError(error: unknown): string {
  if (error instanceof GitCommandError || error instanceof GhCommandError) {
    const details = error.stderr.trim();

    if (details.length > 0) {
      return `${error.message}: ${details}`;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Worker execution failed";
}
