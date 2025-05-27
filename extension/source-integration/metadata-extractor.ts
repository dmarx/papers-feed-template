// extension/source-integration/metadata-extractor.ts
// Object-oriented metadata extraction system with customizable extraction methods

import { loguru } from '../utils/logger';

const logger = loguru.getLogger('metadata-extractor');

export interface ExtractedMetadata {
  title: string;
  authors: string;
  description: string;
  publishedDate: string;
  doi?: string;
  journalName?: string;
  tags?: string[];
  url?: string;
}

// Constants for standard source types
export const SOURCE_TYPES = {
  PDF: 'pdf',
  URL: 'url',
} as const;

export type SourceType = typeof SOURCE_TYPES[keyof typeof SOURCE_TYPES];

/**
 * Base class for metadata extraction with customizable extraction methods
 * Each method can be overridden to provide source-specific extraction
 */
export class MetadataExtractor {
  protected document: Document;
  protected url: string;
  
  /**
   * Create a new metadata extractor for a document
   */
  constructor(document: Document) {
    this.document = document;
    this.url = document.location.href;
    logger.debug('Initialized metadata extractor for:', this.url);
  }
  
  /**
   * Helper method to get content from meta tags
   */
  protected getMetaContent(selector: string): string {
    const element = this.document.querySelector(selector);
    return element ? element.getAttribute('content') || '' : '';
  }
  
  /**
   * Extract and return all metadata fields
   */
  public extract(): ExtractedMetadata {
    logger.debug('Extracting metadata from page:', this.url);
    
    const metadata: ExtractedMetadata = {
      title: this.extractTitle(),
      authors: this.extractAuthors(),
      description: this.extractDescription(),
      publishedDate: this.extractPublishedDate(),
      doi: this.extractDoi(),
      journalName: this.extractJournalName(),
      tags: this.extractTags(),
      url: this.url
    };
    
    logger.debug('Metadata extraction complete:', metadata);
    return metadata;
  }
  
  /**
   * Extract title from document
   * Considers multiple metadata standards with priority order
   */
  protected extractTitle(): string {
    // Title extraction - priority order
    return (
      // Dublin Core
      this.getMetaContent('meta[name="DC.Title"]') || this.getMetaContent('meta[name="dc.title"]') || 
      // Citation
      this.getMetaContent('meta[name="citation_title"]') ||
      // Open Graph
      this.getMetaContent('meta[property="og:title"]') ||
      // Standard meta
      this.getMetaContent('meta[name="title"]') ||
      // Fallback to document title
      this.document.title
    );
  }
  
  /**
   * Extract authors from document
   * Handles multiple author formats and sources
   */
  protected extractAuthors(): string {
    // Get all citation authors (some pages have multiple citation_author tags)
    const citationAuthors: string[] = [];
    this.document.querySelectorAll('meta[name="citation_author"]').forEach(el => {
      const content = el.getAttribute('content');
      if (content) citationAuthors.push(content);
    });
    
    // Get all DC creators
    const dcCreators: string[] = [];
    this.document.querySelectorAll('meta[name="DC.Creator.PersonalName"]').forEach(el => {
      const content = el.getAttribute('content');
      if (content) dcCreators.push(content);
    });
    
    // Individual author elements
    const dcCreator = this.getMetaContent('meta[name="DC.Creator.PersonalName"]') || this.getMetaContent('meta[name="dc.creator.personalname"]') ;
    const citationAuthor = this.getMetaContent('meta[name="citation_author"]');
    const ogAuthor = this.getMetaContent('meta[property="og:article:author"]') ||
                    this.getMetaContent('meta[name="author"]');
    
    // Set authors with priority
    if (dcCreators.length > 0) {
      return dcCreators.join(', ');
    } else if (citationAuthors.length > 0) {
      return citationAuthors.join(', ');
    } else if (dcCreator) {
      return dcCreator;
    } else if (citationAuthor) {
      return citationAuthor;
    } else if (ogAuthor) {
      return ogAuthor;
    }
    
    return '';
  }
  
  /**
   * Extract description/abstract from document
   */
  protected extractDescription(): string {
    return (
      this.getMetaContent('meta[name="DC.Description"]') || this.getMetaContent('meta[name="dc.description"]') ||
      this.getMetaContent('meta[name="citation_abstract"]') ||
      this.getMetaContent('meta[property="og:description"]') ||
      this.getMetaContent('meta[name="description"]')
    );
  }
  
  /**
   * Extract publication date from document
   */
  protected extractPublishedDate(): string {
    return (
      this.getMetaContent('meta[name="DC.Date.issued"]') || this.getMetaContent('meta[name="dc.date.issued"]') || this.getMetaContent('meta[name="dc.date"]') || this.getMetaContent('meta[name="dc.Date"]') || this.getMetaContent('meta[name="DC.Date"]') || 
      this.getMetaContent('meta[name="citation_date"]') ||
      this.getMetaContent('meta[property="article:published_time"]')
    );
  }
  
  /**
   * Extract DOI (Digital Object Identifier) from document
   */
  protected extractDoi(): string {
    return (
      this.getMetaContent('meta[name="DC.Identifier.DOI"]') || this.getMetaContent('meta[name="dc.identifier.doi"]') ||
      this.getMetaContent('meta[name="citation_doi"]')
    );
  }
  
  /**
   * Extract journal name from document
   */
  protected extractJournalName(): string {
    return (
      this.getMetaContent('meta[name="DC.Source"]') || this.getMetaContent('meta[name="dc.source"]') ||
      this.getMetaContent('meta[name="citation_journal_title"]')
    );
  }
  
  /**
   * Extract keywords/tags from document
   */
  protected extractTags(): string[] {
    const keywords = this.getMetaContent('meta[name="keywords"]') ||
                    this.getMetaContent('meta[name="DC.Subject"]') || this.getMetaContent('meta[name="dc.subject"]');
    
    if (keywords) {
      return keywords.split(',').map(tag => tag.trim());
    }
    
    return [];
  }
  
  /**
   * Determine if the current URL is a PDF
   */
  public isPdf(): boolean {
    return isPdfUrl(this.url);
  }
  
  /**
   * Get the source type (PDF or URL)
   */
  public getSourceType(): SourceType {
    return this.isPdf() ? SOURCE_TYPES.PDF : SOURCE_TYPES.URL;
  }
  
  /**
   * Generate a paper ID for the current URL
   */
  public generatePaperId(): string {
    return generatePaperIdFromUrl(this.url);
  }
}

/**
 * Create a common metadata extractor for a document
 * Factory function for creating the default extractor
 */
export function createMetadataExtractor(document: Document): MetadataExtractor {
  return new MetadataExtractor(document);
}

/**
 * Extract common metadata from a document
 * Convenience function for quick extraction
 */
export function extractCommonMetadata(document: Document): ExtractedMetadata {
  return createMetadataExtractor(document).extract();
}

/**
 * Generate a paper ID from a URL
 * Creates a consistent hash-based identifier
 */
export function generatePaperIdFromUrl(url: string): string {
  // Use a basic hash function to create an ID from the URL
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Create a positive hexadecimal string
  const positiveHash = Math.abs(hash).toString(16).toUpperCase();
  
  // Use the first 8 characters as the ID
  return positiveHash.substring(0, 8);
}

/**
 * Determine if a URL is a PDF
 */
export function isPdfUrl(url: string): boolean {
  return url.toLowerCase().endsWith('.pdf');
}
