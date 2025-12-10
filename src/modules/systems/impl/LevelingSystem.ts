import { BaseSystem } from "../BaseSystem.js";
import { logger } from "#core/Logger.js";
import { eventHandler } from "#modules/events/EventHandler.js";
import { BaseEvent, type EventContext } from "#modules/events/BaseEvent.js";
import type { GatewayMessageCreateDispatchData } from "@discordjs/core";
import { container } from "#core/Container.js";
import { GuildRepository } from "#infrastructure/database/repositories/GuildRepository.js";
import { EmbedBuilder, Colors } from "#shared/utils/embed.js";
import { cooldownManager } from "#shared/utils/cooldown.js";

interface RoleReward {
  level: number;
  roleId: string;
}

class LevelingMessageEvent extends BaseEvent<GatewayMessageCreateDispatchData> {
  public readonly name = "MESSAGE_CREATE";
  public readonly once = false;

  constructor(private system: LevelingSystem) {
    super();
  }

  async execute(context: EventContext<GatewayMessageCreateDispatchData>): Promise<void> {
    await this.system.handleMessage(context.data, context.api);
  }
}

export class LevelingSystem extends BaseSystem {
  public readonly name = "LevelingSystem";
  private xpCooldowns = new Map<string, number>();
  private guildRepo!: GuildRepository;

  // Algoritmo de niveles: XP necesario = 100 * nivel^2
  private calculateXpForLevel(level: number): number {
    return 100 * level * level;
  }

  private calculateLevelFromXp(xp: number): number {
    return Math.floor(Math.sqrt(xp / 100));
  }

  async onInit(): Promise<void> {
    try {
      this.guildRepo = await container.resolve<GuildRepository>("GuildRepository");
      eventHandler.register(new LevelingMessageEvent(this));
      logger.info("LevelingSystem initialized!");
    } catch (error) {
      logger.error({ error }, "Failed to initialize LevelingSystem - GuildRepository not available");
      throw error;
    }
  }

  async onReady(): Promise<void> {
    logger.info("LevelingSystem is ready to track XP");
  }

  public async handleMessage(data: GatewayMessageCreateDispatchData, api: any): Promise<void> {
    // Ignorar bots
    if (data.author.bot) return;
    
    // Ignorar mensajes en MD
    if (!data.guild_id) return;

    try {
      const guildConfig = await this.guildRepo.findLevelingConfig(data.guild_id);
      
      // Verificar si el sistema está habilitado
      if (!guildConfig?.enabled) return;

      const userKey = `${data.guild_id}-${data.author.id}`;
      const now = Date.now();
      const cooldownMs = (guildConfig.xpCooldown || 60) * 1000;

      // Verificar cooldown
      const lastXpTime = this.xpCooldowns.get(userKey) || 0;
      if (now - lastXpTime < cooldownMs) return;

      // Actualizar cooldown
      this.xpCooldowns.set(userKey, now);

      // Obtener o crear usuario
      const userLevel = await this.guildRepo.findOrCreateLevelingUser(data.guild_id, data.author.id);
      const oldLevel = userLevel.level;
      
      // Calcular nuevo XP
      const xpGained = guildConfig.xpPerMessage || 10;
      const newXp = userLevel.xp + xpGained;
      const newLevel = this.calculateLevelFromXp(newXp);

      // Actualizar en BD
      await this.guildRepo.updateLevelingUser(data.guild_id, data.author.id, {
        xp: newXp,
        level: newLevel
      });

      // Verificar si subió de nivel
      if (newLevel > oldLevel) {
        await this.handleLevelUp(data, api, guildConfig, newLevel);
      }

    } catch (error) {
      logger.error({ error, guildId: data.guild_id, userId: data.author.id }, "Error processing leveling");
    }
  }

  private async handleLevelUp(
    data: GatewayMessageCreateDispatchData, 
    api: any, 
    guildConfig: any, 
    newLevel: number
  ): Promise<void> {
    // Enviar mensaje de felicitación si está configurado
    if (guildConfig.levelUpMessage) {
      const message = guildConfig.levelUpMessage
        .replace("{user}", `<@${data.author.id}>`)
        .replace("{level}", newLevel.toString());

      try {
        await api.channels.createMessage(data.channel_id, { content: message });
      } catch (error) {
        logger.error({ error }, "Failed to send level up message");
      }
    }

    // Asignar rol de recompensa si existe
    const roleRewards = (guildConfig.roleRewards as RoleReward[]) || [];
    const reward = roleRewards.find(r => r.level === newLevel);
    
    if (reward) {
      try {
        await api.guilds.addRoleToMember(data.guild_id!, data.author.id, reward.roleId);
      } catch (error) {
        logger.error({ error, roleId: reward.roleId }, "Failed to assign level reward role");
      }
    }
  }

  // Métodos de utilidad para comandos
  public getXpForLevel(level: number): number {
    return this.calculateXpForLevel(level);
  }

  public getLevelFromXp(xp: number): number {
    return this.calculateLevelFromXp(xp);
  }

  public getXpProgress(xp: number): { currentLevel: number; xpInLevel: number; xpForNextLevel: number } {
    const currentLevel = this.calculateLevelFromXp(xp);
    const xpForCurrentLevel = this.calculateXpForLevel(currentLevel);
    const xpForNextLevel = this.calculateXpForLevel(currentLevel + 1);
    const xpInLevel = xp - xpForCurrentLevel;
    const xpNeededForNext = xpForNextLevel - xpForCurrentLevel;

    return {
      currentLevel,
      xpInLevel,
      xpForNextLevel: xpNeededForNext
    };
  }
}