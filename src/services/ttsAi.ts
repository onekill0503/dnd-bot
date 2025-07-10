import OpenAI from 'openai';
import { botConfig } from '../config/config';
import { ElevenLabsTtsService } from './elevenLabsTts';
import { logger } from '../utils/logger';

export interface TtsGenerateSpeechParams {
  model: string;
  voice: string;
  input: string;
  speed?: number;
  language?: string;
  sessionId?: string;
}

export class TtsAiService {
  private openaiClient: OpenAI;
  private elevenLabsService: ElevenLabsTtsService;

  constructor() {
    this.openaiClient = new OpenAI({
      apiKey: botConfig.ttsAi.apiKey,
      baseURL: botConfig.ttsAi.endpoint,
    });
    this.elevenLabsService = new ElevenLabsTtsService();

    // Debug logging
    logger.info(`TtsAiService initialized:`);
    logger.info(`- ElevenLabs enabled: ${botConfig.elevenLabs.enabled}`);
    logger.info(`- ElevenLabs API key set: ${!!botConfig.elevenLabs.apiKey}`);
    logger.info(`- USE_ELEVEN env var: ${process.env.USE_ELEVEN}`);
    logger.info(
      `- ElevenLabs service enabled: ${this.elevenLabsService.isEnabled()}`
    );
  }

  async chat(messages: any[]): Promise<string> {
    const response = await this.openaiClient.chat.completions.create({
      model: botConfig.ttsAi.model,
      messages,
    });
    return response.choices[0].message.content ?? '';
  }

  async generateSpeech(params: TtsGenerateSpeechParams): Promise<Response> {
    // Debug logging
    logger.info(`generateSpeech called with:`);
    logger.info(`- ElevenLabs enabled: ${this.elevenLabsService.isEnabled()}`);
    logger.info(`- Language: ${params.language || 'en'}`);
    logger.info(`- Session ID: ${params.sessionId || 'default'}`);
    logger.info(`- Text length: ${params.input.length}`);

    // Check if ElevenLabs is enabled and use it if available
    if (this.elevenLabsService.isEnabled()) {
      logger.info('Using ElevenLabs for TTS generation');
      return this.elevenLabsService.generateSpeech({
        text: params.input,
        voiceId: params.voice, // Use voice parameter as voiceId for ElevenLabs
        modelId: params.model, // Use model parameter as modelId for ElevenLabs
        language: params.language || 'en', // Pass language parameter
        sessionId: params.sessionId || 'default', // Pass session ID parameter
      });
    }

    // Fallback to OpenAI TTS
    logger.info('Using OpenAI for TTS generation (ElevenLabs not enabled)');
    const response = await this.openaiClient.audio.speech.create({
      model: params.model,
      voice: params.voice as any,
      input: params.input,
      speed: params.speed,
    });
    return response;
  }

  /**
   * Check if ElevenLabs is available
   */
  isElevenLabsEnabled(): boolean {
    const enabled = this.elevenLabsService.isEnabled();
    logger.info(`isElevenLabsEnabled() called: ${enabled}`);
    return enabled;
  }

  /**
   * Get available voices from ElevenLabs
   */
  async getElevenLabsVoices(): Promise<any[]> {
    if (this.elevenLabsService.isEnabled()) {
      return await this.elevenLabsService.getVoices();
    }
    return [];
  }

  /**
   * Get voices for a specific language
   */
  async getElevenLabsVoicesForLanguage(language: string): Promise<any[]> {
    if (this.elevenLabsService.isEnabled()) {
      return await this.elevenLabsService.getVoicesForLanguage(language);
    }
    return [];
  }

  /**
   * Get language-specific voice ID
   */
  getVoiceIdForLanguage(language: string): string {
    if (this.elevenLabsService.isEnabled()) {
      return this.elevenLabsService.getVoiceIdForLanguage(language);
    }
    return botConfig.elevenLabs.defaultVoiceId;
  }
}
