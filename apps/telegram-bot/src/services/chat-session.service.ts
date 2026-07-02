import type { ChatSessionStore } from "../types/orchestrator.types.js";

export class InMemoryChatSessionStore implements ChatSessionStore {
  private readonly activeTaskIds = new Map<number, string>();

  setActiveTaskId(chatId: number, taskId: string): void {
    this.activeTaskIds.set(chatId, taskId);
  }

  getActiveTaskId(chatId: number): string | undefined {
    return this.activeTaskIds.get(chatId);
  }

  clearActiveTaskId(chatId: number): void {
    this.activeTaskIds.delete(chatId);
  }
}
