// extension/utils/popup-manager.ts
// Popup management system integrated with source manager

import { SourceManager } from '../source-integration/types';
import { PaperManager } from '../papers/manager';
import { PaperMetadata } from '../papers/types';
import { loguru } from './logger';

const logger = loguru.getLogger('popup-manager');

/**
 * Popup handler information
 */
interface PopupHandler {
  selector: string;
  event: string;
  action: string;
}

/**
 * Popup message type
 */
interface ShowPopupMessage {
  type: 'showPopup';
  sourceId: string;
  paperId: string;
  html: string;
  handlers: PopupHandler[];
  position?: { x: number, y: number };
}

/**
 * Manages all popup-related functionality
 */
export class PopupManager {
  // Source manager and paper manager
  private sourceManagerProvider: () => SourceManager | null;
  private paperManagerProvider: () => PaperManager | null;
  
  /**
   * Create a new popup manager
   */
  constructor(
    sourceManagerProvider: () => SourceManager | null,
    paperManagerProvider: () => PaperManager | null
  ) {
    this.sourceManagerProvider = sourceManagerProvider;
    this.paperManagerProvider = paperManagerProvider;
    
    this.setupMessageListeners();
    logger.debug('Popup manager initialized');
  }
  
  /**
   * Set up message listeners for popup-related messages
   */
  private setupMessageListeners(): void {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // Handle popup actions (ratings, notes, etc.)
      if (message.type === 'popupAction') {
        this.handlePopupAction(
          message.sourceId,
          message.paperId,
          message.action,
          message.data
        ).then(() => {
          sendResponse({ success: true });
        }).catch(error => {
          logger.error('Error handling popup action', error);
          sendResponse({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        });
        
        return true; // Will respond asynchronously
      }
      
      // Handle request to show annotation popup
      if (message.type === 'showAnnotationPopup' && sender.tab?.id) {
        this.handleShowAnnotationPopup(
          sender.tab.id,
          message.sourceId,
          message.paperId,
          message.position
        ).then(() => {
          sendResponse({ success: true });
        }).catch(error => {
          logger.error('Error showing popup', error);
          sendResponse({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        });
        
        return true; // Will respond asynchronously
      }
      
      return false; // Not handled
    });
  }
  
  /**
   * Handle a request to show an annotation popup
   */
  private async handleShowAnnotationPopup(
    tabId: number,
    sourceId: string,
    paperId: string,
    position: { x: number, y: number }
  ): Promise<void> {
    logger.debug(`Showing annotation popup for ${sourceId}:${paperId}`);
    
    // Check if we have source and paper manager
    const sourceManager = this.sourceManagerProvider();
    const paperManager = this.paperManagerProvider();
    
    if (!sourceManager) {
      throw new Error('Source manager not initialized');
    }
    
    if (!paperManager) {
      throw new Error('Paper manager not initialized');
    }
    
    try {
      // Get paper data
      const paper = await paperManager.getPaper(sourceId, paperId);
      
      // Create popup HTML
      const html = this.createPopupHtml(paper || { 
        sourceId, 
        paperId,
        title: paperId,
        authors: '',
        abstract: '',
        url: '',
        timestamp: new Date().toISOString(),
        publishedDate: '',
        tags: [],
        rating: 'novote'
      });
      
      // Get handlers
      const handlers = this.getStandardPopupHandlers();
      
      // Send message to content script to show popup
      const message: ShowPopupMessage = {
        type: 'showPopup',
        sourceId,
        paperId,
        html,
        handlers,
        position
      };
      
      await chrome.tabs.sendMessage(tabId, message);
      
      logger.debug(`Sent popup to content script for ${sourceId}:${paperId}`);
    } catch (error) {
      logger.error(`Error showing popup for ${sourceId}:${paperId}`, error);
      throw error;
    }
  }
  
  /**
   * Handle popup actions (ratings, notes, etc.)
   */
  private async handlePopupAction(
    sourceId: string,
    paperId: string,
    action: string,
    data: any
  ): Promise<void> {
    const paperManager = this.paperManagerProvider();
    
    if (!paperManager) {
      throw new Error('Paper manager not initialized');
    }
    
    logger.debug(`Handling popup action: ${action}`, { sourceId, paperId });
    
    try {
      if (action === 'rate') {
        await paperManager.updateRating(sourceId, paperId, data.value);
        logger.info(`Updated rating for ${sourceId}:${paperId} to ${data.value}`);
      } 
      else if (action === 'saveNotes') {
        if (data.value) {
          await paperManager.logAnnotation(sourceId, paperId, 'notes', data.value);
          logger.info(`Saved notes for ${sourceId}:${paperId}`);
        }
      }
    } catch (error) {
      logger.error(`Error handling action ${action} for ${sourceId}:${paperId}`, error);
      throw error;
    }
  }
  
  /**
   * Create HTML for paper popup
   */
  private createPopupHtml(paper: PaperMetadata): string {
    return `
      <div class="paper-popup-header">${paper.title || paper.paperId}</div>
      <div class="paper-popup-meta">${paper.authors || ''}</div>
      
      <div class="paper-popup-buttons">
        <button class="vote-button" data-vote="thumbsup" id="btn-thumbsup" ${paper.rating === 'thumbsup' ? 'class="active"' : ''}>👍 Interesting</button>
        <button class="vote-button" data-vote="thumbsdown" id="btn-thumbsdown" ${paper.rating === 'thumbsdown' ? 'class="active"' : ''}>👎 Not Relevant</button>
      </div>
      
      <textarea placeholder="Add notes about this paper..." id="paper-notes"></textarea>
      
      <div class="paper-popup-actions">
        <button class="save-button" id="btn-save">Save</button>
      </div>
    `;
  }
  
  /**
   * Get standard popup event handlers
   */
  private getStandardPopupHandlers(): PopupHandler[] {
    return [
      { selector: '#btn-thumbsup', event: 'click', action: 'rate' },
      { selector: '#btn-thumbsdown', event: 'click', action: 'rate' },
      { selector: '#btn-save', event: 'click', action: 'saveNotes' }
    ];
  }
}
