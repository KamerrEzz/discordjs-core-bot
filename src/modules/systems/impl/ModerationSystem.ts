import { BaseSystem } from '../BaseSystem.js';
import { logger } from '../../../core/Logger.js';
import { container } from '../../../core/Container.js';
import { eventHandler } from '../../events/EventHandler.js';
import { BaseEvent, type EventContext } from '../../events/BaseEvent.js';
import type { GatewayMessageCreateDispatchData, API } from '@discordjs/core';
import { ModerationConfigRepository } from '../../../infrastructure/database/repositories/ModerationConfigRepository.js';
import { ModerationQueue, type ModerationActionExecutor, type ModerationAction, type ModerationResult } from './ModerationQueue.js';

export { ModerationResult, ModerationAction, ModerationActionExecutor } from './ModerationQueue.js';

interface MessageRecord {
  content: string;
  timestamp: number;
}

const NSFW_PATTERNS = [
  /pornhub\.com/i,
  /xvideos\.com/i,
  /xnxx\.com/i,
  /xhamster\.com/i,
  /redtube\.com/i,
  /youporn\.com/i,
  /brazzers\.com/i,
  /onlyfans\.com/i,
  /chaturbate\.com/i,
  /stripchat\.com/i,
  /livejasmin\.com/i,
  /bongacams\.com/i,
  /cam4\.com/i,
  /myfreecams\.com/i,
  /spankbang\.com/i,
  /tube8\.com/i,
  /beeg\.com/i,
  /naughtyamerica\.com/i,
  /realitykings\.com/i,
  /hentai/i,
  /xxx/i,
  /porn/i,
];

