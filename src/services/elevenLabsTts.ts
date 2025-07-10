import { botConfig } from '../config/config';
import { logger } from '../utils/logger';
import type {
  ElevenLabsVoice,
  ElevenLabsGenerateSpeechParams,
  ElevenLabsSingleSpeechParams,
} from '../types/elevenlabs';
import {
  ELEVEN_LABS_BASE_URL,
  ELEVEN_LABS_DEFAULT_SETTINGS,
} from '../constants/elevenlabs';
import {
  parseExpressions,
  cleanText,
  getVoiceSettingsForExpression,
  getConsistentVoiceId,
  getVoiceIdsForLanguage,
  getIsoCode,
} from '../utils/elevenlabsUtils';

export class ElevenLabsTtsService {
  private apiKey: string;
  private sessionVoices: Map<string, string> = new Map(); // Store voice IDs per session

  constructor() {
    this.apiKey = botConfig.elevenLabs.apiKey;

    // Debug logging
    logger.info(`ElevenLabsTtsService initialized:`);
    logger.info(`- API Key set: ${!!this.apiKey}`);
    logger.info(`- Config enabled: ${botConfig.elevenLabs.enabled}`);
    logger.info(`- USE_ELEVEN env var: ${process.env.USE_ELEVEN}`);
    logger.info(`- Service enabled: ${this.isEnabled()}`);
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
   * Generate speech with expression support and language-specific voice selection
   */
  async generateSpeech(
    params: ElevenLabsGenerateSpeechParams
  ): Promise<Response> {
    try {
      const {
        text,
        voiceId,
        modelId = botConfig.elevenLabs.modelId,
        style,
        language = 'en', // Default to English
        sessionId = 'default', // Default session ID
      } = params;

      // Parse expressions in the text
      const expressions = parseExpressions(text);
      const cleanedText = cleanText(text);

      // Get language-specific voice ID if not provided
      let finalVoiceId = voiceId;
      if (!finalVoiceId) {
        finalVoiceId = this.getSessionVoiceId(sessionId, language);
      }

      // If no expressions found, use default settings
      if (expressions.length === 0) {
        return this.generateSingleSpeech({
          text: cleanedText,
          voiceId: finalVoiceId,
          modelId,
          style: style || {},
          language,
        });
      }

      // For now, we'll use the first expression found for the entire text
      // In a more advanced implementation, you could split the text and generate multiple audio segments
      const firstExpression = expressions[0];
      const expressionSettings = getVoiceSettingsForExpression(
        firstExpression.expression
      );

      logger.info(
        `Generating speech with expression: ${firstExpression.expression} for language: ${language}`
      );

      return this.generateSingleSpeech({
        text: cleanedText,
        voiceId: finalVoiceId,
        modelId,
        style: {
          ...expressionSettings,
          ...style,
        },
        language,
      });
    } catch (error) {
      logger.error('Error generating ElevenLabs speech:', error);
      throw error;
    }
  }

  /**
   * Generate single speech segment with language support
   */
  private async generateSingleSpeech(
    params: ElevenLabsSingleSpeechParams
  ): Promise<Response> {
    const { text, voiceId, modelId, style, language } = params;

    // Convert bot language to ISO 639-1 code
    const isoCode = getIsoCode(language);

    const requestBody = {
      text,
      model_id: modelId,
      voice_settings: {
        stability: style.stability || ELEVEN_LABS_DEFAULT_SETTINGS.stability,
        similarity_boost:
          style.similarityBoost || ELEVEN_LABS_DEFAULT_SETTINGS.similarityBoost,
        style: style.style || ELEVEN_LABS_DEFAULT_SETTINGS.style,
        use_speaker_boost:
          style.useSpeakerBoost ?? ELEVEN_LABS_DEFAULT_SETTINGS.useSpeakerBoost,
      },
    };

    // Add language parameter if supported by the model
    if (modelId.includes('multilingual')) {
      (requestBody as any).language = isoCode;
    }

    logger.info(
      `Generating speech for language: ${language} (ISO: ${isoCode}) with voice: ${voiceId}`
    );

    const response = await fetch(
      `${ELEVEN_LABS_BASE_URL}/text-to-speech/${voiceId}`,
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

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `ElevenLabs API error: ${response.status} - ${errorText}`
      );
    }

    return response;
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

      // Filter voices that match the language's voice IDs
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
