import assert from "node:assert/strict";
import test from "node:test";

import { createServer } from "../apps/orchestrator/dist/server.js";

const taskService = {
  async createTask() {
    throw new Error("Not used");
  },
  getTask() {
    return undefined;
  },
  async approveTask() {
    throw new Error("Not used");
  },
  rejectTask() {
    throw new Error("Not used");
  },
};

test("Orchestrator exposes a health endpoint", async () => {
  const app = createServer(taskService);

  try {
    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.body), { status: "ok" });
  } finally {
    await app.close();
  }
});
