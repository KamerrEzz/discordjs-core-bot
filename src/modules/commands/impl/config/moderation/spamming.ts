import { BaseCommand } from '#modules/commands/BaseCommand.js';
import type { CommandContext } from '#shared/types/discord.js';
import type { APIApplicationCommandBasicOption } from '@discordjs/core';
import { ApplicationCommandOptionType } from '@discordjs/core';
import { EmbedBuilder, Colors } from '#shared/utils/embed.js';
import { container } from '#core/Container.js';
import { ModerationConfigRepository } from '#infrastructure/database/repositories/ModerationConfigRepository.js';

export class SpammingSubcommand extends BaseCommand {
  public readonly meta = {
    name: 'spamming',
    description: 'Enable or disable anti-spam protection',
    category: 'config',
  };

  public getOptions(): APIApplicationCommandBasicOption[] {
    return [
      {
        type: ApplicationCommandOptionType.Boolean,
        name: 'enabled',
        description: 'Enable or disable anti-spam',
        required: true,
      },
      {
        type: ApplicationCommandOptionType.Integer,
        name: 'threshold',
        description: 'Number of repeated messages before action (default: 5)',
        required: false,
        min_value: 2,
        max_value: 20,
      },
      {
        type: ApplicationCommandOptionType.Integer,
        name: 'interval',
        description: 'Time window in seconds (default: 10)',
        required: false,
        min_value: 5,
        max_value: 60,
      },
    ];
  }

  async execute(context: CommandContext): Promise<void> {
    const { api, interaction, options, guildId } = context;

    const enabled = options.get('enabled') as boolean;
    const threshold = options.get('threshold') as number | undefined;
    const interval = options.get('interval') as number | undefined;

    const moderationRepo = await container.resolve<ModerationConfigRepository>('ModerationConfigRepository');

    const updateData: any = { antiSpam: enabled };
    if (threshold !== undefined) updateData.spamThreshold = threshold;
    if (interval !== undefined) updateData.spamInterval = interval;

    await moderationRepo.upsert(guildId, updateData);

    const embed = new EmbedBuilder()
      .setTitle('🔁 Anti-Spam Configuration')
      .setDescription(`Anti-spam has been **${enabled ? 'enabled' : 'disabled'}**`)
      .setColor(enabled ? Colors.Green : Colors.Red)
      .setTimestamp()
      .toJSON();

    if (enabled) {
      embed.fields = [
        {
          name: 'Threshold',
          value: `${threshold ?? 5} repeated messages`,
          inline: true,
        },
        {
          name: 'Interval',
          value: `${interval ?? 10} seconds`,
          inline: true,
        },
      ];
    }

    await api.interactions.reply(interaction.id, interaction.token, {
      embeds: [embed],
    });
  }
}
