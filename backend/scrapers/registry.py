"""Scraper registry.

Only create city-specific scraper classes when the source itself exposes a
city/branch-specific page or API result. Shared national catalogs stay as one
source to avoid multiplying the same price list across artificial city branches.
"""
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


SINGLE_SOURCE_SCRAPERS: list[type] = [
    AksayScraper,
    MckScraper,
    InvitroScraper,
    InvivoScraper,
    HelixScraper,
    MedelicaScraper,
    IDoctorScraper,
    SunkarScraper,
]

# KDL/Olymp has city-specific scraper classes generated from explicit city metadata.
KDLOLymp_SCRAPERS = [
    make_kdlolymp_scraper(slug, name, lat, lng)
    for slug, name, lat, lng in KDLOLymp_CITIES
]

# DOQ.kz returns concrete clinic/branch data from its API.
DOQ_SCRAPERS = build_doq_scrapers()

ALL_SCRAPERS: list[type] = SINGLE_SOURCE_SCRAPERS + KDLOLymp_SCRAPERS + DOQ_SCRAPERS

SOURCE_LABELS = {
    "invitro_kz": "invitro.kz",
    "invivo_kz": "invivo.kz",
    "helix_kz": "helix.kz",
    "kdlolymp_*": "kdlolymp.kz",
    "doq_*": "doq.kz",
    "medel_kz": "medelica.kz",
    "aksai_clinic_kz": "aksay.kaznmu.edu.kz",
    "mck_kz": "mck.kz",
    "idoctor_kz": "idoctor.kz",
    "sunkar_kz": "sunkar.kz",
}
