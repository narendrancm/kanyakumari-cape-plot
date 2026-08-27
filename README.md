# Cape Plot — Kanyakumari Spatial Explorer

A spatial web application exploring the complete educational landscape of Kanyakumari District, Tamil Nadu, structured across its **Central Kanyakumari Anchor (Agasteeswaram) → 8 Canonical Taluk Blocks → 1,296 Educational Institutions**.

Built using interaction design principles adapted from [Andrew Trousdale](https://andrewtrousdale.com/).

> **Geographic Disclaimer**: *Node positions are schematic within the block. They are not GPS coordinates.*

---

## 🌌 Spatial Model & Interactive Features

The application models Kanyakumari District as a quiet, interactive spatial canvas centered on Kanyakumari:
1. **Central Hub**: **Agasteeswaram / Kanyakumari Hub** anchored at the center `(500, 500)`.
2. **Radial Blocks**: 8 surrounding educational blocks (*Thovalai, Thiruvattar, Melpuram, Munchirai, Killiyoor, Kurunthancode, Rajakkamangalam, Thuckalay*) with generous radial spacing.
3. **Interactive 2D Drag-and-Drop**: Click and drag any block cluster across the 2D plane. All internal school/college nodes translate synchronously, connecting guidelines update dynamically, and custom positions persist in `localStorage`.
4. **Dual Surface (Plot + Index)**:
   - **Plot Surface**: 2D vector canvas with continuous pan/zoom camera (`cubic-bezier(0.16, 1, 0.3, 1)`), hover tooltips, and click-to-zoom.
   - **Index Surface**: Typographic hierarchy grouped by block, displaying institution type, level, management, and location.
5. **Calm Detail Dock**: Slide-in fact sheet with verified Leadership (e.g. **Mrs. Jayasri Reddy**, Principal of Amrita Vidyalayam), clickable phone and email links, official websites, student strength, and data provenance.
6. **Full-Text Search & Exports**: SQLite FTS5 instant filtering and CSV export endpoints.

---

## 🏛️ Dataset Summary

- **Total Schools**: **1,213** (`kanyakumari_schools_verified_enriched_v2.xlsx`)
- **Total Colleges**: **83** (`kanyakumari_colleges_verified_enriched.xlsx`)
- **Total Institutions**: **1,296**
- **Canonical Educational Blocks**: **9 Blocks** (100% mapped, zero unmapped rows)
- **Scrapling Crawler Integration**: Live domain extraction and CBSE SARAS validation via [Scrapling](https://github.com/d4vinci/Scrapling).

---

## 🚀 Quickstart

### 1. Install Dependencies
```bash
pip install fastapi uvicorn pandas openpyxl playwright scrapling
```

### 2. Start the Server
```bash
python -m uvicorn app.server:app --host 127.0.0.1 --port 8000
```

### 3. Open in Browser
Visit: [`http://127.0.0.1:8000/`](http://127.0.0.1:8000/)

---

## 📁 Repository Structure

```
├── app/
│   └── server.py           # FastAPI backend (SQLite, FTS5, CSV export)
├── data/
│   ├── blocks.json         # 9-block layout configuration
│   └── kanyakumari_education.db  # SQLite database
├── static/
│   ├── index.html          # HTML shell
│   ├── css/app.css         # Trousdale styling tokens
│   └── js/app.js           # Client interaction & drag-and-drop engine
├── docs/screenshots/       # Automated browser QA screenshots
├── kanyakumari_schools_verified_enriched_v2.xlsx  # Master schools workbook
└── kanyakumari_colleges_verified_enriched.xlsx   # Master colleges workbook
```
