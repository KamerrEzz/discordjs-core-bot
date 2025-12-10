import { BaseCommand } from "#modules/commands/BaseCommand.js";
import type { CommandContext } from "#shared/types/discord.js";
import { ApplicationCommandOptionType } from "@discordjs/core";
import { EmbedBuilder, Colors } from "#shared/utils/embed.js";
import { container } from "#core/Container.js";
import { GuildRepository } from "#infrastructure/database/repositories/GuildRepository.js";

export class LevelingToggleSubcommand extends BaseCommand {
  public readonly meta = {
    name: "toggle",
    description: "Enable or disable the leveling system",
    category: "config",
  };

  protected getOptions() {
    return [
      {
        type: ApplicationCommandOptionType.Boolean,
        name: "enabled",
        description: "Enable or disable leveling system",
        required: true,
      },
    ];
  }

  async execute(context: CommandContext): Promise<void> {
    const { api, interaction, options, guildId } = context;
    const enabled = options.get("enabled") as boolean;

    const guildRepo = await container.resolve<GuildRepository>("GuildRepository");
    const config = await guildRepo.upsertLevelingConfig(guildId, { enabled });

    const embed = new EmbedBuilder()
      .setTitle("⚙️ Leveling System")
      .setDescription(`Leveling system has been ${config.enabled ? "enabled" : "disabled"}`)
      .setColor(config.enabled ? Colors.Green : Colors.Red)
      .setTimestamp()
      .toJSON();

    await api.interactions.reply(interaction.id, interaction.token, {
      embeds: [embed],
    });
  }
}