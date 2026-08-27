"""
Scrapling-based scraper for Kanyakumari colleges — fills 'Not Available' fields
Visits each college website's contact/about page and extracts:
  - Principal name & designation
  - Principal email & phone
  - General contact number & email
Saves updated data back to the validated Excel.
"""

import re
import time
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

try:
    from scrapling import Fetcher, StealthyFetcher
except ImportError:
    import subprocess, sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "scrapling"])
    from scrapling import Fetcher, StealthyFetcher

# ─── Helper: extract emails from text ──────────────────────────────────────────
EMAIL_RE = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")
PHONE_RE = re.compile(
    r"(\+91[\s\-]?)?(\d[\d\s\-]{7,14}\d)"
)
PRINCIPAL_RE = re.compile(
    r"(principal|dean|director|head of institution|rector|vice[- ]?chancellor)[^\n:]*[:\-]?\s*([A-Z][a-zA-Z. ]{3,50})",
    re.IGNORECASE
)

def clean(text):
    return " ".join(str(text).split()) if text else ""

def extract_emails(text):
    found = EMAIL_RE.findall(text)
    # Filter out common false positives
    valid = [e for e in found if not any(x in e.lower() for x in ["example", "domain", "email@", "@samp", ".png", ".jpg"])]
    return list(dict.fromkeys(valid))[:2]

def extract_phones(text):
    # Look for Indian phone numbers
    found = re.findall(r"(?:\+91[\s\-]?)?(?:0\d{9,10}|\d{10}|0\d{2,4}[\s\-]\d{6,8})", text)
    return list(dict.fromkeys(found))[:3]

def extract_principal_name(text):
    lines = text.split("\n")
    for i, line in enumerate(lines):
        if re.search(r"\b(principal|dean|director)\b", line, re.I):
            # Check same line or next line for a name
            for candidate in [line] + lines[i+1:i+3]:
                # Look for "Dr." or "Prof." or "Mr." followed by name
                m = re.search(r"(Dr\.|Prof\.|Mr\.|Mrs\.|Ms\.)\s+[A-Z][a-zA-Z. ]+", candidate)
                if m:
                    return clean(m.group(0))
    return None

# ─── List of colleges with confirmed working websites ─────────────────────────
COLLEGES_TO_SCRAPE = [
    # (name, base_url, contact_paths_to_try)
    ("NICHE — Noorul Islam Centre for Higher Education",
     "https://www.niuniv.com",
     ["/contact", "/contact-us", "/about/contact"]),

    ("Kanyakumari Govt Medical College (KGMCH)",
     "https://kgmc.ac.in",
     ["/contact", "/contact-us", "/aboutus"]),

    ("SMIMS — Sree Mookambika Institute of Medical Sciences",
     "https://smims.sreemookambikainstitute.com",
     ["/contact", "/contact-us"]),

    ("SMIDS — Sree Mookambika Institute of Dental Sciences",
     "https://smids.sreemookambikainstitute.com",
     ["/contact", "/contact-us"]),

    ("Ponjesly College of Engineering",
     "https://www.ponjesly.ac.in",
     ["/contact", "/contact-us", "/contact.php"]),

    ("RCET — Rohini College of Engineering",
     "https://www.rcet.org.in",
     ["/contact", "/contact-us", "/contactus"]),

    ("Mar Ephraem College of Engineering",
     "https://www.marephraem.edu.in",
     ["/contact", "/contact-us", "/contact.php"]),

    ("Stella Mary's College of Engineering",
     "https://www.stellamaryscoe.edu.in",
     ["/contact", "/contact-us", "/contact.php"]),

    ("Arunachala College of Engineering for Women",
     "http://www.arunachalacollege.com",
     ["/contact", "/contact-us", "/contactus.html"]),

    ("CSIIT — CSI Institute of Technology",
     "https://www.csiit.ac.in",
     ["/contact", "/contact-us"]),

    ("AVCE — Annai Vailankanni College of Engineering",
     "https://www.avce.edu.in",
     ["/contact", "/contact-us"]),

    ("Narayanaguru College of Engineering (NGCE)",
     "https://ngce.ac.in",
     ["/contact", "/contact-us", "/contact.html"]),

    ("LJCET — Lord Jegannath College of Engineering",
     "https://ljcet.com",
     ["/contact", "/contact-us"]),

    ("DMI Engineering College, Aralvaimozhi",
     "https://dmiengg.edu.in",
     ["/contact", "/contact-us"]),

    ("Rajas Institute of Technology",
     "http://www.riit.cc",
     ["/contact", "/contact-us"]),

    ("MACET — Maamallan Institute of Technology",
     "https://www.macet.ac.in",
     ["/contact", "/contact-us"]),

    ("Satyam College of Engineering",
     "https://www.satyamengg.com",
     ["/contact", "/contact-us"]),

    ("Scott Christian College",
     "https://scott.ac.in",
     ["/contact", "/contact-us", "/contactus"]),

    ("Holy Cross College Nagercoil",
     "https://www.holycrossngl.edu.in",
     ["/contact", "/contact-us"]),

    ("S. T. Hindu College Nagercoil",
     "https://sthinducollege.com",
     ["/contact", "/contact-us", "/contact.php"]),

    ("Women's Christian College Nagercoil",
     "https://wccnagercoil.edu.in",
     ["/contact", "/contact-us"]),

    ("Pioneer Kumaraswamy College",
     "https://pioneerkumaraswamycollege.org",
     ["/contact", "/contact-us"]),

    ("NMCC — Nesamony Memorial Christian College",
     "https://www.nmcc.ac.in",
     ["/contact", "/contact-us", "/contactus"]),

    ("Malankara Catholic College",
     "https://www.malankaracatholiccollege.ac.in",
     ["/contact", "/contact-us"]),

    ("Annai Velankanni College",
     "https://annaicollege.edu.in",
     ["/contact", "/contact-us"]),

    ("Vivekananda College, Agasteeswaram",
     "https://www.vivekanandacollege.net",
     ["/contact", "/contact-us"]),

    ("Lekshmipuram College",
     "http://www.lpc.org.in",
     ["/contact", "/contact-us"]),

    ("Amrita College of Engineering and Technology (ACET)",
     "https://www.acetedu.in",
     ["/contact", "/contact-us"]),

    ("UCEN — University College of Engineering Nagercoil",
     "https://www.ucen.ac.in",
     ["/contact", "/contact-us"]),

    ("SXCCE — St. Xavier's Catholic College of Engineering",
     "https://sxcce.edu.in",
     ["/contact", "/contact-us"]),

    ("CSI College of Nursing Marthandam",
     "http://www.csicnm.in",
     ["/contact", "/contact-us"]),

    ("Annammal College of Nursing",
     "http://www.annammalnursingcollege.com",
     ["/contact", "/contact-us"]),
]

