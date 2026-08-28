import os
import sqlite3
import csv
import io
import re
from typing import Optional
from fastapi import FastAPI, Query, HTTPException, Request, Response
from fastapi.responses import HTMLResponse, StreamingResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

app = FastAPI(
    title="Edu-Explore Cape API - Kanyakumari Educational Directory & Spatial Explorer",
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url=None
)

# GZip Compression Middleware
app.add_middleware(GZipMiddleware, minimum_size=1000)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "HEAD", "OPTIONS"],
    allow_headers=["*"],
)

# Production Security Headers Middleware
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()"
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "script-src 'self' 'unsafe-inline'; "
            "connect-src 'self'; "
            "img-src 'self' data: https:; "
            "frame-ancestors 'none';"
        )
        return response

app.add_middleware(SecurityHeadersMiddleware)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "data", "kanyakumari_education.db")
STATIC_DIR = os.path.join(BASE_DIR, "static")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

@app.get("/api/health")
def health_check():
    db_exists = os.path.exists(DB_PATH)
    return {
        "status": "ok",
        "app": "Edu-Explore Cape",
        "district": "Kanyakumari",
        "institutions_total": 1296,
        "database_connected": db_exists,
        "version": "2.0.0"
    }

@app.get("/robots.txt", response_class=Response)
def robots_txt():
    content = """User-agent: *
Allow: /
Sitemap: https://capeedudetails.me/sitemap.xml
"""
    return Response(content=content, media_type="text/plain")

@app.get("/sitemap.xml", response_class=Response)
def sitemap_xml():
    blocks = [
        "Agasteeswaram", "Thovalai", "Rajakkamangalam", "Kurunthancode",
        "Thuckalay", "Thiruvattar", "Killiyoor", "Munchirai", "Melpuram"
    ]
    xml_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        '  <url>',
        '    <loc>https://capeedudetails.me/</loc>',
        '    <changefreq>weekly</changefreq>',
        '    <priority>1.0</priority>',
        '  </url>',
        '  <url>',
        '    <loc>https://capeedudetails.me/?view=index</loc>',
        '    <changefreq>weekly</changefreq>',
        '    <priority>0.9</priority>',
        '  </url>'
    ]
    for b in blocks:
        xml_lines.append('  <url>')
        xml_lines.append(f'    <loc>https://capeedudetails.me/?block={b}</loc>')
        xml_lines.append('    <changefreq>monthly</changefreq>')
        xml_lines.append('    <priority>0.8</priority>')
        xml_lines.append('  </url>')
    xml_lines.append('</urlset>')
    return Response(content="\n".join(xml_lines), media_type="application/xml")

