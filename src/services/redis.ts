import { createClient } from 'redis';
import type { RedisClientType } from 'redis';
import { botConfig } from '../config/config';
import { logger } from '../utils/logger';
import type { PlayerStatus, PlayerDeathEvent, SessionEndEvent } from '../types';

export interface SessionData {
  sessionId: string;
  channelId: string;
  guildId: string;
  creatorId: string;
  createdAt: number;
  lastActivity: number;
  participants: string[];
  gameState?: any;
  playerStatuses?: Map<string, PlayerStatus>;
  deathEvents?: PlayerDeathEvent[];
  sessionEndEvent?: SessionEndEvent;
  alivePlayers?: string[];
  deadPlayers?: string[];
}

export class RedisService {
  private client: RedisClientType;
  private isConnected = false;

  constructor() {
    this.client = createClient({
      socket: {
        host: botConfig.redis.host,
        port: botConfig.redis.port,
      },
      password: botConfig.redis.password,
      database: botConfig.redis.db,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      logger.info('Connected to Redis');
      this.isConnected = true;
    });

    this.client.on('error', (error) => {
      logger.error('Redis connection error:', error);
      this.isConnected = false;
    });

    this.client.on('end', () => {
      logger.info('Redis connection ended');
      this.isConnected = false;
    });
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    if (!this.isConnected) {
      await this.client.connect();
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.quit();
    }
  }

  /**
   * Generate a session key based on voice channel ID
   */
  private generateSessionKey(channelId: string): string {
    return `dnd_session:${channelId}`;
  }

  /**
   * Save session data to Redis
   */
  async saveSession(channelId: string, sessionData: Omit<SessionData, 'channelId'>): Promise<void> {
    try {
      await this.connect();
      const key = this.generateSessionKey(channelId);
      const data: SessionData = {
        ...sessionData,
        channelId,
        lastActivity: Date.now(),
      };

      await this.client.set(key, JSON.stringify(data), {
        EX: 3600, // Expire after 1 hour
      });

      logger.info(`Session saved for channel ${channelId}`);
    } catch (error) {
      logger.error('Error saving session to Redis:', error);
      throw error;
    }
  }

  /**
   * Get session data from Redis
   */
  async getSession(channelId: string): Promise<SessionData | null> {
    try {
      await this.connect();
      const key = this.generateSessionKey(channelId);
      const data = await this.client.get(key);

      if (!data) {
        return null;
      }

      const sessionData: SessionData = JSON.parse(data);
      
      // Handle legacy sessions without creatorId
      if (!sessionData.creatorId) {
        sessionData.creatorId = sessionData.participants[0] || 'unknown';
      }
      
      // Update last activity
      sessionData.lastActivity = Date.now();
      await this.saveSession(channelId, sessionData);

      return sessionData;
    } catch (error) {
      logger.error('Error getting session from Redis:', error);
      throw error;
    }
  }

  /**
   * Update session data
   */
  async updateSession(channelId: string, updates: Partial<SessionData>): Promise<void> {
    try {
      const existingSession = await this.getSession(channelId);
      if (!existingSession) {
        throw new Error(`No session found for channel ${channelId}`);
      }

      const updatedSession = {
        ...existingSession,
        ...updates,
        lastActivity: Date.now(),
      };

      await this.saveSession(channelId, updatedSession);
    } catch (error) {
      logger.error('Error updating session in Redis:', error);
      throw error;
    }
  }

  /**
   * Delete session data
   */
  async deleteSession(channelId: string): Promise<void> {
    try {
      await this.connect();
      const key = this.generateSessionKey(channelId);
      await this.client.del(key);
      logger.info(`Session deleted for channel ${channelId}`);
    } catch (error) {
      logger.error('Error deleting session from Redis:', error);
      throw error;
    }
  }

  /**
   * Add participant to session
   */
  async addParticipant(channelId: string, userId: string): Promise<void> {
    try {
      const session = await this.getSession(channelId);
      if (!session) {
        throw new Error(`No session found for channel ${channelId}`);
      }

      if (!session.participants.includes(userId)) {
        session.participants.push(userId);
        await this.updateSession(channelId, { participants: session.participants });
      }
    } catch (error) {
      logger.error('Error adding participant to session:', error);
      throw error;
    }
  }

  /**
   * Remove participant from session
   */
  async removeParticipant(channelId: string, userId: string): Promise<void> {
    try {
      const session = await this.getSession(channelId);
      if (!session) {
        return; // Session doesn't exist, nothing to remove
      }

      const updatedParticipants = session.participants.filter(id => id !== userId);
      await this.updateSession(channelId, { participants: updatedParticipants });
    } catch (error) {
      logger.error('Error removing participant from session:', error);
      throw error;
    }
  }

