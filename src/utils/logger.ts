import pino from 'pino';
import chalk from 'chalk';

// Create a simple logger that works well with Bun
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
      messageFormat: '{msg}',
    },
  },
});

// Create specialized loggers for different components
export const botLogger = logger.child({ component: 'bot' });
export const commandLogger = logger.child({ component: 'command' });
export const eventLogger = logger.child({ component: 'event' });
export const serviceLogger = logger.child({ component: 'service' });
export const voiceLogger = logger.child({ component: 'voice' });
export const ttsLogger = logger.child({ component: 'tts' });
export const redisLogger = logger.child({ component: 'redis' });

// Export the main logger as default and named export for compatibility
export default logger;
export { logger };

// Helper functions for common logging patterns
export const loggers = {
  // Bot lifecycle events
  botStart: (message: string) =>
    botLogger.info(chalk.green('🤖 BOT START: ') + message),
  botReady: (message: string) =>
    botLogger.info(chalk.green('✅ BOT READY: ') + message),
  botError: (message: string, error?: any) =>
    botLogger.error(chalk.red('❌ BOT ERROR: ') + message, error),
  botShutdown: (message: string) =>
    botLogger.info(chalk.yellow('🛑 BOT SHUTDOWN: ') + message),

  // Command events
  commandExecuted: (command: string, user: string) =>
    commandLogger.info(
      chalk.blue('⚡ COMMAND: ') + `${command} by ${chalk.cyan(user)}`
    ),
  commandError: (command: string, error: any) =>
    commandLogger.error(chalk.red('❌ COMMAND ERROR: ') + `${command}`, error),

  // Event handling
  eventReceived: (event: string, guild?: string) =>
    eventLogger.info(
      chalk.magenta('📡 EVENT: ') +
        `${event}${guild ? ` in ${chalk.cyan(guild)}` : ''}`
    ),
  eventError: (event: string, error: any) =>
    eventLogger.error(chalk.red('❌ EVENT ERROR: ') + `${event}`, error),

  // Service operations
  serviceStart: (service: string) =>
    serviceLogger.info(chalk.blue('🔧 SERVICE START: ') + service),
  serviceReady: (service: string) =>
    serviceLogger.info(chalk.green('✅ SERVICE READY: ') + service),
  serviceError: (service: string, error: any) =>
    serviceLogger.error(chalk.red('❌ SERVICE ERROR: ') + service, error),

  // Voice operations
  voiceJoin: (channel: string, guild: string) =>
    voiceLogger.info(
      chalk.blue('🎤 VOICE JOIN: ') + `${channel} in ${chalk.cyan(guild)}`
    ),
  voiceLeave: (channel: string, guild: string) =>
    voiceLogger.info(
      chalk.yellow('👋 VOICE LEAVE: ') + `${channel} in ${chalk.cyan(guild)}`
    ),
  voiceError: (operation: string, error: any) =>
    voiceLogger.error(chalk.red('❌ VOICE ERROR: ') + operation, error),

  // TTS operations
  ttsStart: (text: string) =>
    ttsLogger.info(
      chalk.blue('🔊 TTS START: ') + chalk.gray(text.substring(0, 50))
    ),
  ttsSuccess: (text: string) =>
    ttsLogger.info(
      chalk.green('✅ TTS SUCCESS: ') + chalk.gray(text.substring(0, 50))
    ),
  ttsError: (text: string, error: any) =>
    ttsLogger.error(
      chalk.red('❌ TTS ERROR: ') + chalk.gray(text.substring(0, 50)),
      error
    ),

  // Redis operations
  redisConnect: () =>
    redisLogger.info(chalk.blue('🔗 REDIS CONNECT: ') + 'Connecting to Redis'),
  redisConnected: () =>
    redisLogger.info(
      chalk.green('✅ REDIS CONNECTED: ') + 'Successfully connected to Redis'
    ),
  redisError: (operation: string, error: any) =>
    redisLogger.error(chalk.red('❌ REDIS ERROR: ') + operation, error),

  // Session management
  sessionStart: (sessionId: string, guild: string) =>
    serviceLogger.info(
      chalk.blue('🎭 SESSION START: ') + `${sessionId} in ${chalk.cyan(guild)}`
    ),
  sessionEnd: (sessionId: string, guild: string) =>
    serviceLogger.info(
      chalk.yellow('🏁 SESSION END: ') + `${sessionId} in ${chalk.cyan(guild)}`
    ),
  sessionError: (sessionId: string, error: any) =>
    serviceLogger.error(chalk.red('❌ SESSION ERROR: ') + sessionId, error),

  // AI operations
  aiRequest: (model: string, prompt: string) =>
    serviceLogger.info(
      chalk.blue('🤖 AI REQUEST: ') +
        `${model} - ${chalk.gray(prompt.substring(0, 50))}`
    ),
  aiResponse: (model: string, response: string) =>
    serviceLogger.info(
      chalk.green('✅ AI RESPONSE: ') +
        `${model} - ${chalk.gray(response.substring(0, 50))}`
    ),
  aiError: (model: string, error: any) =>
    serviceLogger.error(chalk.red('❌ AI ERROR: ') + model, error),

  // Debug information
  debug: (component: string, message: string, data?: any) =>
    logger.debug(chalk.gray(`🔍 DEBUG [${component}]: `) + message, data),

  // Performance metrics
  performance: (operation: string, duration: number) =>
    logger.info(
      chalk.cyan('⏱️  PERFORMANCE: ') +
        `${operation} took ${chalk.yellow(duration)}ms`
    ),
};

// Legacy compatibility - keep the old logger interface for existing code
export const legacyLogger = {
  info: (message: string, ...args: any[]) => logger.info(message, ...args),
  warn: (message: string, ...args: any[]) => logger.warn(message, ...args),
  error: (message: string, ...args: any[]) => logger.error(message, ...args),
  debug: (message: string, ...args: any[]) => logger.debug(message, ...args),
};
