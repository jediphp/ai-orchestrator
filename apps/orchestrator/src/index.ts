import "dotenv/config";

import { DockerPublishService } from "./services/docker-publish.service.js";
import { DockerWorkerProcess } from "./services/docker-worker-process.service.js";
import { DockerWorkerRunner } from "./services/docker-worker-runner.service.js";
import { DefaultPublishService } from "./services/publish.service.js";
import { InMemoryTaskStore } from "./services/task-store.service.js";
import { DefaultTaskService } from "./services/task.service.js";
import { FsWorkspaceCleanupService } from "./services/workspace-cleanup.service.js";
import {
  DefaultWorkerRunner,
  type WorkerRunnerConfig,
} from "./services/worker-runner.service.js";
import { createServer } from "./server.js";
import type { PublishService } from "./services/publish.service.js";
import type { WorkerRunner } from "./types/task.types.js";

type WorkerExecutionMode = "local" | "docker";

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

function getWorkerExecutionMode(): WorkerExecutionMode {
  const mode = process.env.WORKER_EXECUTION_MODE ?? "local";

  if (mode !== "local" && mode !== "docker") {
    throw new Error("WORKER_EXECUTION_MODE must be local or docker");
  }

  return mode;
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (value === undefined || value.trim().length === 0) {
    throw new Error(`${name} environment variable is required`);
  }

  return value;
}

function createWorkerServices(workerConfig: WorkerRunnerConfig): {
  workerRunner: WorkerRunner;
  publishService: PublishService;
} {
  if (getWorkerExecutionMode() === "local") {
    return {
      workerRunner: new DefaultWorkerRunner(workerConfig),
      publishService: new DefaultPublishService({
        workspaceBasePath: workerConfig.workspaceBasePath,
      }),
    };
  }

  const dockerWorkerProcess = new DockerWorkerProcess({
    repoUrl: workerConfig.repoUrl,
    workspaceBasePath: workerConfig.workspaceBasePath,
    workerImage: getRequiredEnv("WORKER_IMAGE"),
    workspaceVolumeName: getRequiredEnv("WORKER_WORKSPACE_VOLUME"),
    codexHomeVolumeName: getRequiredEnv("CODEX_HOME_VOLUME"),
  });

  return {
    workerRunner: new DockerWorkerRunner(dockerWorkerProcess),
    publishService: new DockerPublishService(dockerWorkerProcess),
  };
}

async function main(): Promise<void> {
  const workerConfig = getWorkerRunnerConfig();
  const taskStore = new InMemoryTaskStore();
  const { workerRunner, publishService } = createWorkerServices(workerConfig);
  const workspaceCleanupService = new FsWorkspaceCleanupService();
  const taskService = new DefaultTaskService(
    taskStore,
    workerRunner,
    publishService,
    workspaceCleanupService,
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
