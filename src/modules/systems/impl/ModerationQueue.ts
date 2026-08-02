import type { API } from '@discordjs/core';

export interface ModerationAction {
  type: 'delete-message' | 'kick' | 'ban' | 'mute';
  userId: string;
  channelId?: string;
  reason?: string;
  guildId?: string;
}

/**
 * Process a single moderation action against the Discord API.
 * Returns true on success, false if the action should be skipped.
 */
export interface ModerationActionExecutor {
  execute(action: ModerationAction, api: API): Promise<boolean>;
}

/**
 * FIFO job queue for bulk moderation operations.
 *
 * When an admin issues a bulk moderation command (e.g. "/moderation bulk-ban 50 users"),
 * each individual action is queued and processed sequentially via processQueue().
 * This respects Discord API rate limits by default (one action per batch).
 */
export class ModerationQueue {
  private actions: ModerationAction[] = [];

  /**
   * Add a moderation action to the queue.
   */
  enqueue(action: ModerationAction): void {
    this.actions.push(action);
  }

  /**
   * Process all queued moderation actions sequentially.
   * Executes them one by one against the provided API instance,
   * collecting results for each action.
   *
   * This is the method called by ModerationSystem when an admin
   * issues a bulk moderation action (bulk bans, kicks, mutes, etc.).
   */
  async processQueue(api: API, executor: ModerationActionExecutor): Promise<ModerationResult[]> {
    const results: ModerationResult[] = [];

    while (this.actions.length > 0) {
      const action = this.actions.shift()!;

      try {
        const success = await executor.execute(action, api);
        results.push({
          userId: action.userId,
          type: action.type,
          success,
          reason: action.reason,
          processedAt: new Date(),
        });
      } catch (error) {
        const { logger } = await import('#core/Logger.js');
        logger.error(
          { error, actionType: action.type, userId: action.userId },
          'Bulk moderation action failed'
        );
        results.push({
          userId: action.userId,
          type: action.type,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          processedAt: new Date(),
        });
      }
    }

    return results;
  }

  /**
   * Get the number of queued actions.
   */
  get size(): number {
    return this.actions.length;
  }

  /**
   * Clear the queue without processing.
   */
  clear(): void {
    this.actions = [];
  }
}

export interface ModerationResult {
  userId: string;
  type: ModerationAction['type'];
  success: boolean;
  reason?: string;
  error?: string;
  processedAt: Date;
}