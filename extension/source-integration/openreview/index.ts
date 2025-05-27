// extension/source-integration/openreview/index.ts
// OpenReview integration with custom metadata extractor

import { BaseSourceIntegration } from '../base-source';
import { PaperMetadata } from '../../papers/types';
import { MetadataExtractor, createMetadataExtractor, ExtractedMetadata } from '..//metadata-extractor';
import { loguru } from '../../utils/logger';

const logger = loguru.getLogger('openreview-integration');

/**
 * Custom metadata extractor for OpenReview pages
 */
class OpenReviewMetadataExtractor extends MetadataExtractor {
  /**
   * Extract metadata from OpenReview pages
   */
  public extract(): ExtractedMetadata {
    // First try to extract using standard methods
    const baseMetadata = super.extract();
    
    try {
      // Get title from OpenReview-specific elements
      const title = this.document.querySelector('.citation_title')?.textContent || 
                   this.document.querySelector('.forum-title h2')?.textContent;
      
      // Get authors
      const authorElements = Array.from(this.document.querySelectorAll('.forum-authors a'));
      const authors = authorElements
        .map(el => el.textContent)
        .filter(Boolean)
        .join(', ');
      
      // Get abstract
      const abstract = this.document.querySelector('meta[name="citation_abstract"]')?.getAttribute('content') ||
                     Array.from(this.document.querySelectorAll('.note-content-field'))
                       .find(el => el.textContent?.includes('Abstract'))
                       ?.nextElementSibling?.textContent;
      
      // Get publication date
      const dateText = this.document.querySelector('.date.item')?.textContent;
      let publishedDate = '';
      if (dateText) {
        const dateMatch = dateText.match(/Published: ([^,]+)/);
        if (dateMatch) {
          publishedDate = dateMatch[1];
        }
      }
      
      // Get DOI if available
      const doi = this.document.querySelector('meta[name="citation_doi"]')?.getAttribute('content') || '';
      
      // Get conference/journal name
      const venueElements = this.document.querySelectorAll('.forum-meta .item');
      let venue = '';
      for (let i = 0; i < venueElements.length; i++) {
        const el = venueElements[i];
        if (el.querySelector('.glyphicon-folder-open')) {
          venue = el.textContent?.trim() || '';
          break;
        }
      }
      
      // Get tags/keywords
      const keywordsElement = Array.from(this.document.querySelectorAll('.note-content-field'))
        .find(el => el.textContent?.includes('Keywords'));
      let tags: string[] = [];
      if (keywordsElement) {
        const keywordsValue = keywordsElement.nextElementSibling?.textContent;
        if (keywordsValue) {
          tags = keywordsValue.split(',').map(tag => tag.trim());
        }
      }
      
      return {
        title: title || baseMetadata.title,
        authors: authors || baseMetadata.authors,
        description: abstract || baseMetadata.description,
        publishedDate: publishedDate || baseMetadata.publishedDate,
        doi: doi || baseMetadata.doi,
        journalName: venue || baseMetadata.journalName,
        tags: tags.length ? tags : baseMetadata.tags,
        url: this.url
      };
    } catch (error) {
      logger.error('Error during OpenReview-specific extraction', error);
      return baseMetadata;
    }
  }
}

/**
 * OpenReview integration with custom metadata extraction
 */
export class OpenReviewIntegration extends BaseSourceIntegration {
  readonly id = 'openreview';
  readonly name = 'OpenReview';
  
  // URL patterns for papers
  readonly urlPatterns = [
    /openreview\.net\/forum\?id=([a-zA-Z0-9]+)/,
    /openreview\.net\/pdf\?id=([a-zA-Z0-9]+)/
  ];

  /**
   * Extract paper ID from URL
   */
  extractPaperId(url: string): string | null {
    for (const pattern of this.urlPatterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1]; // The capture group with the paper ID
      }
    }
    return null;
  }

  /**
   * Create a custom metadata extractor for OpenReview
   */
  protected createMetadataExtractor(document: Document): MetadataExtractor {
    return new OpenReviewMetadataExtractor(document);
  }

  /**
   * Extract metadata from page
   * Override parent method to handle OpenReview-specific extraction
   */
  async extractMetadata(document: Document, paperId: string): Promise<PaperMetadata | null> {
    logger.info(`Extracting metadata for OpenReview ID: ${paperId}`);
    
    // Extract metadata using our custom extractor
    const metadata = await super.extractMetadata(document, paperId);
    
    if (metadata) {
      // Add any OpenReview-specific metadata processing here
      logger.debug('Extracted metadata from OpenReview page');
      
      // Check if we're on a PDF page and adjust metadata accordingly
      if (document.location.href.includes('/pdf?id=')) {
        metadata.sourceType = 'pdf';
      }
    }
    
    return metadata;
  }
}

// Export a singleton instance that can be used by both background and content scripts
export const openReviewIntegration = new OpenReviewIntegration();
