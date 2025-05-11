// extension/popup.ts
// Popup script with refactored manual paper tracking
console.log('Popup script starting...');
// Function to get paper data from background script
async function getCurrentPaper() {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'getCurrentPaper' }, (response) => {
            console.log('Got paper data from background:', response);
            resolve(response);
        });
    });
}
// Function to update UI with paper data
function updateUI(paperData) {
    const titleElement = document.getElementById('paperTitle');
    const authorsElement = document.getElementById('paperAuthors');
    const statusElement = document.getElementById('status');
    const manualLogSection = document.getElementById('manualLogSection');
    if (!titleElement || !authorsElement || !statusElement || !manualLogSection) {
        console.error('Required DOM elements not found');
        return;
    }
    if (paperData) {
        // Show detected paper data
        titleElement.textContent = paperData.title || paperData.paperId;
        authorsElement.textContent = paperData.authors;
        statusElement.textContent = 'Paper tracked! Issue created on GitHub.';
        // Enable rating buttons
        const thumbsUpButton = document.getElementById('thumbsUp');
        const thumbsDownButton = document.getElementById('thumbsDown');
        if (thumbsUpButton && thumbsDownButton) {
            thumbsUpButton.disabled = false;
            thumbsDownButton.disabled = false;
            // Set active state on rating buttons
            thumbsUpButton.classList.toggle('active', paperData.rating === 'thumbsup');
            thumbsDownButton.classList.toggle('active', paperData.rating === 'thumbsdown');
        }
        // Hide manual log section
        manualLogSection.style.display = 'none';
    }
    else {
        // No paper detected - show manual log option
        titleElement.textContent = 'No paper detected';
        authorsElement.textContent = '';
        statusElement.textContent = 'Current page not recognized as a paper';
        // Disable rating buttons
        const thumbsUpButton = document.getElementById('thumbsUp');
        const thumbsDownButton = document.getElementById('thumbsDown');
        if (thumbsUpButton && thumbsDownButton) {
            thumbsUpButton.disabled = true;
            thumbsDownButton.disabled = true;
        }
        // Show manual log section
        manualLogSection.style.display = 'block';
    }
}
// Function to log current page as a paper (using content script extraction)
async function logCurrentPage() {
    console.log("attempting to log paper");
    // Get the active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0] || !tabs[0].id) {
        const statusElement = document.getElementById('status');
        if (statusElement) {
            statusElement.textContent = 'Error: Could not access current tab';
        }
        return;
    }
    // Show loading state
    const statusElement = document.getElementById('status');
    if (statusElement) {
        statusElement.textContent = 'Extracting paper metadata...';
    }
    // Send message to content script requesting extraction
    chrome.tabs.sendMessage(tabs[0].id, {
        type: 'extractPaperMetadata'
    }, (response) => {
        if (chrome.runtime.lastError) {
            // Handle error
            if (statusElement) {
                statusElement.textContent = 'Error: ' + chrome.runtime.lastError.message;
            }
            return;
        }
        if (!response || !response.success || !response.metadata) {
            // Handle extraction failure
            if (statusElement) {
                statusElement.textContent = 'Error: ' + (response?.error || 'Failed to extract metadata');
            }
            return;
        }
        // Success - update UI
        updateUI(response.metadata);
        if (statusElement) {
            statusElement.textContent = 'Paper tracked successfully!';
        }
        // The content script has already:
        // 1. Sent metadata to background script
        // 2. Started a session if the tab is visible
        // Hide manual log section
        const manualLogSection = document.getElementById('manualLogSection');
        if (manualLogSection) {
            manualLogSection.style.display = 'none';
        }
        // Enable rating buttons
        const thumbsUpButton = document.getElementById('thumbsUp');
        const thumbsDownButton = document.getElementById('thumbsDown');
        if (thumbsUpButton && thumbsDownButton) {
            thumbsUpButton.disabled = false;
            thumbsDownButton.disabled = false;
        }
    });
}
// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Popup opened');
    // Get paper from the session tracker
    let paperData = null;
    let retries = 3;
    while (retries > 0 && !paperData) {
        paperData = await getCurrentPaper();
        if (!paperData) {
            await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before retry
            retries--;
        }
    }
    updateUI(paperData);
    // Set up rating handlers
    const thumbsUpButton = document.getElementById('thumbsUp');
    if (thumbsUpButton) {
        thumbsUpButton.addEventListener('click', () => {
            chrome.runtime.sendMessage({
                type: 'updateRating',
                rating: 'thumbsup'
            }, (response) => {
                const statusElement = document.getElementById('status');
                const thumbsUpButton = document.getElementById('thumbsUp');
                const thumbsDownButton = document.getElementById('thumbsDown');
                if (!statusElement || !thumbsUpButton || !thumbsDownButton)
                    return;
                if (response && response.success) {
                    statusElement.textContent = 'Rating updated to: thumbs up';
                    thumbsUpButton.classList.add('active');
                    thumbsDownButton.classList.remove('active');
                    setTimeout(() => window.close(), 1500);
                }
                else {
                    statusElement.textContent = 'Error: ' + (response?.error || 'Unknown error');
                }
            });
        });
    }
    const thumbsDownButton = document.getElementById('thumbsDown');
    if (thumbsDownButton) {
        thumbsDownButton.addEventListener('click', () => {
            chrome.runtime.sendMessage({
                type: 'updateRating',
                rating: 'thumbsdown'
            }, (response) => {
                const statusElement = document.getElementById('status');
                const thumbsUpButton = document.getElementById('thumbsUp');
                const thumbsDownButton = document.getElementById('thumbsDown');
                if (!statusElement || !thumbsUpButton || !thumbsDownButton)
                    return;
                if (response && response.success) {
                    statusElement.textContent = 'Rating updated to: thumbs down';
                    thumbsDownButton.classList.add('active');
                    thumbsUpButton.classList.remove('active');
                    setTimeout(() => window.close(), 1500);
                }
                else {
                    statusElement.textContent = 'Error: ' + (response?.error || 'Unknown error');
                }
            });
        });
    }
    // Set up one-click logging button
    const logPageButton = document.getElementById('logPageButton');
    if (logPageButton) {
        console.log("Attaching logPageButton event listener...");
        logPageButton.addEventListener('click', () => {
            console.log("logPageButton clicked...");
            logCurrentPage();
        });
    }
});
//# sourceMappingURL=popup.bundle.js.map
