// extension/source-integration/base-source.ts
// Base class for source integrations with default identifier formatting
// and metadata extraction capability

import { SourceIntegration } from './types';
import { PaperMetadata } from '../papers/types';
import { loguru } from '../utils/logger';
import { 
  MetadataExtractor, 
  createMetadataExtractor,
  generatePaperIdFromUrl
} from './metadata-extractor';

const logger = loguru.getLogger('base-source');

/**
 * Base class for source integrations
 * Provides default implementations for all methods
 * Specific sources can override as needed
 */
export class BaseSourceIntegration implements SourceIntegration {
  // Default properties - set for generic web pages
  readonly id: string = 'url';
  readonly name: string = 'Web Page';
  readonly urlPatterns: RegExp[] = [
    /^https?:\/\/(?!.*\.pdf($|\?|#)).*$/i  // Match HTTP/HTTPS URLs that aren't PDFs
  ];
  readonly contentScriptMatches: string[] = [];

  /**
   * Check if this integration can handle the given URL
   * Default implementation checks against urlPatterns
   */
  canHandleUrl(url: string): boolean {
    return this.urlPatterns.some(pattern => pattern.test(url));
  }

  /**
   * Extract paper ID from URL
   * Default implementation creates a hash from the URL
   */
  extractPaperId(url: string): string | null {
    return generatePaperIdFromUrl(url);
  }
  
  /**
   * Create a metadata extractor for the given document
   * Override this method to provide a custom extractor for your source
   */
  protected createMetadataExtractor(document: Document): MetadataExtractor {
    return createMetadataExtractor(document);
  }
  
  /**
   * Extract metadata from a page
   * Default implementation uses common metadata extraction
   */
  async extractMetadata(document: Document, paperId: string): Promise<PaperMetadata | null> {
    try {
      logger.debug(`Extracting metadata using base extractor for ID: ${paperId}`);
      
      // Create a metadata extractor for this document
      const extractor = this.createMetadataExtractor(document);
      
      // Extract metadata
      const extracted = extractor.extract();
      const url = document.location.href;
      
      // Determine source type (PDF or URL)
      const sourceType = extractor.getSourceType();
      
      // Create PaperMetadata object
      return {
        sourceId: this.id,
        //paperId: this.formatPaperId(paperId),
        paperId: paperId,
        url: url,
        title: extracted.title || document.title || paperId,
        authors: extracted.authors || '',
        abstract: extracted.description || '',
        timestamp: new Date().toISOString(),
        rating: 'novote',
        publishedDate: extracted.publishedDate || '',
        tags: extracted.tags || [],
        doi: extracted.doi,
        journalName: extracted.journalName,
        sourceType: sourceType // Store the source type for reference
      };
    } catch (error) {
      logger.error('Error extracting metadata with base extractor', error);
      return null;
    }
  }
  
  /**
   * Format a paper identifier for this source
   * Default implementation uses the format: sourceId.paperId
   */
  formatPaperId(paperId: string): string {
    return `${this.id}.${paperId}`;
  }
  
  /**
   * Parse a paper identifier specific to this source
   * Default implementation handles source.paperId format and extracts paperId
   */
  parsePaperId(identifier: string): string | null {
    const prefix = `${this.id}.`;
    
    if (identifier.startsWith(prefix)) {
      return identifier.substring(prefix.length);
    }
    
    // Try legacy format (sourceId:paperId)
    const legacyPrefix = `${this.id}:`;
    if (identifier.startsWith(legacyPrefix)) {
      logger.debug(`Parsed legacy format identifier: ${identifier}`);
      return identifier.substring(legacyPrefix.length);
    }
    
    return null;
  }
  
  /**
   * Format a storage object ID for this source
   * Default implementation uses the format: type:sourceId.paperId
   */
  formatObjectId(type: string, paperId: string): string {
    return `${type}:${this.formatPaperId(paperId)}`;
  }
}
