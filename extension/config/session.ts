// config/session.ts
// Session configuration management

import { RawSessionConfig, SessionConfig } from './types';
import { loguru } from '../utils/logger';

const logger = loguru.getLogger('session-config');

// Default configuration values
export const DEFAULT_CONFIG: RawSessionConfig = {
    idleThresholdMinutes: 5,
    minSessionDurationSeconds: 30,
    requireContinuousActivity: true,  // If true, resets timer on idle
    logPartialSessions: false,        // If true, logs sessions even if under minimum duration
    activityUpdateIntervalSeconds: 1  // How often to update active time
};

/**
 * Load session configuration from storage
 */
export async function loadSessionConfig(): Promise<RawSessionConfig> {
    try {
        const items = await chrome.storage.sync.get('sessionConfig');
        const config = { ...DEFAULT_CONFIG, ...items.sessionConfig };
        logger.debug('Loaded session config', config);
        return config;
    } catch (error) {
        logger.error('Error loading session config', error);
        return DEFAULT_CONFIG;
    }
}

/**
 * Save session configuration to storage
 */
export async function saveSessionConfig(config: RawSessionConfig): Promise<void> {
    try {
        // Ensure values are the correct type
        const sanitizedConfig: RawSessionConfig = {
            idleThresholdMinutes: Number(config.idleThresholdMinutes),
            minSessionDurationSeconds: Number(config.minSessionDurationSeconds),
            requireContinuousActivity: Boolean(config.requireContinuousActivity),
            logPartialSessions: Boolean(config.logPartialSessions),
            activityUpdateIntervalSeconds: Number(config.activityUpdateIntervalSeconds)
        };
        
        await chrome.storage.sync.set({ sessionConfig: sanitizedConfig });
        logger.debug('Saved session config', sanitizedConfig);
    } catch (error) {
        logger.error('Error saving session config', error);
        throw error;
    }
}

/**
 * Convert configuration to milliseconds for internal use
 */
export function getConfigurationInMs(config: RawSessionConfig): SessionConfig {
    return {
        idleThreshold: config.idleThresholdMinutes * 60 * 1000,
        minSessionDuration: config.minSessionDurationSeconds * 1000,
        activityUpdateInterval: config.activityUpdateIntervalSeconds * 1000,
        requireContinuousActivity: config.requireContinuousActivity,
        logPartialSessions: config.logPartialSessions
    };
}
