/**
 * Utility Functions
 * Common utility functions for the app
 */

import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge Tailwind CSS classes with conditional classes
 * Combines clsx for conditional classes and tailwind-merge to handle conflicts
 * 
 * @param  {...any} inputs - Class names or conditional class objects
 * @returns {string} Merged class string
 * 
 * @example
 * cn('p-4', 'bg-red-500', isActive && 'bg-blue-500')
 * // If isActive is true, returns 'p-4 bg-blue-500'
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
