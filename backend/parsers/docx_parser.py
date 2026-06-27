import docx
import re
from typing import List, Dict, Any

def parse_docx(filepath: str) -> List[Dict[str, Any]]:
    results = []
    try:
        doc = docx.Document(filepath)
        for table in doc.tables:
            for row in table.rows:
                cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                # remove duplicates (sometimes merged cells duplicate text)
                unique_cells = []
                for c in cells:
                    if not unique_cells or c != unique_cells[-1]:
                        unique_cells.append(c)
                
                if len(unique_cells) >= 2:
                    price_str = unique_cells[-1].replace(" ", "").replace(",", ".").replace("₸", "").replace("тг", "")
                    if re.match(r'^\d+(\.\d+)?$', price_str):
                        price = float(price_str)
                        name = unique_cells[-2].replace('\n', ' ')
                        results.append({"name": name, "price": price})
    except Exception as e:
        print(f"Error parsing docx {filepath}: {e}")
    return results
