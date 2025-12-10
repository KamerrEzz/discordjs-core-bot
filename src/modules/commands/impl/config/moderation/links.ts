import { BaseCommand } from '#modules/commands/BaseCommand.js';
import type { CommandContext } from '#shared/types/discord.js';
import type { APIApplicationCommandBasicOption } from '@discordjs/core';
import { ApplicationCommandOptionType } from '@discordjs/core';
import { EmbedBuilder, Colors } from '#shared/utils/embed.js';
import { container } from '#core/Container.js';
import { ModerationConfigRepository } from '#infrastructure/database/repositories/ModerationConfigRepository.js';

export class LinksSubcommand extends BaseCommand {
  public readonly meta = {
    name: 'links',
    description: 'Enable or disable anti-link protection',
    category: 'config',
  };

  public getOptions(): APIApplicationCommandBasicOption[] {
    return [
      {
        type: ApplicationCommandOptionType.Boolean,
        name: 'enabled',
        description: 'Enable or disable anti-links',
        required: true,
      },
    ];
  }

  async execute(context: CommandContext): Promise<void> {
    const { api, interaction, options, guildId } = context;

    const enabled = options.get('enabled') as boolean;

    const moderationRepo = await container.resolve<ModerationConfigRepository>('ModerationConfigRepository');

    await moderationRepo.upsert(guildId, { antiLinks: enabled });

    const embed = new EmbedBuilder()
      .setTitle('🔗 Anti-Links Configuration')
      .setDescription(`Anti-links has been **${enabled ? 'enabled' : 'disabled'}**`)
      .setColor(enabled ? Colors.Green : Colors.Red)
      .setTimestamp()
      .toJSON();

    if (enabled) {
      embed.fields = [
        {
          name: 'Note',
          value: 'All links will be blocked except whitelisted URLs',
          inline: false,
        },
      ];
    }

    await api.interactions.reply(interaction.id, interaction.token, {
      embeds: [embed],
    });
  }
}
