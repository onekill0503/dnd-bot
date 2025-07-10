import { VoiceService } from './voice';
import { RedisService } from './redis';
import type { SessionData } from './redis';
import { logger } from '../utils/logger';
import { PlayerStatus } from '../types/enums';

export class SessionManager {
  private voiceService: VoiceService;
  private redisService: RedisService;

  constructor() {
    this.voiceService = new VoiceService();
    this.redisService = new RedisService();
  }

  /**
   * Initialize session manager
   */
  async initialize(): Promise<void> {
    try {
      await this.redisService.connect();
      logger.info('Session manager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize session manager:', error);
      throw error;
    }
  }

  /**
   * Start a new D&D session in a voice channel
   */
  async startSession(
    channelId: string,
    guildId: string,
    creatorId: string
  ): Promise<SessionData> {
    try {
      // Create session in Redis
      const session = await this.voiceService.createSession(
        channelId,
        guildId,
        creatorId
      );

      logger.info(
        `Started new D&D session in channel ${channelId} by user ${creatorId}`
      );
      return session;
    } catch (error) {
      logger.error('Error starting session:', error);
      throw error;
    }
  }

  /**
   * Get or create session for a voice channel
   */
  async getOrCreateSession(
    channelId: string,
    guildId: string,
    userId: string
  ): Promise<SessionData> {
    try {
      return await this.voiceService.getOrCreateSession(
        channelId,
        guildId,
        userId
      );
    } catch (error) {
      logger.error('Error getting or creating session:', error);
      throw error;
    }
  }

  /**
   * Add a participant to a session
   */
  async addParticipant(channelId: string, userId: string): Promise<void> {
    try {
      await this.redisService.addParticipant(channelId, userId);
      logger.info(
        `Added participant ${userId} to session in channel ${channelId}`
      );
    } catch (error) {
      logger.error('Error adding participant:', error);
      throw error;
    }
  }

  /**
   * Remove a participant from a session
   */
  async removeParticipant(channelId: string, userId: string): Promise<void> {
    try {
      await this.redisService.removeParticipant(channelId, userId);
      logger.info(
        `Removed participant ${userId} from session in channel ${channelId}`
      );
    } catch (error) {
      logger.error('Error removing participant:', error);
      throw error;
    }
  }

  /**
   * Get session data
   */
  async getSession(channelId: string): Promise<SessionData | null> {
    try {
      return await this.redisService.getSession(channelId);
    } catch (error) {
      logger.error('Error getting session:', error);
      throw error;
    }
  }

  /**
   * Update session data
   */
  async updateSession(
    channelId: string,
    updates: Partial<SessionData>
  ): Promise<void> {
    try {
      await this.redisService.updateSession(channelId, updates);
      logger.info(`Updated session in channel ${channelId}`);
    } catch (error) {
      logger.error('Error updating session:', error);
      throw error;
    }
  }

  /**
   * End a session
   */
  async endSession(channelId: string): Promise<void> {
    try {
      await this.redisService.deleteSession(channelId);
      logger.info(`Ended session in channel ${channelId}`);
    } catch (error) {
      logger.error('Error ending session:', error);
      throw error;
    }
  }

