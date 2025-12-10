import { BaseCommand } from '../../BaseCommand.js';
import type { CommandContext } from '../../../../shared/types/discord.js';
import { API } from '@discordjs/core';
import { REST } from '@discordjs/rest';
import { config } from '../../../../core/Config.js';
import { EmbedBuilder, Colors } from '../../../../shared/utils/embed.js';

export class PingCommand extends BaseCommand {
  public readonly meta = {
    name: 'ping',
    description: 'Check the bot\'s latency',
    category: 'util',
    cooldown: 3,
  };

  private rest = new REST({ version: '10' }).setToken(config.get('DISCORD_TOKEN'));
  private api = new API(this.rest);

  async execute(context: CommandContext): Promise<void> {
    const start = Date.now();

    // Send initial response
    await this.api.interactions.reply(context.interaction.id, context.interaction.token, {
      content: '🏓 Pinging...',
    });

    const latency = Date.now() - start;

    // Edit response with latency
    const embed = new EmbedBuilder()
      .setTitle('🏓 Pong!')
      .setColor(Colors.Green)
      .addField('Latency', `${latency}ms`, true)
      .addField('API Latency', `~${latency}ms`, true)
      .setTimestamp()
      .toJSON();

    await this.api.interactions.editReply(
      config.get('DISCORD_CLIENT_ID'),
      context.interaction.token,
      {
        content: '',
        embeds: [embed],
      }
    );
  }
}
