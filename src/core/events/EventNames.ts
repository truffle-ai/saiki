import type { EventMap } from './EventMap.js';

export type EventName = keyof EventMap;

/**
 * List of all event names in the EventMap.
 * This is used to ensure type safety when emitting events.
 * can be used for doc/code-gen or for subscribers
 */
export const EventNames: readonly EventName[] = Object.freeze(
    Object.keys({} as EventMap) as EventName[]
);
