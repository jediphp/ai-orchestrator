export interface CreateTaskInput {
  text: string;
}

export interface CreateTaskResult {
  taskId: string;
  status: TaskStatus;
}

export type TaskStatus =
  | "running"
  | "awaiting_approval"
  | "approved"
  | "rejected"
  | "failed";

export interface TaskRecord {
  taskId: string;
  text: string;
  status: TaskStatus;
  createdAt: string;
  branchName: string;
  workspacePath: string;
  changedFiles?: string[];
  summary?: string;
  errorMessage?: string;
  prUrl?: string;
}

export interface TaskStore {
  save(task: TaskRecord): void;
  get(taskId: string): TaskRecord | undefined;
  update(taskId: string, patch: Partial<TaskRecord>): TaskRecord;
  hasActiveTask(): boolean;
}

export interface WorkerRunner {
  execute(input: {
    taskId: string;
    task: string;
    branchName: string;
  }): Promise<WorkerRunResult>;
}

export interface WorkerRunResult {
  success: boolean;
  changedFiles: string[];
  summary: string;
  logs: string[];
}

export interface TaskService {
  createTask(input: CreateTaskInput): Promise<CreateTaskResult>;
  getTask(taskId: string): TaskRecord | undefined;
  approveTask(taskId: string): Promise<TaskRecord>;
  rejectTask(taskId: string): TaskRecord;
}

export class TaskPublishError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaskPublishError";
  }
}

export class TaskConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaskConflictError";
  }
}

export class TaskNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaskNotFoundError";
  }
}

export class TaskStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaskStateError";
  }
}
