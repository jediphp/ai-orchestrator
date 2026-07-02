import "dotenv/config";

import { DefaultPublishService } from "./services/publish.service.js";
import { InMemoryTaskStore } from "./services/task-store.service.js";
import { DefaultTaskService } from "./services/task.service.js";
import {
  DefaultWorkerRunner,
  type WorkerRunnerConfig,
} from "./services/worker-runner.service.js";
import { createServer } from "./server.js";

function getPort(): number {
  const rawPort = process.env.PORT ?? "3000";
  const port = Number(rawPort);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("PORT must be a positive integer");
  }

  return port;
}

function getWorkerRunnerConfig(): WorkerRunnerConfig {
  const repoUrl = process.env.REPO_URL;

  if (!repoUrl) {
    throw new Error("REPO_URL environment variable is required");
  }

  return {
    repoUrl,
    workspaceBasePath: process.env.WORKSPACE_BASE_PATH ?? "/tmp/remote-dev-agent",
  };
}

async function main(): Promise<void> {
  const workerConfig = getWorkerRunnerConfig();
  const taskStore = new InMemoryTaskStore();
  const workerRunner = new DefaultWorkerRunner(workerConfig);
  const publishService = new DefaultPublishService({
    workspaceBasePath: workerConfig.workspaceBasePath,
  });
  const taskService = new DefaultTaskService(
    taskStore,
    workerRunner,
    publishService,
    { workspaceBasePath: workerConfig.workspaceBasePath },
  );
  const app = createServer(taskService);
  const port = getPort();
  const host = process.env.HOST ?? "0.0.0.0";

  await app.listen({ port, host });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
