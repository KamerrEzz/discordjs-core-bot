import { logger } from '../../core/Logger.js';
import { container } from '../../core/Container.js';
import { config } from '../../core/Config.js';
import type { Bot } from '../../client/Bot.js';

/**
 * Base class for all systems
 */
export abstract class BaseSystem {
  public abstract readonly name: string;

  constructor(protected readonly bot: Bot) {}

  /**
   * Called when the system is initialized
   */
  abstract onInit(): Promise<void>;

  /**
   * Called when the bot is ready
   */
  async onReady(): Promise<void> {
    // Optional
  }

  /**
   * Called when the system is destroyed
   */
  async onDestroy(): Promise<void> {
    // Optional
  }
}
