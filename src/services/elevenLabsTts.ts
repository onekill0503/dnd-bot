import { botConfig } from '../config/config';
import { logger } from '../utils/logger';
import { getIsoCode, getConsistentVoiceId, getVoiceIdsForLanguage } from '../utils/languageUtils';

export interface ElevenLabsVoiceStyle {
  voiceId: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
}

export interface ExpressionSegment {
  text: string;
  expression: string;
  startIndex: number;
  endIndex: number;
}

export class ElevenLabsTtsService {
  private apiKey: string;
  private baseUrl: string = 'https://api.elevenlabs.io/v1';
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
   * Parse text for expressions in brackets like [sarcastically], [whispers], etc.
   */
  private parseExpressions(text: string): ExpressionSegment[] {
    const expressionRegex = /\[([^\]]+)\]/g;
    const segments: ExpressionSegment[] = [];
    let match;

    while ((match = expressionRegex.exec(text)) !== null) {
      segments.push({
        text: match[0],
        expression: match[1].toLowerCase(),
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }

    return segments;
  }

  /**
   * Clean text by removing expression brackets
   */
  private cleanText(text: string): string {
    return text.replace(/\[[^\]]+\]/g, '').trim();
  }

  /**
   * Map expressions to voice settings
   */
  private getVoiceSettingsForExpression(expression: string): Partial<ElevenLabsVoiceStyle> {
    switch (expression) {
      case 'sarcastically':
      case 'sarcastic':
        return {
          stability: 0.3,
          similarityBoost: 0.7,
          style: 0.8,
        };
      case 'whispers':
      case 'whisper':
      case 'whispering':
        return {
          stability: 0.5,
          similarityBoost: 0.6,
          style: 0.3,
        };
      case 'giggles':
      case 'giggle':
      case 'laughing':
        return {
          stability: 0.2,
          similarityBoost: 0.8,
          style: 0.9,
        };
      case 'angrily':
      case 'angry':
        return {
          stability: 0.1,
          similarityBoost: 0.9,
          style: 0.9,
        };
      case 'sadly':
      case 'sad':
        return {
          stability: 0.4,
          similarityBoost: 0.7,
          style: 0.2,
        };
      case 'excitedly':
      case 'excited':
        return {
          stability: 0.2,
          similarityBoost: 0.8,
          style: 0.8,
        };
      case 'fearfully':
      case 'fearful':
      case 'scared':
        return {
          stability: 0.3,
          similarityBoost: 0.6,
          style: 0.4,
        };
      case 'mysteriously':
      case 'mysterious':
        return {
          stability: 0.4,
          similarityBoost: 0.7,
          style: 0.6,
        };
      default:
        return {
          stability: 0.5,
          similarityBoost: 0.75,
          style: 0.5,
        };
    }
  }

  /**
   * Get or create a consistent voice ID for a session
   */
  private getSessionVoiceId(sessionId: string, language: string): string {
    const key = `${sessionId}_${language}`;
    
    if (!this.sessionVoices.has(key)) {
      const voiceId = getConsistentVoiceId(language);
      this.sessionVoices.set(key, voiceId);
      logger.info(`Created new voice ID ${voiceId} for session ${sessionId} language ${language}`);
    }
    
    const voiceId = this.sessionVoices.get(key)!;
    logger.info(`Using voice ID ${voiceId} for session ${sessionId} language ${language}`);
    return voiceId;
  }

  /**
   * Generate speech with expression support and language-specific voice selection
   */
  async generateSpeech(params: {
    text: string;
    voiceId?: string;
    modelId?: string;
    style?: Partial<ElevenLabsVoiceStyle>;
    language?: string; // Bot language code (en, id, fr, etc.)
    sessionId?: string; // Session ID for voice persistence
  }): Promise<Response> {
    try {
      const { 
        text, 
        voiceId, 
        modelId = botConfig.elevenLabs.modelId, 
        style,
        language = 'en', // Default to English
        sessionId = 'default' // Default session ID
      } = params;
      
      // Parse expressions in the text
      const expressions = this.parseExpressions(text);
      const cleanText = this.cleanText(text);
      
      // Get language-specific voice ID if not provided
      let finalVoiceId = voiceId;
      if (!finalVoiceId) {
        finalVoiceId = this.getSessionVoiceId(sessionId, language);
      }
      
      // If no expressions found, use default settings
      if (expressions.length === 0) {
        return this.generateSingleSpeech({
          text: cleanText,
          voiceId: finalVoiceId,
          modelId,
          style: style || {},
          language,
        });
      }

      // For now, we'll use the first expression found for the entire text
      // In a more advanced implementation, you could split the text and generate multiple audio segments
      const firstExpression = expressions[0];
      const expressionSettings = this.getVoiceSettingsForExpression(firstExpression.expression);
      
      logger.info(`Generating speech with expression: ${firstExpression.expression} for language: ${language}`);
      
      return this.generateSingleSpeech({
        text: cleanText,
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
  private async generateSingleSpeech(params: {
    text: string;
    voiceId: string;
    modelId: string;
    style: Partial<ElevenLabsVoiceStyle>;
    language: string;
  }): Promise<Response> {
    const { text, voiceId, modelId, style, language } = params;

    // Convert bot language to ISO 639-1 code
    const isoCode = getIsoCode(language);
    
    const requestBody = {
      text,
      model_id: modelId,
      voice_settings: {
        stability: style.stability || 0.5,
        similarity_boost: style.similarityBoost || 0.75,
        style: style.style || 0.5,
        use_speaker_boost: style.useSpeakerBoost || true,
      },
    };

    // Add language parameter if supported by the model
    if (modelId.includes('multilingual')) {
      (requestBody as any).language = isoCode;
    }

    logger.info(`Generating speech for language: ${language} (ISO: ${isoCode}) with voice: ${voiceId}`);

    const response = await fetch(`${this.baseUrl}/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': this.apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
    }

    return response;
  }

  /**
   * Get available voices from ElevenLabs
   */
  async getVoices(): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/voices`, {
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
  async getVoicesForLanguage(language: string): Promise<any[]> {
    try {
      const allVoices = await this.getVoices();
      const voiceIds = getVoiceIdsForLanguage(language);
      
      // Filter voices that match the language's voice IDs
      return allVoices.filter((voice: any) => voiceIds.includes(voice.voice_id));
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