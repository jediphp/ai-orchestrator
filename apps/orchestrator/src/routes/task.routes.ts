import type { FastifyInstance } from "fastify";

import {
  approveTaskHandler,
  createTaskHandler,
  getTaskHandler,
  rejectTaskHandler,
} from "../handlers/task.handler.js";
import {
  approvalActionResponseSchema,
  createTaskBodySchema,
  createTaskResponseSchema,
  taskIdParamsSchema,
  taskRecordResponseSchema,
} from "../schemas/task.schema.js";
import type { TaskService } from "../types/task.types.js";

export function registerTaskRoutes(
  app: FastifyInstance,
  taskService: TaskService,
): void {
  app.post(
    "/task",
    {
      schema: {
        body: createTaskBodySchema,
        response: {
          201: createTaskResponseSchema,
        },
      },
    },
    createTaskHandler(taskService),
  );

  app.get(
    "/task/:taskId",
    {
      schema: {
        params: taskIdParamsSchema,
        response: {
          200: taskRecordResponseSchema,
        },
      },
    },
    getTaskHandler(taskService),
  );

  app.post(
    "/task/:taskId/approve",
    {
      schema: {
        params: taskIdParamsSchema,
        response: {
          200: approvalActionResponseSchema,
        },
      },
    },
    approveTaskHandler(taskService),
  );

  app.post(
    "/task/:taskId/reject",
    {
      schema: {
        params: taskIdParamsSchema,
        response: {
          200: approvalActionResponseSchema,
        },
      },
    },
    rejectTaskHandler(taskService),
  );
}
