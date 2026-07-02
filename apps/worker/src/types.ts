export class GitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitError";
  }
}

export class GitCommandError extends GitError {
  constructor(
    message: string,
    public readonly command: string,
    public readonly exitCode: number | null,
    public readonly stderr: string,
  ) {
    super(message);
    this.name = "GitCommandError";
  }
}

export class GhCommandError extends GitError {
  constructor(
    message: string,
    public readonly command: string,
    public readonly exitCode: number | null,
    public readonly stderr: string,
  ) {
    super(message);
    this.name = "GhCommandError";
  }
}

export interface CreatePullRequestInput {
  taskId: string;
  branchName: string;
  title: string;
  body: string;
}

export interface CreatePullRequestResult {
  url: string;
}

export const AI_COMMIT_MESSAGE = "feat: ai-generated update";

export interface GitService {
  openWorkspace(targetPath: string): void;
  cloneRepository(repoUrl: string, targetPath: string): Promise<void>;
  createBranch(branchName: string): Promise<void>;
  checkoutMain(): Promise<void>;
  pullLatest(): Promise<void>;
  getChangedFiles(): Promise<string[]>;
  getDiffSummary(): Promise<string>;
  getDiffPatch(maxChars?: number): Promise<string>;
  commitChanges(): Promise<void>;
  pushBranch(branchName: string): Promise<void>;
  createPullRequest(input: CreatePullRequestInput): Promise<CreatePullRequestResult>;
}

export interface PublishChangesInput {
  taskId: string;
  taskText: string;
  workspacePath: string;
  branchName: string;
  changedFiles: string[];
  summary: string;
}

export interface PublishChangesResult {
  prUrl: string;
}

export interface DiffSummary {
  changedFiles: string[];
  summary: string;
}

export interface PrepareWorkspaceInput {
  repoUrl: string;
  targetPath: string;
  branchName: string;
}

export interface ExecuteTaskInput extends PrepareWorkspaceInput {
  task: string;
}

export interface ExecuteTaskResult {
  success: boolean;
  logs: string[];
  changedFiles: string[];
  summary: string;
}
