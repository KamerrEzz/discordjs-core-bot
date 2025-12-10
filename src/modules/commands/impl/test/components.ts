import { BaseCommand } from "#modules/commands/BaseCommand.js";
import type { CommandContext } from "#shared/types/discord.js";
import { ApplicationCommandOptionType } from "@discordjs/core";
import { EmbedBuilder, Colors } from "#shared/utils/embed.js";
import { componentManager } from "#modules/components/ComponentManager.js";
import { ConfirmButton } from "#modules/components/impl/util/ConfirmButton.js";
import { RoleSelectMenu } from "#modules/components/impl/util/RoleSelectMenu.js";
import { BaseButton } from "#modules/components/BaseButton.js";
import { ButtonStyle } from "@discordjs/core";
import { logger } from "#core/Logger.js";
import type { ComponentContext } from "#modules/components/ComponentHandler.js";

/**
 * Test Components Command
 * Demonstrates usage of buttons and select menus
 */
export class TestComponentsCommand extends BaseCommand {
  public readonly meta = {
    name: "components",
    description: "Test Discord components (buttons and select menus)",
    category: "test",
    dmPermission: false,
    defaultMemberPermissions: "0", // Admin only
  };

  protected getOptions() {
    return [
      {
        type: ApplicationCommandOptionType.String,
        name: "type",
        description: "Type of component to test",
        required: true,
        choices: [
          { name: "Buttons", value: "buttons" },
          { name: "Select Menus", value: "selects" },
          { name: "Mixed Components", value: "mixed" },
          { name: "Component Stats", value: "stats" },
        ],
      },
    ];
  }

  async execute(context: CommandContext): Promise<void> {
    const { api, interaction, options, userId } = context;
    const type = options.get("type") as string;

    switch (type) {
      case "buttons":
        await this.testButtons(api, interaction, userId);
        break;
      
      case "selects":
        await this.testSelectMenus(api, interaction, userId);
        break;
      
      case "mixed":
        await this.testMixedComponents(api, interaction, userId);
        break;
      
      case "stats":
        await this.showComponentStats(api, interaction);
        break;
      
      default:
        await api.interactions.reply(interaction.id, interaction.token, {
          content: "❌ Invalid component type selected.",
        });
    }
  }

  private async testButtons(api: any, interaction: any, userId: string): Promise<void> {
    // Create test buttons
    const confirmButton = new ConfirmButton("test-action", "success", { originalUserId: userId });
    const cancelButton = new ConfirmButton("test-action", "danger", { originalUserId: userId });

    // Register components
    componentManager.registerComponent(confirmButton);
    componentManager.registerComponent(cancelButton);

    const embed = new EmbedBuilder()
      .setTitle("🔘 Button Components Test")
      .setDescription("Click the buttons below to test component interactions.")
      .setColor(Colors.Blue)
      .setTimestamp()
      .toJSON();

    const buttonRow = BaseButton.createRow(confirmButton, cancelButton);

    await api.interactions.reply(interaction.id, interaction.token, {
      embeds: [embed],
      components: [buttonRow],
    });
  }

  private async testSelectMenus(api: any, interaction: any, userId: string): Promise<void> {
    // Create role select menu
    const roleSelect = RoleSelectMenu.createForAction("test-roles", {
      placeholder: "Select roles for testing",
      minRoles: 1,
      maxRoles: 3,
      onSelect: async (context, roles) => {
        logger.info({ userId: context.userId, roles }, "Role selection completed");
      },
    });

    // Register component
    componentManager.registerComponent(roleSelect);

    const embed = new EmbedBuilder()
      .setTitle("📋 Select Menu Test")
      .setDescription("Use the select menu below to choose roles.")
      .setColor(Colors.Green)
      .setTimestamp()
      .toJSON();

    const selectRow = roleSelect.build();

    await api.interactions.reply(interaction.id, interaction.token, {
      embeds: [embed],
      components: [{ type: 1, components: [selectRow] }],
    });
  }

  private async testMixedComponents(api: any, interaction: any, userId: string): Promise<void> {
    // Create mixed components
    const primaryButton = new TestButton("primary", "Primary", ButtonStyle.Primary);
    const secondaryButton = new TestButton("secondary", "Secondary", ButtonStyle.Secondary);
    const roleSelect = RoleSelectMenu.createForAction("mixed-roles", {
      placeholder: "Select a role",
      minRoles: 1,
      maxRoles: 1,
    });

    // Register all components
    componentManager.registerComponent(primaryButton);
    componentManager.registerComponent(secondaryButton);
    componentManager.registerComponent(roleSelect);

    const embed = new EmbedBuilder()
      .setTitle("🎯 Mixed Components Test")
      .setDescription("Test both buttons and select menus together.")
      .setColor(Colors.Purple)
      .setTimestamp()
      .toJSON();

    const buttonRow = BaseButton.createRow(primaryButton, secondaryButton);
    const selectRow = { type: 1, components: [roleSelect.build()] };

    await api.interactions.reply(interaction.id, interaction.token, {
      embeds: [embed],
      components: [buttonRow, selectRow],
    });
  }

  private async showComponentStats(api: any, interaction: any): Promise<void> {
    const stats = componentManager.getAllComponentStats();
    
    if (stats.length === 0) {
      await api.interactions.reply(interaction.id, interaction.token, {
        content: "📊 No components are currently registered.",
      });
      return;
    }

    const description = stats.map(stat => {
      const age = Math.floor(stat.age / 1000); // Convert to seconds
      const lastUsed = Math.floor(stat.timeSinceLastUse / 1000);
      const status = stat.expired ? "❌ Expired" : "✅ Active";
      
      return `**${stat.customId}**\n` +
        `   Status: ${status}\n` +
        `   Uses: ${stat.usageCount}\n` +
        `   Age: ${age}s\n` +
        `   Last used: ${lastUsed}s ago`;
    }).join("\n\n");

    const embed = new EmbedBuilder()
      .setTitle("📊 Component Statistics")
      .setDescription(description)
      .setColor(Colors.Gold)
      .setTimestamp()
      .toJSON();

    await api.interactions.reply(interaction.id, interaction.token, {
      embeds: [embed],
    });
  }
}

/**
 * Simple test button component
 */
class TestButton extends BaseButton {
  public readonly customId: string;
  public readonly label: string;
  public readonly style: ButtonStyle;

  constructor(
    private id: string,
    label: string,
    style: ButtonStyle
  ) {
    super();
    
    this.customId = `test:button:${id}`;
    this.label = label;
    this.style = style;
  }

  async execute(context: ComponentContext): Promise<void> {
    const { api, interaction, userId } = context;

    const embed = new EmbedBuilder()
      .setTitle("Button Clicked!")
      .setDescription(`<@${userId}> clicked the ${this.label} button.`)
      .setColor(Colors.Blue)
      .setTimestamp()
      .toJSON();

    await api.interactions.reply(interaction.id, interaction.token, {
      embeds: [embed],
      flags: 64, // Ephemeral
    });
  }
}