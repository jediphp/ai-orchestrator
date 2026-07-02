import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

import { CodexRunnerError } from "./codex-runner.service.js";
import type { PullRequestMetadata, PullRequestMetadataInput } from "./types.js";

const PR_METADATA_TIMEOUT_MS = 120_000;
const PR_METADATA_SCHEMA = `{
  "type": "object",
  "additionalProperties": false,
  "required": ["title", "body"],
  "properties": {
    "title": { "type": "string" },
    "body": { "type": "string" }
  }
}`;

export async function generatePullRequestMetadata(
  input: PullRequestMetadataInput,
): Promise<PullRequestMetadata> {
  const fallback = buildFallbackPullRequestMetadata(input);

  try {
    const generated = await runCodexPullRequestMetadata(input);
    return normalizePullRequestMetadata(generated, fallback);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown Codex PR metadata error";

    console.warn(`PR metadata generation failed, using fallback: ${message}`);
    return fallback;
  }
}

async function runCodexPullRequestMetadata(
  input: PullRequestMetadataInput,
): Promise<PullRequestMetadata> {
  const tempDir = await mkdtemp(join(tmpdir(), "remote-dev-agent-pr-"));
  const outputPath = join(tempDir, "pr-metadata.json");
  const schemaPath = join(tempDir, "pr-metadata.schema.json");

  try {
    await writeFile(schemaPath, PR_METADATA_SCHEMA, "utf8");

    const logs = await spawnCodexExec({
      projectPath: input.workspacePath,
      prompt: buildPullRequestMetadataPrompt(input),
      outputPath,
      schemaPath,
      timeoutMs: PR_METADATA_TIMEOUT_MS,
    });

    const rawOutput = await readFile(outputPath, "utf8");
    const parsed = parsePullRequestMetadataJson(rawOutput);

    if (parsed === undefined) {
      throw new CodexRunnerError(
        `Failed to parse PR metadata output: ${rawOutput.trim().slice(0, 200)}`,
      );
    }

    if (logs.length > 0) {
      console.info("PR metadata Codex logs:", logs.slice(-3).join(" | "));
    }

    return parsed;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function buildPullRequestMetadataPrompt(input: PullRequestMetadataInput): string {
  const changedFiles =
    input.changedFiles.length > 0
      ? input.changedFiles.map((file) => `- ${file}`).join("\n")
      : "- no changed files detected";

  const diffSection =
    input.diffPatch.trim().length > 0
      ? input.diffPatch.trim()
      : "No diff patch available.";

  return [
    "Generate a GitHub pull request title and description from the task context below.",
    "Use the same language as the original task request.",
    "Title: concise, specific, imperative mood, max 72 characters, no quotes.",
    "Body: Markdown with sections ## Summary, ## Changes, ## Testing.",
    "Do not invent changes that are not supported by the diff.",
    "",
    `Task ID: ${input.taskId}`,
    `Branch: ${input.branchName}`,
    "",
    "Original task request:",
    input.taskText,
    "",
    "Changed files:",
    changedFiles,
    "",
    `Diff stat: ${input.summary}`,
    "",
    "Diff patch:",
    diffSection,
  ].join("\n");
}

function parsePullRequestMetadataJson(
  rawOutput: string,
): PullRequestMetadata | undefined {
  const candidates = [
    rawOutput.trim(),
    extractJsonObject(rawOutput),
  ].filter((value): value is string => value !== undefined && value.length > 0);

  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);

      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "title" in parsed &&
        "body" in parsed &&
        typeof parsed.title === "string" &&
        typeof parsed.body === "string"
      ) {
        return {
          title: parsed.title.trim(),
          body: parsed.body.trim(),
        };
      }
    } catch {
      continue;
    }
  }

  return undefined;
}

function extractJsonObject(rawOutput: string): string | undefined {
  const start = rawOutput.indexOf("{");
  const end = rawOutput.lastIndexOf("}");

  if (start === -1 || end <= start) {
    return undefined;
  }

  return rawOutput.slice(start, end + 1);
}

function normalizePullRequestMetadata(
  metadata: PullRequestMetadata,
  fallback: PullRequestMetadata,
): PullRequestMetadata {
  const title = metadata.title.trim().slice(0, 72);
  const body = metadata.body.trim();

  if (title.length === 0 || body.length === 0) {
    return fallback;
  }

  return { title, body };
}

export function buildFallbackPullRequestMetadata(
  input: PullRequestMetadataInput,
): PullRequestMetadata {
  const title = buildFallbackTitle(input.taskText);
  const files =
    input.changedFiles.length > 0
      ? input.changedFiles.map((file) => `- ${file}`).join("\n")
      : "- no changed files detected";

  const body = [
    "## Summary",
    "",
    input.taskText,
    "",
    "## Changes",
    "",
    files,
    "",
    `Diff stat: ${input.summary}`,
    "",
    "## Testing",
    "",
    "- [ ] Manual review required",
    "",
    `Task ID: ${input.taskId}`,
    `Branch: ${input.branchName}`,
  ].join("\n");

  return { title, body };
}

function buildFallbackTitle(taskText: string): string {
  const normalized = taskText.replace(/\s+/g, " ").trim();

  if (normalized.length === 0) {
    return "AI-generated update";
  }

  if (normalized.length <= 72) {
    return normalized;
  }

  return `${normalized.slice(0, 69).trimEnd()}...`;
}

interface SpawnCodexExecInput {
  projectPath: string;
  prompt: string;
  outputPath: string;
  schemaPath: string;
  timeoutMs: number;
}

function buildCodexEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };

  delete env.GITHUB_TOKEN;
  delete env.GH_TOKEN;
  return env;
}

async function spawnCodexExec(
  input: SpawnCodexExecInput,
): Promise<string[]> {
  const profile = process.env.CODEX_PROFILE ?? "automation";
  const sandbox = process.env.CODEX_SANDBOX?.trim() || "read-only";
  const logs: string[] = [];

  return new Promise((resolve, reject) => {
    const child = spawn(
      "codex",
      [
        "exec",
        "-p",
        profile,
        "-s",
        sandbox,
        "-C",
        input.projectPath,
        "--output-schema",
        input.schemaPath,
        "-o",
        input.outputPath,
        input.prompt,
      ],
      {
        cwd: input.projectPath,
        env: buildCodexEnv(),
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new CodexRunnerError("Codex PR metadata generation timed out"));
    }, input.timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      logs.push(chunk.toString());
    });

    child.stderr.on("data", (chunk: Buffer) => {
      logs.push(`[stderr] ${chunk.toString()}`);
    });

    child.on("error", (error: Error) => {
      clearTimeout(timeout);
      reject(new CodexRunnerError(error.message));
    });

    child.on("close", (exitCode) => {
      clearTimeout(timeout);

      if (exitCode === 0) {
        resolve(logs);
        return;
      }

      reject(
        new CodexRunnerError(
          `Codex PR metadata generation failed with exit code ${exitCode ?? "unknown"}`,
        ),
      );
    });
  });
}
