// extension/source-integration/arxiv/index.ts
// ArXiv integration with custom metadata extractor

import { BaseSourceIntegration } from '../base-source';
import { PaperMetadata } from '../../papers/types';
import { MetadataExtractor, ExtractedMetadata } from '../metadata-extractor';
import { loguru } from '../../utils/logger';

const logger = loguru.getLogger('arxiv-integration');

/**
 * Custom metadata extractor for arXiv pages
 */
class ArxivMetadataExtractor extends MetadataExtractor {
  private apiMetadata?: Partial<ExtractedMetadata>;
  
  constructor(document: Document, apiMetadata?: Partial<ExtractedMetadata>) {
    super(document);
    this.apiMetadata = apiMetadata;
  }
  
  /**
   * Override title extraction to use API data if available
   */
  protected extractTitle(): string {
    if (this.apiMetadata?.title) {
      return this.apiMetadata.title;
    }
    
    return super.extractTitle();
  }
  
  /**
   * Override authors extraction to use API data if available
   */
  protected extractAuthors(): string {
    if (this.apiMetadata?.authors) {
      return this.apiMetadata.authors;
    }
    
    // arXiv-specific selectors
    const authorLinks = this.document.querySelectorAll('.authors a');
    if (authorLinks.length > 0) {
      return Array.from(authorLinks)
        .map(link => link.textContent?.trim())
        .filter(Boolean)
        .join(', ');
    }
    
    return super.extractAuthors();
  }
  
  /**
   * Override description extraction to use API data if available
   */
  protected extractDescription(): string {
    if (this.apiMetadata?.description) {
      return this.apiMetadata.description;
    }
    
    // arXiv-specific selectors
    const abstract = this.document.querySelector('.abstract')?.textContent?.trim();
    if (abstract) {
      // Remove "Abstract:" prefix if present
      return abstract.replace(/^Abstract:\s*/i, '');
    }
    
    return super.extractDescription();
  }
  
  /**
   * Override published date extraction to use API data if available
   */
  protected extractPublishedDate(): string {
    if (this.apiMetadata?.publishedDate) {
      return this.apiMetadata.publishedDate;
    }
    
    // arXiv-specific date extraction
    const datelineElement = this.document.querySelector('.dateline');
    if (datelineElement) {
      const dateText = datelineElement.textContent;
      const dateMatch = dateText?.match(/\(Submitted on ([^)]+)\)/);
      if (dateMatch) {
        return dateMatch[1];
      }
    }
    
    return super.extractPublishedDate();
  }
  
  /**
   * Override DOI extraction to use API data if available
   */
  protected extractDoi(): string {
    return this.apiMetadata?.doi || super.extractDoi();
  }
  
  /**
   * Override journal extraction to use API data if available
   */
  protected extractJournalName(): string {
    return this.apiMetadata?.journalName || super.extractJournalName();
  }
  
  /**
   * Override tags extraction to use API data if available
   */
  protected extractTags(): string[] {
    if (this.apiMetadata?.tags) {
      return this.apiMetadata.tags;
    }
    
    // arXiv-specific category extraction
    const subjects = this.document.querySelector('.subjects')?.textContent?.trim();
    if (subjects) {
      return subjects.split(/[;,]/).map(tag => tag.trim()).filter(Boolean);
    }
    
    return super.extractTags();
  }
}

/**
 * ArXiv integration with custom metadata extraction
 */
export class ArXivIntegration extends BaseSourceIntegration {
  readonly id = 'arxiv';
  readonly name = 'arXiv.org';
  
  // URL patterns for papers
  readonly urlPatterns = [
    /arxiv\.org\/(abs|pdf|html)\/([0-9.]+)/,
    /arxiv\.org\/\w+\/([0-9.]+)/
  ];
  
  // Content script matches
  // readonly contentScriptMatches = [
  //   "*://*.arxiv.org/*"
  // ];

  // ArXiv API endpoint
  private readonly API_BASE_URL = 'https://export.arxiv.org/api/query';

  /**
   * Extract paper ID from URL
   */
  extractPaperId(url: string): string | null {
    for (const pattern of this.urlPatterns) {
      const match = url.match(pattern);
      if (match) {
        return match[2] || match[1]; // The capture group with the paper ID
      }
    }
    return null;
  }

  /**
   * Create a custom metadata extractor for arXiv
   */
  protected createMetadataExtractor(document: Document): MetadataExtractor {
    return new ArxivMetadataExtractor(document);
  }

