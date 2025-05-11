// extension/source-integration/source-manager.ts
// Updated SourceIntegrationManager to use source-specific identifier formatting

import { SourceIntegration, SourceManager } from './types';
import { loguru } from '../utils/logger';

const logger = loguru.getLogger('source-manager');

/**
 * Manages source integrations
 */
export class SourceIntegrationManager implements SourceManager {
  private sources: Map<string, SourceIntegration> = new Map();
  
  constructor() {
    logger.info('Source integration manager initialized');
  }
  
  /**
   * Register a source integration
   */
  registerSource(source: SourceIntegration): void {
    if (this.sources.has(source.id)) {
      logger.warning(`Source with ID '${source.id}' already registered, overwriting`);
    }
    
    this.sources.set(source.id, source);
    logger.info(`Registered source: ${source.name} (${source.id})`);
  }
  
  /**
   * Get all registered sources
   */
  getAllSources(): SourceIntegration[] {
    return Array.from(this.sources.values());
  }
  
  /**
   * Get source that can handle a URL
   */
  getSourceForUrl(url: string): SourceIntegration | null {
    for (const source of this.sources.values()) {
      if (source.canHandleUrl(url)) {
        logger.debug(`Found source for URL '${url}': ${source.id}`);
        return source;
      }
    }
    
    logger.debug(`No source found for URL: ${url}`);
    return null;
  }
  
  /**
   * Get source by ID
   */
  getSourceById(sourceId: string): SourceIntegration | null {
    const source = this.sources.get(sourceId);
    return source || null;
  }
  
  /**
   * Extract paper ID from URL using appropriate source
   */
  extractPaperId(url: string): { sourceId: string, paperId: string } | null {
    for (const source of this.sources.values()) {
      if (source.canHandleUrl(url)) {
        const paperId = source.extractPaperId(url);
        if (paperId) {
          logger.debug(`Extracted paper ID '${paperId}' from URL using ${source.id}`);
          return { sourceId: source.id, paperId };
        }
      }
    }
    
    logger.debug(`Could not extract paper ID from URL: ${url}`);
    return null;
  }
  
  /**
   * Format a paper identifier using the appropriate source
   */
  formatPaperId(sourceId: string, paperId: string): string {
    const source = this.sources.get(sourceId);
    
    if (source) {
      return source.formatPaperId(paperId);
    }
    
    // Fallback if source not found
    logger.warning(`Source '${sourceId}' not found, using default format for paper ID`);
    return `${sourceId}.${paperId}`;
  }
  
  /**
   * Format an object ID using the appropriate source
   */
  formatObjectId(type: string, sourceId: string, paperId: string): string {
    const source = this.sources.get(sourceId);
    
    if (source) {
      return source.formatObjectId(type, paperId);
    }
    
    // Fallback if source not found
    logger.warning(`Source '${sourceId}' not found, using default format for object ID`);
    return `${type}:${sourceId}.${paperId}`;
  }
  
  /**
   * Get all content script match patterns
   */
  getAllContentScriptMatches(): string[] {
    const patterns: string[] = [];
    
    for (const source of this.sources.values()) {
      patterns.push(...source.contentScriptMatches);
    }
    
    return patterns;
  }
}
