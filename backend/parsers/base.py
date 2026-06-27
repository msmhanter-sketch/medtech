from abc import ABC, abstractmethod
from typing import List, Dict, Any

class BaseParser(ABC):
    @abstractmethod
    def extract_data(self, filepath: str) -> List[Dict[str, Any]]:
        """
        Parses a file and returns a list of dictionaries with 'name' and 'price'.
        """
        pass
