import pytest
from unittest.mock import MagicMock

def classify_scrape_response(status_code: int, error_str: str = "") -> str:
    """
    Distinguishes website failure states without guessing or fabricating data.
    """
    if status_code == 200:
        return "WEBSITE_AVAILABLE"
    elif status_code == 404:
        return "HTTP_404"
    elif status_code == 403:
        return "HTTP_403"
    elif status_code == 429:
        return "HTTP_429"
    elif 500 <= status_code < 600:
        return "HTTP_5XX"
    elif "timed out" in error_str.lower() or "timeout" in error_str.lower():
        return "TIMEOUT"
    elif "could not resolve host" in error_str.lower() or "name resolution" in error_str.lower():
        return "DNS_FAILURE"
    elif "ssl" in error_str.lower() or "certificate" in error_str.lower():
        return "SSL_ERROR"
    elif "login" in error_str.lower() or "auth" in error_str.lower():
        return "AUTH_GATED"
    return "EXTRACTION_FAILED"

def test_failure_classifications():
    assert classify_scrape_response(404) == "HTTP_404"
    assert classify_scrape_response(403) == "HTTP_403"
    assert classify_scrape_response(429) == "HTTP_429"
    assert classify_scrape_response(502) == "HTTP_5XX"
    assert classify_scrape_response(0, "Connection timed out after 10000ms") == "TIMEOUT"
    assert classify_scrape_response(0, "Could not resolve host: mariahomeopathic.org.in") == "DNS_FAILURE"
    assert classify_scrape_response(0, "SSL: CERTIFICATE_VERIFY_FAILED") == "SSL_ERROR"
    assert classify_scrape_response(0, "Authentication required: login wall") == "AUTH_GATED"
    assert classify_scrape_response(200) == "WEBSITE_AVAILABLE"

if __name__ == "__main__":
    test_failure_classifications()
    print("✓ Scraper failure handling tests passed!")
