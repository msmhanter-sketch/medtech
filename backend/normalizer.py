import pandas as pd
import difflib
import logging
from pathlib import Path

log = logging.getLogger(__name__)

class ServiceNormalizer:
    def __init__(self, excel_path: str):
        self.excel_path = Path(excel_path)
        self.services_dict = {}  # Normalized Name_ru -> dict of info
        self.names_list = []     # List of Name_ru for fast fuzzy matching
        
        self.load_dictionary()

    def load_dictionary(self):
        if not self.excel_path.exists():
            log.error(f"Справочник не найден: {self.excel_path}")
            return
            
        try:
            df = pd.read_excel(self.excel_path).fillna("")
            count = 0
            for _, row in df.iterrows():
                name_ru = str(row.get("Name_ru", "")).strip()
                if name_ru:
                    self.services_dict[name_ru] = {
                        "category": str(row.get("Специальность", "")),
                        "code": str(row.get("TarificatrCode", ""))
                    }
                    if name_ru not in self.names_list:
                        self.names_list.append(name_ru)
                    count += 1
            log.info(f"Загружено {count} услуг из справочника.")
        except Exception as e:
            log.error(f"Ошибка загрузки справочника: {e}")

    def normalize(self, raw_name: str) -> str | None:
        if not self.names_list or not raw_name:
            return None
            
        # Clean up the raw name for better matching
        clean_raw = raw_name.lower().strip()
        
        # 1. Exact match (case-insensitive)
        for name_ru in self.names_list:
            if name_ru.lower() == clean_raw:
                return name_ru
                
        # 2. Fuzzy match
        # get_close_matches returns a list of the best matches
        matches = difflib.get_close_matches(clean_raw, [n.lower() for n in self.names_list], n=1, cutoff=0.75)
        
        if matches:
            matched_lower = matches[0]
            # Find the original cased name
            for name_ru in self.names_list:
                if name_ru.lower() == matched_lower:
                    return name_ru
                    
        return None
