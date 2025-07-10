import { DmAiService } from './dmAi';
import { TtsAiService } from './ttsAi';
import { botConfig } from '../config/config';
import { logger } from '../utils/logger';
import { RedisService } from './redis';
import { VoiceService } from './voice';
import type {
  PlayerCharacter,
  StorySession,
  SkillSet,
  Currency,
  InventoryItem,
  SpellSlot,
  Cantrip,
  PlayerDeathEvent,
  ActionAnalysis,
  AutomaticDiceRoll,
  DiceRoll,
} from '../types';
import { QuestStatus, SessionStatus, PlayerStatus } from '../types/enums';

// Helper function to check if expression tags should be used
function shouldUseExpressionTags(): boolean {
  return (
    botConfig.elevenLabs.enabled && botConfig.elevenLabs.modelId === 'eleven_v3'
  );
}

export class OpenAIService {
  private dmAi: DmAiService;
  private ttsAi: TtsAiService;
  private storySessions: Map<string, StorySession> = new Map();
  private redisService: RedisService;
  private voiceService: VoiceService;

  constructor() {
    this.dmAi = new DmAiService();
    this.ttsAi = new TtsAiService();
    this.redisService = new RedisService();
    this.voiceService = new VoiceService();
  }

  /**
   * Save session to Redis
   */
  private async saveSessionToRedis(session: StorySession): Promise<void> {
    try {
      if (!session.voiceChannelId) {
        logger.warn('No voice channel ID for session, cannot save to Redis');
        return;
      }

      // Convert Map to array for JSON serialization
      const sessionForRedis = {
        ...session,
        players: Array.from(session.players.entries()),
        playerActions: Array.from(session.playerActions.entries()),
        pendingActions: Array.from(session.pendingActions.entries()),
        npcInteractions: Array.from(session.npcInteractions.entries()),
        questProgress: Array.from(session.questProgress.entries()),
        environmentalState: Array.from(session.environmentalState.entries()),
      };

      await this.redisService.updateSession(session.voiceChannelId, {
        gameState: sessionForRedis,
      });

      logger.info(
        `OpenAI session saved to Redis for voice channel ${session.voiceChannelId}`
      );
    } catch (error) {
      logger.error('Error saving session to Redis:', error);
    }
  }

  /**
   * Load session from Redis
   */
  private async loadSessionFromRedis(
    voiceChannelId: string
  ): Promise<StorySession | null> {
    try {
      const redisSession = await this.redisService.getSession(voiceChannelId);
      logger.debug(`Redis session data for ${voiceChannelId}:`, redisSession);

      if (!redisSession) {
        logger.debug(
          `No Redis session found for voice channel ${voiceChannelId}`
        );
        return null;
      }

      if (!redisSession.gameState) {
        logger.debug(
          `No gameState in Redis session for voice channel ${voiceChannelId}`
        );
        return null;
      }

      const sessionData = redisSession.gameState as any;
      logger.debug(`Session data from Redis:`, sessionData);

      // Convert array back to Map
      const players = new Map<string, PlayerCharacter>();
      if (sessionData.players && Array.isArray(sessionData.players)) {
        for (const [userId, character] of sessionData.players) {
          players.set(userId, character as PlayerCharacter);
        }
      }

      // Convert playerActions array back to Map
      const playerActions = new Map<string, string[]>();
      if (
        sessionData.playerActions &&
        Array.isArray(sessionData.playerActions)
      ) {
        for (const [userId, actions] of sessionData.playerActions) {
          playerActions.set(userId, actions as string[]);
        }
      }

      // Convert pendingActions array back to Map
      const pendingActions = new Map<
        string,
        { action: string; diceResults?: string; timestamp: number }
      >();
      if (
        sessionData.pendingActions &&
        Array.isArray(sessionData.pendingActions)
      ) {
        for (const [userId, pendingAction] of sessionData.pendingActions) {
          pendingActions.set(
            userId,
            pendingAction as {
              action: string;
              diceResults?: string;
              timestamp: number;
            }
          );
        }
      }

      // Convert npcInteractions array back to Map
      const npcInteractions = new Map<string, string[]>();
      if (
        sessionData.npcInteractions &&
        Array.isArray(sessionData.npcInteractions)
      ) {
        for (const [npcName, interactions] of sessionData.npcInteractions) {
          npcInteractions.set(npcName, interactions as string[]);
        }
      }

      // Convert questProgress array back to Map
      const questProgress = new Map<
        string,
        { status: 'active' | 'completed' | 'failed'; progress: string }
      >();
      if (
        sessionData.questProgress &&
        Array.isArray(sessionData.questProgress)
      ) {
        for (const [questName, progress] of sessionData.questProgress) {
          questProgress.set(
            questName,
            progress as {
              status: 'active' | 'completed' | 'failed';
              progress: string;
            }
          );
        }
      }

      // Convert environmentalState array back to Map
      const environmentalState = new Map<string, string>();
      if (
        sessionData.environmentalState &&
        Array.isArray(sessionData.environmentalState)
      ) {
        for (const [location, state] of sessionData.environmentalState) {
          environmentalState.set(location, state as string);
        }
      }

      const session: StorySession = {
        ...sessionData,
        players,
        playerActions,
        pendingActions,
        npcInteractions,
        questProgress,
        environmentalState,
        language: sessionData.language || 'en', // Default to English if not found
        // Initialize new properties if not found
        storySummary: sessionData.storySummary || 'A new adventure begins.',
        currentScene:
          sessionData.currentScene ||
          'The party finds themselves in a mysterious location.',
        importantEvents: sessionData.importantEvents || [],
        lastStoryBeat: sessionData.lastStoryBeat || 'Session initialization',
        sessionRound: sessionData.sessionRound || 0,
      };

      // Also store in memory for quick access
      this.storySessions.set(voiceChannelId, session);

      logger.info(
        `OpenAI session loaded from Redis for voice channel ${voiceChannelId}`
      );
      return session;
    } catch (error) {
      logger.error('Error loading session from Redis:', error);
      return null;
    }
  }