const URL_REGEX = /https?:\/\/[^\s<]+[^<.,:;"')\]\s]/gi;

// Internal event handler for the system
class ModerationMessageEvent extends BaseEvent<GatewayMessageCreateDispatchData> {
  public readonly name = 'MESSAGE_CREATE';
  public readonly once = false;

  constructor(private system: ModerationSystem) {
    super();
  }

  async execute(context: EventContext<GatewayMessageCreateDispatchData>): Promise<void> {
    await this.system.processMessage(context.data, context.api);
  }
}

/**
 * Internal event handler for ban events.
 * When a user is banned, queue their messages for deletion.
 */
class ModerationBanEvent extends BaseEvent<any> {
  public readonly name = 'GUILD_MEMBER_BAN_ADD';
  public readonly once = false;

  constructor(private system: ModerationSystem) {
    super();
  }

  async execute(context: EventContext<any>): Promise<void> {
    const ban = context.data;
    if (ban?.user) {
      this.system.moderationQueue.enqueue({
        type: 'delete-message',
        userId: ban.user.id,
        reason: 'Banned — queued deleted messages',
      });
    }
  }
}

export class ModerationSystem extends BaseSystem {
  public readonly name = 'ModerationSystem';
  private spamCache = new Map<string, MessageRecord[]>();
  public moderationQueue = new ModerationQueue();

  async onInit(): Promise<void> {
    eventHandler.register(new ModerationMessageEvent(this));
    eventHandler.register(new ModerationBanEvent(this));
    logger.debug('ModerationSystem initialized');
  }

  /**
   * Enqueue a bulk moderation action.
   * Call this from commands when an admin issues bulk actions (bans, message deletions, etc.).
   * Then call processQueue(api) to execute all queued actions.
   */
  public enqueueModeration(action: ModerationAction): void {
    this.moderationQueue.enqueue(action);
  }

  /**
   * Process all queued moderation actions.
   * This is called by bulk moderation commands after enqueueing actions.
   * @param api - The Discord API instance
   * @returns Results for each action processed
   */
  public async processQueue(api: API): Promise<ModerationResult[]> {
    const executor: ModerationActionExecutor = {
      execute: (action, apiClient) => this.executeModerationAction(action, apiClient),
    };

    return await this.moderationQueue.processQueue(api, executor);
  }

  private async executeModerationAction(action: ModerationAction, api: API): Promise<boolean> {
    try {
      switch (action.type) {
        case 'ban':
          if (action.guildId) {
            await api.guilds.banUser(action.guildId, action.userId);
            logger.info({ userId: action.userId, reason: action.reason }, 'Banned user (bulk mod)');
          }
          return true;

        case 'delete-message':
          // If a channelId is provided, delete specific message
          if (action.channelId) {
            await api.channels.deleteMessage(action.channelId, action.userId);
            logger.debug({ channelId: action.channelId, userId: action.userId }, 'Message deleted (bulk mod)');
          }
          return true;

        case 'kick':
        case 'mute':
          // These actions would need a custom executor implementation
          // that has access to member/guild APIs
          logger.info({ userId: action.userId, type: action.type }, `Moderation ${action.type} action queued (requires custom executor)`);
          return true;

        default:
          logger.warn({ type: action.type }, 'Unknown moderation action type');
          return false;
      }
    } catch (error) {
      logger.error({ error, action }, 'Failed to execute moderation action');
      return false;
    }
  }

  /**
   * Process a message through moderation checks (spam, NSFW, links)
   */
  async processMessage(
    message: GatewayMessageCreateDispatchData,
    api: API
  ): Promise<void> {
    // Ignore bots and DMs
    if (message.author.bot || !message.guild_id) {
      return;
    }

    const guildId = message.guild_id;
    const moderationRepo = await container.resolve<ModerationConfigRepository>('ModerationConfigRepository');
    const config = await moderationRepo.findById(guildId);

    // No config means no moderation
    if (!config) {
      return;
    }

    // Check anti-spam
    if (config.antiSpam) {
      const spamResult = await this.checkSpam(
        guildId,
        message.author.id,
        message.content,
        config.spamThreshold,
        config.spamInterval
      );
      if (spamResult.isSpam) {
        await this.deleteMessage(api, message.channel_id, message.id);
        await this.logAction(api, config.logChannelId, {
          type: 'SPAM',
          userId: message.author.id,
          channelId: message.channel_id,
          content: message.content,
          guildId,
        });
        return; // Stop processing if deleted
      }
    }

    // Check anti-NSFW (check before general links)
    if (config.antiNsfw) {
      const nsfwResult = this.checkNsfw(message.content);
      if (nsfwResult.isNsfw) {
        await this.deleteMessage(api, message.channel_id, message.id);
        await this.logAction(api, config.logChannelId, {
          type: 'NSFW',
          userId: message.author.id,
          channelId: message.channel_id,
          content: message.content,
          matchedUrl: nsfwResult.matchedUrl,
          guildId,
        });
        return;
      }
    }

    // Check anti-links
    if (config.antiLinks) {
      const linkResult = this.checkLinks(message.content, config.whitelistedUrls);
      if (linkResult.hasLinks) {
        await this.deleteMessage(api, message.channel_id, message.id);
        await this.logAction(api, config.logChannelId, {
          type: 'LINK',
          userId: message.author.id,
          channelId: message.channel_id,
          content: message.content,
          matchedUrl: linkResult.matchedUrl,
          guildId,
        });
        return;
      }
    }
  }

  private async checkSpam(
    guildId: string,
    userId: string,
    content: string,
    threshold: number,
    intervalSeconds: number
  ): Promise<{ isSpam: boolean }> {
    const key = `${guildId}:${userId}`;
    const now = Date.now();
    const windowMs = intervalSeconds * 1000;

    let messages = this.spamCache.get(key) || [];
    messages = messages.filter(m => now - m.timestamp < windowMs);
    messages.push({ content: content.toLowerCase().trim(), timestamp: now });
    this.spamCache.set(key, messages);

    const repeatedCount = messages.filter(
      m => m.content === content.toLowerCase().trim()
    ).length;

    if (repeatedCount >= threshold) {
      logger.warn({ guildId, userId, repeatedCount, threshold }, 'Spam detected');
      return { isSpam: true };
    }

    return { isSpam: false };
  }

  private checkNsfw(content: string): { isNsfw: boolean; matchedUrl?: string } {
    const urls = content.match(URL_REGEX) || [];
    for (const url of urls) {
      for (const pattern of NSFW_PATTERNS) {
        if (pattern.test(url)) {
          return { isNsfw: true, matchedUrl: url };
        }
      }
    }
    for (const pattern of NSFW_PATTERNS) {
      if (pattern.test(content)) {
        const match = content.match(pattern);
        return { isNsfw: true, matchedUrl: match?.[0] };
      }
    }
    return { isNsfw: false };
  }

  private checkLinks(
    content: string,
    whitelist: string[]
  ): { hasLinks: boolean; matchedUrl?: string } {
    const urls = content.match(URL_REGEX) || [];
    for (const url of urls) {
      const isWhitelisted = whitelist.some(wl => url.includes(wl));
      if (!isWhitelisted) {
        return { hasLinks: true, matchedUrl: url };
      }
    }
    return { hasLinks: false };
  }

  private async deleteMessage(
    api: API,
    channelId: string,
    messageId: string
  ): Promise<void> {
    try {
      await api.channels.deleteMessage(channelId, messageId);
      logger.debug({ channelId, messageId }, 'Message deleted by moderation');
    } catch (error) {
      logger.error({ error, channelId, messageId }, 'Failed to delete message');
    }
  }

  private async logAction(
    api: API,
    logChannelId: string | null,
    action: {
      type: 'SPAM' | 'LINK' | 'NSFW';
      userId: string;
      channelId: string;
      content: string;
      matchedUrl?: string;
      guildId: string;
    }
  ): Promise<void> {
    logger.info(action, 'Moderation action taken');
    if (!logChannelId) return;

    try {
      const typeEmoji = { SPAM: '🔁', LINK: '🔗', NSFW: '🔞' };
      await api.channels.createMessage(logChannelId, {
        embeds: [
          {
            title: `${typeEmoji[action.type]} ${action.type} Detected`,
            color: 0xff0000,
            fields: [
              { name: 'User', value: `<@${action.userId}>`, inline: true },
              { name: 'Channel', value: `<#${action.channelId}>`, inline: true },
              { name: 'Content', value: action.content.slice(0, 1000) || 'N/A', inline: false },
              ...(action.matchedUrl
                ? [{ name: 'Matched URL', value: `\`${action.matchedUrl}\``, inline: false }]
                : []),
            ],
            timestamp: new Date().toISOString(),
          },
        ],
      });
    } catch (error) {
      logger.error({ error, logChannelId }, 'Failed to log moderation action');
    }
  }

  public clearSpamCache(guildId: string): void {
    for (const key of this.spamCache.keys()) {
      if (key.startsWith(guildId)) {
        this.spamCache.delete(key);
      }
    }
  }
}