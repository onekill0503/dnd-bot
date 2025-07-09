import { Client, Collection, ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

export interface Command {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export interface BotClient extends Client {
  commands: Collection<string, Command>;
}

export interface DnDCharacter {
  name: string;
  class: string;
  level: number;
  race: string;
  stats: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };
  hitPoints: number;
  armorClass: number;
  background: string;
  alignment: string;
}

export interface DiceRoll {
  result: number;
  rolls: number[];
  modifier: number;
  total: number;
  notation: string;
} 