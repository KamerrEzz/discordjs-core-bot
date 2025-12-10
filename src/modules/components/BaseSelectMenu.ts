import { BaseComponent, ComponentType } from "./BaseComponent.js";
import type { ComponentContext } from "./ComponentHandler.js";

// Re-export ComponentType for convenience
export { ComponentType };

/**
 * Base class for select menu components
 * Provides common select menu functionality and validation
 */
export abstract class BaseSelectMenu extends BaseComponent {
  public readonly type: ComponentType = ComponentType.STRING_SELECT; // Default, override in subclasses

  /**
   * Placeholder text when nothing is selected
   */
  public abstract readonly placeholder?: string;

  /**
   * Minimum number of items that must be chosen (1-25)
   */
  public readonly minValues: number = 1;

  /**
   * Maximum number of items that can be chosen (1-25)
   */
  public readonly maxValues: number = 1;

  /**
   * Whether the select menu is disabled
   */
  public readonly disabled: boolean = false;

  /**
   * Options for the select menu (for string select)
   */
  public readonly options?: SelectOption[];

  /**
   * Channel types for channel select (for channel select)
   */
  public readonly channelTypes?: string[];

  /**
   * Validate select menu interactions
   */
  public async validate(context: ComponentContext): Promise<boolean> {
    // Basic validation - ensure it's a select menu interaction
    if (context.componentType !== this.type) {
      return false;
    }

    // Validate values count
    if (context.values) {
      if (context.values.length < this.minValues || context.values.length > this.maxValues) {
        return false;
      }
    }

    return true;
  }

  /**
   * Build the select menu component for Discord API
   */
  public build(): any {
    const menu: any = {
      type: this.type,
      custom_id: this.customId,
      disabled: this.disabled,
      min_values: this.minValues,
      max_values: this.maxValues,
    };

    if (this.placeholder) {
      menu.placeholder = this.placeholder;
    }

    if (this.options && this.options.length > 0) {
      menu.options = this.options.map(option => ({
        label: option.label,
        value: option.value,
        description: option.description,
        emoji: option.emoji,
        default: option.default,
      }));
    }

    if (this.channelTypes && this.channelTypes.length > 0) {
      menu.channel_types = this.channelTypes;
    }

    return menu;
  }

  /**
   * Helper to create select menu rows
   */
  public static createRow(...menus: BaseSelectMenu[]): any {
    return {
      type: 1, // ActionRow
      components: menus.map(menu => menu.build()),
    };
  }
}

/**
 * Select menu option interface
 */
export interface SelectOption {
  label: string;
  value: string;
  description?: string;
  emoji?: {
    id?: string;
    name?: string;
    animated?: boolean;
  };
  default?: boolean;
}

/**
 * Predefined select menu types (abstract base classes)
 */
export abstract class StringSelectMenu extends BaseSelectMenu {
  public readonly type = ComponentType.STRING_SELECT;
}

export abstract class UserSelectMenu extends BaseSelectMenu {
  public readonly type = ComponentType.USER_SELECT;
}

export abstract class RoleSelectMenu extends BaseSelectMenu {
  public readonly type = ComponentType.ROLE_SELECT;
}

export abstract class ChannelSelectMenu extends BaseSelectMenu {
  public readonly type = ComponentType.CHANNEL_SELECT;
  public abstract readonly channelTypes?: string[];
}

export abstract class MentionableSelectMenu extends BaseSelectMenu {
  public readonly type = ComponentType.MENTIONABLE_SELECT;
}