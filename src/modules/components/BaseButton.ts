import { BaseComponent, ComponentType } from "./BaseComponent.js";
import type { ComponentContext } from "./ComponentHandler.js";
import { ButtonStyle } from "@discordjs/core";

/**
 * Base class for button components
 * Provides common button functionality and validation
 */
export abstract class BaseButton extends BaseComponent {
  public readonly type = ComponentType.BUTTON;

  /**
   * Button style (primary, secondary, success, danger, link)
   */
  public abstract readonly style: ButtonStyle;

  /**
   * Button label text
   */
  public abstract readonly label: string;

  /**
   * Optional emoji for the button
   */
  public readonly emoji?: {
    id?: string;
    name?: string;
    animated?: boolean;
  };

  /**
   * Whether the button is disabled
   */
  public readonly disabled: boolean = false;

  /**
   * Validate button interactions
   */
  public async validate(context: ComponentContext): Promise<boolean> {
    // Basic validation - ensure it's a button interaction
    if (context.componentType !== ComponentType.BUTTON) {
      return false;
    }

    return true;
  }

  /**
   * Build the button component for Discord API
   */
  public build(): any {
    const button: any = {
      type: this.type,
      style: this.style,
      label: this.label,
      custom_id: this.customId,
      disabled: this.disabled,
    };

    if (this.emoji) {
      button.emoji = this.emoji;
    }

    return button;
  }

  /**
   * Helper to create button rows
   */
  public static createRow(...buttons: BaseButton[]): any {
    return {
      type: 1, // ActionRow
      components: buttons.map(button => button.build()),
    };
  }

  /**
   * Helper to create multiple button rows
   */
  public static createRows(buttons: BaseButton[][], rowLimit: number = 5): any[] {
    const rows: any[] = [];
    
    for (const row of buttons) {
      if (row.length > rowLimit) {
        // Split into multiple rows if needed
        for (let i = 0; i < row.length; i += rowLimit) {
          rows.push({
            type: 1, // ActionRow
            components: row.slice(i, i + rowLimit).map(button => button.build()),
          });
        }
      } else {
        rows.push({
          type: 1, // ActionRow
          components: row.map(button => button.build()),
        });
      }
    }

    return rows;
  }
}