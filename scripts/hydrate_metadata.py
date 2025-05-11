# this could probably be rolled into enrichment processing
#!/usr/bin/env python
# fetch_arxiv_metadata.py
"""
Fetches metadata for arXiv papers identified by issue labels and stores it using gh-store.
"""

import json
import sys
import os
import re
from typing import Dict, List, Optional, Any
import fire
from loguru import logger
import arxiv
import requests

from gh_store.core.store import GitHubStore
from gh_store.tools.canonicalize import CanonicalStore
#from gh_store.tools.canonicalize import CanonicalStore as GitHubStore
from gh_store.core.constants import LabelNames
from gh_store.core.types import get_object_id_from_labels, StoredObject
from gh_store.core.exceptions import DuplicateUIDError, ConcurrentUpdateError

def is_metadata_satisfied(data: dict) -> bool:
    return data and data.get('title') and not (data.get('id') in data.get('title'))

def is_valid_arxiv_id(arxiv_id: str) -> bool:
    """Validate arXiv ID format."""
    return bool(re.match(r'\d{4}\.\d{4,5}(v\d+)?|\w+\/\d{7}(v\d+)?', arxiv_id))

def extract_arxiv_id_from_object_id(object_id: str) -> str:
    """Extract the arXiv ID from a paper ID with various prefixing schemes."""
    prefix = 'arxiv'
    
    # Case 1: Format is "prefix:id"
    if object_id.startswith(f"{prefix}:"):
        return object_id[len(prefix)+1:]
    
    # Case 2: Format is "prefix.id"
    if object_id.startswith(f"{prefix}."):
        return object_id[len(prefix)+1:]
    
    # Case 3: Format is "prefix:prefix:id"
    if object_id.startswith(f"{prefix}:{prefix}:"):
        return object_id[len(prefix)*2+2:]
    
    # Case 4: Format is "prefix.prefix.id"
    if object_id.startswith(f"{prefix}.{prefix}."):
        return object_id[len(prefix)*2+2:]
    
    # Case 5: If none of the above, return the original ID
    return object_id

def fetch_arxiv_metadata(arxiv_id: str) -> Dict[str, Any]:
    """Fetch metadata from arXiv API for a given ID using the arxiv client."""
    logger.info(f"Fetching metadata for arXiv ID: {arxiv_id}")
    
    client = arxiv.Client()
    search = arxiv.Search(id_list=[arxiv_id])
    paper = next(client.results(search))
    if not paper:
        raise ValueError(f"No paper found with arXiv ID: {arxiv_id}")
    
    metadata = {
        #'id': paper.entry_id,
        'title': paper.title,
        'authors': [author.name for author in paper.authors],
        'publishedDate': paper.published.isoformat() if paper.published else None,
        #'updated': paper.updated.isoformat() if paper.updated else None,
        'doi': paper.doi,
        'tags': paper.categories,
        'abstract': paper.summary,
        #'links': [{'href': link.href, 'type': link.type} for link in paper.links],
        #'comment': paper.comment,
        #'journal_ref': paper.journal_ref,
        #'primary_category': paper.primary_category,
        #'pdf_url': paper.pdf_url,
    }
    
    logger.info(f"Successfully fetched metadata for arXiv ID: {arxiv_id}")
    logger.info(metadata)
    return metadata
    

def hydrate_issue_metadata(issue: int, token:str, repo:str):
    #store = GitHubStore(token=token, repo=repo, config_path=None)
    store = CanonicalStore(token=token, repo=repo, config_path=None)
    
    obj = store.issue_handler.get_object_by_number(issue)
    object_id = obj.meta.object_id
    #object_id = get_object_id_from_labels(issue)
    if not object_id.startswith("paper:"):
        logger.info("Not a paper object, exiting.")
        sys.exit(0)
    if 'url' in object_id:
        logger.info("Metadata hydration is currently only supported for the arxiv source type.")
        store.process_updates(issue) # ...why is this a separate second step? sheesh, I reaaly did rube goldberg the shit out of this thing
        return
        
    
    paper_id = object_id[len('paper:'):]
    if paper_id.startswith('arxiv'):
        arxiv_id = extract_arxiv_id_from_object_id(paper_id)
    elif is_valid_arxiv_id(paper_id):
        arxiv_id = paper_id
    else:
        raise TypeError(f"Unable to identify arxiv_id from object_id: {object_id}")

    updates = {}
    arxiv_meta = fetch_arxiv_metadata(arxiv_id)
    for k, v_new in arxiv_meta.items():
        #v_old = getattr(obj.data, k)
        v_old = obj.data.get(k)
        if not v_old:
            updates[k] = v_new

    metadata_satisfied = False
    if updates:
        # Issue is open because we are processing it right now, which acts as an implicit lock on updates.
        # so we close it before pushing the new update
        #store.repo.get_issue(issue).edit(state='closed') # ...this is awkward af. in fact, I think I should just eliminate that whole ConcurrentUpdateError
        # finally: what we came here for
        store.update(object_id=object_id, changes=updates)
        store.process_updates(issue) # ...why is this a separate second step? sheesh, I reaaly did rube goldberg the shit out of this thing
        metadata_satisfied = True
    else:
        metadata_satisfied = is_metadata_satisfied(obj.data)

    if metadata_satisfied:
        store.repo.get_issue(issue).remove_from_labels("TODO:hydrate-metadata")    

# TODO: upstream this to gh-store utilities
def get_open_issues(token:str, repo:str, extra_labels: list|None = None):
    store = GitHubStore(token=token, repo=repo, config_path=None)
    #store = CanonicalStore(token=token, repo=repo, config_path=None)
    
    query_labels = [LabelNames.GH_STORE, LabelNames.STORED_OBJECT]
    if extra_labels: # 
        query_labels += extra_labels
    return store.repo.get_issues(
            labels=query_labels,
            state="open"
        )

def hydrate_all_open_issues(token:str, repo:str):
    store = CanonicalStore(token=token, repo=repo, config_path=None)
    for issue in get_open_issues(token=token, repo=repo, extra_labels=["TODO:hydrate-metadata"]):
        try:
            hydrate_issue_metadata(issue=issue.number, token=token, repo=repo)
        except TypeError:
            logger.info("unsupported source for issue %s", issue.number)
        except DuplicateUIDError:
            #logger.info("Issue %s has dupes, skipping for now. Run deduplification." % issue.number)
            logger.info("Issue %s has dupes. Running deduplification." % issue.number)
            #object_id = StoredObject.from_issue(issue).object_id
            object_id = get_object_id_from_labels(issue)
            dedupe_status = store.deduplicate_object(object_id)
            hydrate_issue_metadata(issue=dedupe_status.get('canonical_issue'), token=token, repo=repo)
        except ConcurrentUpdateError:
            logger.info("Issue %s has too many unprocessed concurrent updates. Either adjust this threshold, or reconcile the updates manually.", issue.number)

# class Main:
#     def hydrate_issue_metadata(self, issue: int, token:str, repo:str):
#         hydrate_issue_metadata(issue=issue, token=token, repo=repo)

#     def hydrate_all_open_issues(self, token:str, repo:str):
#         hydrate_all_open_issues(token=token, repo=repo)


if __name__ == "__main__":
    #fire.Fire(Main)
    fire.Fire(
        { "hydrate_issue_metadata":hydrate_issue_metadata, "hydrate_all_open_issues":hydrate_all_open_issues }
    )
