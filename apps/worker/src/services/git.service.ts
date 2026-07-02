import { spawn } from "node:child_process";

import {
  AI_COMMIT_MESSAGE,
  GhCommandError,
  GitCommandError,
  GitError,
  type CreatePullRequestInput,
  type CreatePullRequestResult,
  type GitService,
} from "../types.js";

function assertNonEmpty(value: string, fieldName: string): void {
  if (value.trim().length === 0) {
    throw new GitError(`${fieldName} must be a non-empty string`);
  }
}

function parseChangedFileNames(output: string): string[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function parseStatusFiles(output: string): string[] {
  const files: string[] = [];

  for (const line of output.split(/\r?\n/)) {
    if (line.length < 4) {
      continue;
    }

    const rawPath = line.slice(3).trim();

    if (rawPath.includes(" -> ")) {
      const renamedPath = rawPath.split(" -> ").at(-1)?.trim();

      if (renamedPath !== undefined && renamedPath.length > 0) {
        files.push(renamedPath);
      }

      continue;
    }

    files.push(rawPath);
  }

  return files;
}

function mergeUniqueFileNames(...fileLists: string[][]): string[] {
  return [...new Set(fileLists.flat())].sort((left, right) =>
    left.localeCompare(right),
  );
}

function parseDiffStatSummary(output: string): string {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];

    if (line !== undefined && /\bfiles? changed\b/.test(line)) {
      return normalizeDiffStatSummary(line);
    }
  }

  return "0 files changed, 0 insertions, 0 deletions";
}

