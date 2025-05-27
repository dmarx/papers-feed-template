// extension/source-integration/nature/index.ts
// Nature.com integration with custom metadata extractor

import { BaseSourceIntegration } from '../base-source';
import { PaperMetadata } from '../../papers/types';
import { MetadataExtractor, ExtractedMetadata } from '../metadata-extractor';
import { loguru } from '../../utils/logger';

const logger = loguru.getLogger('nature-integration');

/**
 * Custom metadata extractor for Nature.com pages
 */
class NatureMetadataExtractor extends MetadataExtractor {
  /**
   * Override title extraction to use meta tag first
   */
  protected extractTitle(): string {
    const metaTitle = this.getMetaContent('meta[name="citation_title"]') || 
                      this.getMetaContent('meta[property="og:title"]');
    return metaTitle || super.extractTitle();
  }
  
  /**
   * Override authors extraction to use meta tag first
   */
  protected extractAuthors(): string {
    const metaAuthors = this.getMetaContent('meta[name="citation_author"]');
    if (metaAuthors) {
      return metaAuthors;
    }
    // Fallback to HTML extraction
    const authorElements = this.document.querySelectorAll('.c-article-author-list__item');
    if (authorElements.length > 0) {
      return Array.from(authorElements)
        .map(el => el.textContent?.trim())
        .filter(Boolean)
        .join(', ');
    }
    return super.extractAuthors();
  }
  
  /**
   * Extract keywords/tags from document
   */
  protected extractTags(): string[] {
    const keywords = this.getMetaContent('meta[name="dc.subject"]');
    
    if (keywords) {
      return keywords.split(',').map(tag => tag.trim());
    }
    
    return [];
  }
  

  /**
   * Override description extraction to use meta tag first
   */
  protected extractDescription(): string {
    const metaDescription = this.getMetaContent('meta[name="description"]') ||
                            this.getMetaContent('meta[property="og:description"]');
    return metaDescription || super.extractDescription();
  }

  /**
   * Override published date extraction to use meta tag
   */
  protected extractPublishedDate(): string {
    return this.getMetaContent('meta[name="citation_publication_date"]') || super.extractPublishedDate();
  }

  /**
   * Override DOI extraction to use meta tag
   */
  protected extractDoi(): string {
    return this.getMetaContent('meta[name="citation_doi"]') || super.extractDoi();
  }
}

/**
 * Nature.com integration with custom metadata extraction
 */
export class NatureIntegration extends BaseSourceIntegration {
  readonly id = 'nature';
  readonly name = 'Nature'; 

  // URL pattern for Nature articles with capture group for ID
  readonly urlPatterns = [
    /nature\.com\/articles\/([^?]+)/,
  ];

  /**
   * Extract paper ID from URL
   */
  extractPaperId(url: string): string | null {
    const match = url.match(this.urlPatterns[0]);
    return match ? match[1] : null;
  }

  /**
   * Create a custom metadata extractor for Nature.com
   */
  protected createMetadataExtractor(document: Document): MetadataExtractor {
    return new NatureMetadataExtractor(document);
  }
}

// Export a singleton instance 
export const natureIntegration = new NatureIntegration();
