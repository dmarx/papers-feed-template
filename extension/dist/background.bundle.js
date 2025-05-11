var f=(i=>(i.GH_STORE="gh-store",i.STORED_OBJECT="stored-object",i.DEPRECATED="deprecated-object",i.UID_PREFIX="UID:",i.ALIAS_TO_PREFIX="ALIAS-TO:",i))(f||{});var m=class{constructor(e={}){this.cache=new Map,this.maxSize=e.maxSize??1e3,this.ttl=e.ttl??1e3*60*60,this.accessOrder=[];}get(e){let t=this.cache.get(e);if(t){if(Date.now()-t.lastAccessed>this.ttl){this.cache.delete(e),this.removeFromAccessOrder(e);return}return t.lastAccessed=Date.now(),this.updateAccessOrder(e),t.issueNumber}}set(e,t,r){if(this.cache.size>=this.maxSize&&!this.cache.has(e)){let s=this.accessOrder[this.accessOrder.length-1];s&&(this.cache.delete(s),this.removeFromAccessOrder(s));}this.cache.set(e,{issueNumber:t,lastAccessed:Date.now(),createdAt:r.createdAt,updatedAt:r.updatedAt}),this.updateAccessOrder(e);}remove(e){this.cache.delete(e),this.removeFromAccessOrder(e);}clear(){this.cache.clear(),this.accessOrder=[];}getStats(){return {size:this.cache.size,maxSize:this.maxSize,ttl:this.ttl}}shouldRefresh(e,t){let r=this.cache.get(e);return r?t>r.updatedAt:!0}updateAccessOrder(e){this.removeFromAccessOrder(e),this.accessOrder.unshift(e);}removeFromAccessOrder(e){let t=this.accessOrder.indexOf(e);t>-1&&this.accessOrder.splice(t,1);}};var y="0.11.1";var d=class{constructor(e,t,r={}){if(this.token=e,this.repo=t,!this.repo)throw new Error("Repository is required");this.config={baseLabel:r.baseLabel??"stored-object",uidPrefix:r.uidPrefix??"UID:",reactions:{processed:r.reactions?.processed??"+1",initialState:r.reactions?.initialState??"rocket"}},this.cache=new m(r.cache);}isPublic(){return this.token===null}async fetchFromGitHub(e,t={}){let r=new URL(`https://api.github.com/repos/${this.repo}${e}`);t.params&&(Object.entries(t.params).forEach(([a,n])=>{r.searchParams.append(a,n);}),delete t.params);let s={Accept:"application/vnd.github.v3+json"};if(t.headers){let a=t.headers;Object.keys(a).forEach(n=>{s[n]=a[n];});}this.token&&(s.Authorization=`token ${this.token}`);let i=await fetch(r.toString(),{...t,headers:s});if(!i.ok)throw new Error(`GitHub API error: ${i.status}`);return i.json()}createCommentPayload(e,t,r){let s={_data:e,_meta:{client_version:y,timestamp:new Date().toISOString(),update_mode:"append",issue_number:t}};return r&&(s.type=r),s}async getObject(e){let t=this.cache.get(e),r;if(t)try{r=await this.fetchFromGitHub(`/issues/${t}`),this._verifyIssueLabels(r,e)||(this.cache.remove(e),r=void 0);}catch{this.cache.remove(e);}if(!r){let c=await this.fetchFromGitHub("/issues",{method:"GET",params:{labels:["gh-store",this.config.baseLabel,`${this.config.uidPrefix}${e}`].join(","),state:"closed"}});if(!c||c.length===0)throw new Error(`No object found with ID: ${e}`);r=c[0];}if(!r?.body)throw new Error(`Invalid issue data received for ID: ${e}`);let s=JSON.parse(r.body),i=new Date(r.created_at),a=new Date(r.updated_at);return this.cache.set(e,r.number,{createdAt:i,updatedAt:a}),{meta:{objectId:e,label:`${this.config.uidPrefix}${e}`,issueNumber:r.number,createdAt:i,updatedAt:a,version:await this._getVersion(r.number)},data:s}}async createObject(e,t,r=[]){if(!this.token)throw new Error("Authentication required for creating objects");let s=`${this.config.uidPrefix}${e}`,i=["gh-store",this.config.baseLabel,s,...r],a=await this.fetchFromGitHub("/issues",{method:"POST",body:JSON.stringify({title:`Stored Object: ${e}`,body:JSON.stringify(t,null,2),labels:i})});this.cache.set(e,a.number,{createdAt:new Date(a.created_at),updatedAt:new Date(a.updated_at)});let n=this.createCommentPayload(t,a.number,"initial_state"),c=await this.fetchFromGitHub(`/issues/${a.number}/comments`,{method:"POST",body:JSON.stringify({body:JSON.stringify(n,null,2)})});return await this.fetchFromGitHub(`/issues/comments/${c.id}/reactions`,{method:"POST",body:JSON.stringify({content:this.config.reactions.processed})}),await this.fetchFromGitHub(`/issues/comments/${c.id}/reactions`,{method:"POST",body:JSON.stringify({content:this.config.reactions.initialState})}),await this.fetchFromGitHub(`/issues/${a.number}`,{method:"PATCH",body:JSON.stringify({state:"closed"})}),{meta:{objectId:e,label:s,issueNumber:a.number,createdAt:new Date(a.created_at),updatedAt:new Date(a.updated_at),version:1},data:t}}_verifyIssueLabels(e,t){let r=new Set([this.config.baseLabel,`${this.config.uidPrefix}${t}`]);return e.labels.some(s=>r.has(s.name))}async updateObject(e,t){if(!this.token)throw new Error("Authentication required for updating objects");let r=await this.fetchFromGitHub("/issues",{method:"GET",params:{labels:[this.config.baseLabel,`${this.config.uidPrefix}${e}`].join(","),state:"all"}});if(!r||r.length===0)throw new Error(`No object found with ID: ${e}`);let s=r[0],i=this.createCommentPayload(t,s.number);return await this.fetchFromGitHub(`/issues/${s.number}/comments`,{method:"POST",body:JSON.stringify({body:JSON.stringify(i,null,2)})}),await this.fetchFromGitHub(`/issues/${s.number}`,{method:"PATCH",body:JSON.stringify({state:"open"})}),this.getObject(e)}async listAll(){let e=await this.fetchFromGitHub("/issues",{method:"GET",params:{labels:this.config.baseLabel,state:"closed"}}),t={};for(let r of e)if(!r.labels.some(s=>s.name==="archived"))try{let s=this._getObjectIdFromLabels(r),i=JSON.parse(r.body),a={objectId:s,label:s,issueNumber:r.number,createdAt:new Date(r.created_at),updatedAt:new Date(r.updated_at),version:await this._getVersion(r.number)};t[s]={meta:a,data:i};}catch{continue}return t}async listUpdatedSince(e){let t=await this.fetchFromGitHub("/issues",{method:"GET",params:{labels:this.config.baseLabel,state:"closed",since:e.toISOString()}}),r={};for(let s of t)if(!s.labels.some(i=>i.name==="archived"))try{let i=this._getObjectIdFromLabels(s),a=JSON.parse(s.body),n=new Date(s.updated_at);if(n>e){let c={objectId:i,label:i,issueNumber:s.number,createdAt:new Date(s.created_at),updatedAt:n,version:await this._getVersion(s.number)};r[i]={meta:c,data:a};}}catch{continue}return r}async getObjectHistory(e){let t=await this.fetchFromGitHub("/issues",{method:"GET",params:{labels:[this.config.baseLabel,`${this.config.uidPrefix}${e}`].join(","),state:"all"}});if(!t||t.length===0)throw new Error(`No object found with ID: ${e}`);let r=t[0],s=await this.fetchFromGitHub(`/issues/${r.number}/comments`),i=[];for(let a of s)try{let n=JSON.parse(a.body),c="update",u,p={client_version:"legacy",timestamp:a.created_at,update_mode:"append"};typeof n=="object"?"_data"in n?(c=n.type||"update",u=n._data,p=n._meta||p):"type"in n&&n.type==="initial_state"?(c="initial_state",u=n.data):u=n:u=n,i.push({timestamp:a.created_at,type:c,data:u,commentId:a.id});}catch{continue}return i}async _getVersion(e){return (await this.fetchFromGitHub(`/issues/${e}/comments`)).length+1}_getObjectIdFromLabels(e){for(let t of e.labels)if(t.name!==this.config.baseLabel&&t.name.startsWith(this.config.uidPrefix))return t.name.slice(this.config.uidPrefix.length);throw new Error(`No UID label found with prefix ${this.config.uidPrefix}`)}};var E={level:"info",silent:!1},A={error:3,warn:2,info:1,debug:0},b=class{constructor(e,t={}){this.entries=[];this.moduleName=e,this.config={...E,...t};}debug(e,t){this.log("debug",e,t);}info(e,t){this.log("info",e,t);}warn(e,t){this.log("warn",e,t);}error(e,t){this.log("error",e,t);}log(e,t,r){if(A[e]<A[this.config.level])return;let s={timestamp:new Date().toISOString(),level:e,module:this.moduleName,message:t,metadata:r};this.entries.push(s);}getEntries(){return [...this.entries]}clearEntries(){this.entries=[];}configure(e){this.config={...this.config,...e};}getConfig(){return {...this.config}}};new b("CanonicalStore");

