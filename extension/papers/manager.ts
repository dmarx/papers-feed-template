// extension/papers/manager.ts
import { GitHubStoreClient } from 'gh-store-client';
import type { Json } from 'gh-store-client';
import { 
  type PaperMetadata, 
  type InteractionLog, 
  type Interaction,
  type ReadingSessionData,
  isInteractionLog
} from './types';
import { SourceManager } from '../source-integration/types';
import { loguru } from '../utils/logger';

const logger = loguru.getLogger('paper-manager');

export class PaperManager {
  constructor(
    private client: GitHubStoreClient,
    private sourceManager: SourceManager
  ) {
    logger.debug('Paper manager initialized');
  }
  
  /**
   * Get paper by source and ID
   */
  async getPaper(sourceId: string, paperId: string): Promise<PaperMetadata | null> {
    const objectId = this.sourceManager.formatObjectId('paper', sourceId, paperId);
    
    try {
      const obj = await this.client.getObject(objectId);
      return obj.data as PaperMetadata;
    } catch (error) {
      if (error instanceof Error && error.message.includes('No object found')) {
        return null;
      }
      throw error;
    }
  }
  
  /**
   * Get or create paper metadata
   */
  async getOrCreatePaper(paperData: PaperMetadata): Promise<PaperMetadata> {
    const { sourceId, paperId } = paperData;
    const objectId = this.sourceManager.formatObjectId('paper', sourceId, paperId);
    const paperIdentifier = this.sourceManager.formatPaperId(sourceId, paperId);
    
    try {
      const obj = await this.client.getObject(objectId);
      const data = obj.data as PaperMetadata;
      logger.debug(`Retrieved existing paper: ${paperIdentifier}`);
      return data;
    } catch (error) {
      if (error instanceof Error && error.message.includes('No object found')) {
        // Create new paper
        const defaultPaperData: PaperMetadata = {
          ...paperData,
          timestamp: new Date().toISOString(),
          rating: paperData.rating || 'novote'
        };

        const newobj = await this.client.createObject(objectId, defaultPaperData);
        logger.debug(`Created new paper: ${paperIdentifier}`);
        // reopen to trigger metadata hydration
        await this.client.fetchFromGitHub(`/issues/${newobj.meta.issueNumber}`, {
          method: "PATCH",
          body: JSON.stringify({ state: "open" })
        });
        return defaultPaperData;
      }
      throw error;
    }
  }

  /**
   * Get or create interaction log for a paper
   */
  private async getOrCreateInteractionLog(sourceId: string, paperId: string): Promise<InteractionLog> {
    const objectId = this.sourceManager.formatObjectId('interactions', sourceId, paperId);
    const paperIdentifier = this.sourceManager.formatPaperId(sourceId, paperId);
    
    try {
      const obj = await this.client.getObject(objectId);
      const data = obj.data as unknown;
      if (isInteractionLog(data)) {
        return data;
      }
      throw new Error('Invalid interaction log format');
    } catch (error) {
      if (error instanceof Error && error.message.includes('No object found')) {
        const newLog: InteractionLog = {
          sourceId,
          paperId,
          interactions: []
        };
        await this.client.createObject(objectId, newLog as unknown as { [key: string]: Json });
        logger.debug(`Created new interaction log: ${paperIdentifier}`);
        return newLog;
      }
      throw error;
    }
  }
  
  /**
   * Get GitHub client instance
   */
  getClient(): GitHubStoreClient {
    return this.client;
  }
  
  /**
   * Log a reading session
   */
  async logReadingSession(
    sourceId: string,
    paperId: string,
    session: ReadingSessionData,
    paperData?: Partial<PaperMetadata>
  ): Promise<void> {
    // Ensure paper exists
    if (paperData) {
      await this.getOrCreatePaper({
        sourceId,
        paperId,
        url: paperData.url || this.sourceManager.formatPaperId(sourceId, paperId),
        title: paperData.title || paperId,
        authors: paperData.authors || '',
        abstract: paperData.abstract || '',
        timestamp: new Date().toISOString(),
        rating: 'novote',
        publishedDate: paperData.publishedDate || '',
        tags: paperData.tags || []
      });
    }

    // Log the session as an interaction
    await this.addInteraction(sourceId, paperId, {
      type: 'reading_session',
      timestamp: new Date().toISOString(),
      data: session as unknown as { [key: string]: Json }
    });
    
    const paperIdentifier = this.sourceManager.formatPaperId(sourceId, paperId);
    logger.info(`Logged reading session for ${paperIdentifier}`, { duration: session.duration_seconds });
  }

  /**
   * Log an annotation
   */
  async logAnnotation(
    sourceId: string,
    paperId: string,
    key: string,
    value: Json,
    paperData?: Partial<PaperMetadata>
  ): Promise<void> {
    // Ensure paper exists
    if (paperData) {
      await this.getOrCreatePaper({
        sourceId,
        paperId,
        url: paperData.url || this.sourceManager.formatPaperId(sourceId, paperId),
        title: paperData.title || paperId,
        authors: paperData.authors || '',
        abstract: paperData.abstract || '',
        timestamp: new Date().toISOString(),
        rating: 'novote',
        publishedDate: paperData.publishedDate || '',
        tags: paperData.tags || []
      });
    }

    // Log the annotation as an interaction
    await this.addInteraction(sourceId, paperId, {
      type: 'annotation',
      timestamp: new Date().toISOString(),
      data: { key, value }
    });
    
    const paperIdentifier = this.sourceManager.formatPaperId(sourceId, paperId);
    logger.info(`Logged annotation for ${paperIdentifier}`, { key });
  }

  /**
   * Update paper rating
   */
  async updateRating(
    sourceId: string,
    paperId: string,
    rating: string,
    paperData?: Partial<PaperMetadata>
  ): Promise<void> {
    // Ensure paper exists and get current data
    const paper = await this.getOrCreatePaper({
      sourceId,
      paperId,
      url: paperData?.url || this.sourceManager.formatPaperId(sourceId, paperId),
      title: paperData?.title || paperId,
      authors: paperData?.authors || '',
      abstract: paperData?.abstract || '',
      timestamp: new Date().toISOString(),
      rating: 'novote',
      publishedDate: paperData?.publishedDate || '',
      tags: paperData?.tags || []
    });

    const objectId = this.sourceManager.formatObjectId('paper', sourceId, paperId);
    
    // Update paper metadata with new rating
    await this.client.updateObject(objectId, { 
      ...paper,
      rating 
    });

    // Log rating change as an interaction
    await this.addInteraction(sourceId, paperId, {
      type: 'rating',
      timestamp: new Date().toISOString(),
      data: { rating }
    });
    
    const paperIdentifier = this.sourceManager.formatPaperId(sourceId, paperId);
    logger.info(`Updated rating for ${paperIdentifier} to ${rating}`);
  }

  /**
   * Add interaction to log
   */
  private async addInteraction(sourceId: string, paperId: string, interaction: Interaction): Promise<void> {
    const log = await this.getOrCreateInteractionLog(sourceId, paperId);
    log.interactions.push(interaction);
    
    const objectId = this.sourceManager.formatObjectId('interactions', sourceId, paperId);
    await this.client.updateObject(objectId, log as unknown as { [key: string]: Json });
  }
}
