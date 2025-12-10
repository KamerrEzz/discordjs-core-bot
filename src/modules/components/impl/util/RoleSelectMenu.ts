import { BaseSelectMenu, ComponentType } from "../../BaseSelectMenu.js";
import type { ComponentContext } from "../../ComponentHandler.js";
import { EmbedBuilder, Colors } from "#shared/utils/embed.js";
import { logger } from "#core/Logger.js";

/**
 * Role Select Menu Component
 * A reusable role selection component with validation
 */
export class RoleSelectMenu extends BaseSelectMenu {
  public readonly type = ComponentType.ROLE_SELECT;
  public readonly customId: string;
  public readonly placeholder: string;
  public readonly minValues: number;
  public readonly maxValues: number;
  private metadata?: Record<string, any>;

  constructor(
    private action: string,
    options: {
      placeholder?: string;
      minValues?: number;
      maxValues?: number;
      metadata?: Record<string, any>;
    } = {}
  ) {
    super();
    
    this.customId = `util:role-select:${action}`;
    this.placeholder = options.placeholder || "Select roles...";
    this.minValues = options.minValues ?? 1;
    this.maxValues = options.maxValues ?? 1;
    this.metadata = options.metadata;
  }

  async execute(context: ComponentContext): Promise<void> {
    const { api, interaction, userId, values } = context;

    if (!values || values.length === 0) {
      await api.interactions.reply(interaction.id, interaction.token, {
        content: "❌ No roles selected!",
        flags: 64, // Ephemeral
      });
      return;
    }

    // Validate user permissions if needed
    if (this.metadata?.requireAdmin && !this.metadata?.isAdmin) {
      await api.interactions.reply(interaction.id, interaction.token, {
        content: "❌ You don't have permission to use this select menu!",
        flags: 64, // Ephemeral
      });
      return;
    }

    // Process selected roles
    const selectedRoles = values;
    const roleMentions = selectedRoles.map((roleId: string) => `<@&${roleId}>`).join(", ");

    const embed = new EmbedBuilder()
      .setTitle("Role Selection")
      .setDescription(`<@${userId}> selected the following roles:`)
      .addField("Selected Roles", roleMentions)
      .setColor(Colors.Blue)
      .setTimestamp()
      .toJSON();

    await api.interactions.reply(interaction.id, interaction.token, {
      embeds: [embed],
    });

    // Log the selection
    logger.info({ 
      userId, 
      action: this.action, 
      selectedRoles,
      metadata: this.metadata 
    }, "Role select menu executed");

    // Execute custom action if provided
    if (this.metadata?.onSelect) {
      try {
        await this.metadata.onSelect(context, selectedRoles);
      } catch (error) {
        logger.error({ error, userId, selectedRoles }, "Custom role selection handler failed");
      }
    }
  }

  /**
   * Static factory method to create role select with common configurations
   */
  public static createForAction(
    action: string,
    config: {
      placeholder?: string;
      minRoles?: number;
      maxRoles?: number;
      requireAdmin?: boolean;
      onSelect?: (context: ComponentContext, roles: string[]) => Promise<void>;
    } = {}
  ): RoleSelectMenu {
    return new RoleSelectMenu(action, {
      placeholder: config.placeholder,
      minValues: config.minRoles,
      maxValues: config.maxRoles,
      metadata: {
        requireAdmin: config.requireAdmin,
        onSelect: config.onSelect,
      },
    });
  }
}