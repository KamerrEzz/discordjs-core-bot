import { BaseCommand } from "#modules/commands/BaseCommand.js";
import type { CommandContext } from "#shared/types/discord.js";
import { ApplicationCommandOptionType } from "@discordjs/core";
import { EmbedBuilder, Colors } from "#shared/utils/embed.js";
import { container } from "#core/Container.js";
import { GuildRepository } from "#infrastructure/database/repositories/GuildRepository.js";

export class LevelingResetUserSubcommand extends BaseCommand {
  public readonly meta = {
    name: "reset-user",
    description: "Reset a user's level and XP",
    category: "config",
  };

  protected getOptions() {
    return [
      {
        type: ApplicationCommandOptionType.User,
        name: "user",
        description: "The user to reset",
        required: true,
      },
    ];
  }

  async execute(context: CommandContext): Promise<void> {
    const { api, interaction, options, guildId } = context;
    const user = options.get("user") as { id: string; username: string };

    const guildRepo = await container.resolve<GuildRepository>("GuildRepository");
    
    try {
      await guildRepo.deleteLevelingUser(guildId, user.id);
      
      const embed = new EmbedBuilder()
        .setTitle("⚙️ Leveling Reset")
        .setDescription(`Successfully reset leveling data for <@${user.id}>`)
        .setColor(Colors.Green)
        .setTimestamp()
        .toJSON();

      await api.interactions.reply(interaction.id, interaction.token, {
        embeds: [embed],
      });
    } catch (error) {
      const embed = new EmbedBuilder()
        .setTitle("❌ Error")
        .setDescription("User not found in leveling system or already reset")
        .setColor(Colors.Red)
        .toJSON();

      await api.interactions.reply(interaction.id, interaction.token, {
        embeds: [embed],
      });
    }
  }
}