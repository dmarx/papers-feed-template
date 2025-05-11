// extension/papers/types.ts
// Updated for heartbeat-based session tracking

import type { Json } from 'gh-store-client';

/**
 * Paper metadata from any source
 */
export interface PaperMetadata {
  // Source identifier
  sourceId: string;
  
  // Paper identifier within the source
  paperId: string;
  
  // Full URL to the paper
  url: string;
  
  // Paper title
  title: string;
  
  // Authors (comma-separated)
  authors: string;
  
  // Abstract or summary
  abstract: string;
  
  // When this paper was first added
  timestamp: string;
  
  // Publication date
  publishedDate: string;
  
  // Tags or categories
  tags: string[];
  
  // User-assigned rating (novote, thumbsup, thumbsdown)
  rating: string;
  
  // Allow additional source-specific properties
  [key: string]: any;
}

/**
 * Reading session data - updated for heartbeat tracking
 */
export interface ReadingSessionData {
  // Session identifier
  session_id: string;
  
  // Paper identifiers
  source_id?: string;
  paper_id?: string;
  
  // Session timing
  start_time: string;
  end_time: string;
  
  // Heartbeat data
  heartbeat_count: number;
  
  // Duration in seconds (derived from heartbeat count)
  duration_seconds: number;
  
  // Legacy properties for backward compatibility
  idle_seconds?: number;
  total_elapsed_seconds?: number;
}

/**
 * Interaction data
 */
export interface Interaction {
  // Type of interaction (reading_session, annotation, rating)
  type: string;
  
  // When interaction occurred
  timestamp: string;
  
  // Additional data
  data: Json;
}

/**
 * Interaction log
 */
export interface InteractionLog {
  // Source identifier
  sourceId: string;
  
  // Paper identifier within the source
  paperId: string;
  
  // List of interactions
  interactions: Interaction[];

  // Index signature to make it compatible with Json type
  [key: string]: string | Interaction[] | any;
}

/**
 * Type guard for interaction log
 */
export function isInteractionLog(data: unknown): data is InteractionLog {
  const log = data as InteractionLog;
  return (
    typeof log === 'object' &&
    log !== null &&
    typeof log.sourceId === 'string' &&
    typeof log.paperId === 'string' &&
    Array.isArray(log.interactions)
  );
}