  /**
   * Fetch metadata from ArXiv API
   */
  private async fetchFromApi(paperId: string): Promise<Partial<ExtractedMetadata> | null> {
    try {
      const apiUrl = `${this.API_BASE_URL}?id_list=${paperId}`;
      logger.debug(`Fetching from ArXiv API: ${apiUrl}`);
      
      const response = await fetch(apiUrl);
      if (!response.ok) {
        logger.error(`ArXiv API request failed with status: ${response.status}`);
        return null;
      }
      
      const xmlText = await response.text();
      
      // Parse XML to JSON
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      
      // Convert XML to a more manageable format
      const entry = xmlDoc.querySelector('entry');
      if (!entry) {
        logger.warn('No entry found in ArXiv API response');
        return null;
      }
      
      // Extract metadata from XML
      const title = entry.querySelector('title')?.textContent?.trim() || '';
      const summary = entry.querySelector('summary')?.textContent?.trim() || '';
      const published = entry.querySelector('published')?.textContent?.trim() || '';
      
      // Extract authors
      const authorElements = entry.querySelectorAll('author name');
      const authors = Array.from(authorElements)
        .map(el => el.textContent?.trim())
        .filter(Boolean)
        .join(', ');
      
      // Extract DOI if available
      const doi = entry.querySelector('arxiv\\:doi, doi')?.textContent?.trim();
      
      // Extract journal reference if available
      const journalRef = entry.querySelector('arxiv\\:journal_ref, journal_ref')?.textContent?.trim();
      
      // Extract categories
      const categoryElements = entry.querySelectorAll('category');
      const categories = Array.from(categoryElements)
        .map(el => el.getAttribute('term'))
        .filter(Boolean) as string[];
      
      return {
        title,
        authors,
        description: summary,
        publishedDate: published,
        doi,
        journalName: journalRef,
        tags: categories
      };
      
    } catch (error) {
      logger.error('Error fetching from ArXiv API', error);
      return null;
    }
  }

  /**
   * Extract metadata from page or fetch from API
   * Override parent method to handle the API fallback
   */
  async extractMetadata(document: Document, paperId: string): Promise<PaperMetadata | null> {
    try {
      logger.info(`Extracting metadata for arXiv ID: ${paperId}`);
      
      // Try to extract from page first
      const extractor = this.createMetadataExtractor(document);
      const pageMetadata = extractor.extract();
      
      // Check if we have the essential fields
      const hasTitle = pageMetadata.title && pageMetadata.title !== document.title;
      const hasAuthors = pageMetadata.authors && pageMetadata.authors.length > 0;
      const hasAbstract = pageMetadata.description && pageMetadata.description.length > 0;
      
      if (hasTitle && hasAuthors && hasAbstract) {
        logger.debug('Successfully extracted complete metadata from page');
        return this.convertToPageMetadata(pageMetadata, paperId, extractor.getSourceType());
      }
      
      // If page extraction is incomplete, fetch from API
      logger.info('Page metadata incomplete, fetching from ArXiv API');
      const apiMetadata = await this.fetchFromApi(paperId);
      
      if (!apiMetadata) {
        logger.warn('Failed to fetch metadata from ArXiv API, using partial page data');
        return this.convertToPageMetadata(pageMetadata, paperId, extractor.getSourceType());
      }
      
      // Create a new extractor with API data
      const enhancedExtractor = new ArxivMetadataExtractor(document, apiMetadata);
      const mergedMetadata = enhancedExtractor.extract();
      
      logger.debug('Merged metadata from page and API', mergedMetadata);
      return this.convertToPageMetadata(mergedMetadata, paperId, enhancedExtractor.getSourceType());
      
    } catch (error) {
      logger.error('Error extracting metadata for arXiv', error);
      return null;
    }
  }

  /**
   * Convert ExtractedMetadata to PaperMetadata
   */
  private convertToPageMetadata(extracted: ExtractedMetadata, paperId: string, sourceType: string): PaperMetadata {
    return {
      sourceId: this.id,
      paperId: paperId,
      url: extracted.url || '',
      title: extracted.title,
      authors: extracted.authors,
      abstract: extracted.description,
      timestamp: new Date().toISOString(),
      rating: 'novote',
      publishedDate: extracted.publishedDate,
      tags: extracted.tags || [],
      doi: extracted.doi,
      journalName: extracted.journalName,
      sourceType: sourceType
    };
  }
}

// Export a singleton instance that can be used by both background and content scripts
export const arxivIntegration = new ArXivIntegration();
