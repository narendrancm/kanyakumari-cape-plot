"""
URL Health Checker for Kanyakumari Colleges
Checks each stored URL and reports LIVE / DEAD / REDIRECT
"""
import requests
import sys

URLS = [
    # Universities
    ("NICHE", "https://www.niuniv.com"),
    ("Manonmaniam Sundaranar Univ", "https://www.msuniv.ac.in"),
    ("Amrita Vishwa Vidyapeetham", "https://www.amrita.edu"),
    # Medical
    ("Kanyakumari Govt Medical College", "https://www.kgmcri.ac.in"),
    ("Sree Mookambika Inst of Medical Sciences", "https://www.sreevidyanikethan.edu"),  # placeholder
    ("Sarada Krishna Homoeo", "https://www.saradakrishna.org"),
    ("White Memorial Homoeo", "https://www.whitememorial.in"),
    ("Maria Homoeopathic College", "https://www.mariahomeo.com"),
    ("ATSVS Siddha Medical College", "https://www.atsvs.in"),
    ("Sudha Saseendran Siddha", "https://www.sudhasisddha.com"),
    ("Maria Siddha Medical College", "https://www.mariasiddha.com"),
    ("Maria Ayurveda College", "https://www.mariaayurveda.com"),
    ("Immanuel Arasar Ayurveda", "https://www.iaacollege.in"),
    ("Sree Ramakrishna Naturopathy", "https://www.srnys.in"),
    # Dental
    ("Sree Mookambika Inst of Dental Sciences", "https://www.smids.in"),
    # Engineering
    ("Amrita College of Engineering (ACET)", "https://www.acetedu.in"),
    ("UCE Nagercoil (Anna University)", "https://www.ucengl.in"),
    ("St. Xavier's Catholic (SXCCE)", "https://www.sxcce.edu.in"),
    ("Ponjesly College of Engineering", "https://www.ponjesly.com"),
    ("Rohini College of Engineering (RCET)", "https://www.rohinicollege.ac.in"),
    ("Stella Mary's College of Engineering", "https://www.stellamarys.ac.in"),
    ("Arunachala College of Engineering for Women", "https://www.acewkk.ac.in"),
    ("Mar Ephraem College of Engineering", "https://www.mecea.ac.in"),
    ("CSI Institute of Technology (CSIIT)", "https://www.csiit.ac.in"),
    ("AVCE Engineering", "https://www.avcengg.com"),
    ("Maria College of Engineering", "https://www.mariace.ac.in"),
    ("Bethlahem Inst of Engineering", "https://www.bethlahem.ac.in"),
    ("James College of Engineering", "https://www.jamesengg.ac.in"),
    ("Rajas Engineering College", "https://www.rajasengg.ac.in"),
    ("Lord Jegannath College of Engineering", "https://www.lordjengg.ac.in"),
    ("DMI College of Engineering", "https://www.dmice.ac.in"),
    ("Jayamatha Engineering College", "https://www.jayamathaengg.com"),
    ("LITES Engineering", "https://www.litesengg.com"),
    ("Immanuel Arasar JJ Engineering", "https://www.iajjengg.ac.in"),
    ("Narayanaguru College of Engineering", "https://www.ngengg.in"),
    ("Noorul Islam College of Engineering", "https://www.niuniv.com"),
    ("MACET Engineering", "https://www.macet.ac.in"),
    ("Sivaji College of Engineering", "https://www.sivajicollege.ac.in"),
    ("Satyam Engineering", "https://www.satyamengg.com"),
    ("Udaya Engineering", "https://www.udayaengg.ac.in"),
    ("VINS Christian College of Engineering", "https://www.vinscet.ac.in"),
    ("Lourdes Mount College of Engineering", "https://www.lourdesmt.ac.in"),
    ("MET Engineering", "https://www.metengg.ac.in"),
    ("Good Shepherd College of Engineering", "https://www.gsce.ac.in"),
    # Arts & Science
    ("Scott Christian College", "https://www.scottchristiancollege.ac.in"),
    ("Holy Cross College Nagercoil", "https://www.holycrossngl.edu.in"),
    ("ST Hindu College Nagercoil", "https://www.sthindungl.edu.in"),
    ("Women's Christian College Nagercoil", "https://www.wccngl.org"),
    ("Pioneer Kumaraswamy College", "https://www.pkc.ac.in"),
    ("Govt Arts & Science College Konam", "https://www.gasc.edu.in"),
    ("Scott Christian College (Ayyappa Women's)", "https://www.saewc.ac.in"),
    ("NMCC Marthandam", "https://www.nmcc.ac.in"),
    ("Malankara Catholic College", "https://www.mcc.edu.in"),
    ("Annai Velankanni College", "https://www.avc.edu.in"),
    ("Vins Christian College of Arts", "https://www.vincollege.ac.in"),
    ("NICAS Arts College", "https://www.nicas.ac.in"),
    ("Muslim Arts College", "https://www.muslimarts.ac.in"),
    ("Vivekananda College", "https://www.vivekanandacollege.ac.in"),
    ("Sivanthi Aditanar College", "https://www.sivanthicollege.ac.in"),
    ("Lekshmipuram College", "https://www.lekshmipuram.ac.in"),
    ("Udaya Arts College", "https://www.udayaarts.ac.in"),
    ("Bethlahem Arts College", "https://www.bethlahem.ac.in"),
    ("White Memorial Arts College", "https://www.whitememorialarts.ac.in"),
    ("St. Jude's College", "https://www.stjudes.ac.in"),
    ("Anna Vinayagar College", "https://www.annavinayagar.ac.in"),
    ("Infant Jesus Women's College", "https://www.infantjesus.ac.in"),
]

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
}

print(f"{'College':<55} {'URL':<50} STATUS")
print("-" * 130)

results = {}
for name, url in URLS:
    try:
        resp = requests.head(url, headers=headers, timeout=8, allow_redirects=True)
        status = f"LIVE ({resp.status_code})"
        final = resp.url
    except requests.exceptions.ConnectionError:
        status = "DEAD (Connection refused)"
        final = url
    except requests.exceptions.Timeout:
        status = "TIMEOUT"
        final = url
    except Exception as e:
        status = f"ERROR: {e}"
        final = url
    results[name] = {"url": url, "status": status, "final_url": final}
    print(f"{name:<55} {url:<50} {status}")

print("\n\nSUMMARY:")
live = [n for n, r in results.items() if "LIVE" in r["status"]]
dead = [n for n, r in results.items() if "DEAD" in r["status"] or "ERROR" in r["status"] or "TIMEOUT" in r["status"]]
print(f"  LIVE:    {len(live)}")
print(f"  PROBLEM: {len(dead)}")
print(f"  DEAD/TIMEOUT/ERROR sites:")
for n in dead:
    print(f"    - {n}: {results[n]['status']}")
