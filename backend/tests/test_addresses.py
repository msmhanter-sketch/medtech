"""Тесты адресов и DOQ филиалов."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.address_enrich import format_kz_address, is_generic_address
from scrapers.doq import fetch_doq_city_branches


def test_format_kz_address_with_street():
    assert format_kz_address("Алматы", "ул. Толе би, 258А") == "г. Алматы, ул. Толе би, 258А"


def test_is_generic_address():
    assert is_generic_address("Агрегатор клиник, г. Алматы")
    assert not is_generic_address("г. Алматы, ул. Сыганак 64/1")


@pytest.mark.slow
def test_doq_branches_have_real_addresses():
    branches = fetch_doq_city_branches("kokshetau", "Кокшетау", 16)
    if not branches:
        pytest.skip("DOQ API недоступен или нет данных по Кокшетау")
    
    assert any(b.clinic_meta.get("latitude") and b.clinic_meta.get("longitude") for b in branches)
    assert any(not is_generic_address(b.clinic_meta.get("address", "")) for b in branches)
    assert any(len(b.items) > 0 for b in branches)