// extension/papers/types.ts
// Updated for heartbeat-based session tracking
/**
 * Type guard for interaction log
 */
function isInteractionLog(data) {
    const log = data;
    return (typeof log === 'object' &&
        log !== null &&
        typeof log.sourceId === 'string' &&
        typeof log.paperId === 'string' &&
        Array.isArray(log.interactions));
}

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

const logger$8 = loguru.getLogger('paper-manager');
class PaperManager {
    constructor(client, sourceManager) {
        this.client = client;
        this.sourceManager = sourceManager;
        logger$8.debug('Paper manager initialized');
    }
    /**
     * Get paper by source and ID
     */
    async getPaper(sourceId, paperId) {
        const objectId = this.sourceManager.formatObjectId('paper', sourceId, paperId);
        try {
            const obj = await this.client.getObject(objectId);
            return obj.data;
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('No object found')) {
                return null;
            }
            throw error;
        }
    }
    /**
     * Get or create paper metadata
     */
    async getOrCreatePaper(paperData) {
        const { sourceId, paperId } = paperData;
        const objectId = this.sourceManager.formatObjectId('paper', sourceId, paperId);
        const paperIdentifier = this.sourceManager.formatPaperId(sourceId, paperId);
        try {
            const obj = await this.client.getObject(objectId);
            const data = obj.data;
            logger$8.debug(`Retrieved existing paper: ${paperIdentifier}`);
            return data;
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('No object found')) {
                // Create new paper
                const defaultPaperData = {
                    ...paperData,
                    timestamp: new Date().toISOString(),
                    rating: paperData.rating || 'novote'
                };
                const newobj = await this.client.createObject(objectId, defaultPaperData);
                logger$8.debug(`Created new paper: ${paperIdentifier}`);
                // reopen to trigger metadata hydration
                await this.client.fetchFromGitHub(`/issues/${newobj.meta.issueNumber}`, {
                    method: "PATCH",
                    body: JSON.stringify({ state: "open" })
                });
                return defaultPaperData;
            }
            throw error;
        }
    }
    /**
     * Get or create interaction log for a paper
     */
    async getOrCreateInteractionLog(sourceId, paperId) {
        const objectId = this.sourceManager.formatObjectId('interactions', sourceId, paperId);
        const paperIdentifier = this.sourceManager.formatPaperId(sourceId, paperId);
        try {
            const obj = await this.client.getObject(objectId);
            const data = obj.data;
            if (isInteractionLog(data)) {
                return data;
            }
            throw new Error('Invalid interaction log format');
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('No object found')) {
                const newLog = {
                    sourceId,
                    paperId,
                    interactions: []
                };
                await this.client.createObject(objectId, newLog);
                logger$8.debug(`Created new interaction log: ${paperIdentifier}`);
                return newLog;
            }
            throw error;
        }
    }
    /**
     * Get GitHub client instance
     */
    getClient() {
        return this.client;
    }
    /**
     * Log a reading session
     */
    async logReadingSession(sourceId, paperId, session, paperData) {
        // Ensure paper exists
        if (paperData) {
            await this.getOrCreatePaper({
                sourceId,
                paperId,
                url: paperData.url || this.sourceManager.formatPaperId(sourceId, paperId),
                title: paperData.title || paperId,
                authors: paperData.authors || '',
                abstract: paperData.abstract || '',
                timestamp: new Date().toISOString(),
                rating: 'novote',
                publishedDate: paperData.publishedDate || '',
                tags: paperData.tags || []
            });
        }
        // Log the session as an interaction
        await this.addInteraction(sourceId, paperId, {
            type: 'reading_session',
            timestamp: new Date().toISOString(),
            data: session
        });
        const paperIdentifier = this.sourceManager.formatPaperId(sourceId, paperId);
        logger$8.info(`Logged reading session for ${paperIdentifier}`, { duration: session.duration_seconds });
    }
    /**
     * Log an annotation
     */
    async logAnnotation(sourceId, paperId, key, value, paperData) {
        // Ensure paper exists
        if (paperData) {
            await this.getOrCreatePaper({
                sourceId,
                paperId,
                url: paperData.url || this.sourceManager.formatPaperId(sourceId, paperId),
                title: paperData.title || paperId,
                authors: paperData.authors || '',
                abstract: paperData.abstract || '',
                timestamp: new Date().toISOString(),
                rating: 'novote',
                publishedDate: paperData.publishedDate || '',
                tags: paperData.tags || []
            });
        }
        // Log the annotation as an interaction
        await this.addInteraction(sourceId, paperId, {
            type: 'annotation',
            timestamp: new Date().toISOString(),
            data: { key, value }
        });
        const paperIdentifier = this.sourceManager.formatPaperId(sourceId, paperId);
        logger$8.info(`Logged annotation for ${paperIdentifier}`, { key });
    }
    /**
     * Update paper rating
     */
    async updateRating(sourceId, paperId, rating, paperData) {
        // Ensure paper exists and get current data
        const paper = await this.getOrCreatePaper({
            sourceId,
            paperId,
            url: paperData?.url || this.sourceManager.formatPaperId(sourceId, paperId),
            title: paperData?.title || paperId,
            authors: paperData?.authors || '',
            abstract: paperData?.abstract || '',
            timestamp: new Date().toISOString(),
            rating: 'novote',
            publishedDate: paperData?.publishedDate || '',
            tags: paperData?.tags || []
        });
        const objectId = this.sourceManager.formatObjectId('paper', sourceId, paperId);
        // Update paper metadata with new rating
        await this.client.updateObject(objectId, {
            ...paper,
            rating
        });
        // Log rating change as an interaction
        await this.addInteraction(sourceId, paperId, {
            type: 'rating',
            timestamp: new Date().toISOString(),
            data: { rating }
        });
        const paperIdentifier = this.sourceManager.formatPaperId(sourceId, paperId);
        logger$8.info(`Updated rating for ${paperIdentifier} to ${rating}`);
    }
    /**
     * Add interaction to log
     */
    async addInteraction(sourceId, paperId, interaction) {
        const log = await this.getOrCreateInteractionLog(sourceId, paperId);
        log.interactions.push(interaction);
        const objectId = this.sourceManager.formatObjectId('interactions', sourceId, paperId);
        await this.client.updateObject(objectId, log);
    }
}

