// Re-export all types from individual files
export * from './enums';
export * from './elevenlabs';

// Main application types
import {
  Client,
  Collection,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from 'discord.js';
import {
  PlayerStatus,
  SessionStatus,
  QuestStatus,
  ItemRarity,
  ItemType,
  SessionEndReason,
} from './enums';

export interface Command {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export interface BotClient extends Client {
  commands: Collection<string, Command>;
}

export interface PlayerCharacter {
  userId: string;
  username: string;
  name: string;
  class: string;
  race: string;
  level: number;
  background: string;
  description: string;
  stats: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };
  hitPoints: number;
  maxHitPoints: number;
  armorClass: number;
  alignment: string;
  status: PlayerStatus;
  deathSaves?: {
    successes: number;
    failures: number;
  };
  // New comprehensive systems
  skills: SkillSet;
  currency: Currency;
  inventory: InventoryItem[];
  spellSlots: SpellSlot[];
  cantrips: Cantrip[];
  spells: Spell[];
  proficiencyBonus: number;
  experiencePoints: number;
  inspiration: boolean;
  exhaustion: number;
  initiative: number;
  speed: number;
  languages: string[];
  features: string[];
  proficiencies: {
    weapons: string[];
    armor: string[];
    tools: string[];
    savingThrows: string[];
  };
}

export interface StorySession {
  sessionId: string;
  partyLevel: number;
  partySize: number;
  currentLocation: string;
  storyContext: string;
  recentEvents: string[];
  activeQuests: string[];
  npcs: string[];
  sessionHistory: string[];
  status: SessionStatus;
  players: Map<string, PlayerCharacter>;
  maxPlayers: number;
  voiceChannelId?: string;
  guildId?: string;
  playerActions: Map<string, string[]>; // Track actions by player ID
  pendingActions: Map<
    string,
    { action: string; diceResults?: string; timestamp: number }
  >; // Track pending actions
  language: string; // Selected language for the session
  // Enhanced story context tracking
  storySummary: string; // Current story summary
  currentScene: string; // Current scene description
  importantEvents: string[]; // Important story events that should be remembered
  npcInteractions: Map<string, string[]>; // NPC interactions by NPC name
  questProgress: Map<string, { status: QuestStatus; progress: string }>; // Quest tracking
  environmentalState: Map<string, string>; // Environmental changes and state
  lastStoryBeat: string; // Last major story beat
  sessionRound: number; // Current round number for tracking progression
}

export interface Currency {
  copper: number;
  silver: number;
  electrum: number;
  gold: number;
  platinum: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  quantity: number;
  weight: number;
  value: number;
  rarity: ItemRarity;
  type: ItemType;
  properties?: string[];
  attunement?: boolean;
  equipped?: boolean;
}

export interface SkillSet {
  athletics: { proficient: boolean; modifier: number };
  acrobatics: { proficient: boolean; modifier: number };
  sleightOfHand: { proficient: boolean; modifier: number };
  stealth: { proficient: boolean; modifier: number };
  arcana: { proficient: boolean; modifier: number };
  history: { proficient: boolean; modifier: number };
  investigation: { proficient: boolean; modifier: number };
  nature: { proficient: boolean; modifier: number };
  religion: { proficient: boolean; modifier: number };
  animalHandling: { proficient: boolean; modifier: number };
  insight: { proficient: boolean; modifier: number };
  medicine: { proficient: boolean; modifier: number };
  perception: { proficient: boolean; modifier: number };
  survival: { proficient: boolean; modifier: number };
  deception: { proficient: boolean; modifier: number };
  intimidation: { proficient: boolean; modifier: number };
  performance: { proficient: boolean; modifier: number };
  persuasion: { proficient: boolean; modifier: number };
}

export interface SpellSlot {
  level: number;
  total: number;
  used: number;
  available: number;
}

export interface Cantrip {
  name: string;
  school: string;
  castingTime: string;
  range: string;
  components: string[];
  duration: string;
  description: string;
  level: number;
}

export interface Spell {
  name: string;
  school: string;
  level: number;
  castingTime: string;
  range: string;
  components: string[];
  duration: string;
  description: string;
  prepared: boolean;
  ritual: boolean;
}

export interface DiceRoll {
  result: number;
  rolls: number[];
  modifier: number;
  total: number;
  notation: string;
}

export interface AutomaticDiceRoll {
  action: string;
  diceType: string;
  modifier: number;
  difficultyClass?: number;
  success: boolean;
  criticalSuccess?: boolean;
  criticalFailure?: boolean;
  roll: DiceRoll;
}

export interface PlayerDeathEvent {
  playerId: string;
  characterName: string;
  cause: string;
  timestamp: number;
}

export interface SessionEndEvent {
  reason: SessionEndReason;
  deadPlayers: PlayerDeathEvent[];
  timestamp: number;
}

export interface ActionAnalysis {
  requiresRoll: boolean;
  diceType: string;
  modifier: number;
  difficultyClass?: number;
  skillCheck?: string;
  savingThrow?: string;
  attackRoll?: boolean;
  damageRoll?: string;
}
