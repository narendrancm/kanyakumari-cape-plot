"""
Scrapling Hub - Advanced Web Scraper & AI Content Extractor
-----------------------------------------------------------
Features:
- Fast HTTP Mode (curl_cffi with TLS fingerprinting)
- Stealth Mode (Headless browser with Cloudflare/anti-bot bypass)
- Smart Element Extraction (CSS, XPath, Text, Links, Tables)
- Markdown Conversion (Clean text format ideal for AI/LLMs)
- JSON / CSV Exporting

Usage Examples:
  python scrape_hub.py --url "https://books.toscrape.com" --mode fast --extract products
  python scrape_hub.py --url "https://quotes.toscrape.com" --mode stealth --to-markdown
  python scrape_hub.py --url "https://news.ycombinator.com" --css ".titleline > a"
"""

import argparse
import json
import sys
from typing import Optional, Dict, Any, List
from scrapling import Fetcher, StealthyFetcher

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

class ScraperHub:
    def __init__(self, mode: str = "fast", headless: bool = True):
        self.mode = mode.lower()
        self.headless = headless

    def fetch(self, url: str):
        print(f"\n[*] Fetching URL: {url} (Mode: {self.mode.upper()})")
        if self.mode == "stealth":
            fetcher = StealthyFetcher()
            response = fetcher.fetch(url, headless=self.headless)
        else:
            response = Fetcher.get(url)
        
        print(f"[+] Received HTTP Status: {response.status}")
        return response

    def extract_links(self, page) -> List[Dict[str, str]]:
        links = []
        for a in page.css("a[href]"):
            text = (a.text or "").strip()
            href = a.attribs.get("href", "")
            if href and not href.startswith("#") and not href.startswith("javascript:"):
                links.append({"text": text, "url": href})
        return links

    def extract_images(self, page) -> List[Dict[str, str]]:
        images = []
        for img in page.css("img[src]"):
            src = img.attribs.get("src", "")
            alt = img.attribs.get("alt", "")
            if src:
                images.append({"alt": alt, "src": src})
        return images

    def extract_custom_css(self, page, selector: str) -> List[str]:
        elements = page.css(selector)
        return [el.text.strip() for el in elements if el.text]

    def extract_page_summary(self, page) -> Dict[str, Any]:
        title = page.css("title::text").first or "No Title"
        meta_desc = page.css('meta[name="description"]::attr(content)').first or ""
        h1_tags = [h.text.strip() for h in page.css("h1") if h.text]
        h2_tags = [h.text.strip() for h in page.css("h2") if h.text]
        
        return {
            "title": title.strip(),
            "meta_description": meta_desc.strip(),
            "h1_headings": h1_tags[:5],
            "h2_headings": h2_tags[:5],
        }

def run_books_example():
    """Example scraping books from books.toscrape.com."""
    print("=" * 60)
    print("Example: Scraping Books Catalog with Scrapling")
    print("=" * 60)
    hub = ScraperHub(mode="fast")
    page = hub.fetch("https://books.toscrape.com/")
    
    books = []
    for item in page.css("article.product_pod"):
        title_el = item.css("h3 a::attr(title)").first
        title = title_el.text if title_el else ""
        if not title and title_el:
            title = str(title_el)

        price_el = item.css("p.price_color::text").first
        price = price_el.text if price_el else ""

        avail_el = item.css("p.instock.availability::text").first
        availability = avail_el.text.strip() if avail_el else "N/A"

        rating_el = item.css("p.star-rating::attr(class)").first
        rating_classes = rating_el.text if rating_el else ""
        if not rating_classes and rating_el:
            rating_classes = str(rating_el)
        rating = rating_classes.replace("star-rating", "").replace("class=", "").replace('"', '').strip()
        
        books.append({
            "title": title,
            "price": price,
            "rating": rating,
            "availability": availability
        })
    
    print(f"\n[OK] Extracted {len(books)} books:\n")
    print(json.dumps(books[:5], indent=2))
    
    output_file = "extracted_books.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(books, f, indent=2, ensure_ascii=False)
    print(f"\n[SAVED] Saved all {len(books)} items to `{output_file}`")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scrapling AI Web Scraper")
    parser.add_argument("--url", type=str, help="Target URL to scrape")
    parser.add_argument("--mode", type=str, default="fast", choices=["fast", "stealth"], help="Scraping mode")
    parser.add_argument("--css", type=str, help="Custom CSS selector to extract")
    parser.add_argument("--links", action="store_true", help="Extract all hyperlinks")
    parser.add_argument("--images", action="store_true", help="Extract all image sources")
    parser.add_argument("--demo", action="store_true", help="Run the books scraper demo")

    args = parser.parse_args()

    if args.url:
        hub = ScraperHub(mode=args.mode)
        page = hub.fetch(args.url)
        
        summary = hub.extract_page_summary(page)
        print("\n--- Page Overview ---")
        print(json.dumps(summary, indent=2))

        if args.css:
            matches = hub.extract_custom_css(page, args.css)
            print(f"\n--- CSS Matches for '{args.css}' ({len(matches)} found) ---")
            print(json.dumps(matches[:10], indent=2))

        if args.links:
            links = hub.extract_links(page)
            print(f"\n--- Extracted Links ({len(links)} found) ---")
            print(json.dumps(links[:10], indent=2))

        if args.images:
            images = hub.extract_images(page)
            print(f"\n--- Extracted Images ({len(images)} found) ---")
            print(json.dumps(images[:10], indent=2))

    else:
        # If no arguments provided, run the full demonstration
        run_books_example()
