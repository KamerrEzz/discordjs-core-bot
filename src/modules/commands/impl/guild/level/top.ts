import { BaseCommand } from "#modules/commands/BaseCommand.js";
import type { CommandContext } from "#shared/types/discord.js";
import { EmbedBuilder, Colors } from "#shared/utils/embed.js";
import { container } from "#core/Container.js";
import { GuildRepository } from "#infrastructure/database/repositories/GuildRepository.js";

export class GuildLevelTopCommand extends BaseCommand {
  public readonly meta = {
    name: "top",
    description: "Show the top 10 users by level in this server",
    category: "guild",
    dmPermission: false,
  };

  async execute(context: CommandContext): Promise<void> {
    const { api, interaction, guildId } = context;

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

    const topUsers = await guildRepo.getTopLevelingUsers(guildId, 10);
    
    if (topUsers.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle("📊 Server Level Leaderboard")
        .setDescription("No users have gained XP yet. Start chatting to level up!")
        .setColor(Colors.Blue)
        .toJSON();

      await api.interactions.reply(interaction.id, interaction.token, {
        embeds: [embed],
      });
      return;
    }

    // Obtener información de los usuarios para mostrar nombres
    const userInfo = new Map<string, { username: string; discriminator: string }>();
    
    // Crear la descripción del embed
    let description = "";
    for (let i = 0; i < topUsers.length; i++) {
      const user = topUsers[i];
      const rank = i + 1;
      const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "🔸";
      
      description += `${medal} **#${rank}** <@${user.userId}>\n`;
      description += `   Level **${user.level}** • **${user.xp.toLocaleString()}** XP\n\n`;
    }

    const embed = new EmbedBuilder()
      .setTitle("📊 Server Level Leaderboard")
      .setDescription(description.trim())
      .setColor(Colors.Gold)
      .setTimestamp()
      .setFooter("Top 10 users by XP")
      .toJSON();

    await api.interactions.reply(interaction.id, interaction.token, {
      embeds: [embed],
    });
  }
}