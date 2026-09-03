import re
from typing import Dict, Any, Tuple
from difflib import SequenceMatcher
from .normalizer import normalize_name, normalize_url, normalize_phone, normalize_pincode

def string_similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()

def evaluate_match(inst_a: Dict[str, Any], inst_b: Dict[str, Any]) -> Tuple[str, float, str]:
    """
    Evaluates entity match between two institution records across multiple signals.
    Returns: (classification, confidence_score, explanation)
    Classifications: 'EXACT', 'HIGH_CONFIDENCE', 'POSSIBLE_MATCH', 'CONFLICTING_MATCH', 'NO_MATCH'
    """
    # 1. Exact UDISE Code Match (Schools)
    udise_a = inst_a.get("udise_code")
    udise_b = inst_b.get("udise_code")
    if udise_a and udise_b and str(udise_a).strip() == str(udise_b).strip() and str(udise_a).strip() not in ("NA", "None", ""):
        return ("EXACT", 1.0, f"Identical UDISE Code: {udise_a}")

    # 2. Exact Domain / Website Match
    url_a = normalize_url(inst_a.get("website"))
    url_b = normalize_url(inst_b.get("website"))
    domain_match = False
    if url_a and url_b:
        dom_a = re.sub(r"^https?://(www\.)?", "", url_a).split("/")[0]
        dom_b = re.sub(r"^https?://(www\.)?", "", url_b).split("/")[0]
        if dom_a == dom_b and len(dom_a) > 4:
            domain_match = True

    # 3. Name Similarity
    norm_name_a = normalize_name(inst_a.get("name"))
    norm_name_b = normalize_name(inst_b.get("name"))
    name_sim = string_similarity(norm_name_a, norm_name_b)

    # 4. Block & Pincode Match
    block_a = (inst_a.get("block") or "").strip().lower()
    block_b = (inst_b.get("block") or "").strip().lower()
    block_match = bool(block_a and block_b and block_a == block_b)

    pin_a = normalize_pincode(inst_a.get("location") or "")
    pin_b = normalize_pincode(inst_b.get("location") or "")
    pin_match = bool(pin_a and pin_b and pin_a == pin_b)

    # 5. Phone Match
    phone_a = normalize_phone(inst_a.get("phone") or inst_a.get("principal_phone"))
    phone_b = normalize_phone(inst_b.get("phone") or inst_b.get("principal_phone"))
    phone_match = bool(phone_a and phone_b and phone_a == phone_b)

    # 6. Acronym Match (MACET, NMCC, etc.)
    acronym_a = "".join([w[0] for w in norm_name_a.split() if w])
    acronym_b = "".join([w[0] for w in norm_name_b.split() if w])
    acronym_match = bool(len(acronym_a) >= 3 and acronym_a == acronym_b)

    # Evaluation Rules
    if domain_match and name_sim > 0.6:
        return ("HIGH_CONFIDENCE", 0.95, f"Domain match ({dom_a}) + name similarity ({name_sim:.2f})")
    
    if phone_match and name_sim > 0.6:
        return ("HIGH_CONFIDENCE", 0.88, f"Phone match ({phone_a}) + name similarity ({name_sim:.2f})")
    
    if name_sim > 0.88 and block_match:
        return ("HIGH_CONFIDENCE", 0.85, f"High name similarity ({name_sim:.2f}) in same block ({block_a})")
    
    # Specific MACET / Marthandam College detection
    if ("MACET" in (inst_a.get("name") or "").upper() or "MACET" in (inst_b.get("name") or "").upper()) and \
       ("MARTHANDAM" in (inst_a.get("name") or "").upper() or "MARTHANDAM" in (inst_b.get("name") or "").upper() or \
        "MAAMALLAN" in (inst_a.get("name") or "").upper() or "MAAMALLAN" in (inst_b.get("name") or "").upper()):
        return ("POSSIBLE_MATCH", 0.70, "Known Acronym Collision: MACET / Marthandam / Maamallan")

    if name_sim > 0.70 and (block_match or pin_match):
        return ("POSSIBLE_MATCH", 0.65, f"Moderate name similarity ({name_sim:.2f}) with location match")
    
    if acronym_match and not domain_match and not phone_match and name_sim < 0.5:
        return ("CONFLICTING_MATCH", 0.25, f"Acronym match only ({acronym_a}) with conflicting full names")
    
    return ("NO_MATCH", 0.0, "No significant matching signals")
