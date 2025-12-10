import { logger } from './Logger.js';

type ServiceLifetime = 'singleton' | 'transient';

interface ServiceDescriptor<T = any> {
  factory: () => T | Promise<T>;
  lifetime: ServiceLifetime;
  instance?: T;
}

/**
 * Simple Dependency Injection Container
 * Supports singleton and transient service lifetimes
 */
export class Container {
  private static instance: Container;
  private services = new Map<string, ServiceDescriptor>();

  private constructor() {}

  public static getInstance(): Container {
    if (!Container.instance) {
      Container.instance = new Container();
    }
    return Container.instance;
  }

  /**
   * Register a service as a singleton
   */
  public registerSingleton<T>(
    name: string,
    factory: () => T | Promise<T>
  ): void {
    if (this.services.has(name)) {
      logger.warn({ service: name }, 'Service already registered, overwriting');
    }

    this.services.set(name, {
      factory,
      lifetime: 'singleton',
    });

    logger.debug({ service: name, lifetime: 'singleton' }, 'Service registered');
  }

  /**
   * Register a service as transient (new instance every time)
   */
  public registerTransient<T>(
    name: string,
    factory: () => T | Promise<T>
  ): void {
    if (this.services.has(name)) {
      logger.warn({ service: name }, 'Service already registered, overwriting');
    }

    this.services.set(name, {
      factory,
      lifetime: 'transient',
    });

    logger.debug({ service: name, lifetime: 'transient' }, 'Service registered');
  }

  /**
   * Resolve a service from the container
   */
  public async resolve<T>(name: string): Promise<T> {
    const descriptor = this.services.get(name);

    if (!descriptor) {
      throw new Error(`Service '${name}' not found in container`);
    }

    // For singletons, return cached instance if available
    if (descriptor.lifetime === 'singleton') {
      if (descriptor.instance) {
        return descriptor.instance as T;
      }

      const instance = await descriptor.factory();
      descriptor.instance = instance;
      logger.debug({ service: name }, 'Singleton instance created');
      return instance as T;
    }

    // For transient, always create new instance
    logger.debug({ service: name }, 'Transient instance created');
    return (await descriptor.factory()) as T;
  }

  /**
   * Resolve a service synchronously (for already-instantiated singletons)
   */
  public resolveSync<T>(name: string): T {
    const descriptor = this.services.get(name);

    if (!descriptor) {
      throw new Error(`Service '${name}' not found in container`);
    }

    if (descriptor.lifetime === 'singleton' && descriptor.instance) {
      return descriptor.instance as T;
    }

    throw new Error(
      `Service '${name}' is not available synchronously. Use resolve() instead.`
    );
  }

  /**
   * Check if a service is registered
   */
  public has(name: string): boolean {
    return this.services.has(name);
  }

  /**
   * Clear all services (useful for testing)
   */
  public clear(): void {
    this.services.clear();
    logger.debug('Container cleared');
  }

  /**
   * Get all registered service names
   */
  public getRegisteredServices(): string[] {
    return Array.from(this.services.keys());
  }
}

export const container = Container.getInstance();
