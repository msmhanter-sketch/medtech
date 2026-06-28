"""Backward-compatible wrapper for purge_legacy_fallback_prices.py."""

from purge_legacy_fallback_prices import main

if __name__ == "__main__":
    import asyncio
    print(asyncio.run(main()))
