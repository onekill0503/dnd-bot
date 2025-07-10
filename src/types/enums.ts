export enum PlayerStatus {
  ALIVE = 'alive',
  DEAD = 'dead',
  UNCONSCIOUS = 'unconscious',
}

export enum SessionStatus {
  CHARACTER_CREATION = 'character_creation',
  ACTIVE = 'active',
  ENDED = 'ended',
}

export enum QuestStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum ItemRarity {
  COMMON = 'common',
  UNCOMMON = 'uncommon',
  RARE = 'rare',
  VERY_RARE = 'very rare',
  LEGENDARY = 'legendary',
}

export enum ItemType {
  WEAPON = 'weapon',
  ARMOR = 'armor',
  TOOL = 'tool',
  CONSUMABLE = 'consumable',
  TREASURE = 'treasure',
  GEAR = 'gear',
  MAGIC_ITEM = 'magic item',
}

export enum SessionEndReason {
  ALL_PLAYERS_DEAD = 'all_players_dead',
  SESSION_ENDED = 'session_ended',
  DM_ENDED = 'dm_ended',
}

export enum Environment {
  DEVELOPMENT = 'development',
  PRODUCTION = 'production',
}

export enum ElevenLabsModel {
  MULTILINGUAL_V2 = 'eleven_multilingual_v2',
  MONOLINGUAL_V1 = 'eleven_monolingual_v1',
}

export enum TtsProvider {
  ELEVEN_LABS = 'elevenlabs',
  OPENAI = 'openai',
}
