import { spawn } from "node:child_process";

export interface DockerWorkerProcessConfig {
  workerImage: string;
  workspaceVolumeName: string;
  codexHomeVolumeName: string;
  workspaceBasePath: string;
  repoUrl: string;
}

export interface DockerWorkerRunInput {
  command: "execute" | "publish";
  env: Record<string, string>;
}

function readRequiredEnv(name: string): string {
  const value = process.env[name];

  if (value === undefined || value.trim().length === 0) {
    throw new Error(`${name} environment variable is required`);
  }

  return value;
}

function readOptionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();

  return value === undefined || value.length === 0 ? undefined : value;
}

function buildDockerEnvArgs(env: Record<string, string>): string[] {
  return Object.keys(env).flatMap((name) => ["--env", name]);
}

function splitOutputLines(output: string): string[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export class DockerWorkerProcess {
  constructor(private readonly config: DockerWorkerProcessConfig) {}

  async runJson<T>(input: DockerWorkerRunInput): Promise<T> {
    let stdout = "";
    let stderr = "";
    const dockerEnv = {
      ...input.env,
      REPO_URL: this.config.repoUrl,
      WORKSPACE_BASE_PATH: this.config.workspaceBasePath,
      GITHUB_TOKEN: readRequiredEnv("GITHUB_TOKEN"),
      DEFAULT_BRANCH: readOptionalEnv("DEFAULT_BRANCH") ?? "",
      CODEX_PROFILE: readOptionalEnv("CODEX_PROFILE") ?? "automation",
      CODEX_SANDBOX: readOptionalEnv("CODEX_SANDBOX") ?? "",
      CODEX_TASK_TIMEOUT_MS: readOptionalEnv("CODEX_TASK_TIMEOUT_MS") ?? "",
    };

    const args = [
      "run",
      "--rm",
      "--volume",
      `${this.config.workspaceVolumeName}:${this.config.workspaceBasePath}`,
      "--volume",
      `${this.config.codexHomeVolumeName}:/root/.codex`,
      ...buildDockerEnvArgs(dockerEnv),
      this.config.workerImage,
      "node",
      "apps/worker/dist/cli.js",
      input.command,
    ];

    await new Promise<void>((resolve, reject) => {
      const child = spawn("docker", args, {
        env: {
          ...process.env,
          ...dockerEnv,
        },
        stdio: ["ignore", "pipe", "pipe"],
      });

      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on("error", (error: Error) => {
        reject(new Error(`Failed to run Docker worker: ${error.message}`));
      });

      child.on("close", (exitCode) => {
        if (exitCode === 0) {
          resolve();
          return;
        }

        const stdoutLines = splitOutputLines(stdout);
        const workerErrorMessage = readWorkerFailureMessage(stdoutLines);

        if (workerErrorMessage !== undefined) {
          reject(new Error(workerErrorMessage));
          return;
        }

        reject(
          new Error(
            `Docker worker failed with exit code ${exitCode ?? "unknown"}: ${splitOutputLines(stderr).join("\n")}`,
          ),
        );
      });
    });

    return parseWorkerResponse(splitOutputLines(stdout));
  }
}

function parseWorkerResponse<T>(stdoutLines: string[]): T {
  const parsed = readWorkerResponse(stdoutLines);

  if (parsed === undefined) {
    throw new Error("Docker worker returned empty output");
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("ok" in parsed) ||
    typeof parsed.ok !== "boolean"
  ) {
    throw new Error("Docker worker returned invalid response");
  }

  if (!parsed.ok) {
    const errorMessage =
      "errorMessage" in parsed && typeof parsed.errorMessage === "string"
        ? parsed.errorMessage
        : "Docker worker failed";

    throw new Error(errorMessage);
  }

  if (!("result" in parsed)) {
    throw new Error("Docker worker returned no result");
  }

  return parsed.result as T;
}

function readWorkerFailureMessage(stdoutLines: string[]): string | undefined {
  const parsed = readWorkerResponse(stdoutLines);

  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "ok" in parsed &&
    parsed.ok === false &&
    "errorMessage" in parsed &&
    typeof parsed.errorMessage === "string"
  ) {
    return parsed.errorMessage;
  }

  return undefined;
}

function readWorkerResponse(stdoutLines: string[]): unknown {
  for (let index = stdoutLines.length - 1; index >= 0; index -= 1) {
    const line = stdoutLines[index];

    if (line === undefined) {
      continue;
    }

    try {
      const parsed: unknown = JSON.parse(line);

      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "ok" in parsed &&
        typeof parsed.ok === "boolean"
      ) {
        return parsed;
      }
    } catch {
      continue;
    }
  }

  return undefined;
}
