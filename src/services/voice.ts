import { 
  joinVoiceChannel, 
  createAudioPlayer, 
  createAudioResource, 
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection
} from '@discordjs/voice';
import { OpenAI } from 'openai';
import { Guild } from 'discord.js';
import { botConfig } from '../config/config';
import { logger } from '../utils/logger';

export class VoiceService {
  private openai: OpenAI;
  private audioPlayer = createAudioPlayer();

  constructor() {
    this.openai = new OpenAI({
      apiKey: botConfig.openaiApiKey,
    });
  }

  /**
   * Join a voice channel
   */
  async joinVoiceChannel(channelId: string, guildId: string) {
    try {
      const connection = joinVoiceChannel({
        channelId,
        guildId,
        adapterCreator: (guild: Guild) => guild.voiceAdapterCreator,
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
   * Convert text to speech using OpenAI TTS
   */
  async textToSpeech(text: string): Promise<Buffer> {
    try {
      const response = await this.openai.audio.speech.create({
        model: 'tts-1',
        voice: 'alloy',
        input: text,
      });

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      logger.error('Error converting text to speech:', error);
      throw error;
    }
  }

  /**
   * Speak text in a voice channel
   */
  async speakInChannel(channelId: string, guildId: string, text: string) {
    try {
      // Get or create voice connection
      let connection = getVoiceConnection(guildId);
      if (!connection) {
        connection = await this.joinVoiceChannel(channelId, guildId);
      }

      // Convert text to speech
      const audioBuffer = await this.textToSpeech(text);
      const resource = createAudioResource(audioBuffer);

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
    } catch (error) {
      logger.error('Error speaking in channel:', error);
      throw error;
    }
  }

  /**
   * Leave voice channel
   */
  leaveVoiceChannel(guildId: string) {
    const connection = getVoiceConnection(guildId);
    if (connection) {
      connection.destroy();
      logger.info('Left voice channel');
    }
  }
} 