import { TypedEventEmitter } from '@core/events/TypedEventEmitter.js';
import type { EventMap } from '@core/events/EventMap.js';

/**
 * Generic interface for subscribing to core events.
 */
export interface EventSubscriber {
    /**
     * Attach event handlers to the given event bus.
     */
    subscribe(eventBus: TypedEventEmitter): void;
}
