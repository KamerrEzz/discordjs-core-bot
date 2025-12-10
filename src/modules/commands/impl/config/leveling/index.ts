import { BaseCommand } from "#modules/commands/BaseCommand.js";
import type { CommandContext } from "#shared/types/discord.js";
import { PermissionFlagsBits } from "@discordjs/core";

export class LevelingCommand extends BaseCommand {
  public readonly meta = {
    name: "leveling",
    description: "Configure the leveling system settings",
    category: "config",
    defaultMemberPermissions: PermissionFlagsBits.ManageGuild.toString(),
    dmPermission: false,
  };

  async execute(context: CommandContext): Promise<void> {
    throw new Error("This command requires a subcommand");
  }
}