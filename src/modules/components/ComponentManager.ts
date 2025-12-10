import { logger } from "#core/Logger.js";
import type { BaseComponent } from "./BaseComponent.js";
import { componentHandler } from "./ComponentHandler.js";

/**
 * ComponentManager - Advanced component lifecycle management
 * Handles component registration, caching, timeouts, and cleanup
 * Follows SOLID principles with single responsibility
 */
export class ComponentManager {
  private static instance: ComponentManager;
  private componentCache = new Map<string, ComponentCacheEntry<any>>();
  private cleanupInterval?: NodeJS.Timeout;
  private readonly DEFAULT_TIMEOUT = 15 * 60 * 1000; // 15 minutes
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.startCleanupInterval();
  }

  public static getInstance(): ComponentManager {
    if (!ComponentManager.instance) {
      ComponentManager.instance = new ComponentManager();
    }
    return ComponentManager.instance;
  }

  /**
   * Register a component with advanced options
   */
  public registerComponent<T extends BaseComponent>(
    component: T,
    options: ComponentOptions = {}
  ): string {
    const customId = component.getCustomId();
    const timeout = options.timeout ?? this.DEFAULT_TIMEOUT;
    const metadata = options.metadata ?? {};

    // Register with component handler
    componentHandler.register(component);

    // Cache component metadata
    const entry: ComponentCacheEntry<T> = {
      component,
      registeredAt: Date.now(),
      timeout,
      metadata,
      usageCount: 0,
      lastUsed: Date.now(),
    };

    this.componentCache.set(customId, entry);
    
    logger.info({ 
      customId, 
      timeout, 
      metadata 
    }, "Component registered with ComponentManager");

    return customId;
  }

  /**
   * Unregister a component
   */
  public unregisterComponent(customId: string): void {
    const entry = this.componentCache.get(customId);
    if (entry) {
      componentHandler.unregister(customId);
      this.componentCache.delete(customId);
      logger.info({ customId }, "Component unregistered from ComponentManager");
    }
  }

  /**
   * Get component metadata
   */
  public getComponentMetadata(customId: string): ComponentMetadata | undefined {
    const entry = this.componentCache.get(customId);
    return entry?.metadata;
  }

  /**
   * Update component metadata
   */
  public updateComponentMetadata(customId: string, metadata: ComponentMetadata): void {
    const entry = this.componentCache.get(customId);
    if (entry) {
      entry.metadata = { ...entry.metadata, ...metadata };
      entry.lastUsed = Date.now();
      entry.usageCount++;
    }
  }

  /**
   * Check if component is expired
   */
  public isComponentExpired(customId: string): boolean {
    const entry = this.componentCache.get(customId);
    if (!entry) return true;

    const now = Date.now();
    const age = now - entry.registeredAt;
    
    return age > entry.timeout;
  }

  /**
   * Generate customId with namespace and unique identifier
   */
  public generateCustomId(namespace: string, componentId: string, metadata?: ComponentMetadata): string {
    const baseId = `${namespace}:${componentId}`;
    
    if (metadata && Object.keys(metadata).length > 0) {
      const metadataHash = this.hashMetadata(metadata);
      return `${baseId}:${metadataHash}`;
    }

    return baseId;
  }

  /**
   * Parse customId to extract namespace, componentId, and metadata
   */
  public parseCustomId(customId: string): ParsedCustomId {
    const parts = customId.split(':');
    
    if (parts.length < 2) {
      throw new Error(`Invalid customId format: ${customId}`);
    }

    const namespace = parts[0];
    const componentId = parts[1];
    const metadataHash = parts[2];

    return {
      namespace,
      componentId,
      fullId: customId,
      metadataHash,
    };
  }

  /**
   * Get all registered components by namespace
   */
  public getComponentsByNamespace(namespace: string): BaseComponent[] {
    const components: BaseComponent[] = [];
    
    for (const [customId, entry] of this.componentCache.entries()) {
      const parsed = this.parseCustomId(customId);
      if (parsed.namespace === namespace) {
        components.push(entry.component as BaseComponent);
      }
    }

    return components;
  }

  /**
   * Get component statistics
   */
  public getComponentStats(customId: string): ComponentStats | undefined {
    const entry = this.componentCache.get(customId);
    if (!entry) return undefined;

    const now = Date.now();
    const age = now - entry.registeredAt;
    const timeSinceLastUse = now - entry.lastUsed;

    return {
      customId,
      usageCount: entry.usageCount,
      age,
      timeSinceLastUse,
      expired: this.isComponentExpired(customId),
      metadata: entry.metadata,
    };
  }

  /**
   * Get all component statistics
   */
  public getAllComponentStats(): ComponentStats[] {
    const stats: ComponentStats[] = [];
    
    for (const customId of this.componentCache.keys()) {
      const stat = this.getComponentStats(customId);
      if (stat) {
        stats.push(stat);
      }
    }

    return stats;
  }

  /**
   * Clean up expired components
   */
  private cleanupExpiredComponents(): void {
    let cleaned = 0;
    
    for (const [customId, entry] of this.componentCache.entries()) {
      if (this.isComponentExpired(customId)) {
        this.unregisterComponent(customId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info({ cleaned }, "Cleaned up expired components");
    }
  }

  /**
   * Start cleanup interval
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredComponents();
    }, this.CLEANUP_INTERVAL);

    logger.info({ interval: this.CLEANUP_INTERVAL }, "Component cleanup interval started");
  }

  /**
   * Stop cleanup interval (call on bot shutdown)
   */
  public stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
      logger.info("Component cleanup interval stopped");
    }
  }

  /**
   * Hash metadata for customId generation
   */
  private hashMetadata(metadata: ComponentMetadata): string {
    const sorted = Object.keys(metadata).sort().reduce((acc, key) => {
      acc[key] = metadata[key];
      return acc;
    }, {} as ComponentMetadata);

    return Buffer.from(JSON.stringify(sorted)).toString('base64').slice(0, 16);
  }
}

/**
 * Component cache entry
 */
interface ComponentCacheEntry<T extends BaseComponent> {
  component: T;
  registeredAt: number;
  timeout: number;
  metadata: ComponentMetadata;
  usageCount: number;
  lastUsed: number;
}

/**
 * Component registration options
 */
export interface ComponentOptions {
  timeout?: number;
  metadata?: ComponentMetadata;
}

/**
 * Component metadata
 */
export interface ComponentMetadata {
  [key: string]: any;
}

/**
 * Parsed customId structure
 */
export interface ParsedCustomId {
  namespace: string;
  componentId: string;
  fullId: string;
  metadataHash?: string;
}

/**
 * Component statistics
 */
export interface ComponentStats {
  customId: string;
  usageCount: number;
  age: number;
  timeSinceLastUse: number;
  expired: boolean;
  metadata?: ComponentMetadata;
}

/**
 * Export singleton instance
 */
export const componentManager = ComponentManager.getInstance();