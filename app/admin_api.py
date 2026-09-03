import os
import sqlite3
import hashlib
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

from fastapi import APIRouter, HTTPException, Depends, Request, Response, status
from fastapi.responses import JSONResponse

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "data", "kanyakumari_education.db")

admin_router = APIRouter(prefix="/api/admin", tags=["Admin CMS"])

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000).hex()

# Authentication & Session Helpers
SESSION_COOKIE_NAME = "edu_cape_session"
SESSION_DURATION_DAYS = 7

def get_current_user(request: Request) -> Dict[str, Any]:
    session_id = request.cookies.get(SESSION_COOKIE_NAME)
    auth_header = request.headers.get("Authorization")
    if not session_id and auth_header and auth_header.startswith("Bearer "):
        session_id = auth_header[7:].strip()

    if not session_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT u.id, u.username, u.full_name, u.role, u.is_active, s.expires_at, s.revoked_at
        FROM admin_sessions s
        JOIN admin_users u ON s.user_id = u.id
        WHERE s.session_id = ?
    """, (session_id,))
    row = cur.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")

    user = dict(row)
    if not user["is_active"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is deactivated")
    if user["revoked_at"] is not None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session has been revoked")
    
    expires_at = datetime.fromisoformat(user["expires_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")

    return user

def require_roles(*allowed_roles: str):
    def role_checker(user: Dict[str, Any] = Depends(get_current_user)):
        if user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied. Required role: {', '.join(allowed_roles)}"
            )
        return user
    return role_checker

# Pydantic Schemas
class LoginRequest(BaseModel):
    username: str
    password: str

class InstitutionUpdateRequest(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    management_type: Optional[str] = None
    location: Optional[str] = None
    principal_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    student_strength: Optional[str] = None
    verification_status: Optional[str] = None
    sources_notes: Optional[str] = None
    acronym: Optional[str] = None
    edit_reason: Optional[str] = "Administrative update via CMS"

class MergeDuplicateRequest(BaseModel):
    source_institution_id: str
    target_institution_id: str
    reason: str

class ConflictResolveRequest(BaseModel):
    selected_value: str
    resolution_reason: str

class CorrectionReviewRequest(BaseModel):
    admin_notes: Optional[str] = "Reviewed and actioned by admin"

# --- Authentication Endpoints ---
@admin_router.post("/login")
def login(req: LoginRequest, response: Response):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id, username, password_hash, salt, full_name, role, is_active FROM admin_users WHERE username = ?", (req.username.strip(),))
    user_row = cur.fetchone()

    if not user_row:
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid username or password")

    user = dict(user_row)
    if not user["is_active"]:
        conn.close()
        raise HTTPException(status_code=403, detail="Account is disabled")

    expected_hash = hash_password(req.password, user["salt"])
    if not secrets.compare_digest(expected_hash, user["password_hash"]):
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # Create session
    session_id = secrets.token_hex(32)
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=SESSION_DURATION_DAYS)

    cur.execute("""
        INSERT INTO admin_sessions (session_id, user_id, expires_at)
        VALUES (?, ?, ?)
    """, (session_id, user["id"], expires_at.isoformat()))

    cur.execute("UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = ?", (user["id"],))
    conn.commit()
    conn.close()

    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_id,
        httponly=True,
        samesite="lax",
        max_age=SESSION_DURATION_DAYS * 86400,
        secure=False # allows localhost dev, will be secure on HTTPS production
    )

    return {
        "status": "success",
        "message": "Authenticated successfully",
        "session_token": session_id,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "full_name": user["full_name"],
            "role": user["role"]
        }
    }

@admin_router.post("/logout")
def logout(response: Response, user: Dict[str, Any] = Depends(get_current_user)):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("UPDATE admin_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ?", (user["id"],))
    conn.commit()
    conn.close()
    response.delete_cookie(SESSION_COOKIE_NAME)
    return {"status": "success", "message": "Logged out successfully"}

@admin_router.get("/me")
def get_me(user: Dict[str, Any] = Depends(get_current_user)):
    return {"user": user}

# --- KPI Dashboard Real-time Stats ---
@admin_router.get("/stats")
def get_admin_stats(user: Dict[str, Any] = Depends(get_current_user)):
    conn = get_db()
    cur = conn.cursor()

    cur.execute("SELECT COUNT(*) FROM schools")
    total_schools = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM colleges")
    total_colleges = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM institutions_master")
    active_institutions = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM colleges WHERE is_active = 0")
    inactive_colleges = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM schools WHERE is_active = 0")
    inactive_schools = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM reconciliation_conflicts WHERE status = 'NEEDS_REVIEW' OR status = 'CONFLICT'")
    pending_conflicts = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM institution_corrections WHERE status = 'PENDING'")
    pending_corrections = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM scraped_evidence WHERE extraction_status != 'WEBSITE_AVAILABLE'")
    unavailable_sites = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM audit_logs")
    total_audit_events = cur.fetchone()[0]

    cur.execute("""
        SELECT COUNT(*) FROM institutions_master 
        WHERE verification_status LIKE '%Verified%'
    """)
    verified_count = cur.fetchone()[0]

    conn.close()
    return {
        "total_all_records": total_schools + total_colleges,
        "active_institutions": active_institutions,
        "schools_count": total_schools,
        "colleges_count": total_colleges,
        "inactive_duplicates": inactive_colleges + inactive_schools,
        "verified_count": verified_count,
        "unverified_count": active_institutions - verified_count,
        "pending_conflicts": pending_conflicts,
        "pending_corrections": pending_corrections,
        "website_unavailable_count": unavailable_sites,
        "total_audit_events": total_audit_events
    }

# --- Institution Management ---
@admin_router.get("/institutions")
def list_institutions(
    q: Optional[str] = None,
    block: Optional[str] = None,
    inst_type: Optional[str] = None,
    status: Optional[str] = None,
    include_inactive: bool = False,
    page: int = 1,
    limit: int = 50,
    user: Dict[str, Any] = Depends(get_current_user)
):
    conn = get_db()
    cur = conn.cursor()
    conditions = []
    params = []

    if not include_inactive:
        conditions.append("COALESCE(is_active, 1) = 1")

    if inst_type:
        conditions.append("institution_type = ?")
        params.append(inst_type)

    if block:
        conditions.append("block = ?")
        params.append(block)

    if q and q.strip():
        search_term = f"%{q.strip()}%"
        conditions.append("(name LIKE ? OR identifier LIKE ? OR principal_name LIKE ? OR acronym LIKE ?)")
        params.extend([search_term, search_term, search_term, search_term])

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    offset = (page - 1) * limit

    cur.execute(f"SELECT COUNT(*) FROM institutions_master {where_clause}", params)
    total = cur.fetchone()[0]

    cur.execute(f"""
        SELECT * FROM institutions_master
        {where_clause}
        ORDER BY id ASC
        LIMIT ? OFFSET ?
    """, params + [limit, offset])
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "institutions": rows
    }

@admin_router.get("/institutions/{inst_id}")
def get_institution_admin_detail(inst_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    conn = get_db()
    cur = conn.cursor()

    is_school = inst_id.startswith("SCH_")
    table = "schools" if is_school else "colleges"

    cur.execute(f"SELECT * FROM {table} WHERE id = ?", (inst_id,))
    inst_row = cur.fetchone()
    if not inst_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Institution not found")

    inst = dict(inst_row)

    # Scraped evidence
    cur.execute("SELECT * FROM scraped_evidence WHERE institution_id = ? ORDER BY id DESC LIMIT 10", (inst_id,))
    evidence = [dict(r) for r in cur.fetchall()]

    # Field verifications
    cur.execute("SELECT * FROM field_verifications WHERE institution_id = ? ORDER BY id DESC", (inst_id,))
    verifications = [dict(r) for r in cur.fetchall()]

    # Audit history
    cur.execute("SELECT * FROM audit_logs WHERE institution_id = ? ORDER BY id DESC LIMIT 25", (inst_id,))
    history = [dict(r) for r in cur.fetchall()]

    conn.close()
    return {
        "institution": inst,
        "institution_type": "school" if is_school else "college",
        "evidence": evidence,
        "field_verifications": verifications,
        "audit_history": history
    }

@admin_router.put("/institutions/{inst_id}")
def update_institution(
    inst_id: str,
    req: InstitutionUpdateRequest,
    user: Dict[str, Any] = Depends(require_roles("SUPER_ADMIN", "DATA_ADMIN"))
):
    conn = get_db()
    cur = conn.cursor()

    is_school = inst_id.startswith("SCH_")
    table = "schools" if is_school else "colleges"

    cur.execute(f"SELECT * FROM {table} WHERE id = ?", (inst_id,))
    current_row = cur.fetchone()
    if not current_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Institution not found")

    current = dict(current_row)
    update_data = req.model_dump(exclude_unset=True)
    edit_reason = update_data.pop("edit_reason", "Admin edit")

    # Map generic principal_name for schools (hm_name) vs colleges (principal_name)
    if "principal_name" in update_data:
        p_name = update_data.pop("principal_name")
        if is_school:
            update_data["hm_name"] = p_name
        else:
            update_data["principal_name"] = p_name

    # Map generic phone for schools (phone) vs colleges (principal_phone)
    if "phone" in update_data:
        ph = update_data.pop("phone")
        if is_school:
            update_data["phone"] = ph
        else:
            update_data["principal_phone"] = ph

    # Map generic email for schools (email) vs colleges (principal_email)
    if "email" in update_data:
        em = update_data.pop("email")
        if is_school:
            update_data["email"] = em
        else:
            update_data["principal_email"] = em

    changes = []
    set_clauses = []
    params = []

    for field, new_val in update_data.items():
        if field in current:
            old_val = str(current[field] or "")
            new_val_str = str(new_val or "")
            if old_val != new_val_str:
                set_clauses.append(f"{field} = ?")
                params.append(new_val)
                changes.append((field, old_val, new_val_str))

    if not changes:
        conn.close()
        return {"status": "no_change", "message": "No values were modified"}

    # Atomic transaction
    params.append(inst_id)
    cur.execute(f"UPDATE {table} SET {', '.join(set_clauses)} WHERE id = ?", params)

    # Insert audit logs
    for field, old_v, new_v in changes:
        cur.execute("""
            INSERT INTO audit_logs (admin_id, admin_username, action, institution_id, field_name, old_value, new_value, source, reason)
            VALUES (?, ?, 'EDIT_FIELD', ?, ?, ?, ?, 'ADMIN_CMS', ?)
        """, (user["id"], user["username"], inst_id, field, old_v, new_v, edit_reason))

    # Sync FTS Virtual Table
    cur.execute("DELETE FROM institutions_fts WHERE id = ?", (inst_id,))
    cur.execute("""
        INSERT INTO institutions_fts (id, name, block, taluk, category, management_type, location, principal_name, phone, email)
        SELECT id, name || ' ' || COALESCE(acronym, ''), block, taluk, category, management_type, location, principal_name, phone, email
        FROM institutions_master WHERE id = ?
    """, (inst_id,))

    conn.commit()
    conn.close()

    return {
        "status": "success",
        "message": f"Successfully updated {len(changes)} field(s)",
        "changes": [{"field": f, "old": o, "new": n} for f, o, n in changes]
    }

# --- Duplicate Management & Merge ---
@admin_router.post("/institutions/merge")
def merge_duplicate(
    req: MergeDuplicateRequest,
    user: Dict[str, Any] = Depends(require_roles("SUPER_ADMIN", "DATA_ADMIN"))
):
    src_id = req.source_institution_id.strip()
    tgt_id = req.target_institution_id.strip()

    if src_id == tgt_id:
        raise HTTPException(status_code=400, detail="Source and target institutions must be different")

    conn = get_db()
    cur = conn.cursor()

    # Determine tables
    src_table = "schools" if src_id.startswith("SCH_") else "colleges"
    tgt_table = "schools" if tgt_id.startswith("SCH_") else "colleges"

    cur.execute(f"SELECT id, name, is_active FROM {src_table} WHERE id = ?", (src_id,))
    src_row = cur.fetchone()
    cur.execute(f"SELECT id, name, is_active FROM {tgt_table} WHERE id = ?", (tgt_id,))
    tgt_row = cur.fetchone()

    if not src_row or not tgt_row:
        conn.close()
        raise HTTPException(status_code=404, detail="One or both institutions not found")

    # Mark source as inactive and link duplicate_of
    cur.execute(f"UPDATE {src_table} SET is_active = 0, duplicate_of = ? WHERE id = ?", (tgt_id, src_id))
    cur.execute("UPDATE institution_metadata SET is_active = 0, duplicate_of = ? WHERE institution_id = ?", (tgt_id, src_id))

    # Log to merge history
    cur.execute("""
        INSERT INTO institution_merge_history (source_institution_id, target_institution_id, reason, merged_by)
        VALUES (?, ?, ?, ?)
    """, (src_id, tgt_id, req.reason, user["username"]))

    # Audit log
    cur.execute("""
        INSERT INTO audit_logs (admin_id, admin_username, action, institution_id, field_name, old_value, new_value, source, reason)
        VALUES (?, ?, 'MERGE_DUPLICATE', ?, 'duplicate_of', NULL, ?, 'ADMIN_CMS', ?)
    """, (user["id"], user["username"], src_id, tgt_id, req.reason))

    # Remove duplicate from FTS search index
    cur.execute("DELETE FROM institutions_fts WHERE id = ?", (src_id,))

    conn.commit()
    conn.close()

    return {
        "status": "success",
        "message": f"Successfully merged {src_id} into canonical {tgt_id}",
        "source": dict(src_row),
        "target": dict(tgt_row)
    }

# --- Citizen Corrections Moderation Queue ---
@admin_router.get("/corrections")
def list_corrections(
    status_filter: Optional[str] = "PENDING",
    user: Dict[str, Any] = Depends(get_current_user)
):
    conn = get_db()
    cur = conn.cursor()
    if status_filter:
        cur.execute("SELECT * FROM institution_corrections WHERE status = ? ORDER BY id DESC", (status_filter,))
    else:
        cur.execute("SELECT * FROM institution_corrections ORDER BY id DESC")
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return {"corrections": rows, "count": len(rows)}

@admin_router.post("/corrections/{corr_id}/approve")
def approve_correction(
    corr_id: int,
    req: CorrectionReviewRequest,
    user: Dict[str, Any] = Depends(require_roles("SUPER_ADMIN", "DATA_ADMIN"))
):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM institution_corrections WHERE id = ?", (corr_id,))
    corr = cur.fetchone()
    if not corr:
        conn.close()
        raise HTTPException(status_code=404, detail="Correction request not found")

    corr = dict(corr)
    inst_id = corr["institution_id"]
    field = corr["field_name"]
    val = corr["suggested_value"]
    is_school = inst_id.startswith("SCH_")
    table = "schools" if is_school else "colleges"

    # Map fields
    col_name = field
    if field == "leadership":
        col_name = "hm_name" if is_school else "principal_name"

    # Update canonical field
    cur.execute(f"UPDATE {table} SET {col_name} = ? WHERE id = ?", (val, inst_id))

    # Mark correction as approved
    cur.execute("""
        UPDATE institution_corrections 
        SET status = 'APPROVED', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ?, admin_notes = ?
        WHERE id = ?
    """, (user["username"], req.admin_notes, corr_id))

    # Audit log
    cur.execute("""
        INSERT INTO audit_logs (admin_id, admin_username, action, institution_id, field_name, old_value, new_value, source, reason)
        VALUES (?, ?, 'APPROVE_CORRECTION', ?, ?, NULL, ?, ?, ?)
    """, (user["id"], user["username"], inst_id, col_name, val, corr["source_proof"], req.admin_notes))

    # Sync FTS
    cur.execute("DELETE FROM institutions_fts WHERE id = ?", (inst_id,))
    cur.execute("""
        INSERT INTO institutions_fts (id, name, block, taluk, category, management_type, location, principal_name, phone, email)
        SELECT id, name || ' ' || COALESCE(acronym, ''), block, taluk, category, management_type, location, principal_name, phone, email
        FROM institutions_master WHERE id = ?
    """, (inst_id,))

    conn.commit()
    conn.close()

    return {"status": "success", "message": f"Approved correction {corr_id} and updated {field} on {inst_id}"}

@admin_router.post("/corrections/{corr_id}/reject")
def reject_correction(
    corr_id: int,
    req: CorrectionReviewRequest,
    user: Dict[str, Any] = Depends(require_roles("SUPER_ADMIN", "DATA_ADMIN"))
):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        UPDATE institution_corrections 
        SET status = 'REJECTED', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ?, admin_notes = ?
        WHERE id = ?
    """, (user["username"], req.admin_notes, corr_id))
    conn.commit()
    conn.close()
    return {"status": "success", "message": f"Rejected correction {corr_id}"}

