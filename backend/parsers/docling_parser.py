from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.datamodel.base_models import InputFormat
import re
from typing import List, Dict, Any

def parse_pdf(filepath: str) -> List[Dict[str, Any]]:
    print(f"Using advanced Docling AI parser for {filepath}...")
    pipeline_options = PdfPipelineOptions()
    pipeline_options.do_ocr = True # Включено распознавание текста с картинок (OCR)
    
    converter = DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
        }
    )
    result = converter.convert(filepath)
    
    # Export the parsed document layout to Markdown
    md_text = result.document.export_to_markdown()
    
    results = []
    
    # Parse the resulting Markdown for tables and lines
    for line in md_text.split('\n'):
        line = line.strip()
        
        # 1. Check if line is a Markdown table row
        if line.startswith('|') and line.endswith('|'):
            cells = [c.strip() for c in line.split('|')[1:-1]]
            
            price_val = None
            name_val = None
            
            # Look backwards to find the price cell
            for i, cell in reversed(list(enumerate(cells))):
                cleaned = cell.replace(' ', '').replace(',', '').replace('₸', '').replace('тг', '')
                if re.match(r'^\d+(\.\d+)?$', cleaned):
                    price_val = float(cleaned)
                    # The name is the longest string before the price
                    for j in range(i-1, -1, -1):
                        if len(cells[j]) > 3:
                            name_val = cells[j]
                            break
                    break
                    
            if price_val is not None and name_val is not None and len(name_val) > 5 and "---" not in name_val:
                results.append({"name": name_val, "price": price_val})
                
        # 2. Check if it's a regular text line ending with a price
        else:
            line = line.lstrip('* -#')
            match = re.search(r'^(.*?)\s+((?:\d+\s*)+\d*)$', line)
            if match:
                name_part = match.group(1).strip()
                price_part = match.group(2).replace(" ", "")
                if re.match(r'^\d+$', price_part):
                    name_part = re.sub(r'^\d+\s+', '', name_part)
                    name_part = name_part.replace("1 посещение", "").strip()
                    if len(name_part) > 5 and "Итого" not in name_part and "---" not in name_part:
                        results.append({"name": name_part, "price": float(price_part)})

    # Deduplicate
    unique_results = []
    seen = set()
    for r in results:
        key = (r['name'], r['price'])
        if key not in seen:
            seen.add(key)
            unique_results.append(r)
            
    print(f"Docling found {len(unique_results)} records.")
    return unique_results
