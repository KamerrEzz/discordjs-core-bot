import type { ComponentContext } from "./ComponentHandler.js";
import { logger } from "#core/Logger.js";

/**
 * Base class for all Discord components (buttons, select menus, etc.)
 * Follows SOLID principles - each component has a single responsibility
 */
export abstract class BaseComponent {
  /**
   * Unique identifier for this component type
   * Format: "namespace:componentId"
   * Example: "leveling:claim-reward", "ticket:close-btn"
   */
  public abstract readonly customId: string;

  /**
   * Component type for validation
   */
  public abstract readonly type: ComponentType;

  /**
   * Optional timeout in milliseconds (auto-unregister after timeout)
   */
  public readonly timeout?: number;

  /**
   * Whether this component can only be used once
   */
  public readonly once: boolean = false;

  /**
   * Execute the component logic
   */
  public abstract execute(context: ComponentContext): Promise<void>;

  /**
   * Optional validation before execution
   * Return false to prevent execution
   */
  public async validate(context: ComponentContext): Promise<boolean> {
    return true;
  }

  /**
   * Optional cleanup after execution (especially for once components)
   */
  public async cleanup(): Promise<void> {
    // Override in subclasses if needed
  }

  /**
   * Get the full customId with namespace
   */
  public getCustomId(): string {
    return this.customId;
  }

  /**
   * Get component type
   */
  public getType(): ComponentType {
    return this.type;
  }

  /**
   * Execute with validation and error handling
   */
  public async executeWithValidation(context: ComponentContext): Promise<void> {
    try {
      // Validate before execution
      const isValid = await this.validate(context);
      if (!isValid) {
        logger.debug({ customId: this.customId }, "Component validation failed");
        return;
      }

      // Execute main logic
      await this.execute(context);

      // Cleanup if needed
      if (this.once) {
        await this.cleanup();
      }

      logger.debug({ customId: this.customId }, "Component executed successfully");
    } catch (error) {
      logger.error({ error, customId: this.customId }, "Component execution failed");
      throw error;
    }
  }
}

/**
 * Component types supported
 */
export enum ComponentType {
  BUTTON = 2,
  SELECT_MENU = 3,
  STRING_SELECT = 3,
  USER_SELECT = 5,
  ROLE_SELECT = 6,
  MENTIONABLE_SELECT = 7,
  CHANNEL_SELECT = 8,
}