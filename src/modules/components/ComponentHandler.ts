import { logger } from "#core/Logger.js";
import type { BaseComponent } from "./BaseComponent.js";
import { componentRegistry } from "./ComponentRegistry.js";

/**
 * ComponentHandler - Factory pattern for managing Discord components
 * Handles registration and dispatch of buttons, select menus, and other components
 */
export class ComponentHandler {
  private static instance: ComponentHandler;
  private components = new Map<string, BaseComponent>();

  private constructor() {}

  public static getInstance(): ComponentHandler {
    if (!ComponentHandler.instance) {
      ComponentHandler.instance = new ComponentHandler();
    }
    return ComponentHandler.instance;
  }

  /**
   * Register a component
   */
  public register(component: BaseComponent): void {
    const id = component.getCustomId();
    
    if (this.components.has(id)) {
      logger.warn({ componentId: id }, "Component already registered, overwriting");
    }

    this.components.set(id, component);
    logger.info({ componentId: id, type: component.getType() }, "Component registered");
  }

  /**
   * Unregister a component
   */
  public unregister(customId: string): void {
    if (this.components.delete(customId)) {
      logger.info({ componentId: customId }, "Component unregistered");
    }
  }

  /**
   * Dispatch component interaction to registered handler
   * First checks persistent components (ComponentRegistry), then dynamic components
   */
  public async dispatch(customId: string, context: ComponentContext): Promise<void> {
    // First, try to get from persistent registry (pass context for factories)
    let component = componentRegistry.get(customId, context);

    // If not found in persistent registry, try dynamic components
    if (!component) {
      component = this.components.get(customId);
    }

    if (!component) {
      logger.warn({ customId }, "No component handler found for customId");
      return;
    }

    try {
      await component.executeWithValidation(context);
      logger.debug({ customId, type: component.getType() }, "Component executed successfully");
    } catch (error) {
      logger.error({ error, customId, type: component.getType() }, "Component execution failed");
      
      // Send error response to user
      try {
        await context.api.interactions.reply(context.interaction.id, context.interaction.token, {
          content: "❌ An error occurred while processing this interaction.",
          flags: 64, // Ephemeral
        });
      } catch (replyError) {
        logger.error({ replyError }, "Failed to send error response");
      }
    }
  }

  /**
   * Get all registered components
   */
  public getAll(): Map<string, BaseComponent> {
    return new Map(this.components);
  }

  /**
   * Clear all components (useful for testing)
   */
  public clear(): void {
    this.components.clear();
    logger.info("All components cleared");
  }
}

/**
 * Export singleton instance
 */
export const componentHandler = ComponentHandler.getInstance();

/**
 * Component interaction context
 */
export interface ComponentContext {
  interaction: any; // APIInteraction
  api: any; // API instance
  guildId?: string;
  userId: string;
  channelId?: string;
  message?: any; // APIMessage
  customId: string;
  values?: string[]; // For select menus
  componentType: number;
  modalData?: Map<string, string>; // For modals - parsed input values
}