function normalizeDiffStatSummary(line: string): string {
  return line
    .replace(/\(\+\)/g, "")
    .replace(/\(-\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function withGithubAuth(repoUrl: string): string {
  const token = process.env.GITHUB_TOKEN;

  if (token === undefined || token.trim().length === 0) {
    return repoUrl;
  }

  try {
    const url = new URL(repoUrl);

    if (url.hostname !== "github.com") {
      return repoUrl;
    }

    url.username = "x-access-token";
    url.password = token;

    return url.toString();
  } catch {
    return repoUrl;
  }
}

function withoutGithubAuth(repoUrl: string): string {
  try {
    const url = new URL(repoUrl);

    if (url.hostname !== "github.com") {
      return repoUrl;
    }

    url.username = "";
    url.password = "";

    return url.toString();
  } catch {
    return repoUrl;
  }
}

export class ShellGitService implements GitService {
  private workspacePath: string | null = null;
  private defaultBranch: string | null = null;

  openWorkspace(targetPath: string): void {
    assertNonEmpty(targetPath, "targetPath");
    this.workspacePath = targetPath;
    this.defaultBranch = null;
  }

  async cloneRepository(repoUrl: string, targetPath: string): Promise<void> {
    assertNonEmpty(repoUrl, "repoUrl");
    assertNonEmpty(targetPath, "targetPath");

    await this.runGit(["clone", withGithubAuth(repoUrl), targetPath]);
    this.workspacePath = targetPath;
    this.defaultBranch = null;
  }

  async removeRepositoryCredentials(repoUrl: string): Promise<void> {
    await this.runGit(
      ["remote", "set-url", "origin", withoutGithubAuth(repoUrl)],
      this.getWorkspacePath(),
    );
  }

  async createBranch(branchName: string): Promise<void> {
    assertNonEmpty(branchName, "branchName");
    await this.runGit(["checkout", "-b", branchName], this.getWorkspacePath());
  }

  async checkoutMain(): Promise<void> {
    await this.runGit(
      ["checkout", await this.resolveDefaultBranch()],
      this.getWorkspacePath(),
    );
  }

  async pullLatest(): Promise<void> {
    await this.runGit(["pull"], this.getWorkspacePath());
  }

  async moveCommittedChangesToWorkingTree(): Promise<void> {
    const workspacePath = this.getWorkspacePath();
    const baseBranch = await this.resolveDefaultBranch();

    await this.runGit(["reset", "--soft", baseBranch], workspacePath);
  }

  async getChangedFiles(): Promise<string[]> {
    const workspacePath = this.getWorkspacePath();

    const statusOutput = await this.runGit(["status", "--porcelain"], workspacePath);
    const diffNamesOutput = await this.runGit(
      ["diff", "--name-only", "HEAD"],
      workspacePath,
    );

    return mergeUniqueFileNames(
      parseStatusFiles(statusOutput),
      parseChangedFileNames(diffNamesOutput),
    );
  }

  async getDiffSummary(): Promise<string> {
    const workspacePath = this.getWorkspacePath();

    await this.runGit(["status"], workspacePath);

    const statOutput = await this.runGit(["diff", "--stat", "HEAD"], workspacePath);

    return parseDiffStatSummary(statOutput);
  }

  async getDiffPatch(maxChars = 12_000): Promise<string> {
    const workspacePath = this.getWorkspacePath();

    const unstaged = await this.runGit(["diff", "HEAD"], workspacePath);
    const staged = await this.runGit(["diff", "--cached"], workspacePath);
    const combined = [unstaged, staged]
      .map((chunk) => chunk.trim())
      .filter((chunk) => chunk.length > 0)
      .join("\n\n");

    if (combined.length <= maxChars) {
      return combined;
    }

    return `${combined.slice(0, maxChars)}\n\n... diff truncated ...`;
  }

  async commitChanges(): Promise<void> {
    const workspacePath = this.getWorkspacePath();

    await this.runGit(["add", "."], workspacePath);

    const status = await this.runGit(["status", "--porcelain"], workspacePath);

    if (status.trim().length === 0) {
      return;
    }

    await this.runGit(
      ["commit", "-m", AI_COMMIT_MESSAGE],
      workspacePath,
    );
  }

  async pushBranch(branchName: string): Promise<void> {
    assertNonEmpty(branchName, "branchName");

    const workspacePath = this.getWorkspacePath();

    const originUrl = (
      await this.runGit(["remote", "get-url", "origin"], workspacePath)
    ).trim();

    await this.runGit(
      ["push", withGithubAuth(originUrl), branchName],
      workspacePath,
    );
  }

  async createPullRequest(
    input: CreatePullRequestInput,
  ): Promise<CreatePullRequestResult> {
    assertNonEmpty(input.taskId, "taskId");
    assertNonEmpty(input.branchName, "branchName");
    assertNonEmpty(input.title, "title");
    assertNonEmpty(input.body, "body");

    const workspacePath = this.getWorkspacePath();
    const githubToken = getGithubToken();
    const baseBranch = await this.resolveDefaultBranch();

    const output = await this.runGh(
      [
        "pr",
        "create",
        "--title",
        input.title,
        "--head",
        input.branchName,
        "--base",
        baseBranch,
        "--body",
        input.body,
      ],
      workspacePath,
      githubToken,
    );

    const url = parsePullRequestUrl(output);

    if (url === undefined) {
      throw new GitError("Failed to parse pull request URL from gh output");
    }

    return { url };
  }

  private getWorkspacePath(): string {
    if (this.workspacePath === null) {
      throw new GitError(
        "Workspace is not initialized. Call cloneRepository first.",
      );
    }

    return this.workspacePath;
  }

  private async resolveDefaultBranch(): Promise<string> {
    if (this.defaultBranch !== null) {
      return this.defaultBranch;
    }

    const fromEnv = process.env.DEFAULT_BRANCH?.trim();

    if (fromEnv !== undefined && fromEnv.length > 0) {
      this.defaultBranch = fromEnv;
      return fromEnv;
    }

    const output = await this.runGit(
      ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"],
      this.getWorkspacePath(),
    );

    this.defaultBranch = output.trim().replace(/^origin\//, "");
    return this.defaultBranch;
  }

  private runGit(
    args: string[],
    cwd?: string,
    githubToken?: string,
  ): Promise<string> {
    const gitArgs =
      githubToken === undefined
        ? args
        : [
            "-c",
            `http.extraHeader=Authorization: Bearer ${githubToken}`,
            ...args,
          ];

    return this.runCommand("git", gitArgs, cwd, (command, exitCode, stderr) => {
      return new GitCommandError(
        `Git command failed with exit code ${exitCode ?? "unknown"}`,
        command,
        exitCode,
        stderr.trim(),
      );
    });
  }

  private runGh(
    args: string[],
    cwd: string,
    githubToken: string,
  ): Promise<string> {
    return this.runCommand(
      "gh",
      args,
      cwd,
      (command, exitCode, stderr) => {
        return new GhCommandError(
          `GitHub CLI command failed with exit code ${exitCode ?? "unknown"}`,
          command,
          exitCode,
          stderr.trim(),
        );
      },
      {
        ...process.env,
        GITHUB_TOKEN: githubToken,
        GH_TOKEN: githubToken,
      },
    );
  }

  private runCommand(
    executable: string,
    args: string[],
    cwd: string | undefined,
    createError: (
      command: string,
      exitCode: number | null,
      stderr: string,
    ) => Error,
    env: NodeJS.ProcessEnv = process.env,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const command = `${executable} ${args.join(" ")}`;
      const child = spawn(executable, args, {
        cwd,
        env,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on("error", (error: Error) => {
        reject(createError(`Failed to execute command: ${error.message}`, null, stderr));
      });

      child.on("close", (exitCode) => {
        if (exitCode === 0) {
          resolve(stdout);
          return;
        }

        reject(createError(command, exitCode, stderr));
      });
    });
  }
}

function getGithubToken(): string {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new GitError("GITHUB_TOKEN environment variable is required");
  }

  return token;
}

function parsePullRequestUrl(output: string): string | undefined {
  const urlMatch = output.match(/https:\/\/github\.com\/[^\s]+\/pull\/\d+/);

  return urlMatch?.[0];
}
