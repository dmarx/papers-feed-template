// utils/logger.ts
// Logging utility wrapping loguru
/**
 * Logger class for consistent logging throughout the extension
 */
class Logger {
    constructor(module) {
        this.module = module;
    }
    /**
     * Log debug message
     */
    debug(message, data) {
        console.debug(`[${this.module}] ${message}`, data !== undefined ? data : '');
    }
    /**
     * Log info message
     */
    info(message, data) {
        console.info(`[${this.module}] ${message}`, data !== undefined ? data : '');
    }
    /**
     * Log warning message
     */
    warning(message, data) {
        console.warn(`[${this.module}] ${message}`, data !== undefined ? data : '');
    }
    /**
     * Alias for warning method (to match loguru API)
     */
    warn(message, data) {
        this.warning(message, data);
    }
    /**
     * Log error message
     */
    error(message, data) {
        console.error(`[${this.module}] ${message}`, data !== undefined ? data : '');
    }
}
/**
 * Loguru mock for browser extension use
 */
class LoguruMock {
    /**
     * Get logger for a module
     */
    getLogger(module) {
        return new Logger(module);
    }
}
// Export singleton instance
const loguru = new LoguruMock();

// config/session.ts
const logger = loguru.getLogger('session-config');
// Default configuration values
const DEFAULT_CONFIG = {
    idleThresholdMinutes: 5,
    minSessionDurationSeconds: 30,
    requireContinuousActivity: true, // If true, resets timer on idle
    logPartialSessions: false, // If true, logs sessions even if under minimum duration
    activityUpdateIntervalSeconds: 1 // How often to update active time
};
/**
 * Load session configuration from storage
 */
async function loadSessionConfig() {
    try {
        const items = await chrome.storage.sync.get('sessionConfig');
        const config = { ...DEFAULT_CONFIG, ...items.sessionConfig };
        logger.debug('Loaded session config', config);
        return config;
    }
    catch (error) {
        logger.error('Error loading session config', error);
        return DEFAULT_CONFIG;
    }
}
/**
 * Save session configuration to storage
 */
async function saveSessionConfig(config) {
    try {
        // Ensure values are the correct type
        const sanitizedConfig = {
            idleThresholdMinutes: Number(config.idleThresholdMinutes),
            minSessionDurationSeconds: Number(config.minSessionDurationSeconds),
            requireContinuousActivity: Boolean(config.requireContinuousActivity),
            logPartialSessions: Boolean(config.logPartialSessions),
            activityUpdateIntervalSeconds: Number(config.activityUpdateIntervalSeconds)
        };
        await chrome.storage.sync.set({ sessionConfig: sanitizedConfig });
        logger.debug('Saved session config', sanitizedConfig);
    }
    catch (error) {
        logger.error('Error saving session config', error);
        throw error;
    }
}

// options.ts
// Helper to set form values
function setFormValues(settings) {
    // GitHub settings
    if (settings.githubRepo) {
        document.getElementById('repo').value = settings.githubRepo;
    }
    if (settings.githubToken) {
        // Don't show the actual token, just indicate it's set
        document.getElementById('token').placeholder = '••••••••••••••••••••••';
    }
    // Session settings
    document.getElementById('idleThreshold').value =
        String(settings.sessionConfig?.idleThresholdMinutes ?? DEFAULT_CONFIG.idleThresholdMinutes);
    document.getElementById('minDuration').value =
        String(settings.sessionConfig?.minSessionDurationSeconds ?? DEFAULT_CONFIG.minSessionDurationSeconds);
    document.getElementById('requireContinuous').checked =
        settings.sessionConfig?.requireContinuousActivity ?? DEFAULT_CONFIG.requireContinuousActivity;
    document.getElementById('logPartial').checked =
        settings.sessionConfig?.logPartialSessions ?? DEFAULT_CONFIG.logPartialSessions;
}
// Helper to get form values
function getFormValues() {
    return {
        githubRepo: document.getElementById('repo').value.trim(),
        githubToken: document.getElementById('token').value.trim(),
        sessionConfig: {
            idleThresholdMinutes: Number(document.getElementById('idleThreshold').value),
            minSessionDurationSeconds: Number(document.getElementById('minDuration').value),
            requireContinuousActivity: document.getElementById('requireContinuous').checked,
            logPartialSessions: document.getElementById('logPartial').checked,
            activityUpdateIntervalSeconds: DEFAULT_CONFIG.activityUpdateIntervalSeconds // Keep default
        }
    };
}
// Display status message
function showStatus(message, isError = false) {
    const status = document.getElementById('status');
    if (!status)
        return;
    status.textContent = message;
    status.className = `status ${isError ? 'error' : 'success'}`;
    // Clear status after 3 seconds if it's a success message
    if (!isError) {
        setTimeout(() => {
            if (status) {
                status.textContent = '';
                status.className = 'status';
            }
        }, 3000);
    }
}
// Validate settings before saving
async function validateSettings(settings) {
    // Validate repository format
    if (!/^[\w-]+\/[\w-]+$/.test(settings.githubRepo)) {
        throw new Error('Invalid repository format. Use username/repository');
    }
    // Validate the token by making a test API call
    const response = await fetch(`https://api.github.com/repos/${settings.githubRepo}`, {
        headers: {
            'Authorization': `token ${settings.githubToken}`,
            'Accept': 'application/vnd.github.v3+json'
        }
    });
    if (!response.ok) {
        throw new Error('Invalid token or repository. Please check your credentials.');
    }
    // Validate session settings
    const { sessionConfig } = settings;
    if (sessionConfig.idleThresholdMinutes < 1 || sessionConfig.idleThresholdMinutes > 60) {
        throw new Error('Idle threshold must be between 1 and 60 minutes');
    }
    if (sessionConfig.minSessionDurationSeconds < 1 || sessionConfig.minSessionDurationSeconds > 300) {
        throw new Error('Minimum session duration must be between 10 and 300 seconds');
    }
}
// Save settings
async function saveSettings(settings) {
    await chrome.storage.sync.set({
        githubRepo: settings.githubRepo,
        githubToken: settings.githubToken
    });
    await saveSessionConfig(settings.sessionConfig);
}
// Initialize options page
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Load current settings
        const [storageItems, sessionConfig] = await Promise.all([
            chrome.storage.sync.get(['githubRepo', 'githubToken']),
            loadSessionConfig()
        ]);
        // Combine settings and display them
        setFormValues({
            ...storageItems,
            sessionConfig
        });
        // Add save button handler
        const saveButton = document.getElementById('save');
        if (saveButton) {
            saveButton.addEventListener('click', async () => {
                try {
                    const settings = getFormValues();
                    await validateSettings(settings);
                    await saveSettings(settings);
                    showStatus('Settings saved successfully!');
                }
                catch (error) {
                    showStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, true);
                }
            });
        }
    }
    catch (error) {
        showStatus(`Error loading settings: ${error instanceof Error ? error.message : 'Unknown error'}`, true);
    }
});
//# sourceMappingURL=options.bundle.js.map
