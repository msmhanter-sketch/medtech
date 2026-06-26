"""
tests/test_api.py — Интеграционные тесты для FastAPI эндпоинтов.

Запуск: pytest tests/ -v
Требует рабочего PostgreSQL + Redis (или используй моки).
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

from app.main import app

pytestmark = pytest.mark.anyio


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac


class TestHealth:
    async def test_health_ok(self, client: AsyncClient):
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["service"] == "medprice-kz-api"


class TestCategories:
    async def test_get_categories_returns_list(self, client: AsyncClient):
        response = await client.get("/api/categories/")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    async def test_categories_have_required_fields(self, client: AsyncClient):
        response = await client.get("/api/categories/")
        assert response.status_code == 200
        for cat in response.json():
            assert "id" in cat
            assert "name" in cat
            assert "slug" in cat


class TestServicesSearch:
    async def test_search_requires_min_2_chars(self, client: AsyncClient):
        response = await client.get("/api/services/search?q=М")
        assert response.status_code == 422  # Validation error

    async def test_search_returns_results(self, client: AsyncClient):
        response = await client.get("/api/services/search?q=МРТ")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Все результаты должны содержать category_name
        for item in data:
            assert "category_name" in item
            assert "id" in item

    async def test_search_limit_respected(self, client: AsyncClient):
        response = await client.get("/api/services/search?q=ан&limit=3")
        assert response.status_code == 200
        assert len(response.json()) <= 3

    async def test_search_no_results(self, client: AsyncClient):
        response = await client.get("/api/services/search?q=xyznonsense")
        assert response.status_code == 200
        assert response.json() == []


class TestClinicsCompare:
    async def test_compare_requires_service_id(self, client: AsyncClient):
        response = await client.get("/api/clinics/compare?city=Астана")
        assert response.status_code == 422

    async def test_compare_requires_city(self, client: AsyncClient):
        response = await client.get("/api/clinics/compare?service_id=1")
        assert response.status_code == 422

    async def test_compare_not_found_service(self, client: AsyncClient):
        response = await client.get("/api/clinics/compare?service_id=99999&city=Астана")
        assert response.status_code == 404

    async def test_compare_returns_valid_schema(self, client: AsyncClient):
        response = await client.get("/api/clinics/compare?service_id=1&city=Астана")
        assert response.status_code == 200
        data = response.json()
        assert "service" in data
        assert "clinics" in data
        assert "total_clinics" in data
        assert isinstance(data["clinics"], list)

    async def test_compare_price_asc_sorted(self, client: AsyncClient):
        response = await client.get(
            "/api/clinics/compare?service_id=1&city=Астана&sort=price_asc"
        )
        assert response.status_code == 200
        clinics = response.json()["clinics"]
        prices = [c["price_kzt"] for c in clinics]
        assert prices == sorted(prices)

    async def test_compare_cheapest_flag(self, client: AsyncClient):
        response = await client.get(
            "/api/clinics/compare?service_id=1&city=Астана&sort=price_asc"
        )
        assert response.status_code == 200
        clinics = response.json()["clinics"]
        if clinics:
            cheapest = [c for c in clinics if c["is_cheapest"]]
            assert len(cheapest) >= 1
            # Самая дешёвая — первая в price_asc
            assert clinics[0]["is_cheapest"] is True
