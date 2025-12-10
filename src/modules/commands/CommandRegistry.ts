import { BaseCommand } from './BaseCommand.js';
import { logger } from '#core/Logger.js';

/**
 * Command Registry
 * Stores all registered commands
 */
export class CommandRegistry {
  private commands = new Map<string, BaseCommand>();

  /**
   * Register a command
   */
  public register(command: BaseCommand): void {
    if (this.commands.has(command.meta.name)) {
      logger.warn({ command: command.meta.name }, 'Command already registered, overwriting');
    }

    this.commands.set(command.meta.name, command);
    logger.info({ command: command.meta.name }, 'Command registered');
  }

  /**
   * Get a command by name
   */
  public get(name: string): BaseCommand | undefined {
    return this.commands.get(name);
  }

  /**
   * Get all commands
   */
  public getAll(): BaseCommand[] {
    return Array.from(this.commands.values());
  }

  /**
   * Check if a command exists
   */
  public has(name: string): boolean {
    return this.commands.has(name);
  }

  /**
   * Get all command names
   */
  public getCommandNames(): string[] {
    return Array.from(this.commands.keys());
  }

  /**
   * Clear all commands
   */
  public clear(): void {
    this.commands.clear();
    logger.info('Command registry cleared');
  }

  /**
   * Get command count
   */
  public get size(): number {
    return this.commands.size;
  }
}

export const commandRegistry = new CommandRegistry();
