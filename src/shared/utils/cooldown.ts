import { cacheService } from '../../infrastructure/cache/CacheService.js';
import { CommandCooldownError } from '../errors/CommandError.js';

export class CooldownManager {
  /**
   * Check if user is on cooldown for a command
   */
  async checkCooldown(
    commandName: string,
    userId: string,
    cooldownSeconds: number
  ): Promise<void> {
    const key = `cooldown:${commandName}:${userId}`;
    const exists = await cacheService.exists(key);

    if (exists) {
      const ttl = await cacheService.get<number>(key);
      throw new CommandCooldownError(ttl || 0);
    }
  }

  /**
   * Set cooldown for a user on a command
   */
  async setCooldown(
    commandName: string,
    userId: string,
    cooldownSeconds: number
  ): Promise<void> {
    const key = `cooldown:${commandName}:${userId}`;
    await cacheService.set(key, cooldownSeconds, { ttl: cooldownSeconds });
  }

  /**
   * Clear cooldown for a user on a command
   */
  async clearCooldown(commandName: string, userId: string): Promise<void> {
    const key = `cooldown:${commandName}:${userId}`;
    await cacheService.delete(key);
  }
}

export const cooldownManager = new CooldownManager();
