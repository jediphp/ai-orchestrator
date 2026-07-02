import type { FastifyReply, FastifyRequest } from "fastify";

import type { CreateTaskInput, TaskService } from "../types/task.types.js";
import {
  TaskConflictError,
  TaskNotFoundError,
  TaskPublishError,
  TaskStateError,
} from "../types/task.types.js";

type CreateTaskRequest = FastifyRequest<{ Body: CreateTaskInput }>;

export function createTaskHandler(taskService: TaskService) {
  return async (
    request: CreateTaskRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    try {
      const result = await taskService.createTask(request.body);
      await reply.status(201).send(result);
    } catch (error: unknown) {
      if (error instanceof TaskConflictError) {
        await reply.status(409).send({ message: error.message });
        return;
      }

      throw error;
    }
  };
}

type TaskParamsRequest = FastifyRequest<{
  Params: { taskId: string };
}>;

export function getTaskHandler(taskService: TaskService) {
  return async (
    request: TaskParamsRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const task = taskService.getTask(request.params.taskId);

    if (task === undefined) {
      await reply.status(404).send({ message: "Task not found" });
      return;
    }

    await reply.status(200).send(task);
  };
}

export function approveTaskHandler(taskService: TaskService) {
  return async (
    request: TaskParamsRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    try {
      const task = await taskService.approveTask(request.params.taskId);
      await reply.status(200).send({
        taskId: task.taskId,
        status: task.status,
        prUrl: task.prUrl,
      });
    } catch (error: unknown) {
      await handleTaskActionError(error, reply);
    }
  };
}

export function rejectTaskHandler(taskService: TaskService) {
  return async (
    request: TaskParamsRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    try {
      const task = taskService.rejectTask(request.params.taskId);
      await reply.status(200).send({
        taskId: task.taskId,
        status: task.status,
      });
    } catch (error: unknown) {
      await handleTaskActionError(error, reply);
    }
  };
}

async function handleTaskActionError(
  error: unknown,
  reply: FastifyReply,
): Promise<void> {
  if (error instanceof TaskNotFoundError) {
    await reply.status(404).send({ message: error.message });
    return;
  }

  if (error instanceof TaskStateError) {
    await reply.status(409).send({ message: error.message });
    return;
  }

  if (error instanceof TaskPublishError) {
    await reply.status(500).send({ message: error.message });
    return;
  }

  throw error;
}
