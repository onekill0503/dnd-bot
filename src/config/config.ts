import { Environment, ElevenLabsModel } from '../types/enums';
import {
  DEFAULT_PREFIX,
  REDIS_DEFAULT_HOST,
  REDIS_DEFAULT_PORT,
  REDIS_DEFAULT_DB,
  OPENAI_DEFAULT_ENDPOINT,
  OPENAI_DEFAULT_MODEL,
  DEEPSEEK_DEFAULT_ENDPOINT,
  DEEPSEEK_DEFAULT_MODEL,
} from '../constants/app';

export interface BotConfig {
  token: string;
  clientId: string;
  guildId?: string;
  openaiApiKey: string;
  prefix: string;
  environment: Environment;
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  dmAi: {
    endpoint: string;
    model: string;
    apiKey: string;
  };
  ttsAi: {
    endpoint: string;
    model: string;
    apiKey: string;
  };
  elevenLabs: {
    apiKey: string;
    enabled: boolean;
    defaultVoiceId: string;
    modelId: string;
  };
}

export const botConfig: BotConfig = {
  token: process.env.DISCORD_TOKEN || '',
  clientId: process.env.DISCORD_CLIENT_ID || '',
  guildId: process.env.DISCORD_GUILD_ID,
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  prefix: process.env.BOT_PREFIX || DEFAULT_PREFIX,
  environment: (process.env.NODE_ENV as Environment) || Environment.DEVELOPMENT,
  redis: {
    host: process.env.REDIS_HOST || REDIS_DEFAULT_HOST,
    port: parseInt(process.env.REDIS_PORT || REDIS_DEFAULT_PORT.toString()),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || REDIS_DEFAULT_DB.toString()),
  },
  dmAi: {
    endpoint: process.env.DM_AI_ENDPOINT || DEEPSEEK_DEFAULT_ENDPOINT,
    model: process.env.DM_AI_MODEL || DEEPSEEK_DEFAULT_MODEL,
    apiKey: process.env.DM_AI_API_KEY || '',
  },
  ttsAi: {
    endpoint: process.env.TTS_AI_ENDPOINT || OPENAI_DEFAULT_ENDPOINT,
    model: process.env.TTS_AI_MODEL || OPENAI_DEFAULT_MODEL,
    apiKey: process.env.TTS_AI_API_KEY || process.env.OPENAI_API_KEY || '',
  },
  elevenLabs: {
    apiKey: process.env.ELEVEN_LABS_KEY || '',
    enabled: process.env.USE_ELEVEN === 'true',
    defaultVoiceId:
      process.env.ELEVEN_LABS_DEFAULT_VOICE_ID || 'pNInz6obpgDQGcFmaJgB', // Adam voice
    modelId:
      process.env.ELEVEN_LABS_MODEL_ID || ElevenLabsModel.MULTILINGUAL_V2,
  },
};

export const validateConfig = (): void => {
  const requiredFields = ['token', 'clientId', 'openaiApiKey'];

  for (const field of requiredFields) {
    if (!botConfig[field as keyof BotConfig]) {
      throw new Error(
        `Missing required environment variable: ${field.toUpperCase()}`
      );
    }
  }
};
