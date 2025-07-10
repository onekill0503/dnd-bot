// Bun has built-in environment variable support

export interface BotConfig {
  token: string;
  clientId: string;
  guildId?: string;
  openaiApiKey: string;
  prefix: string;
  environment: 'development' | 'production';
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
  prefix: process.env.BOT_PREFIX || '!',
  environment: (process.env.NODE_ENV as 'development' | 'production') || 'development',
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
  },
  dmAi: {
    endpoint: process.env.DM_AI_ENDPOINT || 'https://api.deepseek.com',
    model: process.env.DM_AI_MODEL || 'deepseek-chat',
    apiKey: process.env.DM_AI_API_KEY || '',
  },
  ttsAi: {
    endpoint: process.env.TTS_AI_ENDPOINT || 'https://api.openai.com/v1',
    model: process.env.TTS_AI_MODEL || 'gpt-3.5-turbo',
    apiKey: process.env.TTS_AI_API_KEY || process.env.OPENAI_API_KEY || '',
  },
  elevenLabs: {
    apiKey: process.env.ELEVEN_LABS_KEY || '',
    enabled: process.env.USE_ELEVEN === 'true',
    defaultVoiceId: process.env.ELEVEN_LABS_DEFAULT_VOICE_ID || 'pNInz6obpgDQGcFmaJgB', // Adam voice
    modelId: process.env.ELEVEN_LABS_MODEL_ID || 'eleven_multilingual_v2',
  },
};

export const validateConfig = (): void => {
  const requiredFields = ['token', 'clientId', 'openaiApiKey'];
  
  for (const field of requiredFields) {
    if (!botConfig[field as keyof BotConfig]) {
      throw new Error(`Missing required environment variable: ${field.toUpperCase()}`);
    }
  }
}; 