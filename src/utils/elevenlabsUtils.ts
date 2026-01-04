import {
  LANGUAGE_VOICE_IDS,
  LANGUAGE_ISO_CODES,
  ELEVEN_LABS_DEFAULT_VOICE_ID,
} from '../constants/elevenlabs';

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