// session-service.ts
const logger$7 = loguru.getLogger('session-service');
/**
 * Session tracking service for paper reading sessions
 *
 * Manages session state, heartbeats, and persistence
 * Designed for use in the background script (Service Worker)
 */
class SessionService {
    /**
     * Create a new session service
     */
    constructor(paperManager) {
        this.paperManager = paperManager;
        this.activeSession = null;
        this.timeoutId = null;
        this.paperMetadata = new Map();
        // Configuration
        this.HEARTBEAT_TIMEOUT = 15000; // 15 seconds
        logger$7.debug('Session service initialized');
    }
    /**
     * Start a new session for a paper
     */
    startSession(sourceId, paperId, metadata) {
        // End any existing session
        this.endSession();
        // Create new session
        this.activeSession = {
            sourceId,
            paperId,
            startTime: new Date(),
            heartbeatCount: 0,
            lastHeartbeatTime: new Date()
        };
        // Store metadata if provided
        if (metadata) {
            const key = `${sourceId}:${paperId}`;
            this.paperMetadata.set(key, metadata);
            logger$7.debug(`Stored metadata for ${key}`);
        }
        // Start timeout check
        this.scheduleTimeoutCheck();
        logger$7.info(`Started session for ${sourceId}:${paperId}`);
    }
    /**
     * Record a heartbeat for the current session
     */
    recordHeartbeat() {
        if (!this.activeSession) {
            return false;
        }
        this.activeSession.heartbeatCount++;
        this.activeSession.lastHeartbeatTime = new Date();
        // Reschedule timeout
        this.scheduleTimeoutCheck();
        if (this.activeSession.heartbeatCount % 12 === 0) { // Log every minute (12 x 5sec heartbeats)
            logger$7.debug(`Session received ${this.activeSession.heartbeatCount} heartbeats`);
        }
        return true;
    }
    /**
     * Schedule a check for heartbeat timeout
     */
    scheduleTimeoutCheck() {
        // Clear existing timeout
        if (this.timeoutId !== null) {
            clearTimeout(this.timeoutId);
        }
        // Set new timeout
        this.timeoutId = self.setTimeout(() => {
            this.checkTimeout();
        }, this.HEARTBEAT_TIMEOUT);
    }
    /**
     * Check if the session has timed out due to missing heartbeats
     */
    checkTimeout() {
        if (!this.activeSession)
            return;
        const now = Date.now();
        const lastTime = this.activeSession.lastHeartbeatTime.getTime();
        if ((now - lastTime) > this.HEARTBEAT_TIMEOUT) {
            logger$7.info('Session timeout detected');
            this.endSession();
        }
        else {
            this.scheduleTimeoutCheck();
        }
    }
    /**
     * End the current session and get the data
     */
    endSession() {
        if (!this.activeSession)
            return null;
        // Clear timeout
        if (this.timeoutId !== null) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        const { sourceId, paperId, startTime, heartbeatCount } = this.activeSession;
        const endTime = new Date();
        // Calculate duration (5 seconds per heartbeat)
        const duration = heartbeatCount * 5;
        // Calculate total elapsed time
        const totalElapsed = endTime.getTime() - startTime.getTime();
        const totalElapsedSeconds = Math.round(totalElapsed / 1000);
        // Set idle seconds to the difference (for backward compatibility)
        const idleSeconds = Math.max(0, totalElapsedSeconds - duration);
        // Create session data
        const sessionData = {
            session_id: `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            source_id: sourceId,
            paper_id: paperId,
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            heartbeat_count: heartbeatCount,
            duration_seconds: duration,
            // Legacy fields
            idle_seconds: idleSeconds,
            total_elapsed_seconds: totalElapsedSeconds
        };
        // Store session if it was meaningful and we have a paper manager
        if (this.paperManager && heartbeatCount > 0) {
            const metadata = this.getPaperMetadata(sourceId, paperId);
            this.paperManager.logReadingSession(sourceId, paperId, sessionData, metadata)
                .catch(err => logger$7.error('Failed to store session', err));
        }
        logger$7.info(`Ended session for ${sourceId}:${paperId}`, {
            duration,
            heartbeats: heartbeatCount
        });
        // Clear active session
        this.activeSession = null;
        return sessionData;
    }
    /**
     * Check if a session is currently active
     */
    hasActiveSession() {
        return this.activeSession !== null;
    }
    /**
     * Get information about the current session
     */
    getCurrentSession() {
        if (!this.activeSession)
            return null;
        return {
            sourceId: this.activeSession.sourceId,
            paperId: this.activeSession.paperId
        };
    }
    /**
     * Get paper metadata for the current or specified session
     */
    getPaperMetadata(sourceId, paperId) {
        if (!sourceId || !paperId) {
            if (!this.activeSession)
                return undefined;
            sourceId = this.activeSession.sourceId;
            paperId = this.activeSession.paperId;
        }
        return this.paperMetadata.get(`${sourceId}:${paperId}`);
    }
    /**
     * Store paper metadata
     */
    storePaperMetadata(metadata) {
        const key = `${metadata.sourceId}:${metadata.paperId}`;
        this.paperMetadata.set(key, metadata);
    }
    /**
     * Get time since last heartbeat in milliseconds
     */
    getTimeSinceLastHeartbeat() {
        if (!this.activeSession) {
            return null;
        }
        return Date.now() - this.activeSession.lastHeartbeatTime.getTime();
    }
    /**
     * Get session statistics for debugging
     */
    getSessionStats() {
        if (!this.activeSession) {
            return { active: false };
        }
        return {
            active: true,
            sourceId: this.activeSession.sourceId,
            paperId: this.activeSession.paperId,
            startTime: this.activeSession.startTime.toISOString(),
            heartbeatCount: this.activeSession.heartbeatCount,
            lastHeartbeatTime: this.activeSession.lastHeartbeatTime.toISOString(),
            elapsedTime: Math.round((Date.now() - this.activeSession.startTime.getTime()) / 1000)
        };
    }
}

// extension/utils/popup-manager.ts
const logger$6 = loguru.getLogger('popup-manager');
/**
 * Manages all popup-related functionality
 */
class PopupManager {
    /**
     * Create a new popup manager
     */
    constructor(sourceManagerProvider, paperManagerProvider) {
        this.sourceManagerProvider = sourceManagerProvider;
        this.paperManagerProvider = paperManagerProvider;
        this.setupMessageListeners();
        logger$6.debug('Popup manager initialized');
    }
    /**
     * Set up message listeners for popup-related messages
     */
    setupMessageListeners() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            // Handle popup actions (ratings, notes, etc.)
            if (message.type === 'popupAction') {
                this.handlePopupAction(message.sourceId, message.paperId, message.action, message.data).then(() => {
                    sendResponse({ success: true });
                }).catch(error => {
                    logger$6.error('Error handling popup action', error);
                    sendResponse({
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                });
                return true; // Will respond asynchronously
            }
            // Handle request to show annotation popup
            if (message.type === 'showAnnotationPopup' && sender.tab?.id) {
                this.handleShowAnnotationPopup(sender.tab.id, message.sourceId, message.paperId, message.position).then(() => {
                    sendResponse({ success: true });
                }).catch(error => {
                    logger$6.error('Error showing popup', error);
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
    async handleShowAnnotationPopup(tabId, sourceId, paperId, position) {
        logger$6.debug(`Showing annotation popup for ${sourceId}:${paperId}`);
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
            const message = {
                type: 'showPopup',
                sourceId,
                paperId,
                html,
                handlers,
                position
            };
            await chrome.tabs.sendMessage(tabId, message);
            logger$6.debug(`Sent popup to content script for ${sourceId}:${paperId}`);
        }
        catch (error) {
            logger$6.error(`Error showing popup for ${sourceId}:${paperId}`, error);
            throw error;
        }
    }
    /**
     * Handle popup actions (ratings, notes, etc.)
     */
    async handlePopupAction(sourceId, paperId, action, data) {
        const paperManager = this.paperManagerProvider();
        if (!paperManager) {
            throw new Error('Paper manager not initialized');
        }
        logger$6.debug(`Handling popup action: ${action}`, { sourceId, paperId });
        try {
            if (action === 'rate') {
                await paperManager.updateRating(sourceId, paperId, data.value);
                logger$6.info(`Updated rating for ${sourceId}:${paperId} to ${data.value}`);
            }
            else if (action === 'saveNotes') {
                if (data.value) {
                    await paperManager.logAnnotation(sourceId, paperId, 'notes', data.value);
                    logger$6.info(`Saved notes for ${sourceId}:${paperId}`);
                }
            }
        }
        catch (error) {
            logger$6.error(`Error handling action ${action} for ${sourceId}:${paperId}`, error);
            throw error;
        }
    }
    /**
     * Create HTML for paper popup
     */
    createPopupHtml(paper) {
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
    getStandardPopupHandlers() {
        return [
            { selector: '#btn-thumbsup', event: 'click', action: 'rate' },
            { selector: '#btn-thumbsdown', event: 'click', action: 'rate' },
            { selector: '#btn-save', event: 'click', action: 'saveNotes' }
        ];
    }
}

// extension/source-integration/source-manager.ts
const logger$5 = loguru.getLogger('source-manager');
/**
 * Manages source integrations
 */
class SourceIntegrationManager {
    constructor() {
        this.sources = new Map();
        logger$5.info('Source integration manager initialized');
    }
    /**
     * Register a source integration
     */
    registerSource(source) {
        if (this.sources.has(source.id)) {
            logger$5.warning(`Source with ID '${source.id}' already registered, overwriting`);
        }
        this.sources.set(source.id, source);
        logger$5.info(`Registered source: ${source.name} (${source.id})`);
    }
    /**
     * Get all registered sources
     */
    getAllSources() {
        return Array.from(this.sources.values());
    }
    /**
     * Get source that can handle a URL
     */
    getSourceForUrl(url) {
        for (const source of this.sources.values()) {
            if (source.canHandleUrl(url)) {
                logger$5.debug(`Found source for URL '${url}': ${source.id}`);
                return source;
            }
        }
        logger$5.debug(`No source found for URL: ${url}`);
        return null;
    }
    /**
     * Get source by ID
     */
    getSourceById(sourceId) {
        const source = this.sources.get(sourceId);
        return source || null;
    }
    /**
     * Extract paper ID from URL using appropriate source
     */
    extractPaperId(url) {
        for (const source of this.sources.values()) {
            if (source.canHandleUrl(url)) {
                const paperId = source.extractPaperId(url);
                if (paperId) {
                    logger$5.debug(`Extracted paper ID '${paperId}' from URL using ${source.id}`);
                    return { sourceId: source.id, paperId };
                }
            }
        }
        logger$5.debug(`Could not extract paper ID from URL: ${url}`);
        return null;
    }
    /**
     * Format a paper identifier using the appropriate source
     */
    formatPaperId(sourceId, paperId) {
        const source = this.sources.get(sourceId);
        if (source) {
            return source.formatPaperId(paperId);
        }
        // Fallback if source not found
        logger$5.warning(`Source '${sourceId}' not found, using default format for paper ID`);
        return `${sourceId}.${paperId}`;
    }
    /**
     * Format an object ID using the appropriate source
     */
    formatObjectId(type, sourceId, paperId) {
        const source = this.sources.get(sourceId);
        if (source) {
            return source.formatObjectId(type, paperId);
        }
        // Fallback if source not found
        logger$5.warning(`Source '${sourceId}' not found, using default format for object ID`);
        return `${type}:${sourceId}.${paperId}`;
    }
    /**
     * Get all content script match patterns
     */
    getAllContentScriptMatches() {
        const patterns = [];
        for (const source of this.sources.values()) {
            patterns.push(...source.contentScriptMatches);
        }
        return patterns;
    }
}

// extension/source-integration/metadata-extractor.ts
const logger$4 = loguru.getLogger('metadata-extractor');
// Constants for standard source types
const SOURCE_TYPES = {
    PDF: 'pdf',
    URL: 'url',
};
/**
 * Base class for metadata extraction with customizable extraction methods
 * Each method can be overridden to provide source-specific extraction
 */
class MetadataExtractor {
    /**
     * Create a new metadata extractor for a document
     */
    constructor(document) {
        this.document = document;
        this.url = document.location.href;
        logger$4.debug('Initialized metadata extractor for:', this.url);
    }
    /**
     * Helper method to get content from meta tags
     */
    getMetaContent(selector) {
        const element = this.document.querySelector(selector);
        return element ? element.getAttribute('content') || '' : '';
    }
    /**
     * Extract and return all metadata fields
     */
    extract() {
        logger$4.debug('Extracting metadata from page:', this.url);
        const metadata = {
            title: this.extractTitle(),
            authors: this.extractAuthors(),
            description: this.extractDescription(),
            publishedDate: this.extractPublishedDate(),
            doi: this.extractDoi(),
            journalName: this.extractJournalName(),
            tags: this.extractTags(),
            url: this.url
        };
        logger$4.debug('Metadata extraction complete:', metadata);
        return metadata;
    }
    /**
     * Extract title from document
     * Considers multiple metadata standards with priority order
     */
    extractTitle() {
        // Title extraction - priority order
        return (
        // Dublin Core
        this.getMetaContent('meta[name="DC.Title"]') ||
            // Citation
            this.getMetaContent('meta[name="citation_title"]') ||
            // Open Graph
            this.getMetaContent('meta[property="og:title"]') ||
            // Standard meta
            this.getMetaContent('meta[name="title"]') ||
            // Fallback to document title
            this.document.title);
    }
    /**
     * Extract authors from document
     * Handles multiple author formats and sources
     */
    extractAuthors() {
        // Get all citation authors (some pages have multiple citation_author tags)
        const citationAuthors = [];
        this.document.querySelectorAll('meta[name="citation_author"]').forEach(el => {
            const content = el.getAttribute('content');
            if (content)
                citationAuthors.push(content);
        });
        // Get all DC creators
        const dcCreators = [];
        this.document.querySelectorAll('meta[name="DC.Creator.PersonalName"]').forEach(el => {
            const content = el.getAttribute('content');
            if (content)
                dcCreators.push(content);
        });
        // Individual author elements
        const dcCreator = this.getMetaContent('meta[name="DC.Creator.PersonalName"]');
        const citationAuthor = this.getMetaContent('meta[name="citation_author"]');
        const ogAuthor = this.getMetaContent('meta[property="og:article:author"]') ||
            this.getMetaContent('meta[name="author"]');
        // Set authors with priority
        if (dcCreators.length > 0) {
            return dcCreators.join(', ');
        }
        else if (citationAuthors.length > 0) {
            return citationAuthors.join(', ');
        }
        else if (dcCreator) {
            return dcCreator;
        }
        else if (citationAuthor) {
            return citationAuthor;
        }
        else if (ogAuthor) {
            return ogAuthor;
        }
        return '';
    }
    /**
     * Extract description/abstract from document
     */
    extractDescription() {
        return (this.getMetaContent('meta[name="DC.Description"]') ||
            this.getMetaContent('meta[name="citation_abstract"]') ||
            this.getMetaContent('meta[property="og:description"]') ||
            this.getMetaContent('meta[name="description"]'));
    }
    /**
     * Extract publication date from document
     */
    extractPublishedDate() {
        return (this.getMetaContent('meta[name="DC.Date.issued"]') ||
            this.getMetaContent('meta[name="citation_date"]') ||
            this.getMetaContent('meta[property="article:published_time"]'));
    }
    /**
     * Extract DOI (Digital Object Identifier) from document
     */
    extractDoi() {
        return (this.getMetaContent('meta[name="DC.Identifier.DOI"]') ||
            this.getMetaContent('meta[name="citation_doi"]'));
    }
    /**
     * Extract journal name from document
     */
    extractJournalName() {
        return (this.getMetaContent('meta[name="DC.Source"]') ||
            this.getMetaContent('meta[name="citation_journal_title"]'));
    }
    /**
     * Extract keywords/tags from document
     */
    extractTags() {
        const keywords = this.getMetaContent('meta[name="keywords"]') ||
            this.getMetaContent('meta[name="DC.Subject"]');
        if (keywords) {
            return keywords.split(',').map(tag => tag.trim());
        }
        return [];
    }
    /**
     * Determine if the current URL is a PDF
     */
    isPdf() {
        return isPdfUrl(this.url);
    }
    /**
     * Get the source type (PDF or URL)
     */
    getSourceType() {
        return this.isPdf() ? SOURCE_TYPES.PDF : SOURCE_TYPES.URL;
    }
    /**
     * Generate a paper ID for the current URL
     */
    generatePaperId() {
        return generatePaperIdFromUrl(this.url);
    }
}
/**
 * Create a common metadata extractor for a document
 * Factory function for creating the default extractor
 */
function createMetadataExtractor(document) {
    return new MetadataExtractor(document);
}
/**
 * Generate a paper ID from a URL
 * Creates a consistent hash-based identifier
 */
function generatePaperIdFromUrl(url) {
    // Use a basic hash function to create an ID from the URL
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
        const char = url.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    // Create a positive hexadecimal string
    const positiveHash = Math.abs(hash).toString(16).toUpperCase();
    // Use the first 8 characters as the ID
    return positiveHash.substring(0, 8);
}
/**
 * Determine if a URL is a PDF
 */
function isPdfUrl(url) {
    return url.toLowerCase().endsWith('.pdf');
}

// extension/source-integration/base-source.ts
const logger$3 = loguru.getLogger('base-source');
/**
 * Base class for source integrations
 * Provides default implementations for all methods
 * Specific sources can override as needed
 */
class BaseSourceIntegration {
    constructor() {
        // Default properties - set for generic web pages
        this.id = 'url';
        this.name = 'Web Page';
        this.urlPatterns = [
            /^https?:\/\/(?!.*\.pdf($|\?|#)).*$/i // Match HTTP/HTTPS URLs that aren't PDFs
        ];
        this.contentScriptMatches = [];
    }
    /**
     * Check if this integration can handle the given URL
     * Default implementation checks against urlPatterns
     */
    canHandleUrl(url) {
        return this.urlPatterns.some(pattern => pattern.test(url));
    }
    /**
     * Extract paper ID from URL
     * Default implementation creates a hash from the URL
     */
    extractPaperId(url) {
        return generatePaperIdFromUrl(url);
    }
    /**
     * Create a metadata extractor for the given document
     * Override this method to provide a custom extractor for your source
     */
    createMetadataExtractor(document) {
        return createMetadataExtractor(document);
    }
    /**
     * Extract metadata from a page
     * Default implementation uses common metadata extraction
     */
    async extractMetadata(document, paperId) {
        try {
            logger$3.debug(`Extracting metadata using base extractor for ID: ${paperId}`);
            // Create a metadata extractor for this document
            const extractor = this.createMetadataExtractor(document);
            // Extract metadata
            const extracted = extractor.extract();
            const url = document.location.href;
            // Determine source type (PDF or URL)
            const sourceType = extractor.getSourceType();
            // Create PaperMetadata object
            return {
                sourceId: this.id,
                //paperId: this.formatPaperId(paperId),
                paperId: paperId,
                url: url,
                title: extracted.title || document.title || paperId,
                authors: extracted.authors || '',
                abstract: extracted.description || '',
                timestamp: new Date().toISOString(),
                rating: 'novote',
                publishedDate: extracted.publishedDate || '',
                tags: extracted.tags || [],
                doi: extracted.doi,
                journalName: extracted.journalName,
                sourceType: sourceType // Store the source type for reference
            };
        }
        catch (error) {
            logger$3.error('Error extracting metadata with base extractor', error);
            return null;
        }
    }
    /**
     * Format a paper identifier for this source
     * Default implementation uses the format: sourceId.paperId
     */
    formatPaperId(paperId) {
        return `${this.id}.${paperId}`;
    }
    /**
     * Parse a paper identifier specific to this source
     * Default implementation handles source.paperId format and extracts paperId
     */
    parsePaperId(identifier) {
        const prefix = `${this.id}.`;
        if (identifier.startsWith(prefix)) {
            return identifier.substring(prefix.length);
        }
        // Try legacy format (sourceId:paperId)
        const legacyPrefix = `${this.id}:`;
        if (identifier.startsWith(legacyPrefix)) {
            logger$3.debug(`Parsed legacy format identifier: ${identifier}`);
            return identifier.substring(legacyPrefix.length);
        }
        return null;
    }
    /**
     * Format a storage object ID for this source
     * Default implementation uses the format: type:sourceId.paperId
     */
    formatObjectId(type, paperId) {
        return `${type}:${this.formatPaperId(paperId)}`;
    }
}

// extension/source-integration/arxiv/index.ts
const logger$2 = loguru.getLogger('arxiv-integration');
/**
 * Custom metadata extractor for arXiv pages
 */
class ArxivMetadataExtractor extends MetadataExtractor {
    constructor(document, apiMetadata) {
        super(document);
        this.apiMetadata = apiMetadata;
    }
    /**
     * Override title extraction to use API data if available
     */
    extractTitle() {
        if (this.apiMetadata?.title) {
            return this.apiMetadata.title;
        }
        // arXiv-specific selectors
        //const arxivTitle = this.document.querySelector('.title.mathjax')?.textContent?.trim();
        //return arxivTitle || super.extractTitle();
        return super.extractTitle();
    }
    /**
     * Override authors extraction to use API data if available
     */
    extractAuthors() {
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
    extractDescription() {
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
    extractPublishedDate() {
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
    extractDoi() {
        return this.apiMetadata?.doi || super.extractDoi();
    }
    /**
     * Override journal extraction to use API data if available
     */
    extractJournalName() {
        return this.apiMetadata?.journalName || super.extractJournalName();
    }
    /**
     * Override tags extraction to use API data if available
     */
    extractTags() {
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
class ArXivIntegration extends BaseSourceIntegration {
    constructor() {
        super(...arguments);
        this.id = 'arxiv';
        this.name = 'arXiv.org';
        // URL patterns for papers
        this.urlPatterns = [
            /arxiv\.org\/(abs|pdf|html)\/([0-9.]+)/,
            /arxiv\.org\/\w+\/([0-9.]+)/
        ];
        // Content script matches
        this.contentScriptMatches = [
            "*://*.arxiv.org/*"
        ];
        // ArXiv API endpoint
        this.API_BASE_URL = 'https://export.arxiv.org/api/query';
    }
    /**
     * Extract paper ID from URL
     */
    extractPaperId(url) {
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
    createMetadataExtractor(document) {
        return new ArxivMetadataExtractor(document);
    }
    /**
     * Fetch metadata from ArXiv API
     */
    async fetchFromApi(paperId) {
        try {
            const apiUrl = `${this.API_BASE_URL}?id_list=${paperId}`;
            logger$2.debug(`Fetching from ArXiv API: ${apiUrl}`);
            const response = await fetch(apiUrl);
            if (!response.ok) {
                logger$2.error(`ArXiv API request failed with status: ${response.status}`);
                return null;
            }
            const xmlText = await response.text();
            // Parse XML to JSON
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
            // Convert XML to a more manageable format
            const entry = xmlDoc.querySelector('entry');
            if (!entry) {
                logger$2.warn('No entry found in ArXiv API response');
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
                .filter(Boolean);
            return {
                title,
                authors,
                description: summary,
                publishedDate: published,
                doi,
                journalName: journalRef,
                tags: categories
            };
        }
        catch (error) {
            logger$2.error('Error fetching from ArXiv API', error);
            return null;
        }
    }
    /**
     * Extract metadata from page or fetch from API
     * Override parent method to handle the API fallback
     */
    async extractMetadata(document, paperId) {
        try {
            logger$2.info(`Extracting metadata for arXiv ID: ${paperId}`);
            // Try to extract from page first
            const extractor = this.createMetadataExtractor(document);
            const pageMetadata = extractor.extract();
            // Check if we have the essential fields
            const hasTitle = pageMetadata.title && pageMetadata.title !== document.title;
            const hasAuthors = pageMetadata.authors && pageMetadata.authors.length > 0;
            const hasAbstract = pageMetadata.description && pageMetadata.description.length > 0;
            if (hasTitle && hasAuthors && hasAbstract) {
                logger$2.debug('Successfully extracted complete metadata from page');
                return this.convertToPageMetadata(pageMetadata, paperId, extractor.getSourceType());
            }
            // If page extraction is incomplete, fetch from API
            logger$2.info('Page metadata incomplete, fetching from ArXiv API');
            const apiMetadata = await this.fetchFromApi(paperId);
            if (!apiMetadata) {
                logger$2.warn('Failed to fetch metadata from ArXiv API, using partial page data');
                return this.convertToPageMetadata(pageMetadata, paperId, extractor.getSourceType());
            }
            // Create a new extractor with API data
            const enhancedExtractor = new ArxivMetadataExtractor(document, apiMetadata);
            const mergedMetadata = enhancedExtractor.extract();
            logger$2.debug('Merged metadata from page and API', mergedMetadata);
            return this.convertToPageMetadata(mergedMetadata, paperId, enhancedExtractor.getSourceType());
        }
        catch (error) {
            logger$2.error('Error extracting metadata for arXiv', error);
            return null;
        }
    }
    /**
     * Convert ExtractedMetadata to PaperMetadata
     */
    convertToPageMetadata(extracted, paperId, sourceType) {
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
const arxivIntegration = new ArXivIntegration();

// extension/source-integration/openreview/index.ts
const logger$1 = loguru.getLogger('openreview-integration');
/**
 * Custom metadata extractor for OpenReview pages
 */
class OpenReviewMetadataExtractor extends MetadataExtractor {
    /**
     * Extract metadata from OpenReview pages
     */
    extract() {
        // First try to extract using standard methods
        const baseMetadata = super.extract();
        try {
            // Get title from OpenReview-specific elements
            const title = this.document.querySelector('.citation_title')?.textContent ||
                this.document.querySelector('.forum-title h2')?.textContent;
            // Get authors
            const authorElements = Array.from(this.document.querySelectorAll('.forum-authors a'));
            const authors = authorElements
                .map(el => el.textContent)
                .filter(Boolean)
                .join(', ');
            // Get abstract
            const abstract = this.document.querySelector('meta[name="citation_abstract"]')?.getAttribute('content') ||
                Array.from(this.document.querySelectorAll('.note-content-field'))
                    .find(el => el.textContent?.includes('Abstract'))
                    ?.nextElementSibling?.textContent;
            // Get publication date
            const dateText = this.document.querySelector('.date.item')?.textContent;
            let publishedDate = '';
            if (dateText) {
                const dateMatch = dateText.match(/Published: ([^,]+)/);
                if (dateMatch) {
                    publishedDate = dateMatch[1];
                }
            }
            // Get DOI if available
            const doi = this.document.querySelector('meta[name="citation_doi"]')?.getAttribute('content') || '';
            // Get conference/journal name
            const venueElements = this.document.querySelectorAll('.forum-meta .item');
            let venue = '';
            for (let i = 0; i < venueElements.length; i++) {
                const el = venueElements[i];
                if (el.querySelector('.glyphicon-folder-open')) {
                    venue = el.textContent?.trim() || '';
                    break;
                }
            }
            // Get tags/keywords
            const keywordsElement = Array.from(this.document.querySelectorAll('.note-content-field'))
                .find(el => el.textContent?.includes('Keywords'));
            let tags = [];
            if (keywordsElement) {
                const keywordsValue = keywordsElement.nextElementSibling?.textContent;
                if (keywordsValue) {
                    tags = keywordsValue.split(',').map(tag => tag.trim());
                }
            }
            return {
                title: title || baseMetadata.title,
                authors: authors || baseMetadata.authors,
                description: abstract || baseMetadata.description,
                publishedDate: publishedDate || baseMetadata.publishedDate,
                doi: doi || baseMetadata.doi,
                journalName: venue || baseMetadata.journalName,
                tags: tags.length ? tags : baseMetadata.tags,
                url: this.url
            };
        }
        catch (error) {
            logger$1.error('Error during OpenReview-specific extraction', error);
            return baseMetadata;
        }
    }
}
/**
 * OpenReview integration with custom metadata extraction
 */
class OpenReviewIntegration extends BaseSourceIntegration {
    constructor() {
        super(...arguments);
        this.id = 'openreview';
        this.name = 'OpenReview';
        // URL patterns for papers
        this.urlPatterns = [
            /openreview\.net\/forum\?id=([a-zA-Z0-9]+)/,
            /openreview\.net\/pdf\?id=([a-zA-Z0-9]+)/
        ];
        // Content script matches
        this.contentScriptMatches = [
            "*://*.openreview.net/*"
        ];
    }
    /**
     * Extract paper ID from URL
     */
    extractPaperId(url) {
        for (const pattern of this.urlPatterns) {
            const match = url.match(pattern);
            if (match) {
                return match[1]; // The capture group with the paper ID
            }
        }
        return null;
    }
    /**
     * Create a custom metadata extractor for OpenReview
     */
    createMetadataExtractor(document) {
        return new OpenReviewMetadataExtractor(document);
    }
    /**
     * Extract metadata from page
     * Override parent method to handle OpenReview-specific extraction
     */
    async extractMetadata(document, paperId) {
        logger$1.info(`Extracting metadata for OpenReview ID: ${paperId}`);
        // Extract metadata using our custom extractor
        const metadata = await super.extractMetadata(document, paperId);
        if (metadata) {
            // Add any OpenReview-specific metadata processing here
            logger$1.debug('Extracted metadata from OpenReview page');
            // Check if we're on a PDF page and adjust metadata accordingly
            if (document.location.href.includes('/pdf?id=')) {
                metadata.sourceType = 'pdf';
            }
        }
        return metadata;
    }
}
// Export a singleton instance that can be used by both background and content scripts
const openReviewIntegration = new OpenReviewIntegration();

// extension/source-integration/registry.ts
// Import any other integrations here
/**
 * Registry of all available source integrations
 * This is the SINGLE place where integrations need to be added
 */
const sourceIntegrations = [
    arxivIntegration,
    openReviewIntegration,
    // Add new integrations here
];

// background.ts
const logger = loguru.getLogger('background');
// Global state
let githubToken = '';
let githubRepo = '';
let paperManager = null;
let sessionService = null;
let popupManager = null;
let sourceManager = null;
// Initialize sources
function initializeSources() {
    sourceManager = new SourceIntegrationManager();
    // Register all sources from the central registry
    for (const integration of sourceIntegrations) {
        sourceManager.registerSource(integration);
    }
    logger.info('Source manager initialized with integrations:', sourceIntegrations.map(int => int.id).join(', '));
    return sourceManager;
}
// Initialize everything
async function initialize() {
    try {
        // Initialize sources first
        initializeSources();
        // Load GitHub credentials
        const items = await chrome.storage.sync.get(['githubToken', 'githubRepo']);
        githubToken = items.githubToken || '';
        githubRepo = items.githubRepo || '';
        logger.info('Credentials loaded', { hasToken: !!githubToken, hasRepo: !!githubRepo });
        // Initialize paper manager if we have credentials
        if (githubToken && githubRepo) {
            const githubClient = new d(githubToken, githubRepo);
            // Pass the source manager to the paper manager
            paperManager = new PaperManager(githubClient, sourceManager);
            logger.info('Paper manager initialized');
            // Initialize session service with paper manager
            sessionService = new SessionService(paperManager);
        }
        else {
            // Initialize session service without paper manager
            sessionService = new SessionService(null);
        }
        logger.info('Session service initialized');
        // Initialize popup manager
        popupManager = new PopupManager(() => sourceManager, () => paperManager);
        logger.info('Popup manager initialized');
        // Set up message listeners
        setupMessageListeners();
        // Initialize debug objects
        initializeDebugObjects();
    }
    catch (error) {
        logger.error('Initialization error', error);
    }
}
// Set up message listeners
function setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'contentScriptReady' && sender.tab?.id) {
            logger.debug('Content script ready:', sender.tab.url);
            sendResponse({ success: true });
            return true;
        }
        if (message.type === 'paperMetadata' && message.metadata) {
            // Store metadata received from content script
            handlePaperMetadata(message.metadata);
            sendResponse({ success: true });
            return true;
        }
        if (message.type === 'getCurrentPaper') {
            const session = sessionService?.getCurrentSession();
            const paperMetadata = session
                ? sessionService?.getPaperMetadata(session.sourceId, session.paperId)
                : null;
            logger.debug('Popup requested current paper', paperMetadata);
            sendResponse(paperMetadata);
            return true;
        }
        if (message.type === 'updateRating') {
            logger.debug('Rating update requested:', message.rating);
            handleUpdateRating(message.rating, sendResponse);
            return true; // Will respond asynchronously
        }
        if (message.type === 'startSession') {
            handleStartSession(message.sourceId, message.paperId);
            sendResponse({ success: true });
            return true;
        }
        if (message.type === 'sessionHeartbeat') {
            handleSessionHeartbeat();
            sendResponse({ success: true });
            return true;
        }
        if (message.type === 'endSession') {
            handleEndSession(message.reason || 'user_action');
            sendResponse({ success: true });
            return true;
        }
        // New handler for manual paper logging from popup
        if (message.type === 'manualPaperLog' && message.metadata) {
            handleManualPaperLog(message.metadata)
                .then(() => sendResponse({ success: true }))
                .catch(error => {
                logger.error('Error handling manual paper log', error);
                sendResponse({
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            });
            return true; // Will respond asynchronously
        }
        // Other message handlers are managed by PopupManager
        return false; // Not handled
    });
}
// Handle paper metadata from content script
async function handlePaperMetadata(metadata) {
    logger.info(`Received metadata for ${metadata.sourceId}:${metadata.paperId}`);
    try {
        // Store metadata in session service
        if (sessionService) {
            sessionService.storePaperMetadata(metadata);
        }
        // Store in GitHub if we have a paper manager
        if (paperManager) {
            await paperManager.getOrCreatePaper(metadata);
            logger.debug('Paper metadata stored in GitHub');
        }
    }
    catch (error) {
        logger.error('Error handling paper metadata', error);
    }
}
// Handle rating update
async function handleUpdateRating(rating, sendResponse) {
    if (!paperManager || !sessionService) {
        sendResponse({ success: false, error: 'Services not initialized' });
        return;
    }
    const session = sessionService.getCurrentSession();
    if (!session) {
        sendResponse({ success: false, error: 'No current session' });
        return;
    }
    const metadata = sessionService.getPaperMetadata();
    if (!metadata) {
        sendResponse({ success: false, error: 'No paper metadata available' });
        return;
    }
    try {
        await paperManager.updateRating(session.sourceId, session.paperId, rating, metadata);
        // Update stored metadata with new rating
        metadata.rating = rating;
        sendResponse({ success: true });
    }
    catch (error) {
        logger.error('Error updating rating:', error);
        sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
}
// Handle session start request
function handleStartSession(sourceId, paperId) {
    if (!sessionService) {
        logger.error('Session service not initialized');
        return;
    }
    // Get metadata if available
    const existingMetadata = sessionService.getPaperMetadata(sourceId, paperId);
    // Start the session
    sessionService.startSession(sourceId, paperId, existingMetadata);
    logger.info(`Started session for ${sourceId}:${paperId}`);
}
// Handle session heartbeat
function handleSessionHeartbeat() {
    if (!sessionService) {
        logger.error('Session service not initialized');
        return;
    }
    sessionService.recordHeartbeat();
}
// Handle session end request
function handleEndSession(reason) {
    if (!sessionService) {
        logger.error('Session service not initialized');
        return;
    }
    const session = sessionService.getCurrentSession();
    if (session) {
        logger.info(`Ending session: ${reason}`);
        sessionService.endSession();
    }
}
async function handleManualPaperLog(metadata) {
    logger.info(`Received manual paper log: ${metadata.sourceId}:${metadata.paperId}`);
    try {
        // Store metadata in session service
        if (sessionService) {
            sessionService.storePaperMetadata(metadata);
        }
        // Store in GitHub if we have a paper manager
        if (paperManager) {
            await paperManager.getOrCreatePaper(metadata);
            logger.debug('Manually logged paper stored in GitHub');
        }
    }
    catch (error) {
        logger.error('Error handling manual paper log', error);
        throw error;
    }
}
// Listen for credential changes
chrome.storage.onChanged.addListener(async (changes) => {
    logger.debug('Storage changes detected', Object.keys(changes));
    if (changes.githubToken) {
        githubToken = changes.githubToken.newValue;
    }
    if (changes.githubRepo) {
        githubRepo = changes.githubRepo.newValue;
    }
    // Reinitialize paper manager if credentials changed
    if (changes.githubToken || changes.githubRepo) {
        if (githubToken && githubRepo) {
            const githubClient = new d(githubToken, githubRepo);
            // Pass the source manager to the paper manager
            paperManager = new PaperManager(githubClient, sourceManager);
            logger.info('Paper manager reinitialized');
            // Reinitialize session service with new paper manager
            sessionService = new SessionService(paperManager);
            logger.info('Session service reinitialized');
        }
    }
});
// Initialize debug objects in service worker scope
function initializeDebugObjects() {
    // @ts-ignore
    self.__DEBUG__ = {
        get paperManager() { return paperManager; },
        get sessionService() { return sessionService; },
        get popupManager() { return popupManager; },
        get sourceManager() { return sourceManager; },
        getGithubClient: () => paperManager ? paperManager.getClient() : null,
        getCurrentPaper: () => {
            const session = sessionService?.getCurrentSession();
            return session ? sessionService?.getPaperMetadata(session.sourceId, session.paperId) : null;
        },
        getSessionStats: () => sessionService?.getSessionStats(),
        getSources: () => sourceManager?.getAllSources(),
        forceEndSession: () => sessionService?.endSession()
    };
    logger.info('Debug objects registered');
}
// Initialize extension
initialize();
//# sourceMappingURL=background.bundle.js.map
