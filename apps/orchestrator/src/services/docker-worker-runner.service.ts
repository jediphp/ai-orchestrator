import type { WorkerRunner, WorkerRunResult } from "../types/task.types.js";
import { DockerWorkerProcess } from "./docker-worker-process.service.js";

export class DockerWorkerRunner implements WorkerRunner {
  constructor(private readonly dockerWorkerProcess: DockerWorkerProcess) {}

  async execute(input: {
    taskId: string;
    task: string;
    branchName: string;
  }): Promise<WorkerRunResult> {
    return this.dockerWorkerProcess.runJson<WorkerRunResult>({
      command: "execute",
      env: {
        TASK_ID: input.taskId,
        TASK_TEXT: input.task,
        BRANCH_NAME: input.branchName,
      },
    });
  }
}
