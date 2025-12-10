import { BaseCommand } from "#modules/commands/BaseCommand.js";
import type { CommandContext } from "#shared/types/discord.js";

export class GuildLevelCommand extends BaseCommand {
  public readonly meta = {
    name: "guild",
    description: "Guild system commands",
    category: "guild",
    dmPermission: false,
  };

  async execute(context: CommandContext): Promise<void> {
    throw new Error("This command requires a subcommand");
  }
}