import type { API } from '@discordjs/core';
import type { BaseEvent, EventContext } from './BaseEvent.js';
import { logger } from '../../core/Logger.js';

/**
 * Event Handler
 * Manages event registration and dispatching
 * Now passes { data, api, shardId } context to events
 */
export class EventHandler {
  private events = new Map<string, BaseEvent[]>();

  /**
   * Register an event
   */
  public register(event: BaseEvent): void {
    const eventName = event.name;
    
    if (!this.events.has(eventName)) {
      this.events.set(eventName, []);
    }

    this.events.get(eventName)!.push(event);
    logger.info(
      { 
        event: eventName, 
        once: event.once 
      },
      'Event registered'
    );
  }

  /**
   * Dispatch an event with full context from @discordjs/core Client
   * @param eventName - The event name (e.g., 'INTERACTION_CREATE')
   * @param context - The full event context { data, api, shardId }
   */
  public async dispatch<T = any>(eventName: string, context: EventContext<T>): Promise<void> {
    const handlers = this.events.get(eventName);

    if (!handlers || handlers.length === 0) {
      return;
    }

    logger.debug({ event: eventName }, 'Dispatching event');

    // Execute all handlers for this event, passing the full context
    const promises = handlers.map(handler => handler.handle(context));
    await Promise.all(promises);

    // Remove 'once' handlers after execution
    const remainingHandlers = handlers.filter(h => !h.once);
    if (remainingHandlers.length !== handlers.length) {
      this.events.set(eventName, remainingHandlers);
    }
  }

  /**
   * Remove all handlers for an event
   */
  public removeEvent(eventName: string): void {
    this.events.delete(eventName);
    logger.debug({ event: eventName }, 'Event handlers removed');
  }

  /**
   * Clear all events
   */
  public clear(): void {
    this.events.clear();
    logger.info('Event handler cleared');
  }

  /**
   * Get all registered event names
   */
  public getEventNames(): string[] {
    return Array.from(this.events.keys());
  }

  /**
   * Get handler count for an event
   */
  public getHandlerCount(eventName: string): number {
    return this.events.get(eventName)?.length || 0;
  }
}

export const eventHandler = new EventHandler();
