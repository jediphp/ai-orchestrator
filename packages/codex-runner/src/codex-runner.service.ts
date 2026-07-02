import { spawn } from "node:child_process";

import type {
  CodexRunner,
  CodexTaskResult,
  PullRequestMetadata,
  PullRequestMetadataInput,
} from "./types.js";
import { generatePullRequestMetadata } from "./pr-metadata.service.js";

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

      const child = spawn(
        "codex",
        [
          "exec",
          "-p",
          profile,
          "-s",
          "workspace-write",
          "-C",
          projectPath,
          task,
        ],
        {
          cwd: projectPath,
          env: process.env,
          stdio: ["ignore", "pipe", "pipe"],
        },
      );

      child.stdout.on("data", (chunk: Buffer) => {
        appendLogLines(logs, chunk.toString(), "");
      });

      child.stderr.on("data", (chunk: Buffer) => {
        appendLogLines(logs, chunk.toString(), "[stderr] ");
      });

      child.on("error", (error: Error) => {
        logs.push(`[error] ${error.message}`);
        resolve({ success: false, logs });
      });

      child.on("close", (exitCode) => {
        resolve({
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
