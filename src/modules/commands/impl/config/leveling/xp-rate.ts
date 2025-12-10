import { BaseCommand } from "#modules/commands/BaseCommand.js";
import type { CommandContext } from "#shared/types/discord.js";
import { ApplicationCommandOptionType } from "@discordjs/core";
import { EmbedBuilder, Colors } from "#shared/utils/embed.js";
import { container } from "#core/Container.js";
import { GuildRepository } from "#infrastructure/database/repositories/GuildRepository.js";

export class LevelingXpRateSubcommand extends BaseCommand {
  public readonly meta = {
    name: "xp-rate",
    description: "Set XP gained per message and cooldown",
    category: "config",
  };

  protected getOptions() {
    return [
      {
        type: ApplicationCommandOptionType.Integer,
        name: "xp-per-message",
        description: "XP gained per message (1-50)",
        required: true,
        min_value: 1,
        max_value: 50,
      },
      {
        type: ApplicationCommandOptionType.Integer,
        name: "cooldown",
        description: "Cooldown in seconds between XP gains (10-300)",
        required: true,
        min_value: 10,
        max_value: 300,
      },
    ];
  }

  async execute(context: CommandContext): Promise<void> {
    const { api, interaction, options, guildId } = context;
    const xpPerMessage = options.get("xp-per-message") as number;
    const cooldown = options.get("cooldown") as number;

    const guildRepo = await container.resolve<GuildRepository>("GuildRepository");
    const config = await guildRepo.upsertLevelingConfig(guildId, { 
      xpPerMessage, 
      xpCooldown: cooldown 
    });

    const embed = new EmbedBuilder()
      .setTitle("⚙️ XP Configuration")
      .setDescription("XP settings updated successfully")
      .addField("XP per Message", config.xpPerMessage.toString(), true)
      .addField("Cooldown", `${config.xpCooldown} seconds`, true)
      .setColor(Colors.Blue)
      .setTimestamp()
      .toJSON();

    await api.interactions.reply(interaction.id, interaction.token, {
      embeds: [embed],
    });
  }
}