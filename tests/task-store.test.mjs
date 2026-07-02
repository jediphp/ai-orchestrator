import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryTaskStore } from "../apps/orchestrator/dist/services/task-store.service.js";

function createTask(status) {
  return {
    taskId: `task-${status}`,
    text: "Fix search",
    status,
    createdAt: "2026-07-02T00:00:00.000Z",
    branchName: "hotfix/fix-search-12345678",
    workspacePath: "/tmp/remote-dev-agent/task",
  };
}

test("InMemoryTaskStore treats running and awaiting approval tasks as active", () => {
  const store = new InMemoryTaskStore();

  assert.equal(store.hasActiveTask(), false);

  store.save(createTask("running"));
  assert.equal(store.hasActiveTask(), true);

  store.update("task-running", { status: "awaiting_approval" });
  assert.equal(store.hasActiveTask(), true);

  store.update("task-running", { status: "approved" });
  assert.equal(store.hasActiveTask(), false);
});
