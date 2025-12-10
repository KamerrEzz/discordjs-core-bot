import type { API, GatewayMessageCreateDispatchData } from '@discordjs/core';
import { ModerationConfigRepository } from '#infrastructure/database/repositories/ModerationConfigRepository.js';
import { cacheService } from '#infrastructure/cache/CacheService.js';
import { logger } from '#core/Logger.js';
import { container } from '#core/Container.js';

interface MessageRecord {
  content: string;
  timestamp: number;
}

/**
 * NSFW domain patterns - common adult content domains
 */
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

/**
 * URL detection regex
 */
const URL_REGEX = /https?:\/\/[^\s<]+[^<.,:;"')\]\s]/gi;

/**
 * Moderation Service
 * Handles message filtering for spam, links, and NSFW content
 */
export class ModerationService {
  private spamCache = new Map<string, MessageRecord[]>();

  /**
   * Process a message for moderation
   * Returns true if the message should be deleted
   */
  async processMessage(
    message: GatewayMessageCreateDispatchData,
    api: API
  ): Promise<{ shouldDelete: boolean; reason?: string }> {
    // Ignore bots and DMs
    if (message.author.bot || !message.guild_id) {
      return { shouldDelete: false };
    }

    const guildId = message.guild_id;
    const moderationRepo = await container.resolve<ModerationConfigRepository>('ModerationConfigRepository');
    const config = await moderationRepo.findById(guildId);

    // No config means no moderation
    if (!config) {
      return { shouldDelete: false };
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
        return { shouldDelete: true, reason: 'Spam detected' };
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
        return { shouldDelete: true, reason: 'NSFW content detected' };
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
        return { shouldDelete: true, reason: 'Link detected' };
      }
    }

    return { shouldDelete: false };
  }

  /**
   * Check for spam (repeated messages)
   */
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

    // Get existing messages for this user
    let messages = this.spamCache.get(key) || [];

    // Filter to only messages within the time window
    messages = messages.filter(m => now - m.timestamp < windowMs);

    // Add current message
    messages.push({ content: content.toLowerCase().trim(), timestamp: now });

    // Update cache
    this.spamCache.set(key, messages);

    // Count repeated messages
    const repeatedCount = messages.filter(
      m => m.content === content.toLowerCase().trim()
    ).length;

    if (repeatedCount >= threshold) {
      logger.warn({ guildId, userId, repeatedCount, threshold }, 'Spam detected');
      return { isSpam: true };
    }

    return { isSpam: false };
  }

  /**
   * Check for NSFW content
   */
  private checkNsfw(content: string): { isNsfw: boolean; matchedUrl?: string } {
    const urls = content.match(URL_REGEX) || [];

    for (const url of urls) {
      for (const pattern of NSFW_PATTERNS) {
        if (pattern.test(url)) {
          return { isNsfw: true, matchedUrl: url };
        }
      }
    }

    // Also check content directly for NSFW keywords in URLs
    for (const pattern of NSFW_PATTERNS) {
      if (pattern.test(content)) {
        const match = content.match(pattern);
        return { isNsfw: true, matchedUrl: match?.[0] };
      }
    }

    return { isNsfw: false };
  }

  /**
   * Check for links
   */
  private checkLinks(
    content: string,
    whitelist: string[]
  ): { hasLinks: boolean; matchedUrl?: string } {
    const urls = content.match(URL_REGEX) || [];

    for (const url of urls) {
      // Check if URL is whitelisted
      const isWhitelisted = whitelist.some(wl => url.includes(wl));
      if (!isWhitelisted) {
        return { hasLinks: true, matchedUrl: url };
      }
    }

    return { hasLinks: false };
  }

  /**
   * Delete a message
   */
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

  /**
   * Log moderation action
   */
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
      const typeEmoji = {
        SPAM: '🔁',
        LINK: '🔗',
        NSFW: '🔞',
      };

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

  /**
   * Clear spam cache for a guild (useful when config changes)
   */
  clearSpamCache(guildId: string): void {
    for (const key of this.spamCache.keys()) {
      if (key.startsWith(guildId)) {
        this.spamCache.delete(key);
      }
    }
  }
}

export const moderationService = new ModerationService();