  /**
   * Start a new D&D session as Dungeon Master
   */
  async startSession(
    sessionId: string,
    partyLevel: number,
    partySize: number,
    campaignTheme: string = 'fantasy adventure',
    voiceChannelId?: string,
    guildId?: string,
    language: string = 'en'
  ): Promise<string> {
    try {
      logger.info(
        `Starting session with ID: ${sessionId}, Level: ${partyLevel}, Size: ${partySize}, Language: ${language}`
      );

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
        status: SessionStatus.CHARACTER_CREATION,
        players: new Map(),
        maxPlayers: partySize,
        voiceChannelId,
        guildId,
        playerActions: new Map(),
        pendingActions: new Map(),
        language,
        // Initialize enhanced story context
        storySummary: `A new adventure begins for a level ${partyLevel} party of ${partySize} adventurers in a ${campaignTheme} setting.`,
        currentScene:
          'The party finds themselves in a bustling tavern, the starting point of their journey.',
        importantEvents: [],
        npcInteractions: new Map(),
        questProgress: new Map(),
        environmentalState: new Map(),
        lastStoryBeat: 'Session initialization',
        sessionRound: 0,
      };

      this.storySessions.set(sessionId, session);
      logger.info(
        `Session created and stored. Total sessions: ${this.storySessions.size}`
      );

      // Save to Redis if voice channel ID is provided
      if (voiceChannelId) {
        await this.saveSessionToRedis(session);
      }

      const languageInstruction = this.getLanguageInstruction(language);

      const prompt = `You are an experienced Dungeon Master starting a new D&D 5e campaign. 

${languageInstruction}

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

      const response = await this.dmAi.chat([
        {
          role: 'system',
          content: `You are a creative and experienced Dungeon Master who creates immersive D&D experiences. Focus on atmosphere, description, and engaging storytelling. ${languageInstruction}`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ]);

      const welcomeMessage = response || 'Welcome to the adventure!';
      session.sessionHistory.push(`Session started: ${welcomeMessage}`);

      // Save updated session to Redis
      if (voiceChannelId) {
        await this.saveSessionToRedis(session);
      }

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
  ): Promise<{
    success: boolean;
    message: string;
    character?: PlayerCharacter;
  }> {
    try {
      logger.info(
        `Adding character ${characterName} to session ${sessionId} for user ${userId}`
      );
      logger.debug(
        `Available sessions: ${Array.from(this.storySessions.keys())}`
      );

      const session = this.storySessions.get(sessionId);
      if (!session) {
        logger.error(`Session not found for ID: ${sessionId}`);
        logger.debug(
          `Available sessions: ${Array.from(this.storySessions.keys())}`
        );

        // Try to find session by voice channel ID
        for (const [key, value] of this.storySessions.entries()) {
          if (value.voiceChannelId === sessionId) {
            logger.info(`Found session by voice channel ID: ${key}`);
            const foundSession = value;
            // Continue with the found session
            return this.addCharacterToSession(
              foundSession,
              userId,
              username,
              characterName,
              characterClass,
              characterRace,
              background,
              description
            );
          }
        }

        return {
          success: false,
          message:
            'Session not found. Please start a new session with /dm start.',
        };
      }

      return this.addCharacterToSession(
        session,
        userId,
        username,
        characterName,
        characterClass,
        characterRace,
        background,
        description
      );
    } catch (error) {
      logger.error('Error adding character:', error);
      return {
        success: false,
        message: 'Unable to create character at this time.',
      };
    }
  }

  /**
   * Add character to an existing session
   */
  private async addCharacterToSession(
    session: StorySession,
    userId: string,
    username: string,
    characterName: string,
    characterClass: string,
    characterRace: string,
    background: string,
    description: string
  ): Promise<{
    success: boolean;
    message: string;
    character?: PlayerCharacter;
  }> {
    try {
      // Check if player already exists
      if (session.players.has(userId)) {
        return {
          success: false,
          message: 'You already have a character in this session.',
        };
      }

      // Check if session is full
      if (session.players.size >= session.maxPlayers) {
        return {
          success: false,
          message: 'Session is full. Cannot add more players.',
        };
      }

      // Generate ability scores
      const abilityScores = this.generateAbilityScores();
      const [
        strength,
        dexterity,
        constitution,
        intelligence,
        wisdom,
        charisma,
      ] = abilityScores;

      // Calculate HP based on class and constitution
      const baseHP = this.getClassBaseHP(characterClass);
      const constitutionModifier = this.getAbilityModifier(constitution);
      const hitPoints = baseHP + constitutionModifier;
      const maxHitPoints = hitPoints;

      // Calculate armor class based on class and dexterity
      const armorClass = this.calculateArmorClass(characterClass, dexterity);

      // Generate alignment
      const alignment = this.generateAlignment();

      // Initialize new character systems
      const skills = this.initializeSkills(characterClass, background, {
        strength,
        dexterity,
        constitution,
        intelligence,
        wisdom,
        charisma,
      });
      const currency = this.initializeCurrency(characterClass, background);
      const inventory = this.initializeInventory(characterClass, background);
      const spellSlots = this.initializeSpellSlots(characterClass);
      const cantrips = this.initializeCantrips(characterClass);
      const spells: any[] = []; // Will be populated based on class

      const character: PlayerCharacter = {
        userId,
        username,
        name: characterName,
        class: characterClass,
        race: characterRace,
        level: 1,
        background,
        description,
        stats: {
          strength,
          dexterity,
          constitution,
          intelligence,
          wisdom,
          charisma,
        },
        hitPoints,
        maxHitPoints,
        armorClass,
        alignment,
        status: PlayerStatus.ALIVE,
        // New comprehensive systems
        skills,
        currency,
        inventory,
        spellSlots,
        cantrips,
        spells,
        proficiencyBonus: 2, // Level 1 proficiency bonus
        experiencePoints: 0,
        inspiration: false,
        exhaustion: 0,
        initiative: this.getAbilityModifier(dexterity),
        speed: this.getClassSpeed(),
        languages: this.getClassLanguages(characterRace),
        features: this.getClassFeatures(characterClass),
        proficiencies: this.getClassProficiencies(characterClass),
      };

      session.players.set(userId, character);
      await this.saveSessionToRedis(session);

      logger.info(
        `Character ${characterName} added to session ${session.sessionId}`
      );

      // Check if all players have joined and start the game
      logger.debug(
        `Session ${session.sessionId}: players ${session.players.size}/${session.maxPlayers}, status: ${session.status}`
      );
      if (
        session.players.size === session.maxPlayers &&
        session.status !== SessionStatus.ACTIVE
      ) {
        logger.info(
          `All players have joined session ${session.sessionId}. Starting game...`
        );
        session.status = SessionStatus.ACTIVE;
        const gameStartMessage = await this.startGame(session);
        await this.saveSessionToRedis(session);

        return {
          success: true,
          message: gameStartMessage,
          character,
        };
      }

      return {
        success: true,
        message: `Character ${characterName} created successfully! You are now ready to play.`,
        character,
      };
    } catch (error) {
      logger.error('Error adding character to session:', error);
      return {
        success: false,
        message: 'Failed to create character. Please try again.',
      };
    }
  }

  /**
   * Start the game when all players have joined
   */
  private async startGame(session: StorySession): Promise<string> {
    try {
      const languageInstruction = this.getLanguageInstruction(session.language);

      const prompt = `You are the Dungeon Master starting the adventure. All players have created their characters:

${languageInstruction}

Party Members:
${Array.from(session.players.values())
  .map(pc => `- ${pc.name}, ${pc.race} ${pc.class} (Level ${pc.level})`)
  .join('\n')}

Create an engaging opening scene that introduces the party to their first adventure. Set the atmosphere, describe the environment, and present an initial hook or quest that will draw the players into the story. Make it immersive and exciting.

${
  shouldUseExpressionTags()
    ? `IMPORTANT: Include voice expression tags in your text to make the narration more expressive. Use these tags:
- [whispers] for quiet, secretive speech
- [sarcastic] for sarcastic or mocking tones
- [excited] for enthusiastic or energetic speech
- [crying] for emotional or sad moments
- [laughs] for humorous situations
- [sighs] for tired or resigned moments
- [curious] for inquisitive or questioning tones
- [mischievously] for playful or sneaky behavior

Example: "Seorang tetua desa, Nyonya Elara, mendekati kalian dengan wajah penuh kecemasan. [whispers]'Hutan itu berbicara,' bisiknya."`
    : ''
}

Keep your response to 2-3 paragraphs maximum.`;

      const response = await this.dmAi.chat([
        {
          role: 'system',
          content: `You are a creative and experienced Dungeon Master who creates immersive D&D experiences. Focus on atmosphere, description, and engaging storytelling.${shouldUseExpressionTags() ? ' ALWAYS include voice expression tags like [whispers], [excited], [sarcastic], etc. to make the narration more expressive and engaging.' : ''} ${languageInstruction}`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ]);

      const gameStartMessage = response || 'The adventure begins!';
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
  async getCharacter(
    sessionId: string,
    userId: string
  ): Promise<PlayerCharacter | null> {
    // First try to get from memory
    const session = this.storySessions.get(sessionId);
    if (session) {
      const character = session.players.get(userId);
      if (character) {
        return character;
      }
    }

    // If not found in memory, try to load from Redis
    try {
      const redisSession = await this.loadSessionFromRedis(sessionId);
      if (redisSession) {
        return redisSession.players.get(userId) || null;
      }
    } catch (error) {
      logger.error(
        'Error loading session from Redis for character lookup:',
        error
      );
    }

    logger.debug(
      `No character found for user ${userId} in session ${sessionId}`
    );
    return null;
  }

  /**
   * Get all characters in a session
   */
  async getSessionCharacters(sessionId: string): Promise<PlayerCharacter[]> {
    // First try to get from memory
    const session = this.storySessions.get(sessionId);
    if (session) {
      return Array.from(session.players.values());
    }

    // If not found in memory, try to load from Redis
    try {
      const redisSession = await this.loadSessionFromRedis(sessionId);
      if (redisSession) {
        return Array.from(redisSession.players.values());
      }
    } catch (error) {
      logger.error(
        'Error loading session from Redis for characters lookup:',
        error
      );
    }

    logger.debug(`No session found for characters: ${sessionId}`);
    return [];
  }

  /**
   * Continue the story based on player actions
   */
  async continueStory(
    sessionId: string,
    playerAction: string,
    userId?: string
  ): Promise<string> {
    try {
      const session = this.storySessions.get(sessionId);
      if (!session) {
        return 'Session not found. Please start a new session with /dm start.';
      }

      if (session.status !== 'active') {
        return 'The game has not started yet. Please wait for all players to create their characters.';
      }

      // Check if user is alive (if userId provided)
      if (userId && !(await this.isPlayerAlive(sessionId, userId))) {
        return 'You cannot perform actions while your character is dead.';
      }

      // Check if all players are dead
      if (await this.areAllPlayersDead(sessionId)) {
        return 'All players have fallen in battle. The session has ended.';
      }

      // Get character for automatic dice roll
      const character = userId ? session.players.get(userId) : undefined;

      // Generate automatic dice roll based on action
      const automaticRoll = await this.generateAutomaticDiceRoll(
        sessionId,
        playerAction,
        character
      );

      // Update session with recent action
      session.recentEvents.push(playerAction);
      if (automaticRoll) {
        const rollDescription = this.formatDiceRollResult(automaticRoll);
        session.recentEvents.push(`Automatic dice roll: ${rollDescription}`);
      }

      // Increment session round
      session.sessionRound++;

      const alivePlayers = await this.getAlivePlayers(sessionId);
      const playerNames = alivePlayers.map(pc => pc.name).join(', ');

      // Build comprehensive story context
      const recentEvents = session.recentEvents.slice(-10); // Last 10 events instead of 3
      const importantEvents = session.importantEvents.slice(-5); // Last 5 important events
      const npcInteractionsText = Array.from(session.npcInteractions.entries())
        .map(
          ([npc, interactions]) =>
            `${npc}: ${interactions.slice(-3).join(', ')}`
        )
        .join('\n');
      const questProgressText = Array.from(session.questProgress.entries())
        .map(
          ([quest, progress]) =>
            `${quest}: ${progress.status} - ${progress.progress}`
        )
        .join('\n');
      const environmentalStateText = Array.from(
        session.environmentalState.entries()
      )
        .map(([location, state]) => `${location}: ${state}`)
        .join('\n');

      const prompt = `You are continuing a D&D 5e session as the Dungeon Master.

${this.getLanguageInstruction(session.language)}

**SESSION CONTEXT:**
- Session Round: ${session.sessionRound}
- Party Level: ${session.partyLevel}
- Current Location: ${session.currentLocation}
- Story Summary: ${session.storySummary}
- Current Scene: ${session.currentScene}
- Last Story Beat: ${session.lastStoryBeat}

**PARTY INFORMATION:**
- Alive Party Members: ${playerNames}
- Party Size: ${session.partySize}

**STORY HISTORY:**
- Recent Events (Last 10): ${recentEvents.join(' | ')}
- Important Events: ${importantEvents.join(' | ')}
- NPC Interactions: ${npcInteractionsText || 'None yet'}
- Quest Progress: ${questProgressText || 'No active quests'}
- Environmental State: ${environmentalStateText || 'Default state'}

**CURRENT ACTION:**
Player Action: ${playerAction}
${automaticRoll ? `Automatic Dice Roll: ${this.formatDiceRollResult(automaticRoll)}` : 'No dice roll required'}

**INSTRUCTIONS:**
Respond as the DM, describing what happens next based on the player's action. Consider:
- How this action connects to previous events and story beats
- Environmental consequences and changes
- NPC reactions based on previous interactions
- Story progression and continuity
- Quest implications and updates
- Atmosphere and mood changes
- The fact that only alive players can act
- Maintaining story coherence with previous events
${automaticRoll ? `- The dice roll result and whether it was successful (${automaticRoll.success ? 'SUCCESS' : 'FAILURE'})` : ''}

${
  shouldUseExpressionTags()
    ? `IMPORTANT: Include voice expression tags in your text to make the narration more expressive. Use these tags:
- [whispers] for quiet, secretive speech
- [sarcastic] for sarcastic or mocking tones
- [excited] for enthusiastic or energetic speech
- [crying] for emotional or sad moments
- [laughs] for humorous situations
- [sighs] for tired or resigned moments
- [curious] for inquisitive or questioning tones
- [mischievously] for playful or sneaky behavior

Example: "Seorang tetua desa, Nyonya Elara, mendekati kalian dengan wajah penuh kecemasan. [whispers]'Hutan itu berbicara,' bisiknya."`
    : ''
}

Keep your response to 3-4 paragraphs and make it engaging and descriptive. Ensure the story flows naturally from previous events.`;

      const response = await this.dmAi.chat([
        {
          role: 'system',
          content: `You are a responsive Dungeon Master who maintains excellent story continuity and adapts the story based on player actions. Be descriptive, atmospheric, and ensure each response builds upon previous events and maintains narrative coherence.${shouldUseExpressionTags() ? ' ALWAYS include voice expression tags like [whispers], [excited], [sarcastic], etc. to make the narration more expressive and engaging.' : ''} ${this.getLanguageInstruction(session.language)}`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ]);

      const continuation = response || 'The story continues...';

      // Update story context
      session.sessionHistory.push(
        `Round ${session.sessionRound} - Player action: ${playerAction}`
      );
      if (automaticRoll) {
        session.sessionHistory.push(
          `Round ${session.sessionRound} - Dice roll: ${this.formatDiceRollResult(automaticRoll)}`
        );
      }
      session.sessionHistory.push(
        `Round ${session.sessionRound} - DM response: ${continuation}`
      );
      session.lastStoryBeat = continuation;

      // Update current scene based on the response
      if (
        continuation.includes('scene') ||
        continuation.includes('location') ||
        continuation.includes('area')
      ) {
        session.currentScene = continuation.split('.')[0] + '.';
      }

      // Save to Redis
      if (session.voiceChannelId) {
        await this.saveSessionToRedis(session);
      }

      return continuation;
    } catch (error) {
      logger.error('Error continuing story:', error);
      return 'Unable to continue the story at this time.';
    }
  }

  /**
   * Track a player action for the current round
   */
  async trackPlayerAction(
    sessionId: string,
    userId: string,
    action: string
  ): Promise<{
    success: boolean;
    message: string;
    allPlayersActed?: boolean;
    diceRoll?: AutomaticDiceRoll;
  }> {
    try {
      const session = this.storySessions.get(sessionId);
      if (!session) {
        return { success: false, message: 'Session not found.' };
      }

      if (session.status !== 'active') {
        return { success: false, message: 'The game has not started yet.' };
      }

      // Check if player is alive
      if (!(await this.isPlayerAlive(sessionId, userId))) {
        return {
          success: false,
          message: 'You cannot perform actions while your character is dead.',
        };
      }

      // Check if all players are dead
      if (await this.areAllPlayersDead(sessionId)) {
        return {
          success: false,
          message: 'All players have fallen in battle. The session has ended.',
        };
      }

      // Check if player already acted this round
      if (session.pendingActions.has(userId)) {
        return {
          success: false,
          message:
            'You have already acted this round. Please wait for the DM to continue the story.',
        };
      }

      // Get character for automatic dice roll
      const character = session.players.get(userId);

      // Generate automatic dice roll based on action
      const automaticRoll = await this.generateAutomaticDiceRoll(
        sessionId,
        action,
        character
      );

      // Add action to pending actions
      session.pendingActions.set(userId, {
        action,
        diceResults: automaticRoll
          ? this.formatDiceRollResult(automaticRoll)
          : undefined,
        timestamp: Date.now(),
      });

      // Add to player's action history
      if (!session.playerActions.has(userId)) {
        session.playerActions.set(userId, []);
      }
      session.playerActions.get(userId)!.push(action);

      // Save to Redis
      if (session.voiceChannelId) {
        await this.saveSessionToRedis(session);
      }

      // Check if all ALIVE players have acted
      const alivePlayers = await this.getAlivePlayers(sessionId);
      const allAlivePlayersActed = alivePlayers.every(player =>
        session.pendingActions.has(player.userId)
      );

      if (allAlivePlayersActed) {
        logger.info(
          `All alive players have acted in session ${sessionId}. Continuing story...`
        );
        return {
          success: true,
          message: 'All alive players have acted. Continuing the story...',
          allPlayersActed: true,
          diceRoll: automaticRoll || undefined,
        };
      } else {
        const remainingAlivePlayers = alivePlayers.filter(
          player => !session.pendingActions.has(player.userId)
        ).length;
        return {
          success: true,
          message: `Action recorded. Waiting for ${remainingAlivePlayers} more alive player(s) to act.`,
          diceRoll: automaticRoll || undefined,
        };
      }
    } catch (error) {
      logger.error('Error tracking player action:', error);
      return {
        success: false,
        message: 'Unable to record action at this time.',
      };
    }
  }

  /**
   * Continue the story with all player actions
   */
  async continueStoryWithAllActions(sessionId: string): Promise<string> {
    try {
      const session = this.storySessions.get(sessionId);
      if (!session) {
        return 'Session not found. Please start a new session with /dm start.';
      }

      if (session.status !== 'active') {
        return 'The game has not started yet. Please wait for all players to create their characters.';
      }

      if (session.pendingActions.size === 0) {
        return 'No player actions to process.';
      }

      // Collect all player actions
      const playerActionsList: string[] = [];
      const characterNames: string[] = [];
      const diceRollsList: string[] = [];

      for (const [userId, pendingAction] of session.pendingActions.entries()) {
        const character = session.players.get(userId);
        if (character) {
          const actionText = pendingAction.diceResults
            ? `${character.name}: ${pendingAction.action} (${pendingAction.diceResults})`
            : `${character.name}: ${pendingAction.action}`;
          playerActionsList.push(actionText);
          characterNames.push(character.name);

          if (pendingAction.diceResults) {
            diceRollsList.push(
              `${character.name}: ${pendingAction.diceResults}`
            );
          }
        }
      }

      const allActionsText = playerActionsList.join('\n');
      const allDiceRollsText = diceRollsList.join('\n');
      const playerNames = characterNames.join(', ');

      // Update session with recent actions
      session.recentEvents.push(...playerActionsList);
      if (diceRollsList.length > 0) {
        session.recentEvents.push(`Automatic dice rolls: ${allDiceRollsText}`);
      }
      session.sessionHistory.push(
        `Round ${session.sessionRound} - All actions: ${allActionsText}`
      );

      // Increment session round
      session.sessionRound++;

      // Build comprehensive story context
      const recentEvents = session.recentEvents.slice(-15); // Last 15 events for group actions
      const importantEvents = session.importantEvents.slice(-5);
      const npcInteractionsText = Array.from(session.npcInteractions.entries())
        .map(
          ([npc, interactions]) =>
            `${npc}: ${interactions.slice(-3).join(', ')}`
        )
        .join('\n');
      const questProgressText = Array.from(session.questProgress.entries())
        .map(
          ([quest, progress]) =>
            `${quest}: ${progress.status} - ${progress.progress}`
        )
        .join('\n');
      const environmentalStateText = Array.from(
        session.environmentalState.entries()
      )
        .map(([location, state]) => `${location}: ${state}`)
        .join('\n');

      const languageInstruction = this.getLanguageInstruction(session.language);

      const prompt = `You are continuing a D&D 5e session as the Dungeon Master.

${languageInstruction}

**SESSION CONTEXT:**
- Session Round: ${session.sessionRound}
- Party Level: ${session.partyLevel}
- Current Location: ${session.currentLocation}
- Story Summary: ${session.storySummary}
- Current Scene: ${session.currentScene}
- Last Story Beat: ${session.lastStoryBeat}

**PARTY INFORMATION:**
- Alive Party Members: ${playerNames}
- Party Size: ${session.partySize}

**STORY HISTORY:**
- Recent Events (Last 15): ${recentEvents.join(' | ')}
- Important Events: ${importantEvents.join(' | ')}
- NPC Interactions: ${npcInteractionsText || 'None yet'}
- Quest Progress: ${questProgressText || 'No active quests'}
- Environmental State: ${environmentalStateText || 'Default state'}

**ALL PLAYER ACTIONS THIS ROUND:**
${allActionsText}
${diceRollsList.length > 0 ? `\n**AUTOMATIC DICE ROLLS:**\n${allDiceRollsText}` : ''}

**INSTRUCTIONS:**
Respond as the DM, describing what happens next based on ALL the players' actions. Consider:
- How the actions interact with each other and previous events
- Environmental consequences and changes from combined actions
- NPC reactions to the combined actions
- Story progression and continuity with previous events
- Quest implications and updates
- Atmosphere and mood changes
- Any conflicts or synergies between player actions
- Maintaining story coherence with the entire session history
${diceRollsList.length > 0 ? '- The results of the automatic dice rolls and their impact on the story' : ''}

${
  shouldUseExpressionTags()
    ? `IMPORTANT: Include voice expression tags in your text to make the narration more expressive. Use these tags:
- [whispers] for quiet, secretive speech
- [sarcastic] for sarcastic or mocking tones
- [excited] for enthusiastic or energetic speech
- [crying] for emotional or sad moments
- [laughs] for humorous situations
- [sighs] for tired or resigned moments
- [curious] for inquisitive or questioning tones
- [mischievously] for playful or sneaky behavior

Example: "Seorang tetua desa, Nyonya Elara, mendekati kalian dengan wajah penuh kecemasan. [whispers]'Hutan itu berbicara,' bisiknya."`
    : ''
}

Keep your response to 4-5 paragraphs and make it engaging and descriptive. Address how the different actions work together or conflict, and ensure the story flows naturally from all previous events.`;

      const response = await this.dmAi.chat([
        {
          role: 'system',
          content: `You are a responsive Dungeon Master who maintains excellent story continuity and adapts the story based on player actions. Be descriptive, atmospheric, and ensure each response builds upon previous events and maintains narrative coherence.${shouldUseExpressionTags() ? ' ALWAYS include voice expression tags like [whispers], [excited], [sarcastic], etc. to make the narration more expressive and engaging.' : ''} ${languageInstruction}`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ]);

      const continuation = response || 'The story continues...';

      // Update story context
      session.sessionHistory.push(
        `Round ${session.sessionRound} - DM response: ${continuation}`
      );
      session.lastStoryBeat = continuation;

      // Update current scene based on the response
      if (
        continuation.includes('scene') ||
        continuation.includes('location') ||
        continuation.includes('area')
      ) {
        session.currentScene = continuation.split('.')[0] + '.';
      }

      // Clear pending actions
      session.pendingActions.clear();

      // Save to Redis
      if (session.voiceChannelId) {
        await this.saveSessionToRedis(session);
      }

      return continuation;
    } catch (error) {
      logger.error('Error continuing story with all actions:', error);
      return 'Unable to continue the story at this time.';
    }
  }

  /**
   * Get pending actions count for a session
   */
  async getPendingActionsCount(sessionId: string): Promise<number> {
    try {
      const session = this.storySessions.get(sessionId);
      if (!session) {
        return 0;
      }
      return session.pendingActions.size;
    } catch (error) {
      logger.error('Error getting pending actions count:', error);
      return 0;
    }
  }

  /**
   * Get all pending actions for a session
   */
  async getPendingActions(sessionId: string): Promise<
    Array<{
      userId: string;
      characterName: string;
      action: string;
      diceResults?: string;
    }>
  > {
    try {
      const session = this.storySessions.get(sessionId);
      if (!session) {
        return [];
      }

      const pendingActions: Array<{
        userId: string;
        characterName: string;
        action: string;
        diceResults?: string;
      }> = [];

      for (const [userId, pendingAction] of session.pendingActions.entries()) {
        const character = session.players.get(userId);
        if (character) {
          pendingActions.push({
            userId,
            characterName: character.name,
            action: pendingAction.action,
            diceResults: pendingAction.diceResults,
          });
        }
      }

      return pendingActions;
    } catch (error) {
      logger.error('Error getting pending actions:', error);
      return [];
    }
  }

  /**
   * Narrate a story response in voice channel (separate method)
   */
  async narrateStoryResponse(
    sessionId: string,
    storyText: string
  ): Promise<void> {
    try {
      const session = this.storySessions.get(sessionId);
      if (!session?.voiceChannelId) {
        return;
      }

      await this.voiceService.narrateStoryEvent(
        session.voiceChannelId,
        session.guildId || '',
        storyText,
        undefined, // client parameter
        session.language, // language parameter
        sessionId // session ID parameter
      );
    } catch (voiceError) {
      logger.error('Error narrating story in voice channel:', voiceError);
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

      const languageInstruction = this.getLanguageInstruction(session.language);

      const prompt = `You are the Dungeon Master creating a ${encounterType} encounter.

${languageInstruction}

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

${
  shouldUseExpressionTags()
    ? `IMPORTANT: Include voice expression tags in your text to make the narration more expressive. Use these tags:
- [whispers] for quiet, secretive speech
- [sarcastic] for sarcastic or mocking tones
- [excited] for enthusiastic or energetic speech
- [crying] for emotional or sad moments
- [laughs] for humorous situations
- [sighs] for tired or resigned moments
- [curious] for inquisitive or questioning tones
- [mischievously] for playful or sneaky behavior

Example: "Seorang tetua desa, Nyonya Elara, mendekati kalian dengan wajah penuh kecemasan. [whispers]'Hutan itu berbicara,' bisiknya."`
    : ''
}

Make it engaging and appropriate for the party's level. Keep your response to 2-3 paragraphs.`;

      const response = await this.dmAi.chat([
        {
          role: 'system',
          content: `You are a creative Dungeon Master who designs engaging encounters that challenge and entertain players.${shouldUseExpressionTags() ? ' ALWAYS include voice expression tags like [whispers], [excited], [sarcastic], etc. to make the narration more expressive and engaging.' : ''} ${languageInstruction}`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ]);

      const encounter = response || 'An encounter unfolds...';
      session.sessionHistory.push(
        `Generated ${encounterType} encounter: ${encounter}`
      );

      // Return the encounter immediately, voice narration will be handled separately
      return encounter;
    } catch (error) {
      logger.error('Error generating encounter:', error);
      return 'Unable to generate encounter at this time.';
    }
  }

