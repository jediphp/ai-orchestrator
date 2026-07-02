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
  WorkspaceCleanupService,
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
    private readonly workspaceCleanupService: WorkspaceCleanupService,
    private readonly config: TaskServiceConfig,
  ) {}

  async createTask(input: CreateTaskInput): Promise<CreateTaskResult> {
    if (this.taskStore.hasActiveTask()) {
      throw new TaskConflictError(
        "Another task is already running, publishing, or awaiting approval",
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
      const publishingTask = this.taskStore.update(taskId, {
        status: "publishing",
      });
      const publishResult = await this.publishService.publish(publishingTask);

      const approvedTask = this.taskStore.update(taskId, {
        status: "approved",
        prUrl: publishResult.prUrl,
      });

      void this.cleanupWorkspace(approvedTask);
      return approvedTask;
    } catch (error: unknown) {
      const currentTask = this.taskStore.get(taskId);

      if (currentTask !== undefined && currentTask.status === "publishing") {
        this.taskStore.update(taskId, { status: "awaiting_approval" });
      }

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

    const rejectedTask = this.taskStore.update(taskId, { status: "rejected" });

    void this.cleanupWorkspace(rejectedTask);
    return rejectedTask;
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
        void this.cleanupWorkspace(this.getTaskOrThrow(taskId));
        return;
      }

      if (result.changedFiles.length === 0) {
        this.taskStore.update(taskId, {
          status: "failed",
          changedFiles: result.changedFiles,
          summary: result.summary,
          errorMessage: "Codex completed without file changes",
        });
        void this.cleanupWorkspace(this.getTaskOrThrow(taskId));
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
      void this.cleanupWorkspace(this.getTaskOrThrow(taskId));
    }
  }

  private async cleanupWorkspace(task: TaskRecord): Promise<void> {
    try {
      await this.workspaceCleanupService.cleanup(task);
    } catch (error: unknown) {
      console.warn(`Workspace cleanup failed for task ${task.taskId}:`, error);
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
