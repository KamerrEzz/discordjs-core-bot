import type { 
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  APIApplicationCommandOption,
  APIApplicationCommandSubcommandGroupOption,
  APIApplicationCommandSubcommandOption,
  APIApplicationCommandBasicOption,
  ApplicationCommandOptionType,
} from '@discordjs/core';
import type { ChatInputInteraction, CommandContext } from '#shared/types/discord.js';
import { logger } from '#core/Logger.js';
import { cooldownManager } from '#shared/utils/cooldown.js';
import { PermissionFlagsBits } from '@discordjs/core';

export interface CommandMetadata {
  name: string;
  description: string;
  category?: string;
  cooldown?: number; // in seconds
  permissions?: {
    user?: bigint[];
    bot?: bigint[];
  };
  dmPermission?: boolean;
  defaultMemberPermissions?: string;
}

/**
 * Base class for all commands
 */
export abstract class BaseCommand {
  public abstract readonly meta: CommandMetadata;
  
  // Subcommands and groups (can be overridden)
  protected subcommands: Map<string, BaseCommand> = new Map();
  protected subcommandGroups: Map<string, Map<string, BaseCommand>> = new Map();

  /**
   * Execute the command
   */
  abstract execute(context: CommandContext): Promise<void>;

  /**
   * Build command data for Discord API
   */
  public toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody {
    const options: APIApplicationCommandOption[] = [];

    // Add subcommand groups
    for (const [groupName, groupCommands] of this.subcommandGroups.entries()) {
      const groupOption: APIApplicationCommandSubcommandGroupOption = {
        type: 2, // Subcommand Group
        name: groupName,
        description: `${groupName} commands`,
        options: Array.from(groupCommands.values()).map(cmd => ({
          type: 1, // Subcommand
          name: cmd.meta.name,
          description: cmd.meta.description,
          options: this.getCommandOptions(cmd),
        })),
      };
      options.push(groupOption);
    }

    // Add standalone subcommands
    for (const [, subcommand] of this.subcommands.entries()) {
      const subOption: APIApplicationCommandSubcommandOption = {
        type: 1, // Subcommand
        name: subcommand.meta.name,
        description: subcommand.meta.description,
        options: this.getCommandOptions(subcommand),
      };
      options.push(subOption);
    }

    // Add main command options if no subcommands exist
    if (options.length === 0) {
      const mainOptions = this.getCommandOptions(this);
      if (mainOptions && mainOptions.length > 0) {
        options.push(...mainOptions);
      }
    }

    return {
      name: this.meta.name,
      description: this.meta.description,
      options: options.length > 0 ? options : undefined,
      dm_permission: this.meta.dmPermission ?? false,
      default_member_permissions: this.meta.defaultMemberPermissions || null,
    };
  }

  /**
   * Get options for a command (to be overridden by subclasses)
   */
  protected getCommandOptions(command: BaseCommand): APIApplicationCommandBasicOption[] | undefined {
    // Check if the command has a getOptions method (for subcommands with their own options)
    if ('getOptions' in command && typeof command.getOptions === 'function') {
      return command.getOptions();
    }
    return undefined;
  }

  /**
   * Register a subcommand
   */
  public registerSubcommand(subcommand: BaseCommand): void {
    this.subcommands.set(subcommand.meta.name, subcommand);
    logger.debug(
      { parent: this.meta.name, subcommand: subcommand.meta.name },
      'Subcommand registered'
    );
  }

  /**
   * Register a subcommand group
   */
  public registerSubcommandGroup(groupName: string, subcommand: BaseCommand): void {
    if (!this.subcommandGroups.has(groupName)) {
      this.subcommandGroups.set(groupName, new Map());
    }
    this.subcommandGroups.get(groupName)!.set(subcommand.meta.name, subcommand);
    logger.debug(
      { parent: this.meta.name, group: groupName, subcommand: subcommand.meta.name },
      'Subcommand group registered'
    );
  }

  /**
   * Route to the appropriate subcommand
   */
  public async route(context: CommandContext): Promise<void> {
    const options = context.interaction.data.options;
    
    if (!options || options.length === 0) {
      return await this.execute(context);
    }

    const firstOption = options[0];

    // Check if it's a subcommand group
    if (firstOption.type === 2) {
      const groupName = firstOption.name;
      const group = this.subcommandGroups.get(groupName);
      
      if (!group || !firstOption.options) {
        throw new Error(`Subcommand group '${groupName}' not found`);
      }

      const subcommandOption = firstOption.options[0];
      const subcommand = group.get(subcommandOption.name);
      
      if (!subcommand) {
        throw new Error(`Subcommand '${subcommandOption.name}' not found in group '${groupName}'`);
      }

      return await subcommand.execute(context);
    }

    // Check if it's a standalone subcommand
    if (firstOption.type === 1) {
      const subcommandName = firstOption.name;
      const subcommand = this.subcommands.get(subcommandName);
      
      if (!subcommand) {
        throw new Error(`Subcommand '${subcommandName}' not found`);
      }

      return await subcommand.execute(context);
    }

    // No subcommands, execute main command
    return await this.execute(context);
  }

  /**
   * Check cooldown
   */
  protected async checkCooldown(userId: string): Promise<void> {
    if (this.meta.cooldown) {
      await cooldownManager.checkCooldown(this.meta.name, userId, this.meta.cooldown);
    }
  }

  /**
   * Set cooldown
   */
  protected async setCooldown(userId: string): Promise<void> {
    if (this.meta.cooldown) {
      await cooldownManager.setCooldown(this.meta.name, userId, this.meta.cooldown);
    }
  }
}
