/**
 * Language utilities for ElevenLabs TTS integration
 */

export interface LanguageMapping {
  botLanguage: string;
  isoCode: string;
  displayName: string;
  elevenLabsVoiceIds: string[];
}

/**
 * Language mappings from bot language codes to ISO 639-1 codes
 * and their corresponding ElevenLabs voice IDs
 */
export const LANGUAGE_MAPPINGS: LanguageMapping[] = [
  {
    botLanguage: 'en',
    isoCode: 'en',
    displayName: 'English',
    elevenLabsVoiceIds: [
      'pNInz6obpgDQGcFmaJgB', // Adam
      '21m00Tcm4TlvDq8ikWAM', // Rachel
      'AZnzlk1XvdvUeBnXmlld', // Domi
      'EXAVITQu4vr4xnSDxMaL', // Bella
      'VR6AewLTigWG4xSOukaG', // Arnold
      'yoZ06aMxZJJ28mfd3POQ', // Josh
      'TxGEqnHWrfWFTfGW9XjX', // Sam
      'VR6AewLTigWG4xSOukaG', // Arnold
    ]
  },
  {
    botLanguage: 'id',
    isoCode: 'id',
    displayName: 'Indonesian',
    elevenLabsVoiceIds: [
      '1k39YpzqXZn52BgyLyGO', 
    ]
  },
  {
    botLanguage: 'fr',
    isoCode: 'fr',
    displayName: 'French',
    elevenLabsVoiceIds: [
      'pNInz6obpgDQGcFmaJgB', // Adam (fallback to English)
      '21m00Tcm4TlvDq8ikWAM', // Rachel (fallback to English)
    ]
  },
  {
    botLanguage: 'es',
    isoCode: 'es',
    displayName: 'Spanish',
    elevenLabsVoiceIds: [
      'pNInz6obpgDQGcFmaJgB', // Adam (fallback to English)
      '21m00Tcm4TlvDq8ikWAM', // Rachel (fallback to English)
    ]
  },
  {
    botLanguage: 'de',
    isoCode: 'de',
    displayName: 'German',
    elevenLabsVoiceIds: [
      'pNInz6obpgDQGcFmaJgB', // Adam (fallback to English)
      '21m00Tcm4TlvDq8ikWAM', // Rachel (fallback to English)
    ]
  },
  {
    botLanguage: 'it',
    isoCode: 'it',
    displayName: 'Italian',
    elevenLabsVoiceIds: [
      'pNInz6obpgDQGcFmaJgB', // Adam (fallback to English)
      '21m00Tcm4TlvDq8ikWAM', // Rachel (fallback to English)
    ]
  },
  {
    botLanguage: 'pt',
    isoCode: 'pt',
    displayName: 'Portuguese',
    elevenLabsVoiceIds: [
      'pNInz6obpgDQGcFmaJgB', // Adam (fallback to English)
      '21m00Tcm4TlvDq8ikWAM', // Rachel (fallback to English)
    ]
  },
  {
    botLanguage: 'ru',
    isoCode: 'ru',
    displayName: 'Russian',
    elevenLabsVoiceIds: [
      'pNInz6obpgDQGcFmaJgB', // Adam (fallback to English)
      '21m00Tcm4TlvDq8ikWAM', // Rachel (fallback to English)
    ]
  }
];

/**
 * Get language mapping by bot language code
 */
export function getLanguageMapping(botLanguage: string): LanguageMapping | null {
  return LANGUAGE_MAPPINGS.find(mapping => mapping.botLanguage === botLanguage) || null;
}

/**
 * Get ISO 639-1 code from bot language
 */
export function getIsoCode(botLanguage: string): string {
  const mapping = getLanguageMapping(botLanguage);
  return mapping?.isoCode || 'en';
}

/**
 * Get ElevenLabs voice IDs for a language
 */
export function getVoiceIdsForLanguage(botLanguage: string): string[] {
  const mapping = getLanguageMapping(botLanguage);
  return mapping?.elevenLabsVoiceIds || LANGUAGE_MAPPINGS[0].elevenLabsVoiceIds;
}

/**
 * Get a random voice ID for a language
 */
export function getRandomVoiceId(botLanguage: string): string {
  const voiceIds = getVoiceIdsForLanguage(botLanguage);
  return voiceIds[Math.floor(Math.random() * voiceIds.length)];
}

/**
 * Get a consistent voice ID for a language (first voice in the list)
 */
export function getConsistentVoiceId(botLanguage: string): string {
  const voiceIds = getVoiceIdsForLanguage(botLanguage);
  return voiceIds[0]; // Always use the first voice for consistency
}

/**
 * Get display name for a language
 */
export function getLanguageDisplayName(botLanguage: string): string {
  const mapping = getLanguageMapping(botLanguage);
  return mapping?.displayName || 'English';
}

/**
 * Get all supported languages
 */
export function getSupportedLanguages(): LanguageMapping[] {
  return LANGUAGE_MAPPINGS;
} 