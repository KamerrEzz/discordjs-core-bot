import { BaseCommand } from "#modules/commands/BaseCommand.js";
import type { CommandContext } from "#shared/types/discord.js";
import { ApplicationCommandOptionType } from "@discordjs/core";
import type { APIApplicationCommandBasicOption } from "@discordjs/core";
import { EmbedBuilder, Colors } from "#shared/utils/embed.js";
import { container } from "#core/Container.js";
import { GuildRepository } from "#infrastructure/database/repositories/GuildRepository.js";

export class GuildLevelShowCommand extends BaseCommand {
  public readonly meta = {
    name: "show",
    description: "Show your or another user's level and XP",
    category: "guild",
    dmPermission: false,
  };

  protected getOptions() {
    return [
      {
        type: ApplicationCommandOptionType.User,
        name: "user",
        description: "User to check (defaults to you)",
        required: false,
      },
    ] as APIApplicationCommandBasicOption[];
  }

  async execute(context: CommandContext): Promise<void> {
    const { api, interaction, options, guildId, userId } = context;
    const targetUser = options.get("user") as { id: string; username: string } | undefined;
    const targetUserId = targetUser?.id || userId;

    const guildRepo = await container.resolve<GuildRepository>("GuildRepository");
    
    // Verificar si el sistema está habilitado
    const config = await guildRepo.findLevelingConfig(guildId);
    if (!config?.enabled) {
      const embed = new EmbedBuilder()
        .setTitle("❌ Leveling System Disabled")
        .setDescription("The leveling system is not enabled in this server.")
        .setColor(Colors.Red)
        .toJSON();

      await api.interactions.reply(interaction.id, interaction.token, {
        embeds: [embed],
      });
      return;
    }

    const userLevel = await guildRepo.findOrCreateLevelingUser(guildId, targetUserId);
    
    // Calcular progreso al siguiente nivel
    const currentLevel = userLevel.level;
    const xpForCurrentLevel = 100 * currentLevel * currentLevel;
    const xpForNextLevel = 100 * (currentLevel + 1) * (currentLevel + 1);
    const xpInLevel = userLevel.xp - xpForCurrentLevel;
    const xpNeededForNext = xpForNextLevel - xpForCurrentLevel;
    
    const progress = Math.floor((xpInLevel / xpNeededForNext) * 100);
    const progressBar = "█".repeat(Math.floor(progress / 10)) + "░".repeat(10 - Math.floor(progress / 10));

    const embed = new EmbedBuilder()
      .setTitle(`📊 ${targetUser ? `${targetUser.username}'s` : "Your"} Level Stats`)
      .setDescription(`<@${targetUserId}>`)
      .addField("Level", currentLevel.toString(), true)
      .addField("Total XP", userLevel.xp.toLocaleString(), true)
      .addField("Progress to Next Level", `${progressBar} ${progress}%\n${xpInLevel}/${xpNeededForNext} XP`, false)
      .setColor(Colors.Blue)
      .setTimestamp()
      .toJSON();

    await api.interactions.reply(interaction.id, interaction.token, {
      embeds: [embed],
    });
  }
}