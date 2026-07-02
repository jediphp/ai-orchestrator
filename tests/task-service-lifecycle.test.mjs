import assert from "node:assert/strict";
import test from "node:test";

import { DefaultTaskService } from "../apps/orchestrator/dist/services/task.service.js";
import { InMemoryTaskStore } from "../apps/orchestrator/dist/services/task-store.service.js";

function createAwaitingApprovalTask() {
  return {
    taskId: "task-approval",
    text: "Fix search",
    status: "awaiting_approval",
    createdAt: "2026-07-02T00:00:00.000Z",
    branchName: "hotfix/fix-search-12345678",
    workspacePath: "/tmp/remote-dev-agent/task-approval",
    changedFiles: ["src/search.ts"],
    summary: "1 file changed, 2 insertions, 1 deletion",
  };
}

test("DefaultTaskService marks tasks as publishing before approve publish", async () => {
  const taskStore = new InMemoryTaskStore();
  const task = createAwaitingApprovalTask();
  const publishedStatuses = [];
  const cleanedTaskIds = [];

  taskStore.save(task);

  const taskService = new DefaultTaskService(
    taskStore,
    {
      async execute() {
        throw new Error("Worker should not run in this test");
      },
    },
    {
      async publish(taskToPublish) {
        publishedStatuses.push(taskToPublish.status);
        return { prUrl: "https://github.com/org/repo/pull/1" };
      },
    },
    {
      async cleanup(taskToCleanup) {
        cleanedTaskIds.push(taskToCleanup.taskId);
      },
    },
    { workspaceBasePath: "/tmp/remote-dev-agent" },
  );

  const result = await taskService.approveTask(task.taskId);

  assert.equal(result.status, "approved");
  assert.equal(result.prUrl, "https://github.com/org/repo/pull/1");
  assert.deepEqual(publishedStatuses, ["publishing"]);
  assert.deepEqual(cleanedTaskIds, [task.taskId]);
});
