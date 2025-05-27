// extension/source-integration/pnas/index.ts
import { BaseSourceIntegration } from '../base-source';

export class PnasIntegration extends BaseSourceIntegration {
  readonly id = 'pnas';
  readonly name = 'PNAS'; 

  readonly urlPatterns = [
    /pnas\.org\/doi\/10\.1073\/pnas\.([0-9]+)/
  ];

  // upstream BaseSourceIntegration.extractPaperId should default to this behavior when able
  extractPaperId(url: string): string | null {
    const match = url.match(this.urlPatterns[0]);
    return match ? match[1] : null;
  }
}

export const pnasIntegration = new PnasIntegration();