@app.get("/api/blocks")
def get_blocks():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT name, cx, cy, r, taluk, hq, description, school_count, college_count, total_count
        FROM blocks
        ORDER BY name ASC
    """)
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {"blocks": rows, "count": len(rows)}

@app.get("/api/institutions")
def get_institutions(
    block: Optional[str] = None,
    type: Optional[str] = None,
    q: Optional[str] = None,
    category: Optional[str] = None,
    mgmt: Optional[str] = None,
    limit: int = 1500
):
    conn = get_db()
    cursor = conn.cursor()
    conditions = []
    params = []
    
    if q and q.strip():
        search_query = q.strip().replace('"', '').replace("'", "")
        terms = [f"{t}*" for t in search_query.split() if t]
        fts_match = " ".join(terms)
        conditions.append("id IN (SELECT id FROM institutions_fts WHERE institutions_fts MATCH ?)")
        params.append(fts_match)
        
    if block and block.strip():
        conditions.append("block = ?")
        params.append(block.strip())
        
    if type and type.strip() in ['school', 'college']:
        conditions.append("institution_type = ?")
        params.append(type.strip())
        
    if category and category.strip():
        conditions.append("category LIKE ?")
        params.append(f"%{category.strip()}%")
        
    if mgmt and mgmt.strip():
        conditions.append("management_type = ?")
        params.append(mgmt.strip())
        
    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    sql = f"""
        SELECT 
            institution_type, id, identifier, name, block, taluk,
            category, management_type, medium, location, principal_name,
            phone, email, website, student_strength, verification_status,
            sources_notes, schematic_x, schematic_y
        FROM institutions_master
        {where_clause}
        ORDER BY name ASC
        LIMIT ?
    """
    params.append(limit)
    cursor.execute(sql, params)
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    
    return {
        "count": len(rows),
        "filters": {"block": block, "type": type, "q": q, "category": category, "mgmt": mgmt},
        "institutions": rows
    }

@app.get("/api/institutions/{inst_id}")
def get_institution_detail(inst_id: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM institutions_master WHERE id = ?", (inst_id,))
    row = cursor.fetchone()
    
    if not row:
        if inst_id.startswith("SCH_"):
            cursor.execute("SELECT *, hm_name AS principal_name, 'school' as institution_type FROM schools WHERE id = ?", (inst_id,))
        elif inst_id.startswith("COL_"):
            cursor.execute("SELECT *, 'college' as institution_type FROM colleges WHERE id = ?", (inst_id,))
        row = cursor.fetchone()
        
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Institution not found")
        
    res = dict(row)
    if 'hm_name' in res and not res.get('principal_name'):
        res['principal_name'] = res['hm_name']
    return res

@app.get("/api/stats")
def get_stats():
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM schools")
    total_schools = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM colleges")
    total_colleges = cursor.fetchone()[0]
    
    cursor.execute("SELECT management_type, COUNT(*) FROM schools GROUP BY management_type")
    schools_by_mgmt = dict(cursor.fetchall())
    
    cursor.execute("SELECT category, COUNT(*) FROM colleges GROUP BY category")
    colleges_by_cat = dict(cursor.fetchall())
    
    cursor.execute("SELECT block, COUNT(*) FROM institutions_master GROUP BY block")
    by_block = dict(cursor.fetchall())
    
    conn.close()
    return {
        "total_institutions": total_schools + total_colleges,
        "total_schools": total_schools,
        "total_colleges": total_colleges,
        "schools_by_management": schools_by_mgmt,
        "colleges_by_category": colleges_by_cat,
        "by_block": by_block,
        "disclaimer": "Node positions are schematic within the block. They are not GPS coordinates."
    }

def sanitize_csv_cell(val):
    s = str(val or '').strip()
    if s.startswith(('=', '+', '-', '@', '\t', '\r')):
        return f"'{s}"
    return s

@app.get("/api/export/csv")
def export_csv(type: str = "all", block: Optional[str] = None):
    conn = get_db()
    cursor = conn.cursor()
    where = "WHERE block = ?" if block else ""
    params = [block] if block else []
    
    if type == "contacts":
        cursor.execute(f"""
            SELECT 
                institution_type, identifier, name, block, taluk,
                principal_name, phone, email, website, sources_notes
            FROM institutions_master
            {where}
            ORDER BY block ASC, institution_type DESC, name ASC
        """, params)
    else:
        cursor.execute(f"""
            SELECT 
                institution_type, id, identifier, name, block, taluk,
                category, management_type, medium, location, principal_name,
                phone, email, website, student_strength, verification_status,
                sources_notes, schematic_x, schematic_y
            FROM institutions_master
            {where}
            ORDER BY block ASC, institution_type DESC, name ASC
        """, params)
        
    rows = cursor.fetchall()
    conn.close()
    
    output = io.StringIO()
    writer = csv.writer(output)
    if rows:
        writer.writerow(rows[0].keys())
        for r in rows:
            sanitized_row = [sanitize_csv_cell(v) for v in r]
            writer.writerow(sanitized_row)
            
    output.seek(0)
    filename = f"kanyakumari_edu_explore_{type}{'_' + block if block else ''}.csv"
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8-sig')),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

if os.path.exists(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

    @app.get("/")
    def serve_frontend():
        index_file = os.path.join(STATIC_DIR, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        return {"message": "Edu-Explore Cape interface loading"}

# Custom Branded HTML Exception Handlers
@app.exception_handler(404)
async def custom_404_handler(request: Request, exc: HTTPException):
    if request.url.path.startswith("/api/"):
        return JSONResponse(status_code=404, content={"error": "Not Found", "detail": str(exc.detail)})
    html_content = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><title>404 — Page Not Found | Edu-Explore Cape</title>
  <link rel="stylesheet" href="/static/css/app.css">
  <style>
    body { display: flex; align-items: center; justify-content: center; height: 100vh; text-align: center; padding: 20px; }
    .err-box { background: #FFFFFF; border: 1px solid #E4DDD2; padding: 40px; border-radius: 8px; max-width: 480px; box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
    h1 { color: #1F5C57; font-size: 32px; margin-bottom: 8px; }
    p { color: #615C54; font-size: 13px; margin-bottom: 24px; line-height: 1.5; }
    .btn { display: inline-block; background: #1F5C57; color: #FFFFFF; padding: 10px 20px; border-radius: 4px; text-decoration: none; font-size: 12px; font-weight: 600; }
  </style>
</head>
<body class="theme-paper">
  <div class="err-box">
    <h1>404</h1>
    <h2>Entity or Page Not Found</h2>
    <p>The requested educational record, block surface, or URL could not be located in the Kanyakumari district registry.</p>
    <a href="/" class="btn">← Return to Edu-Explore Cape Explorer</a>
  </div>
</body>
</html>"""
    return HTMLResponse(status_code=404, content=html_content)

@app.exception_handler(500)
async def custom_500_handler(request: Request, exc: Exception):
    if request.url.path.startswith("/api/"):
        return JSONResponse(status_code=500, content={"error": "Internal Server Error", "detail": "An unexpected error occurred."})
    html_content = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><title>500 — Server Error | Edu-Explore Cape</title>
  <link rel="stylesheet" href="/static/css/app.css">
  <style>
    body { display: flex; align-items: center; justify-content: center; height: 100vh; text-align: center; padding: 20px; }
    .err-box { background: #FFFFFF; border: 1px solid #E4DDD2; padding: 40px; border-radius: 8px; max-width: 480px; box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
    h1 { color: #D32F2F; font-size: 32px; margin-bottom: 8px; }
    p { color: #615C54; font-size: 13px; margin-bottom: 24px; line-height: 1.5; }
    .btn { display: inline-block; background: #1F5C57; color: #FFFFFF; padding: 10px 20px; border-radius: 4px; text-decoration: none; font-size: 12px; font-weight: 600; }
  </style>
</head>
<body class="theme-paper">
  <div class="err-box">
    <h1>500</h1>
    <h2>Server Error</h2>
    <p>An unexpected error occurred while querying the educational spatial registry. Please try again shortly.</p>
    <a href="/" class="btn">← Return to Edu-Explore Cape</a>
  </div>
</body>
</html>"""
    return HTMLResponse(status_code=500, content=html_content)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
