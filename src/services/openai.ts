import OpenAI from 'openai';
import { botConfig } from '../config/config';
import { logger } from '../utils/logger';

export interface PlayerCharacter {
  userId: string;
  username: string;
  name: string;
  class: string;
  race: string;
  level: number;
  background: string;
  description: string;
  stats: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };
  hitPoints: number;
  armorClass: number;
  alignment: string;
}

export interface StorySession {
  sessionId: string;
  partyLevel: number;
  partySize: number;
  currentLocation: string;
  storyContext: string;
  recentEvents: string[];
  activeQuests: string[];
  npcs: string[];
  sessionHistory: string[];
  status: 'character_creation' | 'active' | 'ended';
  players: Map<string, PlayerCharacter>;
  maxPlayers: number;
  voiceChannelId?: string;
}

export class OpenAIService {
  private client: OpenAI;
  private storySessions: Map<string, StorySession> = new Map();

  constructor() {
    this.client = new OpenAI({
      apiKey: botConfig.openaiApiKey,
    });
  }

  /**
   * Start a new D&D session as Dungeon Master
   */
  async startSession(
    sessionId: string,
    partyLevel: number,
    partySize: number,
    campaignTheme: string = 'fantasy adventure',
    voiceChannelId?: string
  ): Promise<string> {
    try {
      logger.info(`Starting session with ID: ${sessionId}, Level: ${partyLevel}, Size: ${partySize}`);
      
      const session: StorySession = {
        sessionId,
        partyLevel,
        partySize,
        currentLocation: 'A mysterious tavern in a bustling city',
        storyContext: `A level ${partyLevel} party of ${partySize} adventurers begins their journey in a ${campaignTheme} campaign.`,
        recentEvents: [],
        activeQuests: [],
        npcs: [],
        sessionHistory: [],
        status: 'character_creation',
        players: new Map(),
        maxPlayers: partySize,
        voiceChannelId
      };

      this.storySessions.set(sessionId, session);
      logger.info(`Session created and stored. Total sessions: ${this.storySessions.size}`);

      const prompt = `You are an experienced Dungeon Master starting a new D&D 5e campaign. 

Campaign Details:
- Party Level: ${partyLevel}
- Party Size: ${partySize} players
- Theme: ${campaignTheme}

The session is now in character creation phase. Players will be creating their characters before the adventure begins.

Create a welcoming message that:
1. Welcomes players to the campaign
2. Explains they need to create their characters using the "Join Session" button
3. Describes the campaign theme and setting
4. Sets expectations for the adventure

Keep your response to 2-3 paragraphs and make it exciting and welcoming.`;

      const response = await this.client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a creative and experienced Dungeon Master who creates immersive D&D experiences. Focus on atmosphere, description, and engaging storytelling.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 400,
        temperature: 0.8,
      });

      const welcomeMessage = response.choices[0]?.message?.content || 'Welcome to the adventure!';
      session.sessionHistory.push(`Session started: ${welcomeMessage}`);
      
