import { botConfig } from '../config/config';
import { logger } from '../utils/logger';
import type { ElevenLabsVoice } from '../types/elevenlabs';
import { ELEVEN_LABS_BASE_URL } from '../constants/elevenlabs';
import {
  getConsistentVoiceId,
  getVoiceIdsForLanguage,
  getIsoCode,
} from '../utils/elevenlabsUtils';

export interface ElevenLabsGenerateSpeechParams {
  text: string;
  voiceId?: string;
  modelId?: string;
  language?: string;
  sessionId?: string;
}

export class ElevenLabsTtsService {
  private apiKey: string;
  private sessionVoices: Map<string, string> = new Map();

  constructor() {
    this.apiKey = botConfig.elevenLabs.apiKey;

    logger.info(`ElevenLabsTtsService initialized:`);
    logger.info(`- API Key set: ${!!this.apiKey}`);
    logger.info(`- Config enabled: ${botConfig.elevenLabs.enabled}`);
    logger.info(`- USE_ELEVEN env var: ${process.env.USE_ELEVEN}`);
    logger.info(`- Service enabled: ${this.isEnabled()}`);
    logger.info(`- Model ID: ${botConfig.elevenLabs.modelId}`);
  }

  /**
   * Get or create a consistent voice ID for a session
   */
  private getSessionVoiceId(sessionId: string, language: string): string {
    const key = `${sessionId}_${language}`;

    if (!this.sessionVoices.has(key)) {
      const voiceId = getConsistentVoiceId(language);
      this.sessionVoices.set(key, voiceId);
      logger.info(
        `Created new voice ID ${voiceId} for session ${sessionId} language ${language}`
      );
    }

    const voiceId = this.sessionVoices.get(key)!;
    logger.info(
      `Using voice ID ${voiceId} for session ${sessionId} language ${language}`
    );
    return voiceId;
  }

  /**
   * Generate speech using ElevenLabs API
   */
  async generateSpeech(
    params: ElevenLabsGenerateSpeechParams
  ): Promise<Response> {
    try {
      const {
        text,
        voiceId,
        modelId = botConfig.elevenLabs.modelId,
        language = 'en',
        sessionId = 'default',
      } = params;

      // Get language-specific voice ID if not provided
      const finalVoiceId = voiceId || this.getSessionVoiceId(sessionId, language);

      // Convert bot language to ISO 639-1 code
      const isoCode = getIsoCode(language);

      const requestBody: Record<string, unknown> = {
        text,
        model_id: modelId,
      };

      // Add language parameter if supported by the model
      if (modelId.includes('multilingual')) {
        requestBody.language = isoCode;
      }

      logger.info(
        `Generating speech for language: ${language} (ISO: ${isoCode}) with voice: ${finalVoiceId}`
      );
      logger.info(`Request body: ${JSON.stringify(requestBody)}`);

      const response = await fetch(
        `${ELEVEN_LABS_BASE_URL}/text-to-speech/${finalVoiceId}`,
        {
          method: 'POST',
          headers: {
            Accept: 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': this.apiKey,
          },
          body: JSON.stringify(requestBody),
        }
      );

      logger.info(`ElevenLabs API response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`ElevenLabs API error response: ${errorText}`);
        throw new Error(
          `ElevenLabs API error: ${response.status} - ${errorText}`
        );
      }

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`ElevenLabs fetch error: ${errorMessage}`);
      if (error instanceof Error && error.stack) {
        logger.error(`Stack trace: ${error.stack}`);
      }
      throw error;
    }
  }

  /**
   * Get available voices from ElevenLabs
   */
  async getVoices(): Promise<ElevenLabsVoice[]> {
    try {
      const response = await fetch(`${ELEVEN_LABS_BASE_URL}/voices`, {
        headers: {
          'xi-api-key': this.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch voices: ${response.status}`);
      }

      const data = await response.json();
      return data.voices || [];
    } catch (error) {
      logger.error('Error fetching ElevenLabs voices:', error);
      throw error;
    }
  }

  /**
   * Get voices for a specific language
   */
  async getVoicesForLanguage(language: string): Promise<ElevenLabsVoice[]> {
    try {
      const allVoices = await this.getVoices();
      const voiceIds = getVoiceIdsForLanguage(language);

      return allVoices.filter((voice: ElevenLabsVoice) =>
        voiceIds.includes(voice.voice_id)
      );
    } catch (error) {
      logger.error(`Error fetching voices for language ${language}:`, error);
      return [];
    }
  }

  /**
   * Check if ElevenLabs is enabled and configured
   */
  isEnabled(): boolean {
    const enabled = botConfig.elevenLabs.enabled && !!this.apiKey;
    logger.info(`ElevenLabs isEnabled() check:`);
    logger.info(`- Config enabled: ${botConfig.elevenLabs.enabled}`);
    logger.info(`- API key exists: ${!!this.apiKey}`);
    logger.info(`- Final result: ${enabled}`);
    return enabled;
  }

  /**
   * Get language-specific voice ID
   */
  getVoiceIdForLanguage(language: string): string {
    return getConsistentVoiceId(language);
  }
}
