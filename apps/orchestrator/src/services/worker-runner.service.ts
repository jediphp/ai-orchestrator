import { join } from "node:path";

import { ShellCodexRunner } from "@remote-dev-agent/codex-runner";
import { ShellGitService, Worker } from "@remote-dev-agent/worker";

import type { WorkerRunner, WorkerRunResult } from "../types/task.types.js";

export interface WorkerRunnerConfig {
  repoUrl: string;
  workspaceBasePath: string;
}

export class DefaultWorkerRunner implements WorkerRunner {
  private readonly worker: Worker;

  constructor(private readonly config: WorkerRunnerConfig) {
    this.worker = new Worker(new ShellGitService(), new ShellCodexRunner());
  }

  async execute(input: {
    taskId: string;
    task: string;
    branchName: string;
  }): Promise<WorkerRunResult> {
    const targetPath = join(this.config.workspaceBasePath, input.taskId);

    const result = await this.worker.executeTask({
      repoUrl: this.config.repoUrl,
      targetPath,
      branchName: input.branchName,
      task: input.task,
    });

    return {
      success: result.success,
      changedFiles: result.changedFiles,
      summary: result.summary,
      logs: result.logs,
    };
  }
}
