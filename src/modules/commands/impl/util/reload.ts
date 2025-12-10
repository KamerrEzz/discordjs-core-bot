import { BaseCommand } from '../../BaseCommand.js';
import type { CommandContext } from '../../../../shared/types/discord.js';
import { PermissionFlagsBits } from '@discordjs/core';
import { commandRegistry } from '../../CommandRegistry.js';
import { logger } from '../../../../core/Logger.js';
import { EmbedBuilder, Colors } from '../../../../shared/utils/embed.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class ReloadCommand extends BaseCommand {
  public readonly meta = {
    name: 'reload',
    description: 'Reload commands from disk (Hot Reload)',
    category: 'util',
    defaultMemberPermissions: PermissionFlagsBits.Administrator.toString(),
  };

  async execute(context: CommandContext): Promise<void> {
    const { api, interaction } = context;

    await api.interactions.defer(interaction.id, interaction.token);

    try {
      // 1. Clear current registry
      commandRegistry.clear();
      
      // 2. Re-register commands (This logic is usually shared with bootstrap)
      // For this to work dynamically in ESM, we need to re-import files with cache busting
      // or rely on a more complex loader. 
      // For now, we will just re-register the static set as a demonstration of concept,
      // creating a "soft" reload which is often enough for config/logic changes if
      // the modules export factories.
      
      // In a real robust system, you would walk the `impl` directory again
      // and import(filePath + '?update=' + Date.now())
      
      // Re-registering 'this' command to ensure it persists
      commandRegistry.register(this);
      
      // NOTE: Deep hot reloading in Node ESM is experimental/complex.
      // This is a placeholder for where that logic goes.
      // Ideally, use a process manager (PM2) for zero-downtime restarts.

      await api.interactions.editReply(interaction.application_id, interaction.token, {
        embeds: [
          new EmbedBuilder()
            .setTitle('⚠️ Soft Reload')
            .setDescription('Command registry cleared. For code changes to take effect, a process restart is recommended due to ESM caching.')
            .setColor(Colors.Yellow)
            .toJSON()
        ],
      });
      
    } catch (error) {
      logger.error({ error }, 'Reload failed');
      await api.interactions.editReply(interaction.application_id, interaction.token, {
        content: 'Failed to reload commands.',
      });
    }
  }
}
