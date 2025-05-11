// config/types.ts
// Type definitions for configuration

export interface RawSessionConfig {
  // Time in minutes before considering user idle
  idleThresholdMinutes: number;
  
  // Minimum session duration in seconds to log
  minSessionDurationSeconds: number;
  
  // Whether to reset timer on idle
  requireContinuousActivity: boolean;
  
  // Whether to log sessions shorter than minimum duration
  logPartialSessions: boolean;
  
  // How often to update active time in seconds
  activityUpdateIntervalSeconds: number;
}

export interface SessionConfig {
  // Time in milliseconds before considering user idle
  idleThreshold: number;
  
  // Minimum session duration in milliseconds to log
  minSessionDuration: number;
  
  // Whether to reset timer on idle
  requireContinuousActivity: boolean;
  
  // Whether to log sessions shorter than minimum duration
  logPartialSessions: boolean;
  
  // How often to update active time in milliseconds
  activityUpdateInterval: number;
}

export interface StorageConfig {
  // GitHub access token
  githubToken: string;
  
  // GitHub repository (owner/repo)
  githubRepo: string;
  
  // Session tracking configuration
  sessionConfig: RawSessionConfig;
}
