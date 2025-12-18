import { BaseComponent, ComponentType } from "./BaseComponent.js";
import type { ComponentContext } from "./ComponentHandler.js";

/**
 * Modal text input component
 */
export interface ModalTextInput {
  customId: string;
  label: string;
  style: TextInputStyle;
  placeholder?: string;
  value?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
}

/**
 * Text input styles
 */
export enum TextInputStyle {
  Short = 1,    // Single-line input
  Paragraph = 2, // Multi-line input
}

/**
 * Base class for modal components
 * Modals are forms that appear when triggered by buttons or commands
 */
export abstract class BaseModal extends BaseComponent {
  public readonly type = ComponentType.MODAL;

  /**
   * Modal title (max 45 characters)
   */
  public abstract readonly title: string;

  /**
   * Modal text inputs (max 5 inputs)
   */
  public abstract readonly inputs: ModalTextInput[];

  /**
   * Validate modal submissions
   */
  public async validate(context: ComponentContext): Promise<boolean> {
    // Basic validation - ensure it's a modal interaction
    if (context.componentType !== ComponentType.MODAL) {
      return false;
    }

    // Validate inputs count
    if (this.inputs.length === 0 || this.inputs.length > 5) {
      return false;
    }

    // Validate title length
    if (this.title.length === 0 || this.title.length > 45) {
      return false;
    }

    return true;
  }

  /**
   * Build the modal component for Discord API
   */
  public build(): any {
    const components: any[] = [];

    // Build text input components
    for (const input of this.inputs) {
      const textInput: any = {
        type: 4, // TextInput component type
        custom_id: input.customId,
        label: input.label,
        style: input.style,
        required: input.required ?? false,
      };

      if (input.placeholder) {
        textInput.placeholder = input.placeholder;
      }

      if (input.value !== undefined) {
        textInput.value = input.value;
      }

      if (input.minLength !== undefined) {
        textInput.min_length = input.minLength;
      }

      if (input.maxLength !== undefined) {
        textInput.max_length = input.maxLength;
      }

      // Wrap in ActionRow
      components.push({
        type: 1, // ActionRow
        components: [textInput],
      });
    }

    return {
      title: this.title,
      custom_id: this.customId,
      components,
    };
  }

  /**
   * Parse modal submission data into a Map
   */
  public static parseModalData(components: any[]): Map<string, string> {
    const data = new Map<string, string>();

    for (const row of components) {
      if (row.type === 1 && row.components) {
        // ActionRow
        for (const component of row.components) {
          if (component.type === 4) {
            // TextInput
            data.set(component.custom_id, component.value || "");
          }
        }
      }
    }

    return data;
  }
}

