import { BaseSystem } from './BaseSystem.js';
import { logger } from '../../core/Logger.js';
import type { Bot } from '../../client/Bot.js';

export class SystemManager {
  private systems = new Map<string, BaseSystem>();

  constructor(private readonly bot: Bot) {}

  /**
   * Register a system
   */
  public async register(SystemClass: new (bot: Bot) => BaseSystem): Promise<void> {
    const system = new SystemClass(this.bot);
    
    if (this.systems.has(system.name)) {
      logger.warn({ system: system.name }, 'System already registered');
      return;
    }

    this.systems.set(system.name, system);
    await system.onInit();
    
    logger.info({ system: system.name }, 'System initialized');
  }

  /**
   * Trigger onReady for all systems
   */
  public async onReady(): Promise<void> {
    const promises = Array.from(this.systems.values()).map(system => system.onReady());
    await Promise.all(promises);
    logger.info('All systems ready');
  }

  /**
   * Get a system by name
   */
  public get<T extends BaseSystem>(name: string): T | undefined {
    return this.systems.get(name) as T;
  }
}