  /**
   * Narrate an encounter in voice channel (separate method)
   */
  async narrateEncounter(
    sessionId: string,
    encounterText: string
  ): Promise<void> {
    try {
      const session = this.storySessions.get(sessionId);
      if (!session?.voiceChannelId) {
        return;
      }

      await this.voiceService.narrateStoryEvent(
        session.voiceChannelId,
        session.guildId || '',
        encounterText,
        undefined, // client parameter
        session.language, // language parameter
        sessionId // session ID parameter
      );
    } catch (voiceError) {
      logger.error('Error narrating encounter in voice channel:', voiceError);
    }
  }

  /**
   * Get all session IDs (for debugging)
   */
  getAllSessionIds(): string[] {
    return Array.from(this.storySessions.keys());
  }

  /**
   * Debug method to get all session details
   */
  getAllSessionDetails(): Array<{ key: string; session: StorySession }> {
    const details: Array<{ key: string; session: StorySession }> = [];
    for (const [key, session] of this.storySessions.entries()) {
      details.push({ key, session });
    }
    return details;
  }

  /**
   * Get session status
   */
  async getSessionStatus(sessionId: string): Promise<StorySession | null> {
    // First check in memory
    let session = this.storySessions.get(sessionId);

    if (!session) {
      // Try to load from Redis
      try {
        const redisSession = await this.loadSessionFromRedis(sessionId);
        if (redisSession) {
          this.storySessions.set(sessionId, redisSession);
          session = redisSession;
        }
      } catch (error) {
        logger.error('Error loading session from Redis:', error);
      }
    }

    // If still not found, try to find by voice channel ID in memory
    if (!session) {
      for (const [key, value] of this.storySessions.entries()) {
        if (value.voiceChannelId === sessionId) {
          logger.info(
            `Found session by voice channel ID: ${key} -> ${sessionId}`
          );
          session = value;
          // Store it with the voice channel ID as key for future lookups
          this.storySessions.set(sessionId, session);
          break;
        }
      }
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
      'Lawful Good',
      'Neutral Good',
      'Chaotic Good',
      'Lawful Neutral',
      'True Neutral',
      'Chaotic Neutral',
      'Lawful Evil',
      'Neutral Evil',
      'Chaotic Evil',
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

      const response = await this.dmAi.chat([
        {
          role: 'system',
          content:
            'You are a creative D&D storyteller who creates engaging character backstories.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ]);

      return response || 'Unable to generate backstory.';
    } catch (error) {
      logger.error('Error generating character backstory:', error);
      return 'Unable to generate backstory at this time.';
    }
  }

  /**
   * Get rules clarification
   */
  async getRulesClarification(question: string): Promise<string> {
    try {
      const prompt = `You are a D&D 5e rules expert. Answer the following question about D&D 5e rules clearly and concisely:

Question: ${question}

Provide a clear, accurate answer based on official D&D 5e rules. If the question is about a specific rule, cite the relevant source if possible.`;

      const response = await this.dmAi.chat([
        {
          role: 'system',
          content:
            'You are a helpful D&D 5e rules expert. Provide accurate, clear answers about game rules.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ]);

      return response || 'Unable to provide rules clarification at this time.';
    } catch (error) {
      logger.error('Error getting rules clarification:', error);
      return 'Unable to provide rules clarification at this time.';
    }
  }

  /**
   * Update player status (alive/dead/unconscious)
   */
  async updatePlayerStatus(
    sessionId: string,
    userId: string,
    status: PlayerStatus
  ): Promise<void> {
    try {
      const session = this.storySessions.get(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      const character = session.players.get(userId);
      if (!character) {
        throw new Error(`Character not found for user ${userId}`);
      }

      character.status = status;

      // Update status in Redis if voice channel is available
      if (session.voiceChannelId) {
        await this.redisService.updatePlayerStatus(
          session.voiceChannelId,
          userId,
          status
        );
        await this.saveSessionToRedis(session);
      }

      logger.info(
        `Updated player ${userId} status to ${status} in session ${sessionId}`
      );
    } catch (error) {
      logger.error('Error updating player status:', error);
      throw error;
    }
  }

  /**
   * Handle player death
   */
  async handlePlayerDeath(
    sessionId: string,
    userId: string,
    cause: string
  ): Promise<{ sessionEnded: boolean; message: string }> {
    try {
      const session = this.storySessions.get(sessionId);
      if (!session) {
        return { sessionEnded: false, message: 'Session not found.' };
      }

      const character = session.players.get(userId);
      if (!character) {
        return { sessionEnded: false, message: 'Character not found.' };
      }

      // Update character status to dead
      character.status = PlayerStatus.DEAD;
      character.hitPoints = 0;

      // Update status in Redis
      if (session.voiceChannelId) {
        await this.redisService.updatePlayerStatus(
          session.voiceChannelId,
          userId,
          PlayerStatus.DEAD
        );

        // Record death event
        const deathEvent: PlayerDeathEvent = {
          playerId: userId,
          characterName: character.name,
          cause,
          timestamp: Date.now(),
        };
        await this.redisService.recordPlayerDeath(
          session.voiceChannelId,
          deathEvent
        );
      }

      // Check if all players are dead
      const alivePlayers = Array.from(session.players.values()).filter(
        pc => pc.status === 'alive' || pc.status === 'unconscious'
      );

      if (alivePlayers.length === 0) {
        // All players are dead - end session
        session.status = SessionStatus.ENDED;

        if (session.voiceChannelId) {
          await this.redisService.endSessionDueToAllPlayersDead(
            session.voiceChannelId
          );
        }

        const deadCharacters = Array.from(session.players.values())
          .map(pc => pc.name)
          .join(', ');
        const message = `**GAME OVER**\n\nAll players have fallen in battle:\n${deadCharacters}\n\nThe session has ended. The party's journey has come to a tragic end.`;

        logger.info(`All players dead in session ${sessionId}. Session ended.`);
        return { sessionEnded: true, message };
      } else {
        // Some players still alive
        const remainingPlayers = alivePlayers.map(pc => pc.name).join(', ');
        const message = `${character.name} has fallen in battle. ${remainingPlayers} remain to continue the adventure.`;

        logger.info(
          `Player ${userId} died in session ${sessionId}. ${alivePlayers.length} players remaining.`
        );
        return { sessionEnded: false, message };
      }
    } catch (error) {
      logger.error('Error handling player death:', error);
      return { sessionEnded: false, message: 'Error handling player death.' };
    }
  }

  /**
   * Check if a player is alive
   */
  async isPlayerAlive(sessionId: string, userId: string): Promise<boolean> {
    try {
      const session = this.storySessions.get(sessionId);
      if (!session) {
        return false;
      }

      const character = session.players.get(userId);
      if (!character) {
        return false;
      }

      return character.status === 'alive' || character.status === 'unconscious';
    } catch (error) {
      logger.error('Error checking if player is alive:', error);
      return false;
    }
  }

  /**
   * Get alive players for a session
   */
  async getAlivePlayers(sessionId: string): Promise<PlayerCharacter[]> {
    try {
      const session = this.storySessions.get(sessionId);
      if (!session) {
        return [];
      }

      return Array.from(session.players.values()).filter(
        pc => pc.status === 'alive' || pc.status === 'unconscious'
      );
    } catch (error) {
      logger.error('Error getting alive players:', error);
      return [];
    }
  }

  /**
   * Get dead players for a session
   */
  async getDeadPlayers(sessionId: string): Promise<PlayerCharacter[]> {
    try {
      const session = this.storySessions.get(sessionId);
      if (!session) {
        return [];
      }

      return Array.from(session.players.values()).filter(
        pc => pc.status === PlayerStatus.DEAD
      );
    } catch (error) {
      logger.error('Error getting dead players:', error);
      return [];
    }
  }

  /**
   * Check if all players are dead
   */
  async areAllPlayersDead(sessionId: string): Promise<boolean> {
    try {
      const alivePlayers = await this.getAlivePlayers(sessionId);
      return alivePlayers.length === 0;
    } catch (error) {
      logger.error('Error checking if all players are dead:', error);
      return false;
    }
  }

  /**
   * Update story summary
   */
  async updateStorySummary(
    sessionId: string,
    newSummary: string
  ): Promise<void> {
    try {
      const session = this.storySessions.get(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      session.storySummary = newSummary;

      if (session.voiceChannelId) {
        await this.saveSessionToRedis(session);
      }

      logger.info(`Updated story summary for session ${sessionId}`);
    } catch (error) {
      logger.error('Error updating story summary:', error);
      throw error;
    }
  }

  /**
   * Add important event to story context
   */
  async addImportantEvent(sessionId: string, event: string): Promise<void> {
    try {
      const session = this.storySessions.get(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      session.importantEvents.push(event);

      // Keep only last 10 important events
      if (session.importantEvents.length > 10) {
        session.importantEvents = session.importantEvents.slice(-10);
      }

      if (session.voiceChannelId) {
        await this.saveSessionToRedis(session);
      }

      logger.info(`Added important event to session ${sessionId}: ${event}`);
    } catch (error) {
      logger.error('Error adding important event:', error);
      throw error;
    }
  }

  /**
   * Track NPC interaction
   */
  async trackNPCInteraction(
    sessionId: string,
    npcName: string,
    interaction: string
  ): Promise<void> {
    try {
      const session = this.storySessions.get(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      if (!session.npcInteractions.has(npcName)) {
        session.npcInteractions.set(npcName, []);
      }

      session.npcInteractions.get(npcName)!.push(interaction);

      // Keep only last 5 interactions per NPC
      const interactions = session.npcInteractions.get(npcName)!;
      if (interactions.length > 5) {
        session.npcInteractions.set(npcName, interactions.slice(-5));
      }

      if (session.voiceChannelId) {
        await this.saveSessionToRedis(session);
      }

      logger.info(
        `Tracked NPC interaction for ${npcName} in session ${sessionId}`
      );
    } catch (error) {
      logger.error('Error tracking NPC interaction:', error);
      throw error;
    }
  }

  /**
   * Update quest progress
   */
  async updateQuestProgress(
    sessionId: string,
    questName: string,
    status: QuestStatus,
    progress: string
  ): Promise<void> {
    try {
      const session = this.storySessions.get(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      session.questProgress.set(questName, { status, progress });

      if (session.voiceChannelId) {
        await this.saveSessionToRedis(session);
      }

      logger.info(
        `Updated quest progress for ${questName} in session ${sessionId}: ${status} - ${progress}`
      );
    } catch (error) {
      logger.error('Error updating quest progress:', error);
      throw error;
    }
  }

  /**
   * Update environmental state
   */
  async updateEnvironmentalState(
    sessionId: string,
    location: string,
    state: string
  ): Promise<void> {
    try {
      const session = this.storySessions.get(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      session.environmentalState.set(location, state);

      if (session.voiceChannelId) {
        await this.saveSessionToRedis(session);
      }

      logger.info(
        `Updated environmental state for ${location} in session ${sessionId}: ${state}`
      );
    } catch (error) {
      logger.error('Error updating environmental state:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive story context for a session
   */
  async getStoryContext(sessionId: string): Promise<{
    summary: string;
    currentScene: string;
    recentEvents: string[];
    importantEvents: string[];
    npcInteractions: Map<string, string[]>;
    questProgress: Map<
      string,
      { status: 'active' | 'completed' | 'failed'; progress: string }
    >;
    environmentalState: Map<string, string>;
    lastStoryBeat: string;
    sessionRound: number;
  }> {
    try {
      const session = this.storySessions.get(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      return {
        summary: session.storySummary,
        currentScene: session.currentScene,
        recentEvents: session.recentEvents.slice(-10),
        importantEvents: session.importantEvents.slice(-5),
        npcInteractions: session.npcInteractions,
        questProgress: session.questProgress,
        environmentalState: session.environmentalState,
        lastStoryBeat: session.lastStoryBeat,
        sessionRound: session.sessionRound,
      };
    } catch (error) {
      logger.error('Error getting story context:', error);
      throw error;
    }
  }

  /**
   * Update current location
   */
  async updateCurrentLocation(
    sessionId: string,
    newLocation: string
  ): Promise<void> {
    try {
      const session = this.storySessions.get(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      session.currentLocation = newLocation;

      if (session.voiceChannelId) {
        await this.saveSessionToRedis(session);
      }

      logger.info(
        `Updated current location for session ${sessionId}: ${newLocation}`
      );
    } catch (error) {
      logger.error('Error updating current location:', error);
      throw error;
    }
  }

  /**
   * Analyze player action to determine required dice rolls
   */
  async analyzeAction(
    sessionId: string,
    action: string,
    character?: PlayerCharacter
  ): Promise<ActionAnalysis> {
    try {
      const lowerAction = action.toLowerCase();

      // Initialize default analysis
      const analysis: ActionAnalysis = {
        requiresRoll: false,
        diceType: 'd20',
        modifier: 0,
      };

      // Get character stats for modifier calculation
      const stats = character?.stats || {
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      };

      // Combat actions
      if (
        lowerAction.includes('attack') ||
        lowerAction.includes('hit') ||
        lowerAction.includes('strike') ||
        lowerAction.includes('sword') ||
        lowerAction.includes('weapon') ||
        lowerAction.includes('fight')
      ) {
        analysis.requiresRoll = true;
        analysis.attackRoll = true;
        analysis.modifier = this.getAbilityModifier(stats.strength); // Default to strength
        analysis.difficultyClass = 15; // Default AC
        return analysis;
      }

      // Skill checks
      if (
        lowerAction.includes('climb') ||
        lowerAction.includes('jump') ||
        lowerAction.includes('lift')
      ) {
        analysis.requiresRoll = true;
        analysis.skillCheck = 'Athletics';
        analysis.modifier = this.getAbilityModifier(stats.strength);
        analysis.difficultyClass = 12;
        return analysis;
      }

      if (
        lowerAction.includes('stealth') ||
        lowerAction.includes('sneak') ||
        lowerAction.includes('hide')
      ) {
        analysis.requiresRoll = true;
        analysis.skillCheck = 'Stealth';
        analysis.modifier = this.getAbilityModifier(stats.dexterity);
        analysis.difficultyClass = 14;
        return analysis;
      }

      if (
        lowerAction.includes('perception') ||
        lowerAction.includes('spot') ||
        lowerAction.includes('notice') ||
        lowerAction.includes('search') ||
        lowerAction.includes('look')
      ) {
        analysis.requiresRoll = true;
        analysis.skillCheck = 'Perception';
        analysis.modifier = this.getAbilityModifier(stats.wisdom);
        analysis.difficultyClass = 13;
        return analysis;
      }

      if (
        lowerAction.includes('investigation') ||
        lowerAction.includes('examine') ||
        lowerAction.includes('analyze')
      ) {
        analysis.requiresRoll = true;
        analysis.skillCheck = 'Investigation';
        analysis.modifier = this.getAbilityModifier(stats.intelligence);
        analysis.difficultyClass = 13;
        return analysis;
      }

      if (
        lowerAction.includes('persuasion') ||
        lowerAction.includes('convince') ||
        lowerAction.includes('negotiate')
      ) {
        analysis.requiresRoll = true;
        analysis.skillCheck = 'Persuasion';
        analysis.modifier = this.getAbilityModifier(stats.charisma);
        analysis.difficultyClass = 15;
        return analysis;
      }

      if (
        lowerAction.includes('intimidation') ||
        lowerAction.includes('threaten') ||
        lowerAction.includes('scare')
      ) {
        analysis.requiresRoll = true;
        analysis.skillCheck = 'Intimidation';
        analysis.modifier = this.getAbilityModifier(stats.charisma);
        analysis.difficultyClass = 14;
        return analysis;
      }

      if (
        lowerAction.includes('deception') ||
        lowerAction.includes('lie') ||
        lowerAction.includes('bluff')
      ) {
        analysis.requiresRoll = true;
        analysis.skillCheck = 'Deception';
        analysis.modifier = this.getAbilityModifier(stats.charisma);
        analysis.difficultyClass = 14;
        return analysis;
      }

      if (
        lowerAction.includes('insight') ||
        lowerAction.includes('read') ||
        lowerAction.includes('understand')
      ) {
        analysis.requiresRoll = true;
        analysis.skillCheck = 'Insight';
        analysis.modifier = this.getAbilityModifier(stats.wisdom);
        analysis.difficultyClass = 13;
        return analysis;
      }

      if (
        lowerAction.includes('acrobatics') ||
        lowerAction.includes('balance') ||
        lowerAction.includes('tumble')
      ) {
        analysis.requiresRoll = true;
        analysis.skillCheck = 'Acrobatics';
        analysis.modifier = this.getAbilityModifier(stats.dexterity);
        analysis.difficultyClass = 12;
        return analysis;
      }

      if (
        lowerAction.includes('sleight of hand') ||
        lowerAction.includes('pickpocket') ||
        lowerAction.includes('steal')
      ) {
        analysis.requiresRoll = true;
        analysis.skillCheck = 'Sleight of Hand';
        analysis.modifier = this.getAbilityModifier(stats.dexterity);
        analysis.difficultyClass = 15;
        return analysis;
      }

      if (
        lowerAction.includes('survival') ||
        lowerAction.includes('track') ||
        lowerAction.includes('hunt')
      ) {
        analysis.requiresRoll = true;
        analysis.skillCheck = 'Survival';
        analysis.modifier = this.getAbilityModifier(stats.wisdom);
        analysis.difficultyClass = 12;
        return analysis;
      }

      if (
        lowerAction.includes('nature') ||
        lowerAction.includes('identify') ||
        lowerAction.includes('knowledge')
      ) {
        analysis.requiresRoll = true;
        analysis.skillCheck = 'Nature';
        analysis.modifier = this.getAbilityModifier(stats.intelligence);
        analysis.difficultyClass = 13;
        return analysis;
      }

      if (
        lowerAction.includes('arcana') ||
        lowerAction.includes('magic') ||
        lowerAction.includes('spell')
      ) {
        analysis.requiresRoll = true;
        analysis.skillCheck = 'Arcana';
        analysis.modifier = this.getAbilityModifier(stats.intelligence);
        analysis.difficultyClass = 13;
        return analysis;
      }

      if (
        lowerAction.includes('history') ||
        lowerAction.includes('remember') ||
        lowerAction.includes('recall')
      ) {
        analysis.requiresRoll = true;
        analysis.skillCheck = 'History';
        analysis.modifier = this.getAbilityModifier(stats.intelligence);
        analysis.difficultyClass = 13;
        return analysis;
      }

      if (
        lowerAction.includes('religion') ||
        lowerAction.includes('divine') ||
        lowerAction.includes('holy')
      ) {
        analysis.requiresRoll = true;
        analysis.skillCheck = 'Religion';
        analysis.modifier = this.getAbilityModifier(stats.intelligence);
        analysis.difficultyClass = 13;
        return analysis;
      }

      if (
        lowerAction.includes('medicine') ||
        lowerAction.includes('heal') ||
        lowerAction.includes('treat')
      ) {
        analysis.requiresRoll = true;
        analysis.skillCheck = 'Medicine';
        analysis.modifier = this.getAbilityModifier(stats.wisdom);
        analysis.difficultyClass = 13;
        return analysis;
      }

      if (
        lowerAction.includes('animal handling') ||
        lowerAction.includes('calm') ||
        lowerAction.includes('train')
      ) {
        analysis.requiresRoll = true;
        analysis.skillCheck = 'Animal Handling';
        analysis.modifier = this.getAbilityModifier(stats.wisdom);
        analysis.difficultyClass = 12;
        return analysis;
      }

      if (
        lowerAction.includes('performance') ||
        lowerAction.includes('entertain') ||
        lowerAction.includes('act')
      ) {
        analysis.requiresRoll = true;
        analysis.skillCheck = 'Performance';
        analysis.modifier = this.getAbilityModifier(stats.charisma);
        analysis.difficultyClass = 13;
        return analysis;
      }

      // Saving throws
      if (
        lowerAction.includes('resist') ||
        lowerAction.includes('save') ||
        lowerAction.includes('avoid')
      ) {
        analysis.requiresRoll = true;
        analysis.savingThrow = 'Dexterity'; // Default to dex save
        analysis.modifier = this.getAbilityModifier(stats.dexterity);
        analysis.difficultyClass = 13;
        return analysis;
      }

      // Damage rolls (for successful attacks)
      if (
        lowerAction.includes('damage') ||
        lowerAction.includes('hurt') ||
        lowerAction.includes('wound')
      ) {
        analysis.requiresRoll = true;
        analysis.damageRoll = '1d8'; // Default damage
        analysis.diceType = 'd8';
        analysis.modifier = 0;
        return analysis;
      }

      // Initiative
      if (
        lowerAction.includes('initiative') ||
        lowerAction.includes('react') ||
        lowerAction.includes('quick')
      ) {
        analysis.requiresRoll = true;
        analysis.modifier = this.getAbilityModifier(stats.dexterity);
        analysis.difficultyClass = 0; // Initiative doesn't have DC
        return analysis;
      }

      // Default: no roll required for roleplay actions
      return analysis;
    } catch (error) {
      logger.error('Error analyzing action:', error);
      return {
        requiresRoll: false,
        diceType: 'd20',
        modifier: 0,
      };
    }
  }

  /**
   * Generate automatic dice roll based on action analysis
   */
  async generateAutomaticDiceRoll(
    sessionId: string,
    action: string,
    character?: PlayerCharacter
  ): Promise<AutomaticDiceRoll | null> {
    try {
      const analysis = await this.analyzeAction(sessionId, action, character);

      if (!analysis.requiresRoll) {
        return null;
      }

      // Generate the dice roll
      const roll = this.generateDiceRoll(analysis.diceType, analysis.modifier);

      // Determine success/failure
      const total = roll.total;
      const dc = analysis.difficultyClass || 0;
      const success = total >= dc;
      const criticalSuccess = roll.rolls.includes(20);
      const criticalFailure = roll.rolls.includes(1);

      const automaticRoll: AutomaticDiceRoll = {
        action,
        diceType: analysis.diceType,
        modifier: analysis.modifier,
        difficultyClass: analysis.difficultyClass,
        success,
        criticalSuccess,
        criticalFailure,
        roll,
      };

      logger.info(
        `Generated automatic dice roll for action: ${action} - Result: ${total} (DC: ${dc})`
      );
      return automaticRoll;
    } catch (error) {
      logger.error('Error generating automatic dice roll:', error);
      return null;
    }
  }

  /**
   * Generate a dice roll with specified dice and modifier
   */
  private generateDiceRoll(diceType: string, modifier: number): DiceRoll {
    try {
      // Parse dice notation (e.g., "2d6+3" or "d20")
      const diceMatch = diceType.match(/^(\d+)?d(\d+)([+-]\d+)?$/);
      if (!diceMatch) {
        throw new Error(`Invalid dice notation: ${diceType}`);
      }

      const numDice = parseInt(diceMatch[1] || '1');
      const diceSize = parseInt(diceMatch[2]);
      const bonus = diceMatch[3] ? parseInt(diceMatch[3]) : 0;

      // Roll the dice
      const rolls: number[] = [];
      for (let i = 0; i < numDice; i++) {
        rolls.push(Math.floor(Math.random() * diceSize) + 1);
      }

      const total =
        rolls.reduce((sum, roll) => sum + roll, 0) + modifier + bonus;
      const notation = `${numDice}d${diceSize}${bonus >= 0 ? '+' + bonus : bonus}${modifier >= 0 ? '+' + modifier : modifier}`;

      return {
        result: total,
        rolls,
        modifier: modifier + bonus,
        total,
        notation,
      };
    } catch (error) {
      logger.error('Error generating dice roll:', error);
      // Fallback to simple d20 roll
      const roll = Math.floor(Math.random() * 20) + 1;
      return {
        result: roll + modifier,
        rolls: [roll],
        modifier,
        total: roll + modifier,
        notation: `d20${modifier >= 0 ? '+' + modifier : modifier}`,
      };
    }
  }

  /**
   * Initialize character skills based on class and background
   */
  private initializeSkills(
    characterClass: string,
    background: string,
    stats: any
  ): SkillSet {
    const proficiencyBonus = Math.floor((1 - 1) / 4) + 2; // Level 1 proficiency bonus

    // Base skill modifiers (ability modifier only)
    const skills: SkillSet = {
      athletics: {
        proficient: false,
        modifier: this.getAbilityModifier(stats.strength),
      },
      acrobatics: {
        proficient: false,
        modifier: this.getAbilityModifier(stats.dexterity),
      },
      sleightOfHand: {
        proficient: false,
        modifier: this.getAbilityModifier(stats.dexterity),
      },
      stealth: {
        proficient: false,
        modifier: this.getAbilityModifier(stats.dexterity),
      },
      arcana: {
        proficient: false,
        modifier: this.getAbilityModifier(stats.intelligence),
      },
      history: {
        proficient: false,
        modifier: this.getAbilityModifier(stats.intelligence),
      },
      investigation: {
        proficient: false,
        modifier: this.getAbilityModifier(stats.intelligence),
      },
      nature: {
        proficient: false,
        modifier: this.getAbilityModifier(stats.intelligence),
      },
      religion: {
        proficient: false,
        modifier: this.getAbilityModifier(stats.intelligence),
      },
      animalHandling: {
        proficient: false,
        modifier: this.getAbilityModifier(stats.wisdom),
      },
      insight: {
        proficient: false,
        modifier: this.getAbilityModifier(stats.wisdom),
      },
      medicine: {
        proficient: false,
        modifier: this.getAbilityModifier(stats.wisdom),
      },
      perception: {
        proficient: false,
        modifier: this.getAbilityModifier(stats.wisdom),
      },
      survival: {
        proficient: false,
        modifier: this.getAbilityModifier(stats.wisdom),
      },
      deception: {
        proficient: false,
        modifier: this.getAbilityModifier(stats.charisma),
      },
      intimidation: {
        proficient: false,
        modifier: this.getAbilityModifier(stats.charisma),
      },
      performance: {
        proficient: false,
        modifier: this.getAbilityModifier(stats.charisma),
      },
      persuasion: {
        proficient: false,
        modifier: this.getAbilityModifier(stats.charisma),
      },
    };

    // Class skill proficiencies
    const classSkills = this.getClassSkillProficiencies(characterClass);
    classSkills.forEach(skill => {
      if (skills[skill as keyof SkillSet]) {
        skills[skill as keyof SkillSet].proficient = true;
        skills[skill as keyof SkillSet].modifier += proficiencyBonus;
      }
    });

    // Background skill proficiencies
    const backgroundSkills = this.getBackgroundSkillProficiencies(background);
    backgroundSkills.forEach(skill => {
      if (skills[skill as keyof SkillSet]) {
        skills[skill as keyof SkillSet].proficient = true;
        skills[skill as keyof SkillSet].modifier += proficiencyBonus;
      }
    });

    return skills;
  }

  /**
   * Get class skill proficiencies
   */
  private getClassSkillProficiencies(characterClass: string): string[] {
    const classSkills: { [key: string]: string[] } = {
      fighter: ['athletics', 'intimidation'],
      wizard: ['arcana', 'history', 'investigation', 'religion'],
      cleric: ['insight', 'medicine', 'persuasion', 'religion'],
      rogue: [
        'acrobatics',
        'athletics',
        'deception',
        'insight',
        'intimidation',
        'investigation',
        'perception',
        'sleightOfHand',
        'stealth',
      ],
      ranger: [
        'animalHandling',
        'athletics',
        'insight',
        'investigation',
        'nature',
        'perception',
        'stealth',
        'survival',
      ],
      paladin: [
        'athletics',
        'insight',
        'intimidation',
        'medicine',
        'persuasion',
        'religion',
      ],
      barbarian: [
        'animalHandling',
        'athletics',
        'intimidation',
        'nature',
        'perception',
        'survival',
      ],
      bard: [
        'acrobatics',
        'animalHandling',
        'arcana',
        'athletics',
        'deception',
        'history',
        'insight',
        'intimidation',
        'investigation',
        'medicine',
        'nature',
        'perception',
        'performance',
        'persuasion',
        'religion',
        'sleightOfHand',
        'stealth',
        'survival',
      ],
      druid: [
        'animalHandling',
        'arcana',
        'athletics',
        'insight',
        'medicine',
        'nature',
        'perception',
        'religion',
        'survival',
      ],
      monk: [
        'acrobatics',
        'athletics',
        'history',
        'insight',
        'religion',
        'stealth',
      ],
      sorcerer: [
        'arcana',
        'deception',
        'insight',
        'intimidation',
        'persuasion',
        'religion',
      ],
      warlock: [
        'arcana',
        'deception',
        'history',
        'intimidation',
        'investigation',
        'nature',
        'religion',
      ],
      artificer: [
        'arcana',
        'history',
        'investigation',
        'medicine',
        'nature',
        'perception',
        'sleightOfHand',
      ],
    };

    // Get the base class skills
    const baseSkills = classSkills[characterClass.toLowerCase()] || [
      'athletics',
      'perception',
    ];

    // Some classes get to choose additional skills
    const choiceClasses: {
      [key: string]: { choices: string[]; count: number };
    } = {
      fighter: {
        choices: [
          'acrobatics',
          'athletics',
          'history',
          'insight',
          'intimidation',
          'perception',
          'survival',
        ],
        count: 2,
      },
      wizard: {
        choices: ['arcana', 'history', 'insight', 'investigation', 'religion'],
        count: 2,
      },
      cleric: {
        choices: ['history', 'insight', 'medicine', 'persuasion', 'religion'],
        count: 2,
      },
      rogue: {
        choices: [
          'acrobatics',
          'athletics',
          'deception',
          'insight',
          'intimidation',
          'investigation',
          'perception',
          'performance',
          'persuasion',
          'sleightOfHand',
          'stealth',
        ],
        count: 4,
      },
      ranger: {
        choices: [
          'animalHandling',
          'athletics',
          'insight',
          'investigation',
          'nature',
          'perception',
          'stealth',
          'survival',
        ],
        count: 3,
      },
      paladin: {
        choices: [
          'athletics',
          'insight',
          'intimidation',
          'medicine',
          'persuasion',
          'religion',
        ],
        count: 2,
      },
      barbarian: {
        choices: [
          'animalHandling',
          'athletics',
          'intimidation',
          'nature',
          'perception',
          'survival',
        ],
        count: 2,
      },
      bard: {
        choices: [
          'acrobatics',
          'animalHandling',
          'arcana',
          'athletics',
          'deception',
          'history',
          'insight',
          'intimidation',
          'investigation',
          'medicine',
          'nature',
          'perception',
          'performance',
          'persuasion',
          'religion',
          'sleightOfHand',
          'stealth',
          'survival',
        ],
        count: 3,
      },
      druid: {
        choices: [
          'animalHandling',
          'arcana',
          'athletics',
          'insight',
          'medicine',
          'nature',
          'perception',
          'religion',
          'survival',
        ],
        count: 2,
      },
      monk: {
        choices: [
          'acrobatics',
          'athletics',
          'history',
          'insight',
          'religion',
          'stealth',
        ],
        count: 2,
      },
      sorcerer: {
        choices: [
          'arcana',
          'deception',
          'insight',
          'intimidation',
          'persuasion',
          'religion',
        ],
        count: 2,
      },
      warlock: {
        choices: [
          'arcana',
          'deception',
          'history',
          'intimidation',
          'investigation',
          'nature',
          'religion',
        ],
        count: 2,
      },
      artificer: {
        choices: [
          'arcana',
          'history',
          'investigation',
          'medicine',
          'nature',
          'perception',
          'sleightOfHand',
        ],
        count: 2,
      },
    };

    const choiceInfo = choiceClasses[characterClass.toLowerCase()];
    if (choiceInfo) {
      // For now, we'll select the first N skills from the choice list
      // In a real implementation, this would be player choice
      const selectedSkills = choiceInfo.choices.slice(0, choiceInfo.count);
      return [...baseSkills, ...selectedSkills];
    }

    return baseSkills;
  }

  /**
   * Get background skill proficiencies
   */
  private getBackgroundSkillProficiencies(background: string): string[] {
    const backgroundSkills: { [key: string]: string[] } = {
      acolyte: ['insight', 'religion'],
      criminal: ['deception', 'stealth'],
      'folk hero': ['animalHandling', 'survival'],
      noble: ['history', 'persuasion'],
      sage: ['arcana', 'history'],
      soldier: ['athletics', 'intimidation'],
      urchin: ['sleightOfHand', 'stealth'],
      entertainer: ['acrobatics', 'performance'],
      'guild artisan': ['insight', 'persuasion'],
      hermit: ['medicine', 'religion'],
      outlander: ['athletics', 'survival'],
      charlatan: ['deception', 'sleightOfHand'],
      'city watch': ['athletics', 'insight'],
      'clan crafter': ['history', 'insight'],
      'cloistered scholar': ['history', 'religion'],
      courtier: ['insight', 'persuasion'],
      'criminal spy': ['deception', 'stealth'],
      'entertainer gladiator': ['acrobatics', 'performance'],
      'faction agent': ['insight', 'intimidation'],
      'far traveler': ['insight', 'perception'],
      'haunted one': ['arcana', 'investigation'],
      'knight of the order': ['persuasion', 'religion'],
      'mercenary veteran': ['athletics', 'persuasion'],
      'urban bounty hunter': ['deception', 'stealth'],
      'waterdhavian noble': ['insight', 'persuasion'],
    };

    return (
      backgroundSkills[background.toLowerCase()] || ['athletics', 'perception']
    );
  }

  /**
   * Initialize character currency
   */
  private initializeCurrency(
    characterClass: string,
    background: string
  ): Currency {
    // D&D 5e starting gold by class (from Player's Handbook)
    const classGold: { [key: string]: number } = {
      fighter: 150,
      wizard: 80,
      cleric: 125,
      rogue: 120,
      ranger: 150,
      paladin: 150,
      barbarian: 150,
      bard: 125,
      druid: 125,
      monk: 80,
      sorcerer: 80,
      warlock: 80,
      artificer: 125,
    };

    const baseGold = classGold[characterClass.toLowerCase()] || 100;

    // Background gold bonus (some backgrounds provide additional gold)
    const backgroundGold: { [key: string]: number } = {
      noble: 25,
      'guild artisan': 15,
      criminal: 15,
      soldier: 10,
      sage: 10,
      acolyte: 15,
      'folk hero': 10,
      urchin: 10,
      entertainer: 15,
      hermit: 5,
      outlander: 10,
      charlatan: 15,
    };

    const backgroundBonus = backgroundGold[background.toLowerCase()] || 0;
    const totalGold = baseGold + backgroundBonus;

    // Convert to different currencies (D&D 5e standard conversion)
    // 1 platinum = 10 gold
    // 1 gold = 10 silver = 100 copper
    // 1 electrum = 5 silver = 0.5 gold
    const gold = Math.floor(totalGold * 0.7); // Keep most as gold
    const silver = Math.floor(totalGold * 0.2); // Some silver for smaller purchases
    const copper = Math.floor(totalGold * 0.1); // Small amount of copper for minor expenses
    const electrum = Math.floor(totalGold * 0.02); // Rare electrum pieces
    const platinum = Math.floor(totalGold * 0.01); // Very rare platinum pieces

    return {
      copper,
      silver,
      electrum,
      gold,
      platinum,
    };
  }

  /**
   * Initialize character inventory with starting equipment
   */
  private initializeInventory(
    characterClass: string,
    background: string
  ): InventoryItem[] {
    const inventory: InventoryItem[] = [];

    // Add starting equipment based on class
    const classEquipment = this.getClassStartingEquipment(characterClass);
    classEquipment.forEach(item => {
      inventory.push({
        id: this.generateItemId(),
        name: item.name,
        description: item.description,
        quantity: item.quantity || 1,
        weight: item.weight || 0,
        value: item.value || 0,
        rarity: item.rarity || 'common',
        type: item.type || 'gear',
        properties: item.properties || [],
        attunement: item.attunement || false,
        equipped: item.equipped || false,
      });
    });

    // Add background equipment
    const backgroundEquipment = this.getBackgroundStartingEquipment(background);
    backgroundEquipment.forEach(item => {
      inventory.push({
        id: this.generateItemId(),
        name: item.name,
        description: item.description,
        quantity: item.quantity || 1,
        weight: item.weight || 0,
        value: item.value || 0,
        rarity: item.rarity || 'common',
        type: item.type || 'gear',
        properties: item.properties || [],
        attunement: item.attunement || false,
        equipped: item.equipped || false,
      });
    });

    return inventory;
  }

  /**
   * Generate unique item ID
   */
  private generateItemId(): string {
    return `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get class starting equipment
   */
  private getClassStartingEquipment(characterClass: string): any[] {
    const equipment: { [key: string]: any[] } = {
      fighter: [
        {
          name: 'Chain Mail',
          description: 'Heavy armor (AC 16, disadvantage on Stealth)',
          type: 'armor',
          value: 75,
          weight: 55,
          equipped: true,
          properties: ['Heavy', 'Disadvantage on Stealth'],
        },
        {
          name: 'Longsword',
          description: 'Martial melee weapon (1d8 slashing, versatile 1d10)',
          type: 'weapon',
          value: 15,
          weight: 3,
          equipped: true,
          properties: ['Versatile'],
        },
        {
          name: 'Shield',
          description: 'Shield (+2 AC)',
          type: 'armor',
          value: 10,
          weight: 6,
          equipped: true,
          properties: ['+2 AC'],
        },
        {
          name: 'Crossbow, light',
          description: 'Simple ranged weapon (1d8 piercing, 80/320 ft)',
          type: 'weapon',
          value: 25,
          weight: 5,
          properties: ['Ammunition', 'Loading', 'Two-handed'],
        },
        {
          name: 'Crossbow bolts',
          description: 'Ammunition for crossbow',
          type: 'gear',
          quantity: 20,
          value: 1,
          weight: 1.5,
        },
        {
          name: "Dungeoneer's Pack",
          description:
            'Backpack, bedroll, tinderbox, 10 torches, 10 days rations, waterskin, 50 ft rope',
          type: 'gear',
          value: 12,
          weight: 61.5,
        },
      ],
      wizard: [
        {
          name: 'Spellbook',
          description: 'Contains your spells',
          type: 'gear',
          value: 0,
          weight: 3,
        },
        {
          name: "Scholar's Pack",
          description:
            'Backpack, book of lore, ink pen, 10 sheets parchment, little bag of sand, small knife',
          type: 'gear',
          value: 40,
          weight: 11,
        },
        {
          name: 'Component Pouch',
          description: 'For spell components',
          type: 'gear',
          value: 25,
          weight: 2,
        },
        {
          name: 'Arcane Focus',
          description: 'Crystal, orb, rod, staff, or wand for spellcasting',
          type: 'gear',
          value: 10,
          weight: 1,
        },
      ],
      cleric: [
        {
          name: 'Chain Mail',
          description: 'Heavy armor (AC 16, disadvantage on Stealth)',
          type: 'armor',
          value: 75,
          weight: 55,
          equipped: true,
          properties: ['Heavy', 'Disadvantage on Stealth'],
        },
        {
          name: 'Mace',
          description: 'Simple melee weapon (1d6 bludgeoning)',
          type: 'weapon',
          value: 5,
          weight: 4,
          equipped: true,
        },
        {
          name: 'Shield',
          description: 'Shield (+2 AC)',
          type: 'armor',
          value: 10,
          weight: 6,
          equipped: true,
          properties: ['+2 AC'],
        },
        {
          name: "Priest's Pack",
          description:
            'Backpack, blanket, tinderbox, 10 candles, 5 days rations, waterskin, 50 ft rope',
          type: 'gear',
          value: 19,
          weight: 25,
        },
        {
          name: 'Holy Symbol',
          description: 'Divine focus for spellcasting',
          type: 'gear',
          value: 5,
          weight: 1,
        },
      ],
      rogue: [
        {
          name: 'Leather Armor',
          description: 'Light armor (AC 11 + Dex)',
          type: 'armor',
          value: 10,
          weight: 10,
          equipped: true,
          properties: ['Light'],
        },
        {
          name: 'Shortsword',
          description: 'Martial melee weapon (1d6 piercing, finesse, light)',
          type: 'weapon',
          value: 10,
          weight: 2,
          equipped: true,
          properties: ['Finesse', 'Light'],
        },
        {
          name: 'Shortbow',
          description: 'Simple ranged weapon (1d6 piercing, 80/320 ft)',
          type: 'weapon',
          value: 25,
          weight: 2,
          properties: ['Ammunition', 'Two-handed'],
        },
        {
          name: 'Arrows',
          description: 'Ammunition for bow',
          type: 'gear',
          quantity: 20,
          value: 1,
          weight: 1,
        },
        {
          name: "Burglar's Pack",
          description:
            'Backpack, 1000 ball bearings, 10 ft string, bell, 5 candles, crowbar, hammer, 10 pitons, hooded lantern, 2 oil flasks, 5 days rations, tinderbox, waterskin, 50 ft rope',
          type: 'gear',
          value: 16,
          weight: 46.5,
        },
      ],
      ranger: [
        {
          name: 'Leather Armor',
          description: 'Light armor (AC 11 + Dex)',
          type: 'armor',
          value: 10,
          weight: 10,
          equipped: true,
          properties: ['Light'],
        },
        {
          name: 'Longbow',
          description: 'Martial ranged weapon (1d8 piercing, 150/600 ft)',
          type: 'weapon',
          value: 50,
          weight: 2,
          equipped: true,
          properties: ['Ammunition', 'Heavy', 'Two-handed'],
        },
        {
          name: 'Arrows',
          description: 'Ammunition for bow',
          type: 'gear',
          quantity: 20,
          value: 1,
          weight: 1,
        },
        {
          name: "Explorer's Pack",
          description:
            'Backpack, bedroll, mess kit, tinderbox, 10 torches, 10 days rations, waterskin, 50 ft rope',
          type: 'gear',
          value: 10,
          weight: 59,
        },
      ],
      paladin: [
        {
          name: 'Chain Mail',
          description: 'Heavy armor (AC 16, disadvantage on Stealth)',
          type: 'armor',
          value: 75,
          weight: 55,
          equipped: true,
          properties: ['Heavy', 'Disadvantage on Stealth'],
        },
        {
          name: 'Longsword',
          description: 'Martial melee weapon (1d8 slashing, versatile 1d10)',
          type: 'weapon',
          value: 15,
          weight: 3,
          equipped: true,
          properties: ['Versatile'],
        },
        {
          name: 'Shield',
          description: 'Shield (+2 AC)',
          type: 'armor',
          value: 10,
          weight: 6,
          equipped: true,
          properties: ['+2 AC'],
        },
        {
          name: "Priest's Pack",
          description:
            'Backpack, blanket, tinderbox, 10 candles, 5 days rations, waterskin, 50 ft rope',
          type: 'gear',
          value: 19,
          weight: 25,
        },
        {
          name: 'Holy Symbol',
          description: 'Divine focus for spellcasting',
          type: 'gear',
          value: 5,
          weight: 1,
        },
      ],
      barbarian: [
        {
          name: 'Greataxe',
          description:
            'Martial melee weapon (1d12 slashing, heavy, two-handed)',
          type: 'weapon',
          value: 30,
          weight: 7,
          equipped: true,
          properties: ['Heavy', 'Two-handed'],
        },
        {
          name: 'Handaxe',
          description:
            'Simple melee weapon (1d6 slashing, light, thrown 20/60)',
          type: 'weapon',
          value: 5,
          weight: 2,
          properties: ['Light', 'Thrown'],
        },
        {
          name: 'Handaxe',
          description:
            'Simple melee weapon (1d6 slashing, light, thrown 20/60)',
          type: 'weapon',
          value: 5,
          weight: 2,
          properties: ['Light', 'Thrown'],
        },
        {
          name: "Explorer's Pack",
          description:
            'Backpack, bedroll, mess kit, tinderbox, 10 torches, 10 days rations, waterskin, 50 ft rope',
          type: 'gear',
          value: 10,
          weight: 59,
        },
      ],
      bard: [
        {
          name: 'Leather Armor',
          description: 'Light armor (AC 11 + Dex)',
          type: 'armor',
          value: 10,
          weight: 10,
          equipped: true,
          properties: ['Light'],
        },
        {
          name: 'Rapier',
          description: 'Martial melee weapon (1d8 piercing, finesse)',
          type: 'weapon',
          value: 25,
          weight: 2,
          equipped: true,
          properties: ['Finesse'],
        },
        {
          name: 'Lute',
          description: 'Musical instrument and spellcasting focus',
          type: 'gear',
          value: 35,
          weight: 1,
        },
        {
          name: "Entertainer's Pack",
          description:
            'Backpack, bedroll, 2 costumes, 5 candles, 5 days rations, waterskin, disguise kit',
          type: 'gear',
          value: 40,
          weight: 38,
        },
      ],
      druid: [
        {
          name: 'Leather Armor',
          description: 'Light armor (AC 11 + Dex)',
          type: 'armor',
          value: 10,
          weight: 10,
          equipped: true,
          properties: ['Light'],
        },
        {
          name: 'Scimitar',
          description: 'Martial melee weapon (1d6 slashing, finesse, light)',
          type: 'weapon',
          value: 25,
          weight: 3,
          equipped: true,
          properties: ['Finesse', 'Light'],
        },
        {
          name: 'Druidic Focus',
          description: 'Sprig of mistletoe, totem, wooden staff, or yew wand',
          type: 'gear',
          value: 0,
          weight: 0,
        },
        {
          name: "Explorer's Pack",
          description:
            'Backpack, bedroll, mess kit, tinderbox, 10 torches, 10 days rations, waterskin, 50 ft rope',
          type: 'gear',
          value: 10,
          weight: 59,
        },
      ],
      monk: [
        {
          name: 'Shortsword',
          description: 'Martial melee weapon (1d6 piercing, finesse, light)',
          type: 'weapon',
          value: 10,
          weight: 2,
          equipped: true,
          properties: ['Finesse', 'Light'],
        },
        {
          name: "Dungeoneer's Pack",
          description:
            'Backpack, bedroll, tinderbox, 10 torches, 10 days rations, waterskin, 50 ft rope',
          type: 'gear',
          value: 12,
          weight: 61.5,
        },
      ],
      sorcerer: [
        {
          name: 'Light Crossbow',
          description: 'Simple ranged weapon (1d8 piercing, 80/320 ft)',
          type: 'weapon',
          value: 25,
          weight: 5,
          properties: ['Ammunition', 'Loading', 'Two-handed'],
        },
        {
          name: 'Crossbow bolts',
          description: 'Ammunition for crossbow',
          type: 'gear',
          quantity: 20,
          value: 1,
          weight: 1.5,
        },
        {
          name: 'Component Pouch',
          description: 'For spell components',
          type: 'gear',
          value: 25,
          weight: 2,
        },
        {
          name: "Sorcerer's Pack",
          description:
            'Backpack, 2 spellbooks, ink pen, 10 sheets parchment, little bag of sand, small knife',
          type: 'gear',
          value: 40,
          weight: 11,
        },
      ],
      warlock: [
        {
          name: 'Light Crossbow',
          description: 'Simple ranged weapon (1d8 piercing, 80/320 ft)',
          type: 'weapon',
          value: 25,
          weight: 5,
          properties: ['Ammunition', 'Loading', 'Two-handed'],
        },
        {
          name: 'Crossbow bolts',
          description: 'Ammunition for crossbow',
          type: 'gear',
          quantity: 20,
          value: 1,
          weight: 1.5,
        },
        {
          name: 'Component Pouch',
          description: 'For spell components',
          type: 'gear',
          value: 25,
          weight: 2,
        },
        {
          name: "Scholar's Pack",
          description:
            'Backpack, book of lore, ink pen, 10 sheets parchment, little bag of sand, small knife',
          type: 'gear',
          value: 40,
          weight: 11,
        },
      ],
      artificer: [
        {
          name: 'Leather Armor',
          description: 'Light armor (AC 11 + Dex)',
          type: 'armor',
          value: 10,
          weight: 10,
          equipped: true,
          properties: ['Light'],
        },
        {
          name: 'Light Crossbow',
          description: 'Simple ranged weapon (1d8 piercing, 80/320 ft)',
          type: 'weapon',
          value: 25,
          weight: 5,
          properties: ['Ammunition', 'Loading', 'Two-handed'],
        },
        {
          name: 'Crossbow bolts',
          description: 'Ammunition for crossbow',
          type: 'gear',
          quantity: 20,
          value: 1,
          weight: 1.5,
        },
        {
          name: "Dungeoneer's Pack",
          description:
            'Backpack, bedroll, tinderbox, 10 torches, 10 days rations, waterskin, 50 ft rope',
          type: 'gear',
          value: 12,
          weight: 61.5,
        },
        {
          name: "Thieves' Tools",
          description: 'For picking locks and disarming traps',
          type: 'tool',
          value: 25,
          weight: 1,
        },
      ],
    };

    return (
      equipment[characterClass.toLowerCase()] || [
        {
          name: 'Backpack',
          description: 'Basic adventuring gear',
          type: 'gear',
          value: 2,
          weight: 5,
        },
        {
          name: 'Bedroll',
          description: 'For sleeping',
          type: 'gear',
          value: 1,
          weight: 7,
        },
        {
          name: 'Rations',
          description: 'Food for 5 days',
          type: 'consumable',
          quantity: 5,
          value: 5,
          weight: 10,
        },
        {
          name: 'Waterskin',
          description: 'For carrying water',
          type: 'gear',
          value: 2,
          weight: 5,
        },
      ]
    );
  }

  /**
   * Get background starting equipment
   */
  private getBackgroundStartingEquipment(background: string): any[] {
    const equipment: { [key: string]: any[] } = {
      acolyte: [
        {
          name: 'Holy Symbol',
          description: 'Religious symbol',
          type: 'gear',
          value: 5,
          weight: 1,
        },
        {
          name: 'Prayer Book',
          description: 'Book of prayers',
          type: 'gear',
          value: 25,
          weight: 5,
        },
        {
          name: 'Incense',
          description: 'For religious ceremonies',
          type: 'gear',
          quantity: 5,
          value: 1,
          weight: 0,
        },
        {
          name: 'Vestments',
          description: 'Religious clothing',
          type: 'gear',
          value: 0,
          weight: 4,
        },
        {
          name: 'Common Clothes',
          description: 'Everyday clothing',
          type: 'gear',
          value: 5,
          weight: 3,
        },
      ],
      criminal: [
        {
          name: 'Crowbar',
          description: 'Tool for breaking and entering',
          type: 'tool',
          value: 2,
          weight: 5,
        },
        {
          name: 'Dark Common Clothes',
          description: 'Dark clothing for stealth',
          type: 'gear',
          value: 5,
          weight: 3,
        },
        {
          name: 'Hood',
          description: 'For hiding identity',
          type: 'gear',
          value: 1,
          weight: 0,
        },
      ],
      sage: [
        {
          name: 'Bottle of Black Ink',
          description: 'For writing',
          type: 'gear',
          value: 10,
          weight: 0,
        },
        {
          name: 'Quill',
          description: 'Writing implement',
          type: 'gear',
          value: 0,
          weight: 0,
        },
        {
          name: 'Small Knife',
          description: 'Utility knife',
          type: 'gear',
          value: 0,
          weight: 0,
        },
        {
          name: "Scholar's Pack",
          description: 'Academic gear',
          type: 'gear',
          value: 40,
          weight: 11,
        },
        {
          name: 'Letter from a Dead Colleague',
          description: 'Mysterious letter',
          type: 'gear',
          value: 0,
          weight: 0,
        },
      ],
      // Add more backgrounds as needed
    };

    return (
      equipment[background.toLowerCase()] || [
        {
          name: 'Common Clothes',
          description: 'Everyday clothing',
          type: 'gear',
          value: 5,
          weight: 3,
        },
        {
          name: 'Belt Pouch',
          description: 'For carrying coins',
          type: 'gear',
          value: 5,
          weight: 1,
        },
      ]
    );
  }

  /**
   * Initialize spell slots based on class and level
   */
  private initializeSpellSlots(characterClass: string): SpellSlot[] {
    const spellSlots: SpellSlot[] = [];

    // Only spellcasting classes get spell slots
    const spellcastingClasses = [
      'wizard',
      'cleric',
      'sorcerer',
      'warlock',
      'druid',
      'bard',
      'paladin',
      'ranger',
      'artificer',
    ];

    if (!spellcastingClasses.includes(characterClass.toLowerCase())) {
      return spellSlots;
    }

    // D&D 5e spell slot progression for level 1
    // Full casters: wizard, cleric, sorcerer, druid, bard
    // Half casters: paladin, ranger, artificer
    // Pact magic: warlock (handled separately)

    const fullCasters = ['wizard', 'cleric', 'sorcerer', 'druid', 'bard'];
    const halfCasters = ['paladin', 'ranger', 'artificer'];
    const pactCasters = ['warlock'];

    if (fullCasters.includes(characterClass.toLowerCase())) {
      // Full casters get 2 level 1 spell slots at level 1
      spellSlots.push({ level: 1, total: 2, used: 0, available: 2 });
    } else if (halfCasters.includes(characterClass.toLowerCase())) {
      // Half casters get 0 spell slots at level 1 (they get them at level 2)
      // But they still get cantrips
    } else if (pactCasters.includes(characterClass.toLowerCase())) {
      // Warlocks get 1 level 1 spell slot at level 1
      spellSlots.push({ level: 1, total: 1, used: 0, available: 1 });
    }

    return spellSlots;
  }

  /**
   * Initialize cantrips based on class
   */
  private initializeCantrips(characterClass: string): Cantrip[] {
    const cantrips: Cantrip[] = [];

    // Only spellcasting classes get cantrips
    const spellcastingClasses = [
      'wizard',
      'cleric',
      'sorcerer',
      'warlock',
      'druid',
      'bard',
      'paladin',
      'ranger',
      'artificer',
    ];

    if (!spellcastingClasses.includes(characterClass.toLowerCase())) {
      return cantrips;
    }

    // Add some basic cantrips based on class
    const classCantrips = this.getClassCantrips(characterClass);
    cantrips.push(...classCantrips);

    return cantrips;
  }

  /**
   * Get class cantrips
   */
  private getClassCantrips(characterClass: string): Cantrip[] {
    const cantrips: { [key: string]: Cantrip[] } = {
      wizard: [
        {
          name: 'Fire Bolt',
          school: 'Evocation',
          castingTime: '1 action',
          range: '120 feet',
          components: ['V', 'S'],
          duration: 'Instantaneous',
          description:
            'You hurl a mote of fire at a creature or object within range. Make a ranged spell attack. On hit, the target takes 1d10 fire damage.',
          level: 0,
        },
        {
          name: 'Mage Hand',
          school: 'Conjuration',
          castingTime: '1 action',
          range: '30 feet',
          components: ['V', 'S'],
          duration: '1 minute',
          description:
            'A spectral, floating hand appears at a point you choose within range. The hand can manipulate objects and perform simple tasks.',
          level: 0,
        },
        {
          name: 'Prestidigitation',
          school: 'Transmutation',
          castingTime: '1 action',
          range: '10 feet',
          components: ['V', 'S'],
          duration: 'Up to 1 hour',
          description:
            'Create an instantaneous, harmless sensory effect, clean or soil an object no larger than 1 cubic foot, chill, warm, or flavor up to 1 cubic foot of nonliving material for 1 hour.',
          level: 0,
        },
      ],
      cleric: [
        {
          name: 'Sacred Flame',
          school: 'Evocation',
          castingTime: '1 action',
          range: '60 feet',
          components: ['V', 'S'],
          duration: 'Instantaneous',
          description:
            'Flame-like radiance descends on a creature that you can see within range. The target must succeed on a Dexterity saving throw or take 1d8 radiant damage.',
          level: 0,
        },
        {
          name: 'Light',
          school: 'Evocation',
          castingTime: '1 action',
          range: 'Touch',
          components: ['V', 'M'],
          duration: '1 hour',
          description:
            'You touch one object that is no larger than 10 feet in any dimension. The object sheds bright light in a 20-foot radius.',
          level: 0,
        },
        {
          name: 'Guidance',
          school: 'Divination',
          castingTime: '1 action',
          range: 'Touch',
          components: ['V', 'S'],
          duration: 'Concentration, up to 1 minute',
          description:
            'You touch one willing creature. Once before the spell ends, the target can roll a d4 and add the number rolled to one ability check of its choice.',
          level: 0,
        },
      ],
      sorcerer: [
        {
          name: 'Fire Bolt',
          school: 'Evocation',
          castingTime: '1 action',
          range: '120 feet',
          components: ['V', 'S'],
          duration: 'Instantaneous',
          description:
            'You hurl a mote of fire at a creature or object within range. Make a ranged spell attack. On hit, the target takes 1d10 fire damage.',
          level: 0,
        },
        {
          name: 'Mage Hand',
          school: 'Conjuration',
          castingTime: '1 action',
          range: '30 feet',
          components: ['V', 'S'],
          duration: '1 minute',
          description:
            'A spectral, floating hand appears at a point you choose within range. The hand can manipulate objects and perform simple tasks.',
          level: 0,
        },
      ],
      warlock: [
        {
          name: 'Eldritch Blast',
          school: 'Evocation',
          castingTime: '1 action',
          range: '120 feet',
          components: ['V', 'S'],
          duration: 'Instantaneous',
          description:
            'A beam of crackling energy streaks toward a creature within range. Make a ranged spell attack. On hit, the target takes 1d10 force damage.',
          level: 0,
        },
        {
          name: 'Mage Hand',
          school: 'Conjuration',
          castingTime: '1 action',
          range: '30 feet',
          components: ['V', 'S'],
          duration: '1 minute',
          description:
            'A spectral, floating hand appears at a point you choose within range. The hand can manipulate objects and perform simple tasks.',
          level: 0,
        },
      ],
      druid: [
        {
          name: 'Druidcraft',
          school: 'Transmutation',
          castingTime: '1 action',
          range: '30 feet',
          components: ['V', 'S'],
          duration: 'Instantaneous',
          description:
            'Whisper to the spirits of nature to create one of the following effects: predict weather, create a harmless sensory effect, or make a flower blossom.',
          level: 0,
        },
        {
          name: 'Guidance',
          school: 'Divination',
          castingTime: '1 action',
          range: 'Touch',
          components: ['V', 'S'],
          duration: 'Concentration, up to 1 minute',
          description:
            'You touch one willing creature. Once before the spell ends, the target can roll a d4 and add the number rolled to one ability check of its choice.',
          level: 0,
        },
      ],
      bard: [
        {
          name: 'Vicious Mockery',
          school: 'Enchantment',
          castingTime: '1 action',
          range: '60 feet',
          components: ['V'],
          duration: 'Instantaneous',
          description:
            'You unleash a string of insults laced with subtle enchantments at a creature you can see within range. The target must succeed on a Wisdom saving throw or take 1d4 psychic damage and have disadvantage on the next attack roll.',
          level: 0,
        },
        {
          name: 'Mage Hand',
          school: 'Conjuration',
          castingTime: '1 action',
          range: '30 feet',
          components: ['V', 'S'],
          duration: '1 minute',
          description:
            'A spectral, floating hand appears at a point you choose within range. The hand can manipulate objects and perform simple tasks.',
          level: 0,
        },
      ],
      paladin: [
        {
          name: 'Light',
          school: 'Evocation',
          castingTime: '1 action',
          range: 'Touch',
          components: ['V', 'M'],
          duration: '1 hour',
          description:
            'You touch one object that is no larger than 10 feet in any dimension. The object sheds bright light in a 20-foot radius.',
          level: 0,
        },
      ],
      ranger: [
        {
          name: 'Light',
          school: 'Evocation',
          castingTime: '1 action',
          range: 'Touch',
          components: ['V', 'M'],
          duration: '1 hour',
          description:
            'You touch one object that is no larger than 10 feet in any dimension. The object sheds bright light in a 20-foot radius.',
          level: 0,
        },
      ],
      artificer: [
        {
          name: 'Mage Hand',
          school: 'Conjuration',
          castingTime: '1 action',
          range: '30 feet',
          components: ['V', 'S'],
          duration: '1 minute',
          description:
            'A spectral, floating hand appears at a point you choose within range. The hand can manipulate objects and perform simple tasks.',
          level: 0,
        },
        {
          name: 'Mending',
          school: 'Transmutation',
          castingTime: '1 minute',
          range: 'Touch',
          components: ['V', 'S', 'M'],
          duration: 'Instantaneous',
          description:
            'This spell repairs a single break or tear in an object you touch, such as a broken chain link, two halves of a broken key, a torn cloak, or a leaking wineskin.',
          level: 0,
        },
      ],
    };

    return cantrips[characterClass.toLowerCase()] || [];
  }

  /**
   * Format dice roll result for display
   */
  private formatDiceRollResult(roll: AutomaticDiceRoll): string {
    const rollText = `${roll.action} (${roll.diceType}${roll.modifier >= 0 ? '+' + roll.modifier : roll.modifier})`;
    if (roll.criticalSuccess) {
      return `${rollText} (Critical Success!)`;
    }
    if (roll.criticalFailure) {
      return `${rollText} (Critical Failure!)`;
    }
    if (roll.success) {
      return `${rollText} (Success!)`;
    }
    return `${rollText} (Failure)`;
  }

  /**
   * Get language instruction for the system prompt
   */
  private getLanguageInstruction(language: string): string {
    switch (language) {
      case 'fr':
        return 'Votre réponse doit être en français.';
      case 'es':
        return 'Tu respuesta debe ser en español.';
      case 'de':
        return 'Deine Antwort muss in Deutsch sein.';
      case 'it':
        return 'La tua risposta deve essere in italiano.';
      case 'pt':
        return 'Sua resposta deve ser em português.';
      case 'ru':
        return 'Ваш ответ должен быть на русском языке.';
      case 'id':
        return 'Jawaban Anda harus dalam Bahasa Indonesia.';
      default:
        return ''; // English is the default
    }
  }

  /**
   * Get class base HP
   */
  private getClassBaseHP(characterClass: string): number {
    const classHP: { [key: string]: number } = {
      fighter: 10,
      wizard: 6,
      cleric: 8,
      rogue: 8,
      ranger: 10,
      paladin: 10,
      barbarian: 12,
      bard: 8,
      druid: 8,
      monk: 8,
      sorcerer: 6,
      warlock: 8,
      artificer: 8,
    };

    return classHP[characterClass.toLowerCase()] || 8;
  }

  /**
   * Calculate armor class based on class and dexterity
   */
  private calculateArmorClass(
    characterClass: string,
    dexterity: number
  ): number {
    const dexModifier = this.getAbilityModifier(dexterity);

    // Base AC by class
    const classAC: { [key: string]: number } = {
      fighter: 16, // Chain mail
      wizard: 12, // Mage armor or no armor
      cleric: 16, // Chain mail
      rogue: 14, // Leather armor
      ranger: 14, // Leather armor
      paladin: 16, // Chain mail
      barbarian: 14, // Unarmored defense
      bard: 14, // Leather armor
      druid: 14, // Leather armor
      monk: 12, // Unarmored defense
      sorcerer: 12, // No armor
      warlock: 12, // No armor
      artificer: 14, // Light armor
    };

    const baseAC = classAC[characterClass.toLowerCase()] || 12;

    // Some classes can add full dex modifier, others limited
    const maxDexBonus: { [key: string]: number } = {
      fighter: 2, // Heavy armor
      wizard: 999, // No armor limit
      cleric: 2, // Heavy armor
      rogue: 999, // Light armor
      ranger: 999, // Light armor
      paladin: 2, // Heavy armor
      barbarian: 999, // Unarmored
      bard: 999, // Light armor
      druid: 999, // Light armor
      monk: 999, // Unarmored
      sorcerer: 999, // No armor
      warlock: 999, // No armor
      artificer: 999, // Light armor
    };

    const maxDex = maxDexBonus[characterClass.toLowerCase()] || 999;
    const dexBonus = Math.min(dexModifier, maxDex);

    return baseAC + dexBonus;
  }

  /**
   * Get class speed
   */
  private getClassSpeed(): number {
    // Most classes have 30 feet base speed
    return 30;
  }

  /**
   * Get class languages
   */
  private getClassLanguages(race: string): string[] {
    const languages = ['Common'];

    // Add racial languages
    const racialLanguages: { [key: string]: string[] } = {
      elf: ['Elvish'],
      dwarf: ['Dwarvish'],
      halfling: ['Halfling'],
      gnome: ['Gnomish'],
      'half-orc': ['Orc'],
      tiefling: ['Infernal'],
      dragonborn: ['Draconic'],
    };

    if (racialLanguages[race.toLowerCase()]) {
      languages.push(...racialLanguages[race.toLowerCase()]);
    }

    return languages;
  }

  /**
   * Get class features
   */
  private getClassFeatures(characterClass: string): string[] {
    const features: { [key: string]: string[] } = {
      fighter: ['Fighting Style', 'Second Wind'],
      wizard: ['Spellcasting', 'Arcane Recovery'],
      cleric: ['Spellcasting', 'Divine Domain'],
      rogue: ['Sneak Attack', 'Expertise'],
      ranger: ['Favored Enemy', 'Natural Explorer'],
      paladin: ['Divine Sense', 'Lay on Hands'],
      barbarian: ['Rage', 'Unarmored Defense'],
      bard: ['Bardic Inspiration', 'Song of Rest'],
      druid: ['Druidic', 'Wild Shape'],
      monk: ['Unarmored Defense', 'Martial Arts'],
      sorcerer: ['Spellcasting', 'Sorcerous Origin'],
      warlock: ['Spellcasting', 'Pact Magic'],
      artificer: ['Magical Tinkering', 'Spellcasting'],
    };

    return features[characterClass.toLowerCase()] || ['Class Feature'];
  }

  /**
   * Get class proficiencies
   */
  private getClassProficiencies(characterClass: string): {
    weapons: string[];
    armor: string[];
    tools: string[];
    savingThrows: string[];
  } {
    const proficiencies: { [key: string]: any } = {
      fighter: {
        weapons: ['Simple Weapons', 'Martial Weapons'],
        armor: ['Light Armor', 'Medium Armor', 'Heavy Armor', 'Shields'],
        tools: [],
        savingThrows: ['Strength', 'Constitution'],
      },
      wizard: {
        weapons: [
          'Daggers',
          'Darts',
          'Slings',
          'Quarterstaffs',
          'Light Crossbows',
        ],
        armor: [],
        tools: [],
        savingThrows: ['Intelligence', 'Wisdom'],
      },
      cleric: {
        weapons: ['Simple Weapons'],
        armor: ['Light Armor', 'Medium Armor', 'Shields'],
        tools: [],
        savingThrows: ['Wisdom', 'Charisma'],
      },
      rogue: {
        weapons: [
          'Simple Weapons',
          'Hand Crossbows',
          'Longswords',
          'Rapiers',
          'Shortswords',
        ],
        armor: ['Light Armor'],
        tools: ["Thieves' Tools"],
        savingThrows: ['Dexterity', 'Intelligence'],
      },
      // Add more classes as needed
    };

    return (
      proficiencies[characterClass.toLowerCase()] || {
        weapons: ['Simple Weapons'],
        armor: ['Light Armor'],
        tools: [],
        savingThrows: ['Strength', 'Dexterity'],
      }
    );
  }
}
