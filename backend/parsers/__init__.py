from .excel_parser import parse_excel
from .docx_parser import parse_docx
from .doc_parser import parse_doc


def get_parser(filepath: str, *, fast: bool = True):
    """
    fast=True (default): pdfplumber для массового скрапа.
    fast=False: Docling AI, если доступен.
    """
    ext = filepath.lower().rsplit(".", 1)[-1]
    if ext == "pdf":
        if not fast:
            try:
                from .docling_parser import parse_pdf as docling_parse
                return docling_parse
            except Exception as e:
                print(f"Docling initialization failed ({e}). Falling back to legacy PDF parser.")
        from .pdf_parser import parse_pdf as legacy_parse
        return legacy_parse
    if ext in ("xls", "xlsx"):
        return parse_excel
    if ext == "docx":
        return parse_docx
    if ext == "doc":
        return parse_doc
    raise ValueError(f"No parser available for extension: {ext}")
