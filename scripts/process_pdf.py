# .github/scripts/process_pdf.py

import os
from pathlib import Path
from typing import Literal

import fire
import requests
from loguru import logger
from lxml import etree
from llamero.utils import commit_and_push

OutputFormat = Literal['markdown', 'tei']

def remove_extra_whitespace(text: str)->str:
    while '\n\n\n' in text:
        text = text.replace('\n\n\n', '\n\n')
    return text

def remove_gibberish(
    text: str,
    cutoff=2000
)->str:
    good_lines = []
    for line in text.split('\n'):
        _line = line[:]
        if _line.startswith("$"):
            _line = _line[1:-1]
        n_tok = len(_line)
        n_space = _line.count(" ")
        # I think this might remove some formulas if we use cutoff=0
        token_sparsity=1
        if n_tok:
            token_sparsity = n_space/n_tok
        
        _line = line[:]
        _line = _line.replace(" ","")

        skip=False
        if (abs(token_sparsity - .5) < .01) and (len(line) > cutoff):
            skip=True
        if "texitsha1_base64" in _line:
            skip=True
        if "texit>" in _line:
            skip=True
        if skip:
            logger.info(f"removing gibberish")
            logger.info(line)
            continue
        good_lines.append(line)
    return '\n'.join(good_lines)

def sanitize_markdown(text: str)->str:
    text=remove_extra_whitespace(text)
    text=remove_gibberish(text)
    return text

def get_feature_path(base_path: Path, feature_type: str, paper_id: str, ext: str) -> Path:
    """Create feature directory if it doesn't exist and return the full path."""
    feature_dir = base_path / 'features' / feature_type
    feature_dir.mkdir(parents=True, exist_ok=True)
    return feature_dir / f"{paper_id}{ext}"

def process_pdf_grobid(
    pdf_path: str, 
    format: OutputFormat = 'markdown', 
    tag: str = "grobid",
    output_path: str | None = None,
    regenerate_tei: bool = True,
) -> None:
    """
    Process a PDF file using Grobid and convert to the specified format.
    
    Output files will be saved in feature-specific directories:
    - TEI XML files go to features/tei-xml-grobid/
    - Markdown files go to features/markdown-grobid/
    
    Args:
        pdf_path: Path to the PDF file relative to the repository root.
        format: Output format, either 'markdown' or 'tei'.
        tag: Optional tag to append to the output filename (default: "grobid").
        output_path: Optional path where the output file should be saved. If provided,
            this overrides the default feature directory behavior.
        regenerate_tei: Whether to regenerate TEI XML even if it exists.
    """
    pdf_path = Path(pdf_path)
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF file not found: {pdf_path}")

    # Get paper directory
    paper_dir = pdf_path.parent

    # Generate paper ID from PDF filename
    paper_id = pdf_path.stem

    # Determine output paths
    if output_path:
        output_path = Path(output_path)
        tei_path = output_path.with_suffix('.tei.xml')
        md_path = output_path.with_suffix('.md')
    else:
        # Use feature directory structure
        tei_path = get_feature_path(paper_dir, f'tei-xml-{tag}', paper_id, '.xml')
        md_path = get_feature_path(paper_dir, f'markdown-{tag}', paper_id, '.md')
    
    logger.info(f"Processing {pdf_path}")
    logger.info(f"TEI output will go to {tei_path}")
    logger.info(f"Markdown output will go to {md_path}")

    if regenerate_tei or (not tei_path.exists()):
        grobid_host = os.environ.get('GROBID_HOST', 'localhost')
        base_url = f"http://{grobid_host}:8070"
        
        # Call Grobid to process the PDF into TEI XML
        with open(pdf_path, 'rb') as f:
            files = {'input': (pdf_path.name, f, 'application/pdf')}
            resp = requests.post(
                f"{base_url}/api/processFulltextDocument",
                files=files,
                headers={'Accept': 'application/xml'},
                timeout=300  # 5 minute timeout
            )
        
        if resp.status_code != 200:
            raise RuntimeError(f"Grobid processing failed: {resp.status_code}")
        
        # Ensure the feature directory exists and save the TEI output
        tei_path.parent.mkdir(parents=True, exist_ok=True)
        tei_path.write_text(resp.text)
        logger.info(f"Saved TEI XML to {tei_path}")
    
    if format == 'markdown':
        # Convert TEI to Markdown using XSLT
        xslt_path = Path(__file__).parent / 'tei2md.xslt'
        if not xslt_path.exists():
            raise FileNotFoundError(f"XSLT stylesheet not found: {xslt_path}")
        
        xslt = etree.parse(str(xslt_path))
        transform = etree.XSLT(xslt)
        
        tei_doc = etree.parse(str(tei_path))
        markdown = str(transform(tei_doc))
        markdown = sanitize_markdown(markdown)
        
        # Ensure the feature directory exists and save Markdown output
        md_path.parent.mkdir(parents=True, exist_ok=True)
        md_path.write_text(markdown)
        logger.info(f"Saved Markdown to {md_path}")
    else:
        logger.info(f"Output TEI XML saved at {tei_path}")

process_pdf = process_pdf_grobid

# Files to ignore during operations
ignore_files = [
    "gh-store-snapshot.json",
    "papers-archive.json",
    "papers.json",
    "papers.yaml"
]

# def flush_old_conversions(data_path: str = "data/papers", tag: str = "grobid"):
#     """
#     Remove all previous conversions with the specified tag from feature directories.
#     """
#     base_path = Path(data_path).parent
#     tei_dir = base_path / 'features' / f'tei-xml-{tag}'
#     md_dir = base_path / 'features' / f'markdown-{tag}'
    
#     if tei_dir.exists():
#         for fpath in tei_dir.glob("*.xml"):
#             fpath.unlink()
#         tei_dir.rmdir()
    
#     if md_dir.exists():
#         for fpath in md_dir.glob("*.md"):
#             fpath.unlink()
#         md_dir.rmdir()

def generate_missing_conversions(
    data_path: str = "data/papers",
    tag: str = "grobid",
    checkpoint_cadence=5,
    regenerate_tei: bool = True,
):
    """
    Generate missing conversions for PDFs, saving outputs to feature directories.
    """
    data_path = Path(data_path)
    modified_files = []
    
    for i, pdf_fpath in enumerate(data_path.rglob("*.pdf")):
        # Skip PDFs in source directories
        if "source" in str(pdf_fpath):
            continue
            
        # Determine feature paths
        #base_dir = pdf_fpath.parent.parent
        paper_dir = pdf_fpath.parent
        paper_id = pdf_fpath.stem
        md_path = get_feature_path(paper_dir, f'markdown-{tag}', paper_id, '.md')
        
        if not md_path.exists():
            process_pdf_grobid(pdf_fpath, regenerate_tei=regenerate_tei)
            # Add both markdown and TEI paths
            tei_path = get_feature_path(paper_dir, f'tei-xml-{tag}', paper_id, '.xml')
            modified_files.extend([md_path, tei_path])
            logger.info(f"Generated conversions for {pdf_fpath.name}")
            
        if (i % checkpoint_cadence) == 0 and modified_files:
            msg = "Persisting feature conversions"
            commit_and_push(files_to_commit=modified_files, message=msg)
            modified_files = []
            
    if modified_files:
        commit_and_push(files_to_commit=modified_files, message="Persisting remaining feature conversions")

if __name__ == '__main__':
    fire.Fire({
        "process_pdf": process_pdf,
        "generate_missing_conversions": generate_missing_conversions,
        #"flush_old_conversions": flush_old_conversions,
    })
