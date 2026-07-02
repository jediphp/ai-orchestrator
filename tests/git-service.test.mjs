import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import { ShellGitService } from "../apps/worker/dist/services/git.service.js";

const execFileAsync = promisify(execFile);

async function runGit(args, cwd) {
  await execFileAsync("git", args, { cwd });
}

test("ShellGitService summarizes singular git diff stat", async () => {
  const workspacePath = await mkdtemp(join(tmpdir(), "ai-orchestrator-git-"));

  try {
    await runGit(["init"], workspacePath);
    await runGit(["config", "user.name", "Test User"], workspacePath);
    await runGit(["config", "user.email", "test@example.invalid"], workspacePath);
    await writeFile(join(workspacePath, "README.md"), "Initial\n");
    await runGit(["add", "README.md"], workspacePath);
    await runGit(["commit", "-m", "Initial commit"], workspacePath);
    await writeFile(join(workspacePath, "README.md"), "Initial\nNext line\n");

    const gitService = new ShellGitService();
    gitService.openWorkspace(workspacePath);

    assert.equal(await gitService.getDiffSummary(), "1 file changed, 1 insertion");
  } finally {
    await rm(workspacePath, { recursive: true, force: true });
  }
});

test("ShellGitService moves local commits back to reviewable changes", async () => {
  const workspacePath = await mkdtemp(join(tmpdir(), "ai-orchestrator-git-"));

  try {
    await runGit(["init"], workspacePath);
    await runGit(["config", "user.name", "Test User"], workspacePath);
    await runGit(["config", "user.email", "test@example.invalid"], workspacePath);
    await writeFile(join(workspacePath, "README.md"), "Initial\n");
    await runGit(["add", "README.md"], workspacePath);
    await runGit(["commit", "-m", "Initial commit"], workspacePath);
    await runGit(["checkout", "-b", "feature/test"], workspacePath);
    await writeFile(join(workspacePath, "README.md"), "Initial\nNext line\n");
    await runGit(["add", "README.md"], workspacePath);
    await runGit(["commit", "-m", "Unexpected Codex commit"], workspacePath);

    process.env.DEFAULT_BRANCH = "master";

    const gitService = new ShellGitService();
    gitService.openWorkspace(workspacePath);
    await gitService.moveCommittedChangesToWorkingTree();

    assert.deepEqual(await gitService.getChangedFiles(), ["README.md"]);
    assert.equal(await gitService.getDiffSummary(), "1 file changed, 1 insertion");
  } finally {
    delete process.env.DEFAULT_BRANCH;
    await rm(workspacePath, { recursive: true, force: true });
  }
});
