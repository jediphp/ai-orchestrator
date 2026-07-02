import { join } from "node:path";

import { ShellCodexRunner } from "@remote-dev-agent/codex-runner";
import { ShellGitService, Worker } from "@remote-dev-agent/worker";

import type { TaskRecord } from "../types/task.types.js";
import type { PublishChangesResult } from "@remote-dev-agent/worker";

export interface PublishService {
  publish(task: TaskRecord): Promise<PublishChangesResult>;
}

export interface PublishServiceConfig {
  workspaceBasePath: string;
}

export class DefaultPublishService implements PublishService {
  private readonly worker: Worker;

  constructor(private readonly config: PublishServiceConfig) {
    this.worker = new Worker(new ShellGitService(), new ShellCodexRunner());
  }

  async publish(task: TaskRecord): Promise<PublishChangesResult> {
    const workspacePath =
      task.workspacePath ?? join(this.config.workspaceBasePath, task.taskId);

    return this.worker.publishChanges({
      taskId: task.taskId,
      taskText: task.text,
      workspacePath,
      branchName: task.branchName,
      changedFiles: task.changedFiles ?? [],
      summary: task.summary ?? "0 files changed, 0 insertions, 0 deletions",
    });
  }
}
