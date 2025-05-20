import { EventEmitter } from 'events';
import type { EventMap } from './EventMap.js';

/**
 * A strongly typed EventEmitter using our EventMap as the payload definitions.
 */
export class TypedEventEmitter extends EventEmitter {
    /** Emit an event with the correct argument tuple */
    emit<K extends keyof EventMap>(event: K, ...args: EventMap[K]): boolean {
        return super.emit(event as string, ...args);
    }

    /** Register a listener with the correct argument tuple */
    on<K extends keyof EventMap>(event: K, listener: (...args: EventMap[K]) => void): this {
        return super.on(event as string, listener as (...args: any[]) => void);
    }

    /** Register a one-time listener with the correct argument tuple */
    once<K extends keyof EventMap>(event: K, listener: (...args: EventMap[K]) => void): this {
        return super.once(event as string, listener as (...args: any[]) => void);
    }

    /** Remove a listener */
    off<K extends keyof EventMap>(event: K, listener: (...args: EventMap[K]) => void): this {
        return super.off(event as string, listener as (...args: any[]) => void);
    }
}