  /**
   * Get all active sessions
   */
  async getAllSessions(): Promise<SessionData[]> {
    try {
      return await this.redisService.getAllSessions();
    } catch (error) {
      logger.error('Error getting all sessions:', error);
      throw error;
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<void> {
    try {
      await this.redisService.cleanupExpiredSessions();
      logger.info('Cleaned up expired sessions');
    } catch (error) {
      logger.error('Error cleaning up expired sessions:', error);
      throw error;
    }
  }

  /**
   * Update game state for a session
   */
  async updateGameState(channelId: string, gameState: any): Promise<void> {
    try {
      await this.voiceService.updateGameState(channelId, gameState);
    } catch (error) {
      logger.error('Error updating game state:', error);
      throw error;
    }
  }

  /**
   * Get game state for a session
   */
  async getGameState(channelId: string): Promise<any | null> {
    try {
      return await this.voiceService.getGameState(channelId);
    } catch (error) {
      logger.error('Error getting game state:', error);
      throw error;
    }
  }

  /**
   * Speak text in a voice channel
   */
  async speakInChannel(
    channelId: string,
    guildId: string,
    text: string,
    client?: any
  ): Promise<void> {
    try {
      await this.voiceService.speakInChannel(channelId, guildId, text, client);
    } catch (error) {
      logger.error('Error speaking in channel:', error);
      throw error;
    }
  }

  /**
   * Leave voice channel and clean up session
   */
  async leaveVoiceChannel(
    guildId: string,
    channelId: string,
    userId: string
  ): Promise<void> {
    try {
      await this.voiceService.leaveVoiceChannel(guildId, channelId, userId);
    } catch (error) {
      logger.error('Error leaving voice channel:', error);
      throw error;
    }
  }

  /**
   * Disconnect from voice channel and end session
   */
  async disconnectFromVoiceChannel(
    channelId: string,
    userId: string
  ): Promise<void> {
    try {
      // Remove user from session participants
      await this.redisService.removeParticipant(channelId, userId);

      // Get updated session to check if any participants remain
      const session = await this.redisService.getSession(channelId);

      if (session && session.participants.length === 0) {
        // No participants left, delete session
        await this.redisService.deleteSession(channelId);
        logger.info(
          `Session ended for channel ${channelId} - no participants remaining`
        );
      }

      // Leave voice channel
      await this.voiceService.leaveVoiceChannel(
        session?.guildId || '',
        channelId,
        userId
      );

      logger.info(
        `Disconnected user ${userId} from voice channel ${channelId}`
      );
    } catch (error) {
      logger.error('Error disconnecting from voice channel:', error);
      throw error;
    }
  }

  /**
   * Shutdown session manager
   */
  async shutdown(): Promise<void> {
    try {
      await this.redisService.disconnect();
      logger.info('Session manager shutdown successfully');
    } catch (error) {
      logger.error('Error shutting down session manager:', error);
      throw error;
    }
  }

  /**
   * Update player status (alive/dead/unconscious)
   */
  async updatePlayerStatus(
    channelId: string,
    userId: string,
    status: PlayerStatus
  ): Promise<void> {
    try {
      await this.redisService.updatePlayerStatus(channelId, userId, status);
      logger.info(
        `Updated player ${userId} status to ${status} in channel ${channelId}`
      );
    } catch (error) {
      logger.error('Error updating player status:', error);
      throw error;
    }
  }

  /**
   * Record player death event
   */
  async recordPlayerDeath(
    channelId: string,
    playerId: string,
    characterName: string,
    cause: string
  ): Promise<void> {
    try {
      const deathEvent = {
        playerId,
        characterName,
        cause,
        timestamp: Date.now(),
      };

      await this.redisService.recordPlayerDeath(channelId, deathEvent);
      logger.info(
        `Recorded death event for player ${playerId} (${characterName}) in channel ${channelId}`
      );
    } catch (error) {
      logger.error('Error recording player death:', error);
      throw error;
    }
  }

  /**
   * Check if all players are dead
   */
  async areAllPlayersDead(channelId: string): Promise<boolean> {
    try {
      return await this.redisService.areAllPlayersDead(channelId);
    } catch (error) {
      logger.error('Error checking if all players are dead:', error);
      throw error;
    }
  }

  /**
   * Get alive players for a session
   */
  async getAlivePlayers(channelId: string): Promise<string[]> {
    try {
      return await this.redisService.getAlivePlayers(channelId);
    } catch (error) {
      logger.error('Error getting alive players:', error);
      throw error;
    }
  }

  /**
   * Get dead players for a session
   */
  async getDeadPlayers(channelId: string): Promise<string[]> {
    try {
      return await this.redisService.getDeadPlayers(channelId);
    } catch (error) {
      logger.error('Error getting dead players:', error);
      throw error;
    }
  }

  /**
   * Check if a player is alive
   */
  async isPlayerAlive(channelId: string, userId: string): Promise<boolean> {
    try {
      return await this.redisService.isPlayerAlive(channelId, userId);
    } catch (error) {
      logger.error('Error checking if player is alive:', error);
      throw error;
    }
  }

  /**
   * End session due to all players being dead
   */
  async endSessionDueToAllPlayersDead(channelId: string): Promise<void> {
    try {
      await this.redisService.endSessionDueToAllPlayersDead(channelId);
      logger.info(
        `Session ended for channel ${channelId} - all players are dead`
      );
    } catch (error) {
      logger.error('Error ending session due to all players dead:', error);
      throw error;
    }
  }

  /**
   * Handle player death and check if session should end
   */
  async handlePlayerDeath(
    channelId: string,
    playerId: string,
    characterName: string,
    cause: string
  ): Promise<boolean> {
    try {
      // Record the death
      await this.recordPlayerDeath(channelId, playerId, characterName, cause);

      // Update player status to dead
      await this.updatePlayerStatus(channelId, playerId, PlayerStatus.DEAD);

      // Check if all players are dead
      const allDead = await this.areAllPlayersDead(channelId);

      if (allDead) {
        await this.endSessionDueToAllPlayersDead(channelId);
        return true; // Session ended
      }

      return false; // Session continues
    } catch (error) {
      logger.error('Error handling player death:', error);
      throw error;
    }
  }

  /**
   * Update character skills
   */
  async updateCharacterSkills(
    channelId: string,
    userId: string,
    skillName: string,
    proficient: boolean,
    modifier: number
  ): Promise<void> {
    try {
      const session = await this.redisService.getSession(channelId);
      if (!session || !session.gameState) {
        throw new Error('Session not found');
      }

      const gameState = session.gameState as any;
      const players = new Map<string, any>(gameState.players || []);
      const player = players.get(userId);

      if (!player) {
        throw new Error('Player not found');
      }

      // Update the specific skill
      if (player.skills && player.skills[skillName]) {
        player.skills[skillName] = { proficient, modifier };
      }

      // Update the session
      await this.redisService.updateSession(channelId, { gameState });
      logger.info(
        `Updated skills for player ${userId} in session ${channelId}`
      );
    } catch (error) {
      logger.error('Error updating character skills:', error);
      throw error;
    }
  }

  /**
   * Update character currency
   */
  async updateCharacterCurrency(
    channelId: string,
    userId: string,
    currencyType: string,
    amount: number
  ): Promise<void> {
    try {
      const session = await this.redisService.getSession(channelId);
      if (!session || !session.gameState) {
        throw new Error('Session not found');
      }

      const gameState = session.gameState as any;
      const players = new Map<string, any>(gameState.players || []);
      const player = players.get(userId);

      if (!player) {
        throw new Error('Player not found');
      }

      // Update the specific currency
      if (player.currency && player.currency[currencyType] !== undefined) {
        player.currency[currencyType] = Math.max(
          0,
          player.currency[currencyType] + amount
        );
      }

      // Update the session
      await this.redisService.updateSession(channelId, { gameState });
      logger.info(
        `Updated currency for player ${userId} in session ${channelId}`
      );
    } catch (error) {
      logger.error('Error updating character currency:', error);
      throw error;
    }
  }

  /**
   * Add item to character inventory
   */
  async addInventoryItem(
    channelId: string,
    userId: string,
    item: any
  ): Promise<void> {
    try {
      const session = await this.redisService.getSession(channelId);
      if (!session || !session.gameState) {
        throw new Error('Session not found');
      }

      const gameState = session.gameState as any;
      const players = new Map<string, any>(gameState.players || []);
      const player = players.get(userId);

      if (!player) {
        throw new Error('Player not found');
      }

      // Initialize inventory if it doesn't exist
      if (!player.inventory) {
        player.inventory = [];
      }

      // Add the item
      player.inventory.push(item);

      // Update the session
      await this.redisService.updateSession(channelId, { gameState });
      logger.info(
        `Added item to inventory for player ${userId} in session ${channelId}`
      );
    } catch (error) {
      logger.error('Error adding inventory item:', error);
      throw error;
    }
  }

  /**
   * Remove item from character inventory
   */
  async removeInventoryItem(
    channelId: string,
    userId: string,
    itemId: string
  ): Promise<void> {
    try {
      const session = await this.redisService.getSession(channelId);
      if (!session || !session.gameState) {
        throw new Error('Session not found');
      }

      const gameState = session.gameState as any;
      const players = new Map<string, any>(gameState.players || []);
      const player = players.get(userId);

      if (!player) {
        throw new Error('Player not found');
      }

      // Remove the item
      if (player.inventory) {
        player.inventory = player.inventory.filter(
          (item: any) => item.id !== itemId
        );
      }

      // Update the session
      await this.redisService.updateSession(channelId, { gameState });
      logger.info(
        `Removed item from inventory for player ${userId} in session ${channelId}`
      );
    } catch (error) {
      logger.error('Error removing inventory item:', error);
      throw error;
    }
  }

  /**
   * Update spell slots for a character
   */
  async updateSpellSlots(
    channelId: string,
    userId: string,
    spellLevel: number,
    used: number
  ): Promise<void> {
    try {
      const session = await this.redisService.getSession(channelId);
      if (!session || !session.gameState) {
        throw new Error('Session not found');
      }

      const gameState = session.gameState as any;
      const players = new Map<string, any>(gameState.players || []);
      const player = players.get(userId);

      if (!player) {
        throw new Error('Player not found');
      }

      // Update spell slots
      if (player.spellSlots) {
        const spellSlot = player.spellSlots.find(
          (slot: any) => slot.level === spellLevel
        );
        if (spellSlot) {
          spellSlot.used = Math.min(spellSlot.total, used);
          spellSlot.available = spellSlot.total - spellSlot.used;
        }
      }

      // Update the session
      await this.redisService.updateSession(channelId, { gameState });
      logger.info(
        `Updated spell slots for player ${userId} in session ${channelId}`
      );
    } catch (error) {
      logger.error('Error updating spell slots:', error);
      throw error;
    }
  }

  /**
   * Add cantrip to character
   */
  async addCantrip(
    channelId: string,
    userId: string,
    cantrip: any
  ): Promise<void> {
    try {
      const session = await this.redisService.getSession(channelId);
      if (!session || !session.gameState) {
        throw new Error('Session not found');
      }

      const gameState = session.gameState as any;
      const players = new Map<string, any>(gameState.players || []);
      const player = players.get(userId);

      if (!player) {
        throw new Error('Player not found');
      }

      // Initialize cantrips if it doesn't exist
      if (!player.cantrips) {
        player.cantrips = [];
      }

      // Add the cantrip
      player.cantrips.push(cantrip);

      // Update the session
      await this.redisService.updateSession(channelId, { gameState });
      logger.info(`Added cantrip for player ${userId} in session ${channelId}`);
    } catch (error) {
      logger.error('Error adding cantrip:', error);
      throw error;
    }
  }

  /**
   * Get character sheet for a player
   */
  async getCharacterSheet(
    channelId: string,
    userId: string
  ): Promise<any | null> {
    try {
      const session = await this.redisService.getSession(channelId);
      if (!session || !session.gameState) {
        return null;
      }

      const gameState = session.gameState as any;
      const players = new Map<string, any>(gameState.players || []);
      const player = players.get(userId);

      return player || null;
    } catch (error) {
      logger.error('Error getting character sheet:', error);
      throw error;
    }
  }
}