fetcher = Fetcher(auto_match=False)

results = {}

def try_scrape(name, base_url, paths):
    """Try scraping contact pages. Returns dict with found data."""
    data = {
        "principal_name": "Not Available",
        "principal_email": "Not Available",
        "principal_phone": "Not Available",
        "general_contact": "Not Available",
    }
    full_text = ""

    # Try contact/about pages first
    urls_to_try = [base_url + p for p in paths] + [base_url, base_url + "/about"]
    tried = set()

    for url in urls_to_try:
        if url in tried:
            continue
        tried.add(url)
        try:
            page = fetcher.get(url, timeout=12, stealthy_headers=True)
            if page is None or page.status != 200:
                continue
            text = page.get_all_text(separator="\n")
            full_text += "\n" + text
        except Exception as e:
            print(f"  [skip] {url} — {e}")
            continue

    if not full_text.strip():
        print(f"  [FAILED] No content scraped for {name}")
        return data

    # Extract principal name
    pname = extract_principal_name(full_text)
    if pname:
        data["principal_name"] = pname

    # Extract emails
    emails = extract_emails(full_text)
    if emails:
        # First email that looks like a principal/admin email
        principal_emails = [e for e in emails if any(k in e.lower() for k in ["principal", "dean", "director", "admin", "hod"])]
        data["principal_email"] = principal_emails[0] if principal_emails else emails[0]

    # Extract phones
    phones = extract_phones(full_text)
    if phones:
        data["general_contact"] = " / ".join(phones[:3])
        data["principal_phone"] = phones[0]

    # Add all emails to general contact
    if emails:
        contact_parts = []
        if phones:
            contact_parts.append(" / ".join(phones[:2]))
        contact_parts.append(" | ".join(emails[:2]))
        data["general_contact"] = " | ".join(contact_parts)

    return data

print("=" * 70)
print("SCRAPLING COLLEGE CONTACT EXTRACTOR")
print("=" * 70)

for name, base_url, paths in COLLEGES_TO_SCRAPE:
    print(f"\n[*] Scraping: {name}")
    print(f"    URL: {base_url}")
    scraped = try_scrape(name, base_url, paths)
    results[name] = {"base_url": base_url, **scraped}
    print(f"    Principal: {scraped['principal_name']}")
    print(f"    Email:     {scraped['principal_email']}")
    print(f"    Phone:     {scraped['principal_phone']}")
    print(f"    Contact:   {scraped['general_contact']}")
    time.sleep(0.8)  # polite delay

print("\n\n" + "=" * 70)
print("SCRAPING COMPLETE — SUMMARY")
print("=" * 70)
found_names   = sum(1 for r in results.values() if r["principal_name"] != "Not Available")
found_emails  = sum(1 for r in results.values() if r["principal_email"] != "Not Available")
found_phones  = sum(1 for r in results.values() if r["principal_phone"] != "Not Available")
print(f"  Principal Names found:  {found_names}/{len(results)}")
print(f"  Emails found:           {found_emails}/{len(results)}")
print(f"  Phones found:           {found_phones}/{len(results)}")

# Save results
import json, os
out_json = "d:/LINKEDSTORY/Projects/scraped_contacts.json"
with open(out_json, "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2, ensure_ascii=False)
print(f"\n[OK] Raw scraped data saved to: {out_json}")