  /**
   * Get all active sessions
   */
  async getAllSessions(): Promise<SessionData[]> {
    try {
      await this.connect();
      const keys = await this.client.keys('dnd_session:*');
      const sessions: SessionData[] = [];

      for (const key of keys) {
        const data = await this.client.get(key);
        if (data) {
          const sessionData: SessionData = JSON.parse(data);
          
          // Handle legacy sessions without creatorId
          if (!sessionData.creatorId) {
            sessionData.creatorId = sessionData.participants[0] || 'unknown';
          }
          
          sessions.push(sessionData);
        }
      }

      return sessions;
    } catch (error) {
      logger.error('Error getting all sessions from Redis:', error);
      throw error;
    }
  }

  /**
   * Clean up expired sessions (older than 1 hour)
   */
  async cleanupExpiredSessions(): Promise<void> {
    try {
      const sessions = await this.getAllSessions();
      const now = Date.now();
      const oneHour = 60 * 60 * 1000;

      for (const session of sessions) {
        if (now - session.lastActivity > oneHour) {
          await this.deleteSession(session.channelId);
        }
      }
    } catch (error) {
      logger.error('Error cleaning up expired sessions:', error);
      throw error;
    }
  }

  /**
   * Update player status (alive/dead/unconscious)
   */
  async updatePlayerStatus(channelId: string, userId: string, status: PlayerStatus): Promise<void> {
    try {
      const session = await this.getSession(channelId);
      if (!session) {
        throw new Error(`No session found for channel ${channelId}`);
      }

      // Initialize player statuses if not exists
      if (!session.playerStatuses) {
        session.playerStatuses = new Map();
      }

      // Update player status
      session.playerStatuses.set(userId, status);

      // Update alive/dead players arrays
      const alivePlayers: string[] = [];
      const deadPlayers: string[] = [];

      for (const [playerId, playerStatus] of session.playerStatuses) {
        if (playerStatus === 'alive' || playerStatus === 'unconscious') {
          alivePlayers.push(playerId);
        } else if (playerStatus === 'dead') {
          deadPlayers.push(playerId);
        }
      }

      await this.updateSession(channelId, {
        playerStatuses: session.playerStatuses,
        alivePlayers,
        deadPlayers,
      });

      logger.info(`Updated player ${userId} status to ${status} in channel ${channelId}`);
    } catch (error) {
      logger.error('Error updating player status:', error);
      throw error;
    }
  }

  /**
   * Record player death event
   */
  async recordPlayerDeath(channelId: string, deathEvent: PlayerDeathEvent): Promise<void> {
    try {
      const session = await this.getSession(channelId);
      if (!session) {
        throw new Error(`No session found for channel ${channelId}`);
      }

      // Initialize death events array if not exists
      if (!session.deathEvents) {
        session.deathEvents = [];
      }

      session.deathEvents.push(deathEvent);

      await this.updateSession(channelId, {
        deathEvents: session.deathEvents,
      });

      logger.info(`Recorded death event for player ${deathEvent.playerId} in channel ${channelId}`);
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
      const session = await this.getSession(channelId);
      if (!session || !session.playerStatuses) {
        return false;
      }

      const alivePlayers = Array.from(session.playerStatuses.values()).filter(
        status => status === 'alive' || status === 'unconscious'
      );

      return alivePlayers.length === 0;
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
      const session = await this.getSession(channelId);
      if (!session || !session.playerStatuses) {
        return session?.participants || [];
      }

      return Array.from(session.playerStatuses.entries())
        .filter(([_, status]) => status === 'alive' || status === 'unconscious')
        .map(([playerId, _]) => playerId);
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
      const session = await this.getSession(channelId);
      if (!session || !session.playerStatuses) {
        return [];
      }

      return Array.from(session.playerStatuses.entries())
        .filter(([_, status]) => status === 'dead')
        .map(([playerId, _]) => playerId);
    } catch (error) {
      logger.error('Error getting dead players:', error);
      throw error;
    }
  }

  /**
   * End session due to all players being dead
   */
  async endSessionDueToAllPlayersDead(channelId: string): Promise<void> {
    try {
      const session = await this.getSession(channelId);
      if (!session) {
        throw new Error(`No session found for channel ${channelId}`);
      }

      const deadPlayers = await this.getDeadPlayers(channelId);
      const deathEvents = session.deathEvents || [];

      const sessionEndEvent: SessionEndEvent = {
        reason: 'all_players_dead',
        deadPlayers: deathEvents,
        timestamp: Date.now(),
      };

      await this.updateSession(channelId, {
        sessionEndEvent,
      });

      logger.info(`Session ended for channel ${channelId} - all players are dead`);
    } catch (error) {
      logger.error('Error ending session due to all players dead:', error);
      throw error;
    }
  }

  /**
   * Check if a player is alive
   */
  async isPlayerAlive(channelId: string, userId: string): Promise<boolean> {
    try {
      const session = await this.getSession(channelId);
      if (!session || !session.playerStatuses) {
        return true; // Default to alive if no status tracking
      }

      const status = session.playerStatuses.get(userId);
      return status === 'alive' || status === 'unconscious';
    } catch (error) {
      logger.error('Error checking if player is alive:', error);
      throw error;
    }
  }
} 