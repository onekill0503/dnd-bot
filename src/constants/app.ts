export const DEFAULT_LANGUAGE = 'en';
export const DEFAULT_SESSION_ID = 'default';
export const DEFAULT_PREFIX = '!';

export const REDIS_DEFAULT_HOST = 'localhost';
export const REDIS_DEFAULT_PORT = 6379;
export const REDIS_DEFAULT_DB = 0;

export const OPENAI_DEFAULT_ENDPOINT = 'https://api.openai.com/v1';
export const OPENAI_DEFAULT_MODEL = 'gpt-3.5-turbo';

export const DEEPSEEK_DEFAULT_ENDPOINT = 'https://api.deepseek.com';
export const DEEPSEEK_DEFAULT_MODEL = 'deepseek-chat';

export const CURRENCY_DISTRIBUTION = {
  copper: { min: 0, max: 50 },
  silver: { min: 0, max: 20 },
  electrum: { min: 0, max: 5 },
  gold: { min: 0, max: 10 },
  platinum: { min: 0, max: 2 },
};

export const SKILL_NAMES = [
  'athletics',
  'acrobatics',
  'sleightOfHand',
  'stealth',
  'arcana',
  'history',
  'investigation',
  'nature',
  'religion',
  'animalHandling',
  'insight',
  'medicine',
  'perception',
  'survival',
  'deception',
  'intimidation',
  'performance',
  'persuasion',
] as const;

export const ABILITY_SCORES = [
  'strength',
  'dexterity',
  'constitution',
  'intelligence',
  'wisdom',
  'charisma',
] as const;

export const DICE_TYPES = [
  'd4',
  'd6',
  'd8',
  'd10',
  'd12',
  'd20',
  'd100',
] as const;

export const EXPRESSION_TAGS = [
  '[whispers]',
  '[sarcastic]',
  '[excited]',
  '[angry]',
  '[sad]',
  '[fearful]',
  '[mysterious]',
  '[giggles]',
  '[laughing]',
] as const;
