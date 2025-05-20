import { TypedEventEmitter } from './TypedEventEmitter.js';
import { EventMap } from './EventMap.js';
/**
 * Global shared event bus (Node.js built-in EventEmitter).
 */
export const eventBus = new TypedEventEmitter();
