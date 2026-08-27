"""
Scrapling AI Starter & Processing Script
----------------------------------------
This script demonstrates how to scrape websites and use AI / CSS selectors
with the Scrapling library.
"""

from scrapling import Fetcher

def run_basic_scrape(url: str = "https://quotes.toscrape.com"):
    print(f"\n--- Fetching: {url} ---")
    page = Fetcher.get(url)
    
    print(f"Status Code: {page.status}")
    
    # Extract titles / quotes using CSS selectors
    quotes = page.css(".quote")
    print(f"Found {len(quotes)} quotes:\n")
    
    for i, quote in enumerate(quotes[:5], start=1):
        text = quote.css(".text::text").first
        author = quote.css(".author::text").first
        print(f"{i}. \"{text}\" - {author}")

def run_stealth_scrape(url: str = "https://quotes.toscrape.com"):
    """
    For websites with Cloudflare or bot protection, use StealthyFetcher
    (Requires running `scrapling install` once to download browser engines).
    """
    try:
        from scrapling import StealthyFetcher
        print(f"\n--- Fetching with StealthyFetcher: {url} ---")
        fetcher = StealthyFetcher()
        page = fetcher.fetch(url, headless=True)
        print(f"Status: {page.status}")
        print(f"Page title: {page.css('title::text').first}")
    except Exception as e:
        print(f"Stealthy fetcher notice: {e}")
        print("Note: To use StealthyFetcher, run `scrapling install` in your terminal.")

if __name__ == "__main__":
    print("=" * 50)
    print("Scrapling Scraper Demo")
    print("=" * 50)
    
    # 1. Basic Fetching
    run_basic_scrape()
    
    # 2. Example with stealth mode
    run_stealth_scrape()
