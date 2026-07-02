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

function appendLines(target: string[], chunk: string): void {
  for (const line of chunk.split(/\r?\n/)) {
    if (line.trim().length > 0) {
      target.push(line);
    }
  }
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

export class DockerWorkerProcess {
  constructor(private readonly config: DockerWorkerProcessConfig) {}

  async runJson<T>(input: DockerWorkerRunInput): Promise<T> {
    const stdoutLines: string[] = [];
    const stderrLines: string[] = [];
    const dockerEnv = {
      ...input.env,
      REPO_URL: this.config.repoUrl,
      WORKSPACE_BASE_PATH: this.config.workspaceBasePath,
      GITHUB_TOKEN: readRequiredEnv("GITHUB_TOKEN"),
      DEFAULT_BRANCH: readOptionalEnv("DEFAULT_BRANCH") ?? "",
      CODEX_PROFILE: readOptionalEnv("CODEX_PROFILE") ?? "automation",
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
        appendLines(stdoutLines, chunk.toString());
      });

      child.stderr.on("data", (chunk: Buffer) => {
        appendLines(stderrLines, chunk.toString());
      });

      child.on("error", (error: Error) => {
        reject(new Error(`Failed to run Docker worker: ${error.message}`));
      });

      child.on("close", (exitCode) => {
        if (exitCode === 0) {
          resolve();
          return;
        }

        const workerErrorMessage = readWorkerFailureMessage(stdoutLines);

        if (workerErrorMessage !== undefined) {
          reject(new Error(workerErrorMessage));
          return;
        }

        reject(
          new Error(
            `Docker worker failed with exit code ${exitCode ?? "unknown"}: ${stderrLines.join("\n")}`,
          ),
        );
      });
    });

    return parseWorkerResponse(stdoutLines);
  }
}

function parseWorkerResponse<T>(stdoutLines: string[]): T {
  const lastLine = stdoutLines.at(-1);

  if (lastLine === undefined) {
    throw new Error("Docker worker returned empty output");
  }

  const parsed: unknown = JSON.parse(lastLine);

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
  const lastLine = stdoutLines.at(-1);

  if (lastLine === undefined) {
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(lastLine);

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
  } catch {
    return undefined;
  }

  return undefined;
}