      return welcomeMessage;
    } catch (error) {
      logger.error('Error starting DM session:', error);
      return 'Unable to start the session at this time.';
    }
  }

  /**
   * Add a player character to the session
   */
  async addCharacter(
    sessionId: string,
    userId: string,
    username: string,
    characterName: string,
    characterClass: string,
    characterRace: string,
    background: string,
    description: string
  ): Promise<{ success: boolean; message: string; character?: PlayerCharacter }> {
    try {
      logger.info(`Adding character ${characterName} to session ${sessionId} for user ${userId}`);
      
      const session = this.storySessions.get(sessionId);
      if (!session) {
        logger.error(`Session not found for ID: ${sessionId}`);
        logger.debug(`Available sessions: ${Array.from(this.storySessions.keys())}`);
        return { success: false, message: 'Session not found. Please start a new session with /dm start.' };
      }

      if (session.status !== 'character_creation') {
        logger.warn(`Session ${sessionId} is not in character creation phase. Status: ${session.status}`);
        return { success: false, message: 'Character creation phase has ended. Cannot add new characters.' };
      }

      if (session.players.has(userId)) {
        logger.warn(`User ${userId} already has a character in session ${sessionId}`);
        return { success: false, message: 'You have already created a character for this session.' };
      }

      if (session.players.size >= session.maxPlayers) {
        logger.warn(`Session ${sessionId} is full. Cannot add more characters.`);
        return { success: false, message: 'Party is full. Cannot add more characters.' };
      }

      // Generate ability scores
      const abilityScores = this.generateAbilityScores();
      const stats = {
        strength: abilityScores[0],
        dexterity: abilityScores[1],
        constitution: abilityScores[2],
        intelligence: abilityScores[3],
        wisdom: abilityScores[4],
        charisma: abilityScores[5],
      };

      const hitPoints = 10 + this.getAbilityModifier(stats.constitution);
      const armorClass = 10 + this.getAbilityModifier(stats.dexterity);

      const character: PlayerCharacter = {
        userId,
        username,
        name: characterName,
        class: characterClass,
        race: characterRace,
        level: session.partyLevel,
        background,
        description,
        stats,
        hitPoints,
        armorClass,
        alignment: this.generateAlignment()
      };

      session.players.set(userId, character);
      session.sessionHistory.push(`Character added: ${characterName} (${characterRace} ${characterClass})`);
      
      logger.info(`Character ${characterName} added successfully. Session now has ${session.players.size}/${session.maxPlayers} players`);

      // Check if all players have joined
      if (session.players.size === session.maxPlayers) {
        logger.info(`Session ${sessionId} is now full. Starting game...`);
        session.status = 'active';
        const gameStartMessage = await this.startGame(session);
        return { 
          success: true, 
          message: `Character created successfully! ${gameStartMessage}`,
          character
        };
      }

      return { 
        success: true, 
        message: `Character created successfully! Waiting for ${session.maxPlayers - session.players.size} more player(s) to join.`,
        character
      };
    } catch (error) {
      logger.error('Error adding character:', error);
      return { success: false, message: 'Unable to create character at this time.' };
    }
  }

  /**
   * Start the game when all players have joined
   */
  private async startGame(session: StorySession): Promise<string> {
    try {
      const playerNames = Array.from(session.players.values()).map(pc => pc.name).join(', ');
      
      const prompt = `You are the Dungeon Master starting the adventure. All players have created their characters:

Party Members:
${Array.from(session.players.values()).map(pc => 
  `- ${pc.name}, ${pc.race} ${pc.class} (Level ${pc.level})`
).join('\n')}

Create an engaging opening scene that introduces the party to their first adventure. Set the atmosphere, describe the environment, and present an initial hook or quest that will draw the players into the story. Make it immersive and exciting.

Keep your response to 2-3 paragraphs maximum.`;

      const response = await this.client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a creative and experienced Dungeon Master who creates immersive D&D experiences. Focus on atmosphere, description, and engaging storytelling.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 400,
        temperature: 0.8,
      });

      const gameStartMessage = response.choices[0]?.message?.content || 'The adventure begins!';
      session.sessionHistory.push(`Game started: ${gameStartMessage}`);
      session.recentEvents.push(gameStartMessage);
      
      return gameStartMessage;
    } catch (error) {
      logger.error('Error starting game:', error);
      return 'The adventure begins!';
    }
  }

  /**
   * Get character information
   */
  getCharacter(sessionId: string, userId: string): PlayerCharacter | null {
    const session = this.storySessions.get(sessionId);
    if (!session) {
      logger.debug(`No session found for character lookup: ${sessionId}`);
      return null;
    }
    return session.players.get(userId) || null;
  }

  /**
   * Get all characters in a session
   */
  getSessionCharacters(sessionId: string): PlayerCharacter[] {
    const session = this.storySessions.get(sessionId);
    if (!session) {
      logger.debug(`No session found for characters: ${sessionId}`);
      return [];
    }
    return Array.from(session.players.values());
  }

  /**
   * Continue the story based on player actions
   */
  async continueStory(
    sessionId: string,
    playerAction: string,
    diceResults?: string
  ): Promise<string> {
    try {
      const session = this.storySessions.get(sessionId);
      if (!session) {
        return 'Session not found. Please start a new session with /dm start.';
      }

      if (session.status !== 'active') {
        return 'The game has not started yet. Please wait for all players to create their characters.';
      }

      // Update session with recent action
      session.recentEvents.push(playerAction);
      if (diceResults) {
        session.recentEvents.push(`Dice roll: ${diceResults}`);
      }

      const playerNames = Array.from(session.players.values()).map(pc => pc.name).join(', ');

      const prompt = `You are continuing a D&D 5e session as the Dungeon Master.

Session Context:
- Party Level: ${session.partyLevel}
- Current Location: ${session.currentLocation}
- Story Context: ${session.storyContext}
- Recent Events: ${session.recentEvents.slice(-3).join(', ')}
- Party Members: ${playerNames}

Player Action: ${playerAction}
${diceResults ? `Dice Results: ${diceResults}` : ''}

Respond as the DM, describing what happens next based on the player's action. Consider:
- Environmental consequences
- NPC reactions
- Story progression
- Potential new quests or encounters
- Atmosphere and mood

Keep your response to 2-3 paragraphs and make it engaging and descriptive.`;

      const response = await this.client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a responsive Dungeon Master who adapts the story based on player actions. Be descriptive, atmospheric, and maintain story continuity.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 500,
        temperature: 0.7,
      });

      const continuation = response.choices[0]?.message?.content || 'The story continues...';
      session.sessionHistory.push(`Player action: ${playerAction}`);
      session.sessionHistory.push(`DM response: ${continuation}`);
      
      return continuation;
    } catch (error) {
      logger.error('Error continuing story:', error);
      return 'Unable to continue the story at this time.';
    }
  }

  /**
   * Generate an encounter or combat situation
   */
  async generateEncounter(
    sessionId: string,
    encounterType: 'combat' | 'social' | 'exploration' | 'puzzle',
    difficulty: 'easy' | 'medium' | 'hard' | 'deadly' = 'medium'
  ): Promise<string> {
    try {
      const session = this.storySessions.get(sessionId);
      if (!session) {
        return 'Session not found. Please start a new session with /dm start.';
      }

      if (session.status !== 'active') {
        return 'The game has not started yet. Please wait for all players to create their characters.';
      }

      const prompt = `You are the Dungeon Master creating a ${encounterType} encounter.

Session Context:
- Party Level: ${session.partyLevel}
- Party Size: ${session.partySize}
- Current Location: ${session.currentLocation}
- Difficulty: ${difficulty}

Create a ${encounterType} encounter that is appropriate for a level ${session.partyLevel} party. 

For ${encounterType} encounters:
- Combat: Describe enemies, their tactics, and the battlefield
- Social: Present NPCs, dialogue options, and social challenges
- Exploration: Describe the environment, hidden dangers, and discoveries
- Puzzle: Present a logical or magical puzzle with clues

Make it engaging and appropriate for the party's level. Keep your response to 2-3 paragraphs.`;

      const response = await this.client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a creative Dungeon Master who designs engaging encounters that challenge and entertain players.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 400,
        temperature: 0.8,
      });

      const encounter = response.choices[0]?.message?.content || 'An encounter unfolds...';
      session.sessionHistory.push(`Generated ${encounterType} encounter: ${encounter}`);
      
      return encounter;
    } catch (error) {
      logger.error('Error generating encounter:', error);
      return 'Unable to generate encounter at this time.';
    }
  }

  /**
   * Get all session IDs (for debugging)
   */
  getAllSessionIds(): string[] {
    return Array.from(this.storySessions.keys());
  }

  /**
   * Get session status and history
   */
  getSessionStatus(sessionId: string): StorySession | null {
    logger.debug(`Looking for session with ID: ${sessionId}`);
    logger.debug(`Available session IDs: ${Array.from(this.storySessions.keys())}`);
    const session = this.storySessions.get(sessionId);
    if (session) {
      logger.debug(`Session found: ${session.status} with ${session.players.size}/${session.maxPlayers} players`);
    } else {
      logger.debug(`Session not found for ID: ${sessionId}`);
    }
    return session || null;
  }

  /**
   * End a session
   */
  endSession(sessionId: string): boolean {
    return this.storySessions.delete(sessionId);
  }

  /**
   * Generate random ability scores using 4d6 drop lowest
   */
  private generateAbilityScores(): number[] {
    const scores: number[] = [];
    
    for (let i = 0; i < 6; i++) {
      const rolls = [
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
      ];
      
      // Remove lowest roll
      rolls.sort((a, b) => b - a);
      const score = rolls[0] + rolls[1] + rolls[2];
      scores.push(score);
    }
    
    return scores;
  }

  /**
   * Calculate ability modifier
   */
  private getAbilityModifier(score: number): number {
    return Math.floor((score - 10) / 2);
  }

  /**
   * Generate random alignment
   */
  private generateAlignment(): string {
    const alignments = [
      'Lawful Good', 'Neutral Good', 'Chaotic Good',
      'Lawful Neutral', 'True Neutral', 'Chaotic Neutral',
      'Lawful Evil', 'Neutral Evil', 'Chaotic Evil'
    ];
    return alignments[Math.floor(Math.random() * alignments.length)];
  }

  /**
   * Generate D&D character backstory
   */
  async generateCharacterBackstory(
    characterName: string,
    characterClass: string,
    characterRace: string,
    background: string
  ): Promise<string> {
    try {
      const prompt = `Create a compelling backstory for a D&D character with the following details:
- Name: ${characterName}
- Class: ${characterClass}
- Race: ${characterRace}
- Background: ${background}

Write a 2-3 paragraph backstory that explains their origins, motivations, and how they became an adventurer. Make it engaging and suitable for a D&D campaign.`;

      const response = await this.client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a creative D&D storyteller who creates engaging character backstories.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 500,
        temperature: 0.8,
      });

      return response.choices[0]?.message?.content || 'Unable to generate backstory.';
    } catch (error) {
      logger.error('Error generating character backstory:', error);
      return 'Unable to generate backstory at this time.';
    }
  }

  /**
   * Get D&D rules clarification
   */
  async getRulesClarification(question: string): Promise<string> {
    try {
      const prompt = `Answer this D&D 5e rules question: ${question}

Provide a clear, accurate answer based on the official D&D 5e rules. If the answer involves multiple options or interpretations, explain them.`;

      const response = await this.client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a D&D 5e rules expert. Provide accurate, helpful answers about game mechanics and rules.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 400,
        temperature: 0.3,
      });

      return response.choices[0]?.message?.content || 'Unable to provide rules clarification.';
    } catch (error) {
      logger.error('Error getting rules clarification:', error);
      return 'Unable to provide rules clarification at this time.';
    }
  }
} 