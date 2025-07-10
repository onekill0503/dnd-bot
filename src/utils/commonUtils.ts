import { DEFAULT_LANGUAGE, DEFAULT_SESSION_ID } from '../constants/app';

/**
 * Generate a random number between min and max (inclusive)
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate a random float between min and max
 */
export function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * Get a random element from an array
 */
export function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Get multiple random elements from an array
 */
export function randomElements<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

/**
 * Calculate modifier from ability score
 */
export function calculateModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/**
 * Roll a dice with the specified number of sides
 */
export function rollDice(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

/**
 * Roll multiple dice and return the sum
 */
export function rollDiceMultiple(count: number, sides: number): number {
  let total = 0;
  for (let i = 0; i < count; i++) {
    total += rollDice(sides);
  }
  return total;
}

/**
 * Parse dice notation (e.g., "2d6+3")
 */
export function parseDiceNotation(notation: string): {
  count: number;
  sides: number;
  modifier: number;
} {
  const match = notation.match(/^(\d+)d(\d+)([+-]\d+)?$/);
  if (!match) {
    throw new Error(`Invalid dice notation: ${notation}`);
  }

  const count = parseInt(match[1]);
  const sides = parseInt(match[2]);
  const modifier = match[3] ? parseInt(match[3]) : 0;

  return { count, sides, modifier };
}

/**
 * Roll dice using notation (e.g., "2d6+3")
 */
export function rollDiceNotation(notation: string): {
  result: number;
  rolls: number[];
  modifier: number;
  total: number;
  notation: string;
} {
  const { count, sides, modifier } = parseDiceNotation(notation);
  const rolls: number[] = [];

  for (let i = 0; i < count; i++) {
    rolls.push(rollDice(sides));
  }

  const result = rolls.reduce((sum, roll) => sum + roll, 0);
  const total = result + modifier;

  return { result, rolls, modifier, total, notation };
}

/**
 * Format currency for display
 */
export function formatCurrency(currency: {
  copper: number;
  silver: number;
  electrum: number;
  gold: number;
  platinum: number;
}): string {
  const parts: string[] = [];

  if (currency.platinum > 0) parts.push(`${currency.platinum}pp`);
  if (currency.gold > 0) parts.push(`${currency.gold}gp`);
  if (currency.electrum > 0) parts.push(`${currency.electrum}ep`);
  if (currency.silver > 0) parts.push(`${currency.silver}sp`);
  if (currency.copper > 0) parts.push(`${currency.copper}cp`);

  return parts.length > 0 ? parts.join(' ') : '0cp';
}

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get default language if none provided
 */
export function getDefaultLanguage(language?: string): string {
  return language || DEFAULT_LANGUAGE;
}

/**
 * Get default session ID if none provided
 */
export function getDefaultSessionId(sessionId?: string): string {
  return sessionId || DEFAULT_SESSION_ID;
}

/**
 * Check if a string is a valid UUID
 */
export function isValidUUID(str: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Debounce a function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle a function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
