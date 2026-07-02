import { rm } from "node:fs/promises";

import type {
  TaskRecord,
  WorkspaceCleanupService,
} from "../types/task.types.js";

export class FsWorkspaceCleanupService implements WorkspaceCleanupService {
  async cleanup(task: TaskRecord): Promise<void> {
    await rm(task.workspacePath, { recursive: true, force: true });
  }
}

export class NoopWorkspaceCleanupService implements WorkspaceCleanupService {
  async cleanup(): Promise<void> {}
}
