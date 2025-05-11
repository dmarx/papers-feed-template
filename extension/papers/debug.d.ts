// extension/papers/debug.d.ts
import { GitHubStoreClient } from 'gh-store-client';
import { PaperManager } from './manager';

declare global {
    const __DEBUG__: {
        paperManager: PaperManager | null;
        getGithubClient: () => GitHubStoreClient | undefined;
        getCurrentPaper: () => any;
        getCurrentSession: () => any;
        getConfig: () => any;
    }
}
