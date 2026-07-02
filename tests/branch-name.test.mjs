import assert from "node:assert/strict";
import test from "node:test";

import { buildBranchName } from "../apps/orchestrator/dist/services/branch-name.service.js";

test("buildBranchName creates deterministic hotfix branch names with ticket ids", () => {
  assert.equal(
    buildBranchName("PROJ-42 Fix debounce issue in search component", "12345678-aaaa-bbbb-cccc-1234567890ab"),
    "hotfix/proj-42-fix-debounce-issue-search-12345678",
  );
});

test("buildBranchName transliterates Russian task text", () => {
  assert.equal(
    buildBranchName("Добавь проверку токена", "abcdef12-aaaa-bbbb-cccc-1234567890ab"),
    "feature/add-proverku-tokena-abcdef12",
  );
});
