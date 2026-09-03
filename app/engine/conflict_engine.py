from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

# Field-Specific Authority Hierarchy (1 to 5)
SOURCE_AUTHORITY = {
    "name": {
        "OFFICIAL_WEBSITE": 5,
        "GOVERNMENT": 5,
        "UNIVERSITY": 4,
        "EXCEL": 2,
        "PUBLIC_CORRECTION": 1
    },
    "udise_code": {
        "GOVERNMENT": 5,
        "EXCEL": 3,
        "OFFICIAL_WEBSITE": 2
    },
    "phone": {
        "OFFICIAL_WEBSITE": 5,
        "GOVERNMENT": 4,
        "EXCEL": 2,
        "PUBLIC_CORRECTION": 1
    },
    "email": {
        "OFFICIAL_WEBSITE": 5,
        "GOVERNMENT": 4,
        "EXCEL": 2,
        "PUBLIC_CORRECTION": 1
    },
    "website": {
        "OFFICIAL_WEBSITE": 5,
        "GOVERNMENT": 4,
        "EXCEL": 2,
        "PUBLIC_CORRECTION": 1
    },
    "principal_name": {
        "OFFICIAL_WEBSITE": 5,
        "EXCEL": 2,
        "PUBLIC_CORRECTION": 1
    },
    "category": {
        "GOVERNMENT": 5,
        "OFFICIAL_WEBSITE": 4,
        "EXCEL": 3
    },
    "management_type": {
        "GOVERNMENT": 5,
        "OFFICIAL_WEBSITE": 4,
        "EXCEL": 3
    }
}

class ConflictEngine:
    """
    Per-field conflict detection, authority weighting, and resolution engine.
    """

    @classmethod
    def get_authority(cls, field_name: str, source_type: str) -> int:
        field_rules = SOURCE_AUTHORITY.get(field_name, {})
        return field_rules.get(source_type, 1)

    @classmethod
    def resolve_field(
        cls,
        field_name: str,
        current_canonical_value: Optional[str],
        candidates: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        candidates is a list of:
        {
            "source_type": str,
            "source_name": str,
            "source_url": str,
            "value": str,
            "confidence": "HIGH" | "MEDIUM" | "LOW",
            "retrieved_at": str
        }
        Returns decision dictionary:
        {
            "status": "NO_CONFLICT" | "AUTO_RESOLVED" | "NEEDS_REVIEW" | "CONFLICT",
            "canonical_value": str,
            "old_value": str,
            "resolution_reason": str,
            "winning_source": Dict,
            "unresolved_conflicts": List[Dict]
        }
        """
        curr = str(current_canonical_value or "").strip()
        valid_candidates = [c for c in candidates if c.get("value") and str(c["value"]).strip() not in ("NA", "None", "null", "")]

        if not valid_candidates:
            return {
                "status": "NO_CONFLICT",
                "canonical_value": curr,
                "old_value": curr,
                "resolution_reason": "No new valid candidate values provided",
                "winning_source": None,
                "unresolved_conflicts": []
            }

        # If all candidates match the current value
        if all(str(c["value"]).strip() == curr for c in valid_candidates):
            return {
                "status": "NO_CONFLICT",
                "canonical_value": curr,
                "old_value": curr,
                "resolution_reason": "All sources agree with current canonical value",
                "winning_source": valid_candidates[0],
                "unresolved_conflicts": []
            }

        # Discrepancy detected - evaluate by authority
        scored_candidates = []
        for c in valid_candidates:
            st = c.get("source_type", "EXCEL")
            auth = cls.get_authority(field_name, st)
            conf = 1.0 if c.get("confidence") == "HIGH" else (0.7 if c.get("confidence") == "MEDIUM" else 0.4)
            scored_candidates.append({
                **c,
                "authority_score": auth,
                "total_score": auth * conf
            })

        # Sort descending by total score
        scored_candidates.sort(key=lambda x: x["total_score"], reverse=True)
        top = scored_candidates[0]

        # Check for top-tier ties with differing values
        top_ties = [c for c in scored_candidates if c["total_score"] == top["total_score"] and str(c["value"]).strip() != str(top["value"]).strip()]

        if top_ties:
            return {
                "status": "CONFLICT",
                "canonical_value": curr,
                "old_value": curr,
                "resolution_reason": f"Conflicting values from equally authoritative sources: '{top['value']}' vs '{top_ties[0]['value']}'",
                "winning_source": None,
                "unresolved_conflicts": scored_candidates
            }

        # Check if top candidate qualifies for auto-resolution
        # Auto-resolve only if authority >= 4 (Gov or Official Website) and confidence is HIGH
        if top["authority_score"] >= 4 and top.get("confidence") == "HIGH":
            return {
                "status": "AUTO_RESOLVED",
                "canonical_value": str(top["value"]).strip(),
                "old_value": curr,
                "resolution_reason": f"Authoritative {top['source_type']} override ({top.get('source_name', 'Registry')})",
                "winning_source": top,
                "unresolved_conflicts": []
            }
        
        # Otherwise send to Admin Review
        return {
            "status": "NEEDS_REVIEW",
            "canonical_value": curr, # Keep current until Admin confirms
            "old_value": curr,
            "resolution_reason": f"Candidate value '{top['value']}' requires administrative confirmation ({top['source_type']})",
            "winning_source": top,
            "unresolved_conflicts": scored_candidates
        }
