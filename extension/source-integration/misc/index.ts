// extension/source-integration/misc/index.ts
/*
 * Catch-all for registering with URL pattern only
 */
import { BaseSourceIntegration } from '../base-source';

export class MiscIntegration extends BaseSourceIntegration {
  readonly id = 'url-misc';
  readonly name = 'misc tracked url';

  readonly urlPatterns = []; // set this empty to disable attaching the content injection icon thing
    
  // add URLs here to track
  readonly contentScriptMatches = [
    "sciencedirect.com/science/article/",
    "philpapers.org/rec/",
    "proceedings.neurips.cc/paper_files/paper/",
    "journals.sagepub.com/doi/",
    "link.springer.com/article/",
    ".science.org/doi/",
    "journals.aps.org/prx/abstract/",
    "onlinelibrary.wiley.com/doi/",
    "cell.com/trends/cognitive-sciences/fulltext/",
    "researchgate.net/publication/",
    "psycnet.apa.org/record/",
    "biorxiv.org/content/",
    "osf.io/preprints/",
    "frontiersin.org/journals/",
    "jstor.org/",
    "proceedings.mlr.press/",
    "journals.plos.org/plosone/article",
    "ieeexplore.ieee.org/document/",
    "royalsocietypublishing.org/doi/",
    "papers.nips.cc/paper_files/paper/",
    "philarchive.org/archive/",
    "tandfonline.com/doi/",
    "iopscience.iop.org/article/",
    "academic.oup.com/brain/article/",
    "elifesciences.org/articles/",
    "escholarship.org/content/",
    "pmc.ncbi.nlm.nih.gov/articles/",
    "pubmed.ncbi.nlm.nih.gov/",
    "openaccess.thecvf.com/content/",
    "zenodo.org/records/",
    "journals.asm.org/doi/full/",
    "physoc.onlinelibrary.wiley.com/doi/full/",
    "storage.courtlistener.com/recap/",
    "bmj.com/content/",
    "ntsb.gov/investigations/pages",
    "ntsb.gov/investigations/AccidentReports",
    "aclanthology.org/",
    "journals.ametsoc.org/view/journals/",
    
    "substack.com/p/",
    "citeseerx.",
    "/doi/",
    "/pdf/",

  ];

  canHandleUrl(url: string): boolean {
    return this.contentScriptMatches.some(pattern => url.includes(pattern));
  }
}

export const miscIntegration = new MiscIntegration();
