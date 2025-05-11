// extension/source-integration/link-processor.ts
// Generic link detection and processing module

import { loguru } from '../utils/logger';

const logger = loguru.getLogger('link-processor');

interface LinkPattern {
  // Source integration ID
  sourceId: string;
  
  // Regular expression to match URLs
  pattern: RegExp;
  
  // Function to extract paper ID from URL
  extractPaperId: (url: string) => string | null;
}

export class LinkProcessor {
  private patterns: LinkPattern[] = [];
  private observer: MutationObserver | null = null;
  private processedLinks = new Set<string>();
  private onLinkFound: (sourceId: string, paperId: string, link: HTMLAnchorElement) => void;
  
  constructor(onLinkFound: (sourceId: string, paperId: string, link: HTMLAnchorElement) => void) {
    this.onLinkFound = onLinkFound;
    logger.debug('Link processor initialized');
  }
  
  /**
   * Register a new link pattern
   */
  registerPattern(pattern: LinkPattern): void {
    this.patterns.push(pattern);
    logger.debug(`Registered pattern for ${pattern.sourceId}`);
  }
  
  /**
   * Process all links in the document
   */
  processLinks(document: Document): void {
    // Process all links in the document
    const links = document.querySelectorAll<HTMLAnchorElement>('a[href]');
    
    links.forEach(link => {
      // Use a unique identifier for this link
      const linkId = this.getLinkId(link);
      
      // Skip if already processed
      if (this.processedLinks.has(linkId)) {
        return;
      }
      
      this.processedLinks.add(linkId);
      
      // Check each pattern
      for (const pattern of this.patterns) {
        if (pattern.pattern.test(link.href)) {
          const paperId = pattern.extractPaperId(link.href);
          
          if (paperId) {
            // Call the callback
            this.onLinkFound(pattern.sourceId, paperId, link);
            break; // Stop after first match
          }
        }
      }
    });
  }
  
  /**
   * Start observing for DOM changes
   */
  startObserving(document: Document): void {
    if (this.observer) {
      this.observer.disconnect();
    }
    
    this.observer = new MutationObserver((mutations) => {
      let newLinks = false;
      
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // If this is an anchor tag, check it
            if ((node as Element).tagName === 'A') {
              newLinks = true;
            }
            
            // Check for any anchor tags within this element
            const links = (node as Element).querySelectorAll('a[href]');
            if (links.length > 0) {
              newLinks = true;
            }
          }
        });
      });
      
      if (newLinks) {
        this.processLinks(document);
      }
    });
    
    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    logger.debug('Started observing for DOM changes');
  }
  
  /**
   * Create a unique ID for a link
   */
  private getLinkId(link: HTMLAnchorElement): string {
    // Use href and position in document to create a unique ID
    const path = this.getElementPath(link);
    return `${link.href}|${path}`;
  }
  
  /**
   * Get element path in DOM for identification
   */
  private getElementPath(element: Element): string {
    const path: string[] = [];
    let current: Element | null = element;
    
    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();
      
      if (current.id) {
        selector += `#${current.id}`;
      } else {
        const siblings = Array.from(current.parentElement?.children || []);
        const index = siblings.indexOf(current) + 1;
        if (siblings.length > 1) {
          selector += `:nth-child(${index})`;
        }
      }
      
      path.unshift(selector);
      current = current.parentElement;
    }
    
    return path.join(' > ');
  }
  
  /**
   * Stop observing DOM changes
   */
  stopObserving(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
      logger.debug('Stopped observing DOM changes');
    }
  }
}
