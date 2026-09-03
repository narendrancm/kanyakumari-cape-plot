import re
from typing import Optional

def normalize_phone(raw: Optional[str]) -> Optional[str]:
    """Standardize phone numbers into clean landline or mobile formats."""
    if not raw or str(raw).strip() in ("NA", "None", "null", "-", "Not Available"):
        return None
    # Extract all digits
    digits = re.sub(r"\D", "", str(raw))
    if not digits:
        return None
    
    # 10-digit mobile or landline with STD
    if len(digits) == 10:
        if digits.startswith("9") or digits.startswith("8") or digits.startswith("7") or digits.startswith("6"):
            return f"+91 {digits}"
        elif digits.startswith("4652"): # Nagercoil/Kanyakumari STD
            return f"04652-{digits[4:]}"
        elif digits.startswith("4651"): # Marthandam/Thuckalay STD
            return f"04651-{digits[4:]}"
        return digits
    elif len(digits) == 11 and digits.startswith("0"):
        std = digits[:5]
        local = digits[5:]
        return f"{std}-{local}"
    elif len(digits) == 12 and digits.startswith("91"):
        return f"+91 {digits[2:]}"
    
    return str(raw).strip()

def normalize_url(raw: Optional[str]) -> Optional[str]:
    """Normalize web URLs, strip tracking parameters and enforce valid schemes."""
    if not raw or str(raw).strip() in ("NA", "None", "null", "-", "Not Available", "https://Not Available (Unverified)"):
        return None
    url = str(raw).strip()
    if url.startswith("http://"):
        url = "https://" + url[7:]
    elif not url.startswith("https://"):
        url = "https://" + url
    # Strip URL fragments and query params
    url = re.sub(r"[#?].*$", "", url)
    # Strip trailing slash
    url = url.rstrip("/")
    # Filter placeholder/invalid patterns
    if any(p in url.lower() for p in ["not available", "unverified", "example.com", "placeholder"]):
        return None
    return url

def normalize_name(raw: Optional[str]) -> str:
    """Normalize institution name for entity matching and deduplication."""
    if not raw:
        return ""
    name = str(raw).upper().strip()
    # Contract dotted abbreviations first (e.g. G.H.S.S. -> GHSS, G.P.S. -> GPS)
    name = re.sub(r"\b([A-Z])\.([A-Z])\.([A-Z])\.([A-Z])\b", r"\1\2\3\4", name)
    name = re.sub(r"\b([A-Z])\.([A-Z])\.([A-Z])\b", r"\1\2\3", name)
    name = re.sub(r"\b([A-Z])\.([A-Z])\b", r"\1\2", name)
    # Normalize punctuation and separators
    name = re.sub(r"[\.,\-_/\\()\[\]]+", " ", name)
    # Standardize common acronyms/terms
    replacements = {
        r"\bGOVT\b": "GOVERNMENT",
        r"\bGHSS\b": "GOVERNMENT HIGHER SECONDARY SCHOOL",
        r"\bGHS\b": "GOVERNMENT HIGH SCHOOL",
        r"\bGPS\b": "GOVERNMENT PRIMARY SCHOOL",
        r"\bGLMPS\b": "GOVERNMENT LOWER PRIMARY SCHOOL",
        r"\bHSS\b": "HIGHER SECONDARY SCHOOL",
        r"\bHS\b": "HIGH SCHOOL",
        r"\bMAT\b": "MATRICULATION",
        r"\bMATRIC\b": "MATRICULATION",
        r"\bENGG\b": "ENGINEERING",
        r"\bTECH\b": "TECHNOLOGY",
        r"\bCOL\b": "COLLEGE",
        r"\bINST\b": "INSTITUTE"
    }
    for pat, rep in replacements.items():
        name = re.sub(pat, rep, name)
    # Collapse whitespace
    name = re.sub(r"\s+", " ", name).strip()
    return name

def normalize_pincode(raw: Optional[str]) -> Optional[str]:
    """Extract valid 6-digit Indian PIN code, specifically validating 629xxx for Kanyakumari."""
    if not raw:
        return None
    match = re.search(r"\b(629\d{3})\b", str(raw))
    if match:
        return match.group(1)
    match_gen = re.search(r"\b(\d{6})\b", str(raw))
    return match_gen.group(1) if match_gen else None
