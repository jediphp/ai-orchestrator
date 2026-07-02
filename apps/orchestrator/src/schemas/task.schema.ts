export const createTaskBodySchema = {
  type: "object",
  required: ["text"],
  additionalProperties: false,
  properties: {
    text: {
      type: "string",
      minLength: 1,
    },
  },
} as const;

export const createTaskResponseSchema = {
  type: "object",
  required: ["taskId", "status"],
  additionalProperties: false,
  properties: {
    taskId: {
      type: "string",
      minLength: 1,
    },
    status: {
      type: "string",
      enum: ["running"],
    },
  },
} as const;

export const taskIdParamsSchema = {
  type: "object",
  required: ["taskId"],
  additionalProperties: false,
  properties: {
    taskId: {
      type: "string",
      minLength: 1,
    },
  },
} as const;

export const taskRecordResponseSchema = {
  type: "object",
  required: ["taskId", "text", "status", "createdAt", "branchName", "workspacePath"],
  additionalProperties: false,
  properties: {
    taskId: { type: "string" },
    text: { type: "string" },
    status: {
      type: "string",
      enum: [
        "running",
        "awaiting_approval",
        "publishing",
        "approved",
        "rejected",
        "failed",
      ],
    },
    createdAt: { type: "string" },
    branchName: { type: "string" },
    workspacePath: { type: "string" },
    changedFiles: {
      type: "array",
      items: { type: "string" },
    },
    summary: { type: "string" },
    errorMessage: { type: "string" },
    prUrl: { type: "string" },
  },
} as const;

export const approvalActionResponseSchema = {
  type: "object",
  required: ["taskId", "status"],
  additionalProperties: false,
  properties: {
    taskId: { type: "string" },
    status: {
      type: "string",
      enum: ["approved", "rejected"],
    },
    prUrl: { type: "string" },
  },
} as const;
