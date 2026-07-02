export interface CreateTaskPayload {
  text: string;
}

export interface CreateTaskResponse {
  taskId: string;
  status: string;
}

export type TaskStatus =
  | "running"
  | "awaiting_approval"
  | "approved"
  | "rejected"
  | "failed";

export interface TaskDetails {
  taskId: string;
  text: string;
  status: TaskStatus;
  createdAt: string;
  branchName: string;
  workspacePath?: string;
  changedFiles?: string[];
  summary?: string;
  errorMessage?: string;
  prUrl?: string;
}

export interface ApprovalActionResponse {
  taskId: string;
  status: "approved" | "rejected";
  prUrl?: string;
}

export interface OrchestratorClient {
  createTask(text: string): Promise<CreateTaskResponse>;
  getTask(taskId: string): Promise<TaskDetails>;
  approveTask(taskId: string): Promise<ApprovalActionResponse>;
  rejectTask(taskId: string): Promise<ApprovalActionResponse>;
}

export interface ChatSessionStore {
  setActiveTaskId(chatId: number, taskId: string): void;
  getActiveTaskId(chatId: number): string | undefined;
  clearActiveTaskId(chatId: number): void;
}

export interface BotAccessOptions {
  allowedUserId?: number;
}

export const APPROVE_COMMAND = "APPROVE";
export const REJECT_COMMAND = "REJECT";

export interface ParsedApprovalCommand {
  action: "approve" | "reject";
  taskId?: string;
}
