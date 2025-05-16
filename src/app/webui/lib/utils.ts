import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/****
 * Combines and merges class names, resolving Tailwind CSS class conflicts.
 *
 * Accepts any number of class values, conditionally joins them, and merges Tailwind CSS classes to produce an optimized class string.
 *
 * @param inputs - Class values to combine and merge.
 * @returns A single string of merged class names.
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
