import { BaseCommand } from '../../BaseCommand.js';
import type { CommandContext } from '../../../../shared/types/discord.js';
import { EmbedBuilder, Colors } from '../../../../shared/utils/embed.js';

export class PingCommand extends BaseCommand {
  public readonly meta = {
    name: 'ping',
    description: 'Check the bot\'s latency',
    category: 'util',
    cooldown: 3,
  };

  async execute(context: CommandContext): Promise<void> {
    const { api, interaction } = context;
    const start = Date.now();

    // Send initial response using API from context
    await api.interactions.reply(interaction.id, interaction.token, {
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

    await api.interactions.editReply(
      interaction.application_id,
      interaction.token,
      {
        content: '',
        embeds: [embed],
      }
    );
  }
}
