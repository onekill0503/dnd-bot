import type { DiceRoll } from '../types';

export class DiceRoller {
  /**
   * Parse dice notation (e.g., "2d6+3", "1d20-1")
   */
  static parseDiceNotation(notation: string): { dice: number; sides: number; modifier: number } {
    const regex = /^(\d+)d(\d+)([+-]\d+)?$/;
    const match = notation.toLowerCase().replace(/\s/g, '').match(regex);
    
    if (!match) {
      throw new Error(`Invalid dice notation: ${notation}`);
    }

    const dice = parseInt(match[1]);
    const sides = parseInt(match[2]);
    const modifier = match[3] ? parseInt(match[3]) : 0;

    return { dice, sides, modifier };
  }

  /**
   * Roll dice based on notation
   */
  static roll(notation: string): DiceRoll {
    const { dice, sides, modifier } = this.parseDiceNotation(notation);
    
    const rolls: number[] = [];
    let total = 0;

    for (let i = 0; i < dice; i++) {
      const roll = Math.floor(Math.random() * sides) + 1;
      rolls.push(roll);
      total += roll;
    }

    const finalTotal = total + modifier;

    return {
      result: finalTotal,
      rolls,
      modifier,
      total: finalTotal,
      notation,
    };
  }

  /**
   * Roll with advantage (roll 2d20, take highest)
   */
  static rollWithAdvantage(modifier: number = 0): DiceRoll {
    const roll1 = Math.floor(Math.random() * 20) + 1;
    const roll2 = Math.floor(Math.random() * 20) + 1;
    const highest = Math.max(roll1, roll2);
    const total = highest + modifier;

    return {
      result: total,
      rolls: [roll1, roll2],
      modifier,
      total,
      notation: `2d20 (advantage)${modifier >= 0 ? '+' : ''}${modifier}`,
    };
  }

  /**
   * Roll with disadvantage (roll 2d20, take lowest)
   */
  static rollWithDisadvantage(modifier: number = 0): DiceRoll {
    const roll1 = Math.floor(Math.random() * 20) + 1;
    const roll2 = Math.floor(Math.random() * 20) + 1;
    const lowest = Math.min(roll1, roll2);
    const total = lowest + modifier;

    return {
      result: total,
      rolls: [roll1, roll2],
      modifier,
      total,
      notation: `2d20 (disadvantage)${modifier >= 0 ? '+' : ''}${modifier}`,
    };
  }

  /**
   * Generate random ability scores using 4d6 drop lowest
   */
  static generateAbilityScores(): number[] {
    const scores: number[] = [];
    
    for (let i = 0; i < 6; i++) {
      const rolls = [
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
      ];
      
      // Remove lowest roll
      rolls.sort((a, b) => b - a);
      const score = rolls[0] + rolls[1] + rolls[2];
      scores.push(score);
    }
    
    return scores;
  }

  /**
   * Calculate ability modifier
   */
  static getAbilityModifier(score: number): number {
    return Math.floor((score - 10) / 2);
  }
} 