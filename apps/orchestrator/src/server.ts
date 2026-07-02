import Fastify from "fastify";

import { registerTaskRoutes } from "./routes/task.routes.js";
import type { TaskService } from "./types/task.types.js";

export function createServer(taskService: TaskService) {
  const app = Fastify({
    logger: true,
  });

  app.get("/health", async () => {
    return { status: "ok" };
  });

  registerTaskRoutes(app, taskService);

  return app;
}
