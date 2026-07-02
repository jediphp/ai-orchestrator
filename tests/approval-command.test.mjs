import assert from "node:assert/strict";
import test from "node:test";

import {
  formatApprovalSuccessMessage,
  isApprovalCommand,
  parseApprovalCommand,
} from "../apps/telegram-bot/dist/handlers/approval.handler.js";

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
