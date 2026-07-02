import type {
  ApprovalActionResponse,
  CreateTaskResponse,
  OrchestratorClient,
  TaskDetails,
  TaskStatus,
} from "../types/orchestrator.types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCreateTaskResponse(value: unknown): value is CreateTaskResponse {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.taskId === "string" &&
    value.taskId.length > 0 &&
    typeof value.status === "string"
  );
}

const TASK_STATUSES = new Set<TaskStatus>([
  "running",
  "awaiting_approval",
  "publishing",
  "approved",
  "rejected",
  "failed",
]);

function isTaskDetails(value: unknown): value is TaskDetails {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.taskId === "string" &&
    typeof value.text === "string" &&
    typeof value.status === "string" &&
    TASK_STATUSES.has(value.status as TaskStatus) &&
    typeof value.createdAt === "string" &&
    typeof value.branchName === "string"
  );
}

function isApprovalActionResponse(
  value: unknown,
): value is ApprovalActionResponse {
  if (!isRecord(value)) {
    return false;
  }

  if (
    typeof value.taskId !== "string" ||
    (value.status !== "approved" && value.status !== "rejected")
  ) {
    return false;
  }

  if (value.prUrl !== undefined && typeof value.prUrl !== "string") {
    return false;
  }

  return true;
}

function readOrchestratorErrorMessage(
  payload: unknown,
  status: number,
): string {
  if (isRecord(payload) && typeof payload.message === "string") {
    return payload.message;
  }

  return `Orchestrator responded with status ${status}`;
}

export class FetchOrchestratorClient implements OrchestratorClient {
  private readonly baseUrl: URL;

  constructor(baseUrl: string) {
    this.baseUrl = new URL(baseUrl.replace(/\/$/, ""));
  }

  async createTask(text: string): Promise<CreateTaskResponse> {
    return this.requestJson<CreateTaskResponse>(
      new URL("/task", this.baseUrl),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      },
      isCreateTaskResponse,
      [201],
    );
  }

  async getTask(taskId: string): Promise<TaskDetails> {
    return this.requestJson<TaskDetails>(
      new URL(`/task/${encodeURIComponent(taskId)}`, this.baseUrl),
      { method: "GET" },
      isTaskDetails,
      [200],
    );
  }

  async approveTask(taskId: string): Promise<ApprovalActionResponse> {
    return this.requestJson<ApprovalActionResponse>(
      new URL(`/task/${encodeURIComponent(taskId)}/approve`, this.baseUrl),
      { method: "POST" },
      isApprovalActionResponse,
      [200],
    );
  }

  async rejectTask(taskId: string): Promise<ApprovalActionResponse> {
    return this.requestJson<ApprovalActionResponse>(
      new URL(`/task/${encodeURIComponent(taskId)}/reject`, this.baseUrl),
      { method: "POST" },
      isApprovalActionResponse,
      [200],
    );
  }

  private async requestJson<T>(
    url: URL,
    init: RequestInit,
    validator: (value: unknown) => value is T,
    expectedStatuses: number[],
  ): Promise<T> {
    let response: Response;

    try {
      response = await fetch(url, init);
    } catch {
      throw new Error("Orchestrator API is unavailable");
    }

    let payload: unknown;

    try {
      payload = await response.json();
    } catch {
      if (!expectedStatuses.includes(response.status)) {
        throw new Error(`Orchestrator responded with status ${response.status}`);
      }

      throw new Error("Orchestrator returned invalid JSON");
    }

    if (!expectedStatuses.includes(response.status)) {
      throw new Error(readOrchestratorErrorMessage(payload, response.status));
    }

    if (!validator(payload)) {
      throw new Error("Orchestrator returned invalid response");
    }

    return payload;
  }
}
