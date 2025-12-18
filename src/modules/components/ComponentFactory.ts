import type { BaseComponent } from './BaseComponent.js';

/**
 * Component Factory Interface
 * Implementations should create component instances based on customId patterns
 * This allows components with dynamic parameters to be persistent across bot restarts
 */
export interface ComponentFactory<T extends BaseComponent> {
  /**
   * Check if this factory can handle the given customId
   */
  canHandle(customId: string): boolean;

  /**
   * Create a component instance from the customId
   * @param customId - The customId from the interaction
   * @param context - Optional context for component creation
   */
  create(customId: string, context?: any): T;

  /**
   * Get the pattern/namespace this factory handles
   * Used for registration and identification
   */
  getPattern(): string;
}

