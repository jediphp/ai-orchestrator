import { ShellCodexRunner } from "@remote-dev-agent/codex-runner";

import { ShellGitService } from "./services/git.service.js";
import type {
  ExecuteTaskResult,
  PublishChangesResult,
} from "./types.js";
import { Worker } from "./worker.js";

type WorkerCommand = "execute" | "publish";

interface WorkerCliSuccess<T> {
  ok: true;
  result: T;
}

interface WorkerCliFailure {
  ok: false;
  errorMessage: string;
}

type WorkerCliResponse<T> = WorkerCliSuccess<T> | WorkerCliFailure;

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (value === undefined || value.trim().length === 0) {
    throw new Error(`${name} environment variable is required`);
  }

  return value;
}

function getEnv(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

function readChangedFiles(): string[] {
  const rawChangedFiles = getEnv("CHANGED_FILES_JSON", "[]");
  const parsed: unknown = JSON.parse(rawChangedFiles);

  if (
    !Array.isArray(parsed) ||
    parsed.some((value) => typeof value !== "string")
  ) {
    throw new Error("CHANGED_FILES_JSON must be a JSON array of strings");
  }

  return parsed;
}

function createWorker(): Worker {
  return new Worker(new ShellGitService(), new ShellCodexRunner());
}

async function executeTask(worker: Worker): Promise<ExecuteTaskResult> {
  const taskId = getRequiredEnv("TASK_ID");
  const workspaceBasePath = getRequiredEnv("WORKSPACE_BASE_PATH");

  return worker.executeTask({
    repoUrl: getRequiredEnv("REPO_URL"),
    targetPath: `${workspaceBasePath.replace(/\/$/, "")}/${taskId}`,
    branchName: getRequiredEnv("BRANCH_NAME"),
    task: getRequiredEnv("TASK_TEXT"),
  });
}

async function publishChanges(worker: Worker): Promise<PublishChangesResult> {
  return worker.publishChanges({
    taskId: getRequiredEnv("TASK_ID"),
    taskText: getRequiredEnv("TASK_TEXT"),
    workspacePath: getRequiredEnv("WORKSPACE_PATH"),
    branchName: getRequiredEnv("BRANCH_NAME"),
    changedFiles: readChangedFiles(),
    summary: getRequiredEnv("SUMMARY"),
  });
}

async function runCommand(command: WorkerCommand): Promise<unknown> {
  const worker = createWorker();

  if (command === "execute") {
    return executeTask(worker);
  }

  return publishChanges(worker);
}

function writeResponse<T>(response: WorkerCliResponse<T>): void {
  process.stdout.write(`${JSON.stringify(response)}\n`);
}

async function main(): Promise<void> {
  const command = process.argv[2];

  if (command !== "execute" && command !== "publish") {
    throw new Error("Worker command must be execute or publish");
  }

  const result = await runCommand(command);
  writeResponse({ ok: true, result });
}

main().catch((error: unknown) => {
  const errorMessage = error instanceof Error ? error.message : "Worker failed";

  writeResponse({ ok: false, errorMessage });
  process.exit(1);
});
