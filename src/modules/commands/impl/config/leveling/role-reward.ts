import { BaseCommand } from "#modules/commands/BaseCommand.js";
import type { CommandContext } from "#shared/types/discord.js";
import { ApplicationCommandOptionType } from "@discordjs/core";
import { EmbedBuilder, Colors } from "#shared/utils/embed.js";
import { container } from "#core/Container.js";
import { GuildRepository } from "#infrastructure/database/repositories/GuildRepository.js";

interface RoleReward {
  level: number;
  roleId: string;
}

export class LevelingRoleRewardSubcommand extends BaseCommand {
  public readonly meta = {
    name: "role-reward",
    description: "Configure role rewards for reaching levels",
    category: "config",
  };

  protected getOptions() {
    return [
      {
        type: ApplicationCommandOptionType.Integer,
        name: "level",
        description: "Level to assign role reward (1-100)",
        required: true,
        min_value: 1,
        max_value: 100,
      },
      {
        type: ApplicationCommandOptionType.Role,
        name: "role",
        description: "Role to assign (leave empty to remove)",
        required: false,
      },
    ];
  }

  async execute(context: CommandContext): Promise<void> {
    const { api, interaction, options, guildId } = context;
    const level = options.get("level") as number;
    const role = options.get("role") as { id: string; name: string } | undefined;

    const guildRepo = await container.resolve<GuildRepository>("GuildRepository");
    const config = await guildRepo.findLevelingConfig(guildId);
    
    if (!config) {
      const embed = new EmbedBuilder()
        .setTitle("❌ Error")
        .setDescription("Leveling system is not configured. Please enable it first.")
        .setColor(Colors.Red)
        .toJSON();

      await api.interactions.reply(interaction.id, interaction.token, {
        embeds: [embed],
      });
      return;
    }

    const roleRewards = ((config.roleRewards as any) || []) as RoleReward[];
    
    if (role) {
      // Agregar o actualizar recompensa
      const existingIndex = roleRewards.findIndex(r => r.level === level);
      const reward: RoleReward = { level, roleId: role.id };
      
      if (existingIndex >= 0) {
        roleRewards[existingIndex] = reward;
      } else {
        roleRewards.push(reward);
      }
      
      // Ordenar por nivel
      roleRewards.sort((a, b) => a.level - b.level);
      
      await guildRepo.upsertLevelingConfig(guildId, { roleRewards: roleRewards as any });
      
      const embed = new EmbedBuilder()
        .setTitle("⚙️ Role Reward Added")
        .setDescription(`Role <@&${role.id}> will be assigned at level ${level}`)
        .setColor(Colors.Green)
        .setTimestamp()
        .toJSON();

      await api.interactions.reply(interaction.id, interaction.token, {
        embeds: [embed],
      });
    } else {
      // Eliminar recompensa
      const filteredRewards = roleRewards.filter(r => r.level !== level);
      
      if (filteredRewards.length === roleRewards.length) {
        const embed = new EmbedBuilder()
          .setTitle("❌ Not Found")
          .setDescription(`No role reward configured for level ${level}`)
          .setColor(Colors.Red)
          .toJSON();

        await api.interactions.reply(interaction.id, interaction.token, {
          embeds: [embed],
        });
        return;
      }
      
      await guildRepo.upsertLevelingConfig(guildId, { roleRewards: filteredRewards as any });
      
      const embed = new EmbedBuilder()
        .setTitle("⚙️ Role Reward Removed")
        .setDescription(`Role reward for level ${level} has been removed`)
        .setColor(Colors.Yellow)
        .setTimestamp()
        .toJSON();

      await api.interactions.reply(interaction.id, interaction.token, {
        embeds: [embed],
      });
    }
  }
}