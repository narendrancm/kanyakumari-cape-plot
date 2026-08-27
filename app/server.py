import os
import sqlite3
import csv
import io
from typing import Optional
from fastapi import FastAPI, Query, HTTPException, Response
from fastapi.responses import HTMLResponse, StreamingResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Cape Plot API - Kanyakumari Spatial Explorer", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "data", "kanyakumari_education.db")
STATIC_DIR = os.path.join(BASE_DIR, "static")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": "Cape Plot", "database": os.path.exists(DB_PATH)}

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
        for r in rows: writer.writerow(list(r))
            
    output.seek(0)
    filename = f"kanyakumari_education_{type}{'_' + block if block else ''}.csv"
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
        return {"message": "Static index not built yet"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
