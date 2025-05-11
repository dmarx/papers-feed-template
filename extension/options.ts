// options.ts
import { loadSessionConfig, DEFAULT_CONFIG, saveSessionConfig } from './config/session';
import { RawSessionConfig } from './config/types';

// Helper to set form values
function setFormValues(settings: {
  githubRepo?: string;
  githubToken?: string;
  sessionConfig?: RawSessionConfig;
}): void {
  // GitHub settings
  if (settings.githubRepo) {
    (document.getElementById('repo') as HTMLInputElement).value = settings.githubRepo;
  }
  if (settings.githubToken) {
    // Don't show the actual token, just indicate it's set
    (document.getElementById('token') as HTMLInputElement).placeholder = '••••••••••••••••••••••';
  }

  // Session settings
  (document.getElementById('idleThreshold') as HTMLInputElement).value = 
    String(settings.sessionConfig?.idleThresholdMinutes ?? DEFAULT_CONFIG.idleThresholdMinutes);
    
  (document.getElementById('minDuration') as HTMLInputElement).value = 
    String(settings.sessionConfig?.minSessionDurationSeconds ?? DEFAULT_CONFIG.minSessionDurationSeconds);
    
  (document.getElementById('requireContinuous') as HTMLInputElement).checked = 
    settings.sessionConfig?.requireContinuousActivity ?? DEFAULT_CONFIG.requireContinuousActivity;
    
  (document.getElementById('logPartial') as HTMLInputElement).checked = 
    settings.sessionConfig?.logPartialSessions ?? DEFAULT_CONFIG.logPartialSessions;
}

// Helper to get form values
function getFormValues(): {
  githubRepo: string;
  githubToken: string;
  sessionConfig: RawSessionConfig;
} {
  return {
    githubRepo: (document.getElementById('repo') as HTMLInputElement).value.trim(),
    githubToken: (document.getElementById('token') as HTMLInputElement).value.trim(),
    sessionConfig: {
      idleThresholdMinutes: Number((document.getElementById('idleThreshold') as HTMLInputElement).value),
      minSessionDurationSeconds: Number((document.getElementById('minDuration') as HTMLInputElement).value),
      requireContinuousActivity: (document.getElementById('requireContinuous') as HTMLInputElement).checked,
      logPartialSessions: (document.getElementById('logPartial') as HTMLInputElement).checked,
      activityUpdateIntervalSeconds: DEFAULT_CONFIG.activityUpdateIntervalSeconds // Keep default
    }
  };
}

// Display status message
function showStatus(message: string, isError = false): void {
  const status = document.getElementById('status');
  if (!status) return;
  
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
async function validateSettings(settings: {
  githubRepo: string;
  githubToken: string;
  sessionConfig: RawSessionConfig;
}): Promise<void> {
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
async function saveSettings(settings: {
  githubRepo: string;
  githubToken: string;
  sessionConfig: RawSessionConfig;
}): Promise<void> {
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
      ...(storageItems as {
        githubRepo?: string;
        githubToken?: string;
      }),
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
        } catch (error) {
          showStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, true);
        }
      });
    }

  } catch (error) {
    showStatus(`Error loading settings: ${error instanceof Error ? error.message : 'Unknown error'}`, true);
  }
});
