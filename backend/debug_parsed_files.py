import json
from pathlib import Path

def main():
    parsed_dir = Path("c:/MedServicePrice.kz/data/parsed")
    cities = set()
    for file in parsed_dir.glob("*.json"):
        with open(file, "r", encoding="utf-8") as f:
            try:
                data = json.load(f)
            except Exception as e:
                continue
        if isinstance(data, list):
            for block in data:
                clinic_meta = block.get("clinic")
                if clinic_meta and "city" in clinic_meta:
                    cities.add(clinic_meta["city"])
    print(f"Total unique cities across all parsed files: {len(cities)}")
    for city in cities:
        print(f"City: {city!r} | Hex: {city.encode('utf-8').hex()}")

if __name__ == '__main__':
    main()
