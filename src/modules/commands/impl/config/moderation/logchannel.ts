import { BaseCommand } from '#modules/commands/BaseCommand.js';
import type { CommandContext } from '#shared/types/discord.js';
import type { APIApplicationCommandBasicOption } from '@discordjs/core';
import { ApplicationCommandOptionType } from '@discordjs/core';
import { EmbedBuilder, Colors } from '#shared/utils/embed.js';
import { container } from '#core/Container.js';
import { ModerationConfigRepository } from '#infrastructure/database/repositories/ModerationConfigRepository.js';

export class LogChannelSubcommand extends BaseCommand {
  public readonly meta = {
    name: 'logchannel',
    description: 'Set the channel for moderation logs',
    category: 'config',
  };

  public getOptions(): APIApplicationCommandBasicOption[] {
    return [
      {
        type: ApplicationCommandOptionType.Channel,
        name: 'channel',
        description: 'Channel to send moderation logs (leave empty to disable)',
        required: false,
      },
    ];
  }

  async execute(context: CommandContext): Promise<void> {
    const { api, interaction, options, guildId } = context;

    const channelId = options.get('channel') as string | undefined;

    const moderationRepo = await container.resolve<ModerationConfigRepository>('ModerationConfigRepository');

    await moderationRepo.upsert(guildId, { logChannelId: channelId ?? null });

    const embed = new EmbedBuilder()
      .setTitle('📋 Moderation Log Channel')
      .setDescription(
        channelId
          ? `Moderation logs will be sent to <#${channelId}>`
          : 'Moderation logging has been **disabled**'
      )
      .setColor(channelId ? Colors.Green : Colors.Yellow)
      .setTimestamp()
      .toJSON();

    await api.interactions.reply(interaction.id, interaction.token, {
      embeds: [embed],
    });
  }
}
