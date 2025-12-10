import { REST } from '@discordjs/rest';
import { API, Routes } from '@discordjs/core';
import type { ChatInputInteraction, CommandContext } from '../../shared/types/discord.js';
import { commandRegistry } from './CommandRegistry.js';
import { logger } from '../../core/Logger.js';
import { config } from '../../core/Config.js';
import { AppError, ErrorCode } from '../../shared/errors/AppError.js';

/**
 * Command Handler
 * Handles command registration and execution
 */
export class CommandHandler {
  private rest: REST;
  private api: API;

  constructor() {
    this.rest = new REST({ version: '10' }).setToken(config.get('DISCORD_TOKEN'));
    this.api = new API(this.rest);
  }

  /**
   * Register all commands with Discord
   */
  public async registerCommands(guildId?: string): Promise<void> {
    const commands = commandRegistry.getAll();
    const commandsJSON = commands.map(cmd => cmd.toJSON());

    logger.info({ count: commands.length, guildId }, 'Registering commands with Discord');

    try {
      if (guildId) {
        // Register guild commands (instant update for development)
        await this.api.applicationCommands.bulkOverwriteGuildCommands(
          config.get('DISCORD_CLIENT_ID'),
          guildId,
          commandsJSON
        );
        logger.info({ guildId, count: commands.length }, 'Guild commands registered');
      } else {
        // Register global commands (takes up to 1 hour to propagate)
        await this.api.applicationCommands.bulkOverwriteGlobalCommands(
          config.get('DISCORD_CLIENT_ID'),
          commandsJSON
        );
        logger.info({ count: commands.length }, 'Global commands registered');
      }
    } catch (error) {
      logger.error({ error }, 'Failed to register commands');
      throw new AppError(
        ErrorCode.INTERNAL_ERROR,
        'Failed to register commands with Discord',
        error
      );
    }
  }

  /**
   * Handle a command interaction
   */
  public async handleInteraction(interaction: ChatInputInteraction): Promise<void> {
    const commandName = interaction.data.name;
    const command = commandRegistry.get(commandName);

    if (!command) {
      logger.warn({ commandName }, 'Command not found');
      return;
    }

    // Build command context
    const context: CommandContext = {
      interaction,
      guildId: interaction.guild_id!,
      userId: interaction.member?.user?.id || interaction.user!.id,
      channelId: interaction.channel.id,
      options: this.parseOptions(interaction),
    };

    try {
      logger.debug(
        { 
          command: commandName, 
          user: context.userId, 
          guild: context.guildId 
        },
        'Executing command'
      );

      // Route to appropriate handler (main command or subcommand)
      await command.route(context);
      
      logger.info(
        { 
          command: commandName, 
          user: context.userId, 
          guild: context.guildId 
        },
        'Command executed successfully'
      );
    } catch (error) {
      logger.error(
        { 
          error, 
          command: commandName, 
          user: context.userId 
        },
        'Command execution failed'
      );
      throw error;
    }
  }

  /**
   * Parse interaction options into a Map
   */
  private parseOptions(interaction: ChatInputInteraction): Map<string, any> {
    const options = new Map<string, any>();
    
    if (!interaction.data.options) {
      return options;
    }

    this.extractOptions(interaction.data.options, options);

    return options;
  }

  /**
   * Recursively extract options from the interaction data
   */
  private extractOptions(
    optionsList: ChatInputInteraction['data']['options'],
    options: Map<string, any>
  ): void {
    if (!optionsList) return;

    for (const option of optionsList) {
      // Check if this is a subcommand or subcommand group (types 1 and 2)
      if ('options' in option && option.options) {
        // Recursively extract nested options
        this.extractOptions(option.options, options);
      }
      
      // Check if this option has a value (regular options like string, integer, boolean, etc.)
      if ('value' in option) {
        options.set(option.name, option.value);
      }
    }
  }

  /**
   * Delete all commands (useful for cleanup)
   */
  public async deleteAllCommands(guildId?: string): Promise<void> {
    logger.warn({ guildId }, 'Deleting all commands');

    try {
      if (guildId) {
        await this.api.applicationCommands.bulkOverwriteGuildCommands(
          config.get('DISCORD_CLIENT_ID'),
          guildId,
          []
        );
        logger.info({ guildId }, 'Guild commands deleted');
      } else {
        await this.api.applicationCommands.bulkOverwriteGlobalCommands(
          config.get('DISCORD_CLIENT_ID'),
          []
        );
        logger.info('Global commands deleted');
      }
    } catch (error) {
      logger.error({ error, guildId }, 'Failed to delete commands');
      throw error;
    }
  }
}
