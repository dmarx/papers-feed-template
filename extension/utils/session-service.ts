// session-service.ts
// Simplified session tracking service for background script

import { loguru } from './logger';
import { PaperManager } from '../papers/manager';
import { ReadingSessionData, PaperMetadata } from '../papers/types';

const logger = loguru.getLogger('session-service');

/**
 * Session tracking service for paper reading sessions
 * 
 * Manages session state, heartbeats, and persistence
 * Designed for use in the background script (Service Worker)
 */
export class SessionService {
  private activeSession: {
    sourceId: string;
    paperId: string;
    startTime: Date;
    heartbeatCount: number;
    lastHeartbeatTime: Date;
  } | null = null;
  
  private timeoutId: number | null = null;
  private paperMetadata: Map<string, PaperMetadata> = new Map();
  
  // Configuration
  private readonly HEARTBEAT_TIMEOUT = 15000; // 15 seconds
  
  /**
   * Create a new session service
   */
  constructor(private paperManager: PaperManager | null) {
    logger.debug('Session service initialized');
  }
  
  /**
   * Start a new session for a paper
   */
  startSession(sourceId: string, paperId: string, metadata?: PaperMetadata): void {
    // End any existing session
    this.endSession();
    
    // Create new session
    this.activeSession = {
      sourceId,
      paperId,
      startTime: new Date(),
      heartbeatCount: 0,
      lastHeartbeatTime: new Date()
    };
    
    // Store metadata if provided
    if (metadata) {
      const key = `${sourceId}:${paperId}`;
      this.paperMetadata.set(key, metadata);
      logger.debug(`Stored metadata for ${key}`);
    }
    
    // Start timeout check
    this.scheduleTimeoutCheck();
    
    logger.info(`Started session for ${sourceId}:${paperId}`);
  }
  
  /**
   * Record a heartbeat for the current session
   */
  recordHeartbeat(): boolean {
    if (!this.activeSession) {
      return false;
    }
    
    this.activeSession.heartbeatCount++;
    this.activeSession.lastHeartbeatTime = new Date();
    
    // Reschedule timeout
    this.scheduleTimeoutCheck();
    
    if (this.activeSession.heartbeatCount % 12 === 0) { // Log every minute (12 x 5sec heartbeats)
      logger.debug(`Session received ${this.activeSession.heartbeatCount} heartbeats`);
    }
    
    return true;
  }
  
  /**
   * Schedule a check for heartbeat timeout
   */
  private scheduleTimeoutCheck(): void {
    // Clear existing timeout
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
    }
    
    // Set new timeout
    this.timeoutId = self.setTimeout(() => {
      this.checkTimeout();
    }, this.HEARTBEAT_TIMEOUT);
  }
  
  /**
   * Check if the session has timed out due to missing heartbeats
   */
  private checkTimeout(): void {
    if (!this.activeSession) return;
    
    const now = Date.now();
    const lastTime = this.activeSession.lastHeartbeatTime.getTime();
    
    if ((now - lastTime) > this.HEARTBEAT_TIMEOUT) {
      logger.info('Session timeout detected');
      this.endSession();
    } else {
      this.scheduleTimeoutCheck();
    }
  }
  
  /**
   * End the current session and get the data
   */
  endSession(): ReadingSessionData | null {
    if (!this.activeSession) return null;
    
    // Clear timeout
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    
    const { sourceId, paperId, startTime, heartbeatCount } = this.activeSession;
    const endTime = new Date();
    
    // Calculate duration (5 seconds per heartbeat)
    const duration = heartbeatCount * 5;
    
    // Calculate total elapsed time
    const totalElapsed = endTime.getTime() - startTime.getTime();
    const totalElapsedSeconds = Math.round(totalElapsed / 1000);
    
    // Set idle seconds to the difference (for backward compatibility)
    const idleSeconds = Math.max(0, totalElapsedSeconds - duration);
    
    // Create session data
    const sessionData: ReadingSessionData = {
      session_id: `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      source_id: sourceId,
      paper_id: paperId,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      heartbeat_count: heartbeatCount,
      duration_seconds: duration,
      // Legacy fields
      idle_seconds: idleSeconds,
      total_elapsed_seconds: totalElapsedSeconds
    };
    
    // Store session if it was meaningful and we have a paper manager
    if (this.paperManager && heartbeatCount > 0) {
      const metadata = this.getPaperMetadata(sourceId, paperId);
      
      this.paperManager.logReadingSession(sourceId, paperId, sessionData, metadata)
        .catch(err => logger.error('Failed to store session', err));
    }
    
    logger.info(`Ended session for ${sourceId}:${paperId}`, {
      duration,
      heartbeats: heartbeatCount
    });
    
    // Clear active session
    this.activeSession = null;
    
    return sessionData;
  }
  
  /**
   * Check if a session is currently active
   */
  hasActiveSession(): boolean {
    return this.activeSession !== null;
  }
  
  /**
   * Get information about the current session
   */
  getCurrentSession(): { sourceId: string, paperId: string } | null {
    if (!this.activeSession) return null;
    
    return {
      sourceId: this.activeSession.sourceId,
      paperId: this.activeSession.paperId
    };
  }
  
  /**
   * Get paper metadata for the current or specified session
   */
  getPaperMetadata(sourceId?: string, paperId?: string): PaperMetadata | undefined {
    if (!sourceId || !paperId) {
      if (!this.activeSession) return undefined;
      sourceId = this.activeSession.sourceId;
      paperId = this.activeSession.paperId;
    }
    
    return this.paperMetadata.get(`${sourceId}:${paperId}`);
  }
  
  /**
   * Store paper metadata
   */
  storePaperMetadata(metadata: PaperMetadata): void {
    const key = `${metadata.sourceId}:${metadata.paperId}`;
    this.paperMetadata.set(key, metadata);
  }
  
  /**
   * Get time since last heartbeat in milliseconds
   */
  getTimeSinceLastHeartbeat(): number | null {
    if (!this.activeSession) {
      return null;
    }
    
    return Date.now() - this.activeSession.lastHeartbeatTime.getTime();
  }
  
  /**
   * Get session statistics for debugging
   */
  getSessionStats(): any {
    if (!this.activeSession) {
      return { active: false };
    }
    
    return {
      active: true,
      sourceId: this.activeSession.sourceId,
      paperId: this.activeSession.paperId,
      startTime: this.activeSession.startTime.toISOString(),
      heartbeatCount: this.activeSession.heartbeatCount,
      lastHeartbeatTime: this.activeSession.lastHeartbeatTime.toISOString(),
      elapsedTime: Math.round((Date.now() - this.activeSession.startTime.getTime()) / 1000)
    };
  }
}
