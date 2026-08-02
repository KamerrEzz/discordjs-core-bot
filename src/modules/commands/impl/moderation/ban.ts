import { BaseCommand } from '#modules/commands/BaseCommand.js';
import type { CommandContext } from '#shared/types/discord.js';
import type { APIApplicationCommandBasicOption } from '@discordjs/core';
import { ApplicationCommandOptionType, PermissionFlagsBits } from '@discordjs/core';
import { EmbedBuilder, Colors } from '#shared/utils/embed.js';
import { logger } from '#core/Logger.js';

export class BanCommand extends BaseCommand {
  public readonly meta = {
    name: 'ban',
    description: 'Ban a member from the server',
    category: 'moderation',
    defaultMemberPermissions: PermissionFlagsBits.BanMembers.toString(),
  };

  public getOptions(): APIApplicationCommandBasicOption[] {
    return [
      {
        type: ApplicationCommandOptionType.User,
        name: 'user',
        description: 'The member to ban',
        required: true,
      },
      {
        type: ApplicationCommandOptionType.String,
        name: 'reason',
        description: 'Reason for the ban',
        required: false,
      },
    ];
  }

  async execute(context: CommandContext): Promise<void> {
    const { api, interaction, options, guildId, userId } = context;

    const targetUserId = options.get('user') as string | undefined;
    const reason = options.get('reason') as string | undefined;

    if (!targetUserId) {
      await api.interactions.reply(interaction.id, interaction.token, {
        embeds: [
          new EmbedBuilder()
            .setTitle('❌ Ban Failed')
            .setDescription('Please specify a valid member to ban.')
            .setColor(Colors.Red)
            .toJSON(),
        ],
      });
      return;
    }

    if (targetUserId === userId) {
      await api.interactions.reply(interaction.id, interaction.token, {
        embeds: [
          new EmbedBuilder()
            .setTitle('❌ Ban Failed')
            .setDescription('You cannot ban yourself.')
            .setColor(Colors.Red)
            .toJSON(),
        ],
      });
      return;
    }

    try {
      await api.guilds.banUser(guildId, targetUserId, {}, { reason });

      await api.interactions.reply(interaction.id, interaction.token, {
        embeds: [
          new EmbedBuilder()
            .setTitle('🔨 Member Banned')
            .setDescription(`<@${targetUserId}> has been banned.`)
            .setColor(Colors.Green)
            .addField('Reason', reason ?? 'No reason provided', false)
            .setTimestamp()
            .toJSON(),
        ],
      });

      logger.info({ guildId, targetUserId, reason }, 'Member banned');
    } catch (error) {
      logger.error({ error, guildId, targetUserId }, 'Failed to ban member');
      await api.interactions.reply(interaction.id, interaction.token, {
        embeds: [
          new EmbedBuilder()
            .setTitle('❌ Ban Failed')
            .setDescription('An error occurred while trying to ban this member.')
            .setColor(Colors.Red)
            .toJSON(),
        ],
      });
    }
  }
}
