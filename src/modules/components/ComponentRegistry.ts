import type { BaseComponent } from './BaseComponent.js';
import type { ComponentFactory } from './ComponentFactory.js';
import { logger } from '#core/Logger.js';

/**
 * Component Registry
 * Stores all registered persistent components and factories
 * Similar to CommandRegistry, but for components that should persist across bot restarts
 */
export class ComponentRegistry {
  private components = new Map<string, BaseComponent>();
  private factories = new Map<string, ComponentFactory<BaseComponent>>();

  /**
   * Register a persistent component
   * Use this for components with fixed customId that should always be available
   */
  public register(component: BaseComponent): void {
    const customId = component.getCustomId();
    
    if (this.components.has(customId)) {
      logger.warn({ customId }, 'Component already registered, overwriting');
    }

    this.components.set(customId, component);
    logger.info({ customId, type: component.getType() }, 'Persistent component registered');
  }

  /**
   * Register a component factory
   * Use this for components that need dynamic parameters but should persist
   * The factory will create instances based on customId patterns
   */
  public registerFactory(factory: ComponentFactory<BaseComponent>): void {
    const pattern = factory.getPattern();
    
    if (this.factories.has(pattern)) {
      logger.warn({ pattern }, 'Factory already registered, overwriting');
    }

    this.factories.set(pattern, factory);
    logger.info({ pattern }, 'Component factory registered');
  }

  /**
   * Get a component by customId
   * First checks direct components, then tries factories
   * @param customId - The component customId
   * @param context - Optional context to pass to factory when creating component
   */
  public get(customId: string, context?: any): BaseComponent | null {
    // Check direct components first
    const component = this.components.get(customId);
    if (component) {
      return component;
    }

    // Try factories
    for (const factory of this.factories.values()) {
      if (factory.canHandle(customId)) {
        try {
          return factory.create(customId, context);
        } catch (error) {
          logger.error({ error, customId }, 'Failed to create component from factory');
          return null;
        }
      }
    }

    return null;
  }

  /**
   * Check if a component or factory exists for the given customId
   */
  public has(customId: string): boolean {
    if (this.components.has(customId)) {
      return true;
    }

    for (const factory of this.factories.values()) {
      if (factory.canHandle(customId)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get all registered components
   */
  public getAll(): BaseComponent[] {
    return Array.from(this.components.values());
  }

  /**
   * Get all registered factories
   */
  public getAllFactories(): ComponentFactory<BaseComponent>[] {
    return Array.from(this.factories.values());
  }

  /**
   * Clear all components and factories
   */
  public clear(): void {
    this.components.clear();
    this.factories.clear();
    logger.info('Component registry cleared');
  }

  /**
   * Get component count
   */
  public get size(): number {
    return this.components.size;
  }

  /**
   * Get factory count
   */
  public get factoryCount(): number {
    return this.factories.size;
  }
}

export const componentRegistry = new ComponentRegistry();

