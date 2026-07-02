import type { PublishChangesResult } from "@remote-dev-agent/worker";

import type { TaskRecord } from "../types/task.types.js";
import type { PublishService } from "./publish.service.js";
import { DockerWorkerProcess } from "./docker-worker-process.service.js";

export class DockerPublishService implements PublishService {
  constructor(private readonly dockerWorkerProcess: DockerWorkerProcess) {}

  async publish(task: TaskRecord): Promise<PublishChangesResult> {
    return this.dockerWorkerProcess.runJson<PublishChangesResult>({
      command: "publish",
      env: {
        TASK_ID: task.taskId,
        TASK_TEXT: task.text,
        WORKSPACE_PATH: task.workspacePath,
        BRANCH_NAME: task.branchName,
        CHANGED_FILES_JSON: JSON.stringify(task.changedFiles ?? []),
        SUMMARY: task.summary ?? "0 files changed, 0 insertions, 0 deletions",
      },
    });
  }
}
