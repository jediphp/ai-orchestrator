export interface CodexTaskResult {
  success: boolean;
  logs: string[];
}

export interface PullRequestMetadata {
  title: string;
  body: string;
}

export interface PullRequestMetadataInput {
  taskId: string;
  taskText: string;
  branchName: string;
  workspacePath: string;
  changedFiles: string[];
  summary: string;
  diffPatch: string;
}

export interface CodexRunner {
  runCodexTask(task: string, projectPath: string): Promise<CodexTaskResult>;
  generatePullRequestMetadata(
    input: PullRequestMetadataInput,
  ): Promise<PullRequestMetadata>;
}
