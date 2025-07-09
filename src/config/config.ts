// Bun has built-in environment variable support

export interface BotConfig {
  token: string;
  clientId: string;
  guildId?: string;
  openaiApiKey: string;
  prefix: string;
  environment: 'development' | 'production';
}

export const botConfig: BotConfig = {
  token: process.env.DISCORD_TOKEN || '',
  clientId: process.env.DISCORD_CLIENT_ID || '',
  guildId: process.env.DISCORD_GUILD_ID,
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  prefix: process.env.BOT_PREFIX || '!',
  environment: (process.env.NODE_ENV as 'development' | 'production') || 'development',
};

export const validateConfig = (): void => {
  const requiredFields = ['token', 'clientId', 'openaiApiKey'];
  
  for (const field of requiredFields) {
    if (!botConfig[field as keyof BotConfig]) {
      throw new Error(`Missing required environment variable: ${field.toUpperCase()}`);
    }
  }
}; 