# --- Asynchronous Scraping Job Queue ---
@admin_router.post("/institutions/{inst_id}/rescrape")
def trigger_rescrape(
    inst_id: str,
    user: Dict[str, Any] = Depends(require_roles("SUPER_ADMIN", "DATA_ADMIN", "VERIFIER"))
):
    conn = get_db()
    cur = conn.cursor()
    is_school = inst_id.startswith("SCH_")
    table = "schools" if is_school else "colleges"
    cur.execute(f"SELECT id, name, website FROM {table} WHERE id = ?", (inst_id,))
    inst = cur.fetchone()
    if not inst:
        conn.close()
        raise HTTPException(status_code=404, detail="Institution not found")

    website = inst["website"]
    if not website or "Not Available" in website:
        conn.close()
        raise HTTPException(status_code=400, detail="Institution has no valid website to crawl")

    job_id = f"SCRAPE_{datetime.now().strftime('%Y%m%d%H%M%S')}_{secrets.token_hex(4)}"
    cur.execute("""
        INSERT INTO scraper_jobs (id, institution_id, source_url, job_type, status)
        VALUES (?, ?, ?, 'SINGLE_INSTITUTION', 'QUEUED')
    """, (job_id, inst_id, website))
    conn.commit()
    conn.close()

    return {
        "status": "QUEUED",
        "job_id": job_id,
        "institution_id": inst_id,
        "source_url": website,
        "message": f"Scraping job enqueued in background. Job ID: {job_id}"
    }

@admin_router.get("/scraper-jobs")
def list_scraper_jobs(user: Dict[str, Any] = Depends(get_current_user)):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM scraper_jobs ORDER BY created_at DESC LIMIT 50")
    jobs = [dict(r) for r in cur.fetchall()]
    conn.close()
    return {"jobs": jobs}

# --- Audit Logs Viewer ---
@admin_router.get("/audit-logs")
def list_audit_logs(
    inst_id: Optional[str] = None,
    limit: int = 100,
    user: Dict[str, Any] = Depends(get_current_user)
):
    conn = get_db()
    cur = conn.cursor()
    if inst_id:
        cur.execute("SELECT * FROM audit_logs WHERE institution_id = ? ORDER BY id DESC LIMIT ?", (inst_id, limit))
    else:
        cur.execute("SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?", (limit,))
    logs = [dict(r) for r in cur.fetchall()]
    conn.close()
    return {"audit_logs": logs, "count": len(logs)}
