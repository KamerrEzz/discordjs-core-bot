import { BaseCommand } from '#modules/commands/BaseCommand.js';
import type { CommandContext } from '#shared/types/discord.js';
import { PermissionFlagsBits } from '@discordjs/core';

/**
 * Config command (parent)
 * Subcommands and groups are auto-registered
 */
export class ConfigCommand extends BaseCommand {
  public readonly meta = {
    name: 'config',
    description: 'Configure server settings',
    category: 'config',
    defaultMemberPermissions: PermissionFlagsBits.ManageGuild.toString(),
    dmPermission: false,
  };

  async execute(context: CommandContext): Promise<void> {
    // This should not be called directly as it has subcommands
    throw new Error('Config command requires a subcommand');
  }
}
