// extension/source-integration/registry.ts
// Central registry for all source integrations

import { SourceIntegration } from './types';
import { arxivIntegration } from './arxiv';
import { openReviewIntegration } from './openreview';
// Import any other integrations here

/**
 * Registry of all available source integrations
 * This is the SINGLE place where integrations need to be added
 */
export const sourceIntegrations: SourceIntegration[] = [
  arxivIntegration,
  openReviewIntegration,
  // Add new integrations here
];

/**
 * Get all available source integrations
 */
export function getAllIntegrations(): SourceIntegration[] {
  return sourceIntegrations;
}

/**
 * Get a specific integration by ID
 */
export function getIntegrationById(id: string): SourceIntegration | undefined {
  return sourceIntegrations.find(integration => integration.id === id);
}

/**
 * Get all content script match patterns from all integrations
 */
export function getAllContentScriptMatches(): string[] {
  return sourceIntegrations.flatMap(integration => integration.contentScriptMatches);
}
