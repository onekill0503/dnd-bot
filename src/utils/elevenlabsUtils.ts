import type { ExpressionSegment } from '../types/elevenlabs';
import {
  EXPRESSION_VOICE_SETTINGS,
  LANGUAGE_VOICE_IDS,
  LANGUAGE_ISO_CODES,
  ELEVEN_LABS_DEFAULT_VOICE_ID,
} from '../constants/elevenlabs';

/**
 * Parse text for expressions in brackets like [sarcastically], [whispers], etc.
 */
export function parseExpressions(text: string): ExpressionSegment[] {
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
export function cleanText(text: string): string {
  return text.replace(/\[[^\]]+\]/g, '').trim();
}

/**
 * Get voice settings for a specific expression
 */
export function getVoiceSettingsForExpression(expression: string) {
  return (
    EXPRESSION_VOICE_SETTINGS[expression] || {
      stability: 0.5,
      similarityBoost: 0.75,
      style: 0.5,
    }
  );
}

/**
 * Get consistent voice ID for a language
 */
export function getConsistentVoiceId(language: string): string {
  const voiceIds = LANGUAGE_VOICE_IDS[language] || LANGUAGE_VOICE_IDS.en;
  const index = Math.floor(Math.random() * voiceIds.length);
  return voiceIds[index];
}

/**
 * Get voice IDs for a specific language
 */
export function getVoiceIdsForLanguage(language: string): string[] {
  return LANGUAGE_VOICE_IDS[language] || LANGUAGE_VOICE_IDS.en;
}

/**
 * Convert bot language to ISO 639-1 code
 */
export function getIsoCode(language: string): string {
  return LANGUAGE_ISO_CODES[language] || 'en';
}

/**
 * Get default voice ID
 */
export function getDefaultVoiceId(): string {
  return ELEVEN_LABS_DEFAULT_VOICE_ID;
}
