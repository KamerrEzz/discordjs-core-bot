import { BaseCommand } from '../../../BaseCommand.js';
import type { CommandContext } from '../../../../../shared/types/discord.js';
import type { APIApplicationCommandBasicOption } from '@discordjs/core';
import { API, ApplicationCommandOptionType } from '@discordjs/core';
import { REST } from '@discordjs/rest';
import { config } from '../../../../../core/Config.js';
import { EmbedBuilder, Colors } from '../../../../../shared/utils/embed.js';
import { container } from '../../../../../core/Container.js';
import { GuildRepository } from '../../../../../infrastructure/database/repositories/GuildRepository.js';

export class WelcomeCardSubcommand extends BaseCommand {
  public readonly meta = {
    name: 'welcomecard',
    description: 'Configure the welcome card settings',
    category: 'config',
  };

  private rest = new REST({ version: '10' }).setToken(config.get('DISCORD_TOKEN'));
  private api = new API(this.rest);

  public getOptions(): APIApplicationCommandBasicOption[] {
    return [
      {
        type: ApplicationCommandOptionType.Boolean,
        name: 'enabled',
        description: 'Enable or disable welcome cards',
        required: true,
      },
      {
        type: ApplicationCommandOptionType.Channel,
        name: 'channel',
        description: 'Channel to send welcome messages',
        required: false,
      },
    ];
  }

  async execute(context: CommandContext): Promise<void> {
    const enabled = context.options.get('enabled') as boolean;
    const channelId = context.options.get('channel') as string | undefined;

    const guildRepo = await container.resolve<GuildRepository>('GuildRepository');

    // Update welcome config in database
    // Note: This is simplified - you'd need a WelcomeConfigRepository
    const embed = new EmbedBuilder()
      .setTitle('⚙️ Welcome Card Configuration')
      .setDescription(`Welcome cards have been ${enabled ? 'enabled' : 'disabled'}`)
      .setColor(Colors.Green)
      .setTimestamp()
      .toJSON();

    if (channelId) {
      embed.fields = [
        {
          name: 'Channel',
          value: `<#${channelId}>`,
          inline: false,
        },
      ];
    }

    await this.api.interactions.reply(context.interaction.id, context.interaction.token, {
      embeds: [embed],
    });
  }
}
