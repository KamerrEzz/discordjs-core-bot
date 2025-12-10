import { BaseCommand } from "#modules/commands/BaseCommand.js";
import type { CommandContext } from "#shared/types/discord.js";
import { ApplicationCommandOptionType } from "@discordjs/core";
import { EmbedBuilder, Colors } from "#shared/utils/embed.js";
import { container } from "#core/Container.js";
import { GuildRepository } from "#infrastructure/database/repositories/GuildRepository.js";

export class LevelingSetLevelSubcommand extends BaseCommand {
  public readonly meta = {
    name: "set-level",
    description: "Set a user's level and XP",
    category: "config",
  };

  protected getOptions() {
    return [
      {
        type: ApplicationCommandOptionType.User,
        name: "user",
        description: "The user to modify",
        required: true,
      },
      {
        type: ApplicationCommandOptionType.Integer,
        name: "level",
        description: "The level to set (1-100)",
        required: true,
        min_value: 1,
        max_value: 100,
      },
    ];
  }

  async execute(context: CommandContext): Promise<void> {
    const { api, interaction, options, guildId } = context;
    const user = options.get("user") as { id: string; username: string };
    const level = options.get("level") as number;

    const guildRepo = await container.resolve<GuildRepository>("GuildRepository");
    
    // Calcular XP para el nivel especificado (100 * nivel^2)
    const xp = 100 * level * level;

    try {
      await guildRepo.updateLevelingUser(guildId, user.id, { level, xp });
      
      const embed = new EmbedBuilder()
        .setTitle("⚙️ Level Set")
        .setDescription(`Successfully set <@${user.id}> to level ${level} (${xp} XP)`)
        .setColor(Colors.Green)
        .setTimestamp()
        .toJSON();

      await api.interactions.reply(interaction.id, interaction.token, {
        embeds: [embed],
      });
    } catch (error) {
      // Si el usuario no existe, crearlo
      await guildRepo.findOrCreateLevelingUser(guildId, user.id);
      await guildRepo.updateLevelingUser(guildId, user.id, { level, xp });
      
      const embed = new EmbedBuilder()
        .setTitle("⚙️ Level Set")
        .setDescription(`Successfully set <@${user.id}> to level ${level} (${xp} XP)`)
        .setColor(Colors.Green)
        .setTimestamp()
        .toJSON();

      await api.interactions.reply(interaction.id, interaction.token, {
        embeds: [embed],
      });
    }
  }
}