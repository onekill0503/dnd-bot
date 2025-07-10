import { 
  joinVoiceChannel, 
  createAudioPlayer, 
  createAudioResource, 
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection
} from '@discordjs/voice';
import { Guild } from 'discord.js';
import { botConfig } from '../config/config';
import { logger } from '../utils/logger';
import { RedisService } from './redis';
import { TtsAiService } from './ttsAi';
import type { SessionData } from './redis';

export interface VoiceStyle {
  voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  speed?: number;
  dramatic?: boolean;
}

export class VoiceService {
  private ttsAiService: TtsAiService;
  private audioPlayer = createAudioPlayer();
  private redisService: RedisService;

  constructor() {
    this.ttsAiService = new TtsAiService();
    this.redisService = new RedisService();
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a new D&D session for a voice channel
   */
  async createSession(channelId: string, guildId: string, creatorId: string): Promise<SessionData> {
    try {
      const sessionData: Omit<SessionData, 'channelId'> = {
        sessionId: this.generateSessionId(),
        guildId,
        creatorId,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        participants: [creatorId],
        gameState: {
          currentScene: 'tavern',
          players: [],
          npcs: [],
          inventory: [],
          quests: [],
        },
      };

      await this.redisService.saveSession(channelId, sessionData);
      
      logger.info(`Created new D&D session for channel ${channelId}`);
      return { ...sessionData, channelId };
    } catch (error) {
      logger.error('Error creating session:', error);
      throw error;
    }
  }

  /**
   * Get or create session for a voice channel
   */
  async getOrCreateSession(channelId: string, guildId: string, userId: string): Promise<SessionData> {
    try {
      let session = await this.redisService.getSession(channelId);
      
      if (!session) {
        session = await this.createSession(channelId, guildId, userId);
      } else {
        // Add user to participants if not already present
        await this.redisService.addParticipant(channelId, userId);
      }

      return session;
    } catch (error) {
      logger.error('Error getting or creating session:', error);
      throw error;
    }
  }

  /**
   * Join a voice channel
   */
  async joinVoiceChannel(channelId: string, guildId: string, client: any): Promise<any> {
    try {
      logger.info(`Attempting to join voice channel ${channelId} in guild ${guildId}`);
      
      const guild = client.guilds.cache.get(guildId);
      if (!guild) {
        throw new Error(`Guild ${guildId} not found`);
      }

      const connection = joinVoiceChannel({
        channelId,
        guildId,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: false,
      });

      connection.on(VoiceConnectionStatus.Ready, () => {
        logger.info('Voice connection ready');
      });

      connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
          await Promise.race([
            entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
            entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
          ]);
        } catch (error) {
          connection.destroy();
        }
      });

      return connection;
    } catch (error) {
      logger.error('Error joining voice channel:', error);
      throw error;
    }
  }

  /**
   * Analyze text content to determine appropriate voice style
   */
  private analyzeContentForVoiceStyle(text: string): VoiceStyle {
    const lowerText = text.toLowerCase();
    
    // Check for expressions in brackets first
    const expressionRegex = /\[([^\]]+)\]/g;
    const expressions = [...lowerText.matchAll(expressionRegex)].map(match => match[1]);
    
    // If expressions are found, use them to determine voice style
    if (expressions.length > 0) {
      const firstExpression = expressions[0];
      
      // Map expressions to voice styles
      switch (firstExpression) {
        case 'sarcastically':
        case 'sarcastic':
          return { voice: 'echo', speed: 0.9, dramatic: true };
        case 'whispers':
        case 'whisper':
        case 'whispering':
          return { voice: 'shimmer', speed: 0.7, dramatic: false };
        case 'giggles':
        case 'giggle':
        case 'laughing':
          return { voice: 'nova', speed: 1.1, dramatic: false };
        case 'angrily':
        case 'angry':
          return { voice: 'onyx', speed: 0.8, dramatic: true };
        case 'sadly':
        case 'sad':
          return { voice: 'fable', speed: 0.8, dramatic: false };
        case 'excitedly':
        case 'excited':
          return { voice: 'nova', speed: 1.2, dramatic: true };
        case 'fearfully':
        case 'fearful':
        case 'scared':
          return { voice: 'shimmer', speed: 0.7, dramatic: true };
        case 'mysteriously':
        case 'mysterious':
          return { voice: 'fable', speed: 0.85, dramatic: true };
      }
    }
    
    // Combat scenes - use dramatic voice (English and Indonesian keywords)
    if (lowerText.includes('sword') || lowerText.includes('attack') || lowerText.includes('battle') || 
        lowerText.includes('enemy') || lowerText.includes('fight') || lowerText.includes('combat') ||
        lowerText.includes('blood') || lowerText.includes('weapon') || lowerText.includes('spell') ||
        lowerText.includes('pedang') || lowerText.includes('serang') || lowerText.includes('pertempuran') ||
        lowerText.includes('musuh') || lowerText.includes('berkelahi') || lowerText.includes('perang') ||
        lowerText.includes('darah') || lowerText.includes('senjata') || lowerText.includes('sihir')) {
      return { voice: 'onyx', speed: 0.9, dramatic: true };
    }
    
    // Mysterious/magical scenes - use mystical voice (English and Indonesian keywords)
    if (lowerText.includes('magic') || lowerText.includes('spell') || lowerText.includes('mysterious') ||
        lowerText.includes('ancient') || lowerText.includes('portal') || lowerText.includes('enchanted') ||
        lowerText.includes('crystal') || lowerText.includes('rune') || lowerText.includes('arcane') ||
        lowerText.includes('sihir') || lowerText.includes('mantra') || lowerText.includes('misterius') ||
        lowerText.includes('kuno') || lowerText.includes('portal') || lowerText.includes('terpesona') ||
        lowerText.includes('kristal') || lowerText.includes('rune') || lowerText.includes('arcane')) {
      return { voice: 'shimmer', speed: 0.85, dramatic: true };
    }
    
    // NPC dialogue - use character voice (English and Indonesian keywords)
    if (lowerText.includes('"') || lowerText.includes('says') || lowerText.includes('speaks') ||
        lowerText.includes('replies') || lowerText.includes('responds') || lowerText.includes('asks') ||
        lowerText.includes('berkata') || lowerText.includes('berbicara') || lowerText.includes('menjawab') ||
        lowerText.includes('bertanya') || lowerText.includes('mengatakan')) {
      return { voice: 'echo', speed: 0.95, dramatic: false };
    }
    
    // Environmental descriptions - use atmospheric voice (English and Indonesian keywords)
    if (lowerText.includes('forest') || lowerText.includes('cave') || lowerText.includes('mountain') ||
        lowerText.includes('river') || lowerText.includes('castle') || lowerText.includes('dungeon') ||
        lowerText.includes('dark') || lowerText.includes('light') || lowerText.includes('wind') ||
        lowerText.includes('hutan') || lowerText.includes('gua') || lowerText.includes('gunung') ||
        lowerText.includes('sungai') || lowerText.includes('kastil') || lowerText.includes('dungeon') ||
        lowerText.includes('gelap') || lowerText.includes('cahaya') || lowerText.includes('angin')) {
      return { voice: 'fable', speed: 0.9, dramatic: false };
    }
    
    // Tense/dramatic scenes (English and Indonesian keywords)
    if (lowerText.includes('danger') || lowerText.includes('threat') || lowerText.includes('warning') ||
        lowerText.includes('suddenly') || lowerText.includes('unexpected') || lowerText.includes('surprise') ||
        lowerText.includes('bahaya') || lowerText.includes('ancaman') || lowerText.includes('peringatan') ||
        lowerText.includes('tiba-tiba') || lowerText.includes('tak terduga') || lowerText.includes('kejutan')) {
      return { voice: 'nova', speed: 0.8, dramatic: true };
    }
    
    // Default - use standard voice
    return { voice: 'alloy', speed: 1.0, dramatic: false };
  }

  /**
   * Convert text to speech using TTS AI Service with dramatic styling
   */
  async textToSpeech(text: string, style?: VoiceStyle, language?: string, sessionId?: string): Promise<Buffer> {
    try {
      const voiceStyle = style || this.analyzeContentForVoiceStyle(text);
      
      // Add dramatic pauses and emphasis for dramatic scenes
      let processedText = text;
      if (voiceStyle.dramatic) {
        // Add pauses for dramatic effect
        processedText = text.replace(/\./g, '... ');
        processedText = processedText.replace(/!/g, '!... ');
        processedText = processedText.replace(/\?/g, '?... ');
      }

      // Use ElevenLabs voice ID if available, otherwise use OpenAI voice names
      const voiceId = this.ttsAiService.isElevenLabsEnabled() 
        ? this.ttsAiService.getVoiceIdForLanguage(language || 'en')
        : voiceStyle.voice;

      const response = await this.ttsAiService.generateSpeech({
        model: this.ttsAiService.isElevenLabsEnabled() 
          ? botConfig.elevenLabs.modelId 
          : 'tts-1',
        voice: voiceId,
        input: processedText,
        speed: voiceStyle.speed || 1.0,
        language: language || 'en', // Pass language parameter
        sessionId: sessionId || 'default', // Pass session ID parameter
      });

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      logger.error('Error converting text to speech:', error);
      throw error;
    }
  }

  /**
   * Speak text in a voice channel with dramatic narration
   */
  async speakInChannel(channelId: string, guildId: string, text: string, client?: any, style?: VoiceStyle, language?: string, sessionId?: string): Promise<void> {
    try {
      // Get or create voice connection
      let connection = getVoiceConnection(guildId);
      if (!connection) {
        connection = await this.joinVoiceChannel(channelId, guildId, client);
      }

      // If connection is null (voice disabled), just log the message
      if (!connection) {
        logger.info(`Voice disabled - would speak: "${text}"`);
        return;
      }

      try {
        // Convert text to speech with dramatic styling
        const audioBuffer = await this.textToSpeech(text, style, language, sessionId);
        
        // Create a readable stream from the buffer
        const { Readable } = await import('stream');
        const stream = Readable.from(audioBuffer);
        const resource = createAudioResource(stream);

        // Play the audio
        this.audioPlayer.play(resource);
        connection.subscribe(this.audioPlayer);

        // Wait for audio to finish
        return new Promise<void>((resolve, reject) => {
          this.audioPlayer.on(AudioPlayerStatus.Idle, () => {
            resolve();
          });

          this.audioPlayer.on('error', (error: any) => {
            logger.error('Audio player error:', error);
            reject(error);
          });
        });
      } catch (ffmpegError) {
        // If FFmpeg is not available, just log the message
        logger.warn('FFmpeg not available - voice disabled. Message would be:', text);
        logger.info(`Voice message: "${text}"`);
        return;
      }
    } catch (error) {
      logger.error('Error speaking in channel:', error);
      // Don't throw error, just log it
      logger.info(`Voice message (error occurred): "${text}"`);
    }
  }

  /**
   * Narrate a story event with dramatic voice
   */
  async narrateStoryEvent(channelId: string, guildId: string, storyText: string, client?: any, language?: string, sessionId?: string): Promise<void> {
    try {
      logger.info(`Narrating story event in voice channel ${channelId}: ${storyText.substring(0, 100)}...`);
      
      // Analyze the story content for appropriate voice style
      const voiceStyle = this.analyzeContentForVoiceStyle(storyText);
      
      // Add dramatic narration prefix for certain types of content
      let narratedText = storyText;
      if (voiceStyle.dramatic) {
        if (storyText.toLowerCase().includes('battle') || storyText.toLowerCase().includes('combat')) {
          narratedText = `*The tension mounts as* ${storyText}`;
        } else if (storyText.toLowerCase().includes('magic') || storyText.toLowerCase().includes('spell')) {
          narratedText = `*With mystical energy swirling* ${storyText}`;
        } else if (storyText.toLowerCase().includes('suddenly') || storyText.toLowerCase().includes('unexpected')) {
          narratedText = `*In a shocking turn of events* ${storyText}`;
        }
      }
      
      await this.speakInChannel(channelId, guildId, narratedText, client, voiceStyle, language, sessionId);
    } catch (error) {
      logger.error('Error narrating story event:', error);
    }
  }

  /**
   * Leave voice channel and clean up session if no participants
   */
  async leaveVoiceChannel(guildId: string, channelId: string, userId: string) {
    try {
      // Remove user from session participants
      await this.redisService.removeParticipant(channelId, userId);
      
      // Get updated session to check if any participants remain
      const session = await this.redisService.getSession(channelId);
      
      if (session && session.participants.length === 0) {
        // No participants left, delete session
        await this.redisService.deleteSession(channelId);
        logger.info(`Session ended for channel ${channelId} - no participants remaining`);
      }

      const connection = getVoiceConnection(guildId);
      if (connection) {
        connection.destroy();
        logger.info('Left voice channel');
      }
    } catch (error) {
      logger.error('Error leaving voice channel:', error);
      throw error;
    }
  }

  /**
   * Update game state for a session
   */
  async updateGameState(channelId: string, gameState: any): Promise<void> {
    try {
      await this.redisService.updateSession(channelId, { gameState });
      logger.info(`Game state updated for channel ${channelId}`);
    } catch (error) {
      logger.error('Error updating game state:', error);
      throw error;
    }
  }

  /**
   * Get current game state for a session
   */
  async getGameState(channelId: string): Promise<any | null> {
    try {
      const session = await this.redisService.getSession(channelId);
      return session?.gameState || null;
    } catch (error) {
      logger.error('Error getting game state:', error);
      throw error;
    }
  }

  /**
   * Get all active sessions
   */
  async getAllActiveSessions(): Promise<SessionData[]> {
    try {
      return await this.redisService.getAllSessions();
    } catch (error) {
      logger.error('Error getting all active sessions:', error);
      throw error;
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<void> {
    try {
      await this.redisService.cleanupExpiredSessions();
    } catch (error) {
      logger.error('Error cleaning up expired sessions:', error);
      throw error;
    }
  }
} 