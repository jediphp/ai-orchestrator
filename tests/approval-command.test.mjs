import assert from "node:assert/strict";
import test from "node:test";

import {
  formatApprovalSuccessMessage,
  isApprovalCommand,
  parseApprovalCommand,
} from "../apps/telegram-bot/dist/handlers/approval.handler.js";
import {
  formatApprovalRequest,
  formatCompletedTaskMessage,
} from "../apps/telegram-bot/dist/services/task-poller.service.js";

test("parseApprovalCommand handles approve and reject aliases", () => {
  assert.deepEqual(parseApprovalCommand("APPROVE"), { action: "approve" });
  assert.deepEqual(parseApprovalCommand(" reject "), { action: "reject" });
  assert.deepEqual(parseApprovalCommand("/approve task-123"), {
    action: "approve",
    taskId: "task-123",
  });
  assert.deepEqual(parseApprovalCommand("/reject task-123"), {
    action: "reject",
    taskId: "task-123",
  });
});

test("parseApprovalCommand ignores unrelated commands", () => {
  assert.equal(parseApprovalCommand("/start"), undefined);
  assert.equal(isApprovalCommand("please approve"), false);
});

test("formatApprovalSuccessMessage includes PR URL when present", () => {
  assert.equal(
    formatApprovalSuccessMessage("https://github.com/org/repo/pull/1"),
    [
      "Task completed.",
      "PR created successfully.",
      "https://github.com/org/repo/pull/1",
    ].join("\n"),
  );
});

test("formatApprovalRequest promotes tap and short approval flows", () => {
  const message = formatApprovalRequest({
    taskId: "task-123",
    text: "Update README",
    status: "awaiting_approval",
    createdAt: "2026-07-02T00:00:00.000Z",
    branchName: "docs/update-readme-task-123",
    changedFiles: ["README.md"],
    summary: "1 file changed, 1 insertion",
  });

  assert.match(message, /Tap Approve below, or reply APPROVE/);
  assert.match(message, /Fallback approve command: \/approve task-123/);
});

test("formatCompletedTaskMessage includes no-PR result", () => {
  const message = formatCompletedTaskMessage({
    taskId: "task-123",
    text: "Deploy to test",
    status: "completed",
    createdAt: "2026-07-02T00:00:00.000Z",
    branchName: "ops/deploy-to-test-task-123",
    summary: "0 files changed, 0 insertions, 0 deletions",
    resultMessage: "Deployment finished successfully",
  });

  assert.match(message, /No PR is required/);
  assert.match(message, /Deployment finished successfully/);
});
