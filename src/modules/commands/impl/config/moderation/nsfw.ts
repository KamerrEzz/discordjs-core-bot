import { BaseCommand } from '#modules/commands/BaseCommand.js';
import type { CommandContext } from '#shared/types/discord.js';
import type { APIApplicationCommandBasicOption } from '@discordjs/core';
import { ApplicationCommandOptionType } from '@discordjs/core';
import { EmbedBuilder, Colors } from '#shared/utils/embed.js';
import { container } from '#core/Container.js';
import { ModerationConfigRepository } from '#infrastructure/database/repositories/ModerationConfigRepository.js';

export class NsfwSubcommand extends BaseCommand {
  public readonly meta = {
    name: 'nsfw',
    description: 'Enable or disable anti-NSFW (+18) content protection',
    category: 'config',
  };

  public getOptions(): APIApplicationCommandBasicOption[] {
    return [
      {
        type: ApplicationCommandOptionType.Boolean,
        name: 'enabled',
        description: 'Enable or disable anti-NSFW protection',
        required: true,
      },
    ];
  }

  async execute(context: CommandContext): Promise<void> {
    const { api, interaction, options, guildId } = context;

    const enabled = options.get('enabled') as boolean;

    const moderationRepo = await container.resolve<ModerationConfigRepository>('ModerationConfigRepository');

    await moderationRepo.upsert(guildId, { antiNsfw: enabled });

    const embed = new EmbedBuilder()
      .setTitle('🔞 Anti-NSFW Configuration')
      .setDescription(`Anti-NSFW (+18) protection has been **${enabled ? 'enabled' : 'disabled'}**`)
      .setColor(enabled ? Colors.Green : Colors.Red)
      .setTimestamp()
      .toJSON();

    if (enabled) {
      embed.fields = [
        {
          name: 'Protected Content',
          value: 'Links to adult content sites will be automatically removed',
          inline: false,
        },
      ];
    }

    await api.interactions.reply(interaction.id, interaction.token, {
      embeds: [embed],
    });
  }
}
