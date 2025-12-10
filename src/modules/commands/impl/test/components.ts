import { BaseCommand } from "#modules/commands/BaseCommand.js";
import type { CommandContext } from "#shared/types/discord.js";
import { ApplicationCommandOptionType } from "@discordjs/core";
import { EmbedBuilder, Colors } from "#shared/utils/embed.js";
import { componentManager } from "#modules/components/ComponentManager.js";
import { ConfirmButton } from "#modules/components/impl/util/ConfirmButton.js";
import { RoleSelectMenu } from "#modules/components/impl/util/RoleSelectMenu.js";
import { BaseButton } from "#modules/components/BaseButton.js";
import { BaseSelectMenu, ComponentType } from "#modules/components/BaseSelectMenu.js";
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
          { name: "String Select Menus", value: "string-selects" },
          { name: "Role Select Menus", value: "role-selects" },
          { name: "Mixed Components", value: "mixed" },
          { name: "Modal Demo", value: "modal" },
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
      
      case "string-selects":
        await this.testStringSelects(api, interaction, userId);
        break;
      
      case "role-selects":
        await this.testRoleSelects(api, interaction, userId);
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
    const confirmButton = new ConfirmButton("test-success", "success", { originalUserId: userId });
    const cancelButton = new ConfirmButton("test-danger", "danger", { originalUserId: userId });

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

  private async testStringSelects(api: any, interaction: any, userId: string): Promise<void> {
    // Create string select menu
    const stringSelect = new TestSelectMenu();

    // Register component
    componentManager.registerComponent(stringSelect);

    const embed = new EmbedBuilder()
      .setTitle("📋 String Select Menu Test")
      .setDescription("Use the select menu below to choose from predefined options.")
      .setColor(Colors.Green)
      .setTimestamp()
      .toJSON();

    const selectRow = stringSelect.build();

    await api.interactions.reply(interaction.id, interaction.token, {
      embeds: [embed],
      components: [{ type: 1, components: [selectRow] }],
    });
  }

  private async testRoleSelects(api: any, interaction: any, userId: string): Promise<void> {
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
      .setTitle("� Role Select Menu Test")
      .setDescription("Use the select menu below to choose roles from this server.")
      .setColor(Colors.Blue)
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
    const stringSelect = new TestSelectMenu();

    // Register all components
    componentManager.registerComponent(primaryButton);
    componentManager.registerComponent(secondaryButton);
    componentManager.registerComponent(stringSelect);

    const embed = new EmbedBuilder()
      .setTitle("🎯 Mixed Components Test")
      .setDescription("Test buttons and string select menus together.")
      .setColor(Colors.Purple)
      .setTimestamp()
      .toJSON();

    const buttonRow = BaseButton.createRow(primaryButton, secondaryButton);
    const selectRow = { type: 1, components: [stringSelect.build()] };

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

/**
 * Test String Select Menu Component
 */
class TestSelectMenu extends BaseSelectMenu {
  public readonly type = ComponentType.STRING_SELECT;
  public readonly customId = "test:string-select:demo";
  public readonly placeholder = "Choose an option...";
  public readonly minValues = 1;
  public readonly maxValues = 1;

  public readonly options = [
    { label: "🎮 Games", value: "games", description: "Gaming related options" },
    { label: "🎵 Music", value: "music", description: "Music and audio" },
    { label: "📚 Books", value: "books", description: "Reading and literature" },
    { label: "🎨 Art", value: "art", description: "Creative and artistic" },
    { label: "⚽ Sports", value: "sports", description: "Sports and fitness" },
  ];

  async execute(context: ComponentContext): Promise<void> {
    const { api, interaction, userId, values } = context;

    if (!values || values.length === 0) {
      await api.interactions.reply(interaction.id, interaction.token, {
        content: "❌ No option selected!",
        flags: 64, // Ephemeral
      });
      return;
    }

    const selectedValue = values[0];
    const selectedOption = this.options.find(opt => opt.value === selectedValue);

    const embed = new EmbedBuilder()
      .setTitle("🎯 Option Selected!")
      .setDescription(`<@${userId}> selected: **${selectedOption?.label || selectedValue}**`)
      .addField("Category", selectedOption?.description || "No description")
      .setColor(Colors.Green)
      .setTimestamp()
      .toJSON();

    await api.interactions.reply(interaction.id, interaction.token, {
      embeds: [embed],
      flags: 64, // Ephemeral
    });

    logger.info({ userId, selectedValue, selectedOption }, "String select menu used");
  }
}