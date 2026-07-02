import { spawn } from "node:child_process";

import type {
  CodexRunner,
  CodexTaskResult,
  PullRequestMetadata,
  PullRequestMetadataInput,
} from "./types.js";
import { generatePullRequestMetadata } from "./pr-metadata.service.js";

const DEFAULT_CODEX_TASK_TIMEOUT_MS = 30 * 60 * 1000;
const DEFAULT_CODEX_TASK_SANDBOX = "workspace-write";

export class CodexRunnerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CodexRunnerError";
  }
}

function assertNonEmpty(value: string, fieldName: string): void {
  if (value.trim().length === 0) {
    throw new CodexRunnerError(`${fieldName} must be a non-empty string`);
  }
}

function appendLogLines(
  logs: string[],
  chunk: string,
  prefix: string,
): void {
  const lines = chunk.split(/\r?\n/).filter((line) => line.length > 0);

  for (const line of lines) {
    logs.push(`${prefix}${line}`);
  }
}

function readCodexTaskTimeoutMs(): number {
  const rawTimeout = process.env.CODEX_TASK_TIMEOUT_MS?.trim();

  if (rawTimeout === undefined || rawTimeout.length === 0) {
    return DEFAULT_CODEX_TASK_TIMEOUT_MS;
  }

  const timeoutMs = Number(rawTimeout);

  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new CodexRunnerError("CODEX_TASK_TIMEOUT_MS must be a positive integer");
  }

  return timeoutMs;
}

function readCodexSandbox(fallback: string): string {
  const rawSandbox = process.env.CODEX_SANDBOX?.trim();

  return rawSandbox === undefined || rawSandbox.length === 0
    ? fallback
    : rawSandbox;
}

function buildCodexEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };

  delete env.GITHUB_TOKEN;
  delete env.GH_TOKEN;
  return env;
}

export class ShellCodexRunner implements CodexRunner {
  async runCodexTask(
    task: string,
    projectPath: string,
  ): Promise<CodexTaskResult> {
    assertNonEmpty(task, "task");
    assertNonEmpty(projectPath, "projectPath");

    const logs: string[] = [];

    return new Promise((resolve) => {
      const profile = process.env.CODEX_PROFILE ?? "automation";
      const sandbox = readCodexSandbox(DEFAULT_CODEX_TASK_SANDBOX);
      const timeoutMs = readCodexTaskTimeoutMs();
      let settled = false;

      const child = spawn(
        "codex",
        [
          "exec",
          "-p",
          profile,
          "-s",
          sandbox,
          "-C",
          projectPath,
          task,
        ],
        {
          cwd: projectPath,
          env: buildCodexEnv(),
          stdio: ["ignore", "pipe", "pipe"],
        },
      );

      const finish = (result: CodexTaskResult): void => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeout);
        resolve(result);
      };

      const timeout = setTimeout(() => {
        logs.push(`[error] Codex task timed out after ${timeoutMs} ms`);
        child.kill("SIGTERM");
        finish({ success: false, logs });
      }, timeoutMs);

      child.stdout.on("data", (chunk: Buffer) => {
        appendLogLines(logs, chunk.toString(), "");
      });

      child.stderr.on("data", (chunk: Buffer) => {
        appendLogLines(logs, chunk.toString(), "[stderr] ");
      });

      child.on("error", (error: Error) => {
        logs.push(`[error] ${error.message}`);
        finish({ success: false, logs });
      });

      child.on("close", (exitCode) => {
        finish({
          success: exitCode === 0,
          logs,
        });
      });
    });
  }

  async generatePullRequestMetadata(
    input: PullRequestMetadataInput,
  ): Promise<PullRequestMetadata> {
    return generatePullRequestMetadata(input);
  }
}

export async function runCodexTask(
  task: string,
  projectPath: string,
): Promise<CodexTaskResult> {
  const runner = new ShellCodexRunner();
  return runner.runCodexTask(task, projectPath);
}
