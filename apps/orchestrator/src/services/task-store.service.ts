import type { TaskRecord, TaskStore } from "../types/task.types.js";

const ACTIVE_STATUSES = new Set<TaskRecord["status"]>([
  "running",
  "awaiting_approval",
  "publishing",
]);

export class InMemoryTaskStore implements TaskStore {
  private readonly tasks = new Map<string, TaskRecord>();

  save(task: TaskRecord): void {
    this.tasks.set(task.taskId, task);
  }

  get(taskId: string): TaskRecord | undefined {
    return this.tasks.get(taskId);
  }

  update(taskId: string, patch: Partial<TaskRecord>): TaskRecord {
    const current = this.tasks.get(taskId);

    if (current === undefined) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const updated: TaskRecord = {
      ...current,
      ...patch,
    };

    this.tasks.set(taskId, updated);
    return updated;
  }

  hasActiveTask(): boolean {
    for (const task of this.tasks.values()) {
      if (ACTIVE_STATUSES.has(task.status)) {
        return true;
      }
    }

    return false;
  }
}
