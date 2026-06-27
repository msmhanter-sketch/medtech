"""Реестр всех скраперов по ТЗ хакатона."""
from scrapers.aksay import AksayScraper
from scrapers.doq import build_doq_scrapers
from scrapers.helix import HelixScraper
from scrapers.invitro import InvitroScraper
from scrapers.kdlolymp import KDLOLymp_CITIES, make_kdlolymp_scraper
from scrapers.medelica import MedelicaScraper
from scrapers.mck import MckScraper
from scrapers.invivo import InvivoScraper
from scrapers.idoctor import IDoctorScraper
from scrapers.sunkar import SunkarScraper

# Лаборатории (без дублей: invitro_astana, kdl_kz, olymp убраны)
CORE_SCRAPERS: list[type] = [
    InvitroScraper,
    HelixScraper,
    MedelicaScraper,
    AksayScraper,
    MckScraper,
    InvivoScraper,
    IDoctorScraper,
    SunkarScraper,
]

# KDL ОЛИМП по городам
KDLOLymp_SCRAPERS = [
    make_kdlolymp_scraper(slug, name, lat, lng)
    for slug, name, lat, lng in KDLOLymp_CITIES
]

# DOQ.kz — все филиалы по городам (из API)
DOQ_SCRAPERS = build_doq_scrapers()

ALL_SCRAPERS: list[type] = CORE_SCRAPERS + KDLOLymp_SCRAPERS + DOQ_SCRAPERS

SOURCE_LABELS = {
    "invitro_kz": "invitro.kz",
    "invitro_astana": "invitro.kz",
    "helix_kz": "helix.kz",
    "kdl_kz": "kdl.kz",
    "kdlolymp_*": "kdlolymp.kz",
    "olymp_kz": "olymp.kz → kdlolymp.kz",
    "doq_*": "doq.kz",
    "medel_kz": "medelica.kz",
    "aksai_clinic_kz": "aksay.kaznmu.edu.kz",
    "mck_kz": "mck.kz",
    "invivo_kz": "invivo.kz",
    "idoctor_kz": "idoctor.kz",
}
