import type { CodexRunner } from "@remote-dev-agent/codex-runner";

import type {
  ExecuteTaskInput,
  ExecuteTaskResult,
  GitService,
  PrepareWorkspaceInput,
  PublishChangesInput,
  PublishChangesResult,
} from "./types.js";

export class Worker {
  constructor(
    private readonly gitService: GitService,
    private readonly codexRunner: CodexRunner,
  ) {}

  async prepareWorkspace(input: PrepareWorkspaceInput): Promise<void> {
    await this.gitService.cloneRepository(input.repoUrl, input.targetPath);
    await this.gitService.checkoutMain();
    await this.gitService.pullLatest();
    await this.gitService.createBranch(input.branchName);
  }

  async executeTask(input: ExecuteTaskInput): Promise<ExecuteTaskResult> {
    await this.prepareWorkspace(input);
    await this.gitService.removeRepositoryCredentials(input.repoUrl);

    const codexResult = await this.codexRunner.runCodexTask(
      buildExecutionPrompt(input.task),
      input.targetPath,
    );

    await this.gitService.moveCommittedChangesToWorkingTree();

    const changedFiles = await this.gitService.getChangedFiles();
    const summary = await this.gitService.getDiffSummary();

    return {
      success: codexResult.success,
      logs: codexResult.logs,
      changedFiles,
      summary,
    };
  }

  async publishChanges(input: PublishChangesInput): Promise<PublishChangesResult> {
    this.gitService.openWorkspace(input.workspacePath);

    const diffPatch = await this.gitService.getDiffPatch();
    const pullRequestMetadata = await this.codexRunner.generatePullRequestMetadata({
      taskId: input.taskId,
      taskText: input.taskText,
      branchName: input.branchName,
      workspacePath: input.workspacePath,
      changedFiles: input.changedFiles,
      summary: input.summary,
      diffPatch,
    });

    await this.gitService.commitChanges();
    await this.gitService.pushBranch(input.branchName);

    const pullRequest = await this.gitService.createPullRequest({
      taskId: input.taskId,
      branchName: input.branchName,
      title: pullRequestMetadata.title,
      body: pullRequestMetadata.body,
    });

    return {
      prUrl: pullRequest.url,
    };
  }
}

function buildExecutionPrompt(task: string): string {
  return [
    task,
    "",
    "Important workflow constraints:",
    "- Modify files only in this local workspace.",
    "- Do not commit changes.",
    "- Do not push branches.",
    "- Do not create pull requests.",
    "- Stop after the working tree contains the requested changes.",
  ].join("\n");
}

export { ShellGitService } from "./services/git.service.js";
export { GhCommandError, GitCommandError, GitError } from "./types.js";
export type {
  CreatePullRequestInput,
  CreatePullRequestResult,
  DiffSummary,
  ExecuteTaskInput,
  ExecuteTaskResult,
  GitService,
  PrepareWorkspaceInput,
  PublishChangesInput,
  PublishChangesResult,
} from "./types.js";
