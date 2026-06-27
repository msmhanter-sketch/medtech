"""Тесты парсеров скраперов."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from parsers.pdf_parser import parse_pdf
from scrapers.invitro import parse_invitro_html
from scrapers.validate import is_valid_service_name


INVITRO_SAMPLE = """
<div class="analyzes-item__container">
<div class="analyzes-item__title"><a href="/x">СОЭ (Cкорость Оседания Эритроцитов, ESR)</a></div>
<div class="analyzes-item__total--sum">1 200 ₸</div>
data-product-price="1200"
</div>
<div class="analyzes-item__container">
<div class="analyzes-item__title"><a href="/y">Общий анализ крови (CBC)</a></div>
<div class="analyzes-item__total--sum">520 ₸</div>
</div>
"""


class TestInvitroParser:
    def test_structured_cards(self):
        items = parse_invitro_html(INVITRO_SAMPLE, "https://invitro.kz/")
        assert len(items) == 2
        names = {i.name for i in items}
        assert "СОЭ (Cкорость Оседания Эритроцитов, ESR)" in names
        soe = next(i for i in items if "СОЭ" in i.name)
        assert soe.price == 1200
        cbc = next(i for i in items if "CBC" in i.name)
        assert cbc.price == 520


class TestValidate:
    def test_rejects_unit_junk(self):
        assert not is_valid_service_name("1 прием")
        assert not is_valid_service_name("1 консультация")

    def test_mojibake_rejected(self):
        broken = "Ð Ð°Ð·Ð²ÐµÑ\x80Ð½Ñ\x83Ñ\x82Ð°Ñ\x8f"
        assert not is_valid_service_name(broken)
