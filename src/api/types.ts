import { EventEmitter } from 'events';

/**
 * Generic interface for subscribing to core events.
 */
export interface EventSubscriber {
    /**
     * Attach event handlers to the given event bus.
     */
    subscribe(eventBus: EventEmitter): void;
}
