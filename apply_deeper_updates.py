"""
Update COLLEGES_DATA with the newly uncovered verified websites and contacts,
and regenerate the clean Excel files.
"""

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from generate_validated_colleges import COLLEGES_DATA, create_validated_excel

# Mapping of updates for newly verified colleges
UPDATES = {
    "St. Jude's College, Thoothoor": {
        "website": "http://www.stjudescollege.in",
        "principal_email": "sicthoothoor@yahoo.in",
        "principal_phone": "04651-240715",
        "general_contact": "sicthoothoor@yahoo.in | 04651-240715 / 04651-243215"
    },
    "Muslim Arts College, Kanyakumari": {
        "website": "https://mactvc.edu.in",
        "principal_name": "Dr. G. Edwin Sheela",
        "principal_email": "mail@muslimartscollege.in",
        "principal_phone": "+91 9487114783",
        "general_contact": "mail@muslimartscollege.in | 04651-248397 / 7402735510"
    },
    "Sree Ayyappa Women's College, Nagercoil": {
        "website": "https://sreeayyappacollege.edu.in",
        "principal_email": "ayyappacollege1969@gmail.com",
        "principal_phone": "04652-230980",
        "general_contact": "ayyappacollege1969@gmail.com | 04652-230980 / 9384822334"
    },
    "Bethlahem Institute of Engineering, Karungal": {
        "website": "http://bethlahem.org",
        "principal_email": "principal@bethlahem.org",
        "principal_phone": "04651-285300",
        "general_contact": "principal@bethlahem.org | 04651-285300 / 04651-285301"
    },
    "Jayamatha Engineering College, Kanyakumari": {
        "website": "http://www.jayamatha.org",
        "principal_name": "Dr. R. Uma",
        "principal_email": "principal.jec2016@gmail.com",
        "principal_phone": "+91 99430 25312",
        "general_contact": "jayamathacollege@yahoo.com | 99430 25304 / 99430 25305"
    },
    "Udaya School of Engineering, Vellamodi": {
        "website": "http://www.udayaschoolofengineering.com",
        "principal_email": "978udayaengineering@gmail.com",
        "principal_phone": "04651-239900",
        "general_contact": "978udayaengineering@gmail.com | 04651-239900 / 9281090009"
    },
    "VINS Christian College of Engineering, Nagercoil": {
        "website": "https://vinsengineeringcollege.org",
        "principal_email": "info@vinsengineeringcollege.org",
        "principal_phone": "+91 97877 47072",
        "general_contact": "info@vinsengineeringcollege.org | +91 97877 47072 / 97877 47076"
    },
    "Dr. Jeyasekharan Nursing College, Nagercoil": {
        "website": "https://www.jmtcollegeofnursing.in",
        "principal_email": "info@jmtcollegeofnursing.in",
        "principal_phone": "+91 77089 94976",
        "general_contact": "education@jeyasekharanmedicaltrust.com | +91 77089 94976"
    },
    "White Memorial Homoeopathic Medical College, Karunagapally": {
        "website": "http://www.whitememorialcolleges.com",
        "principal_email": "wmhmc062@gmail.com",
        "principal_phone": "04651-282292",
        "general_contact": "wmhmc062@gmail.com | 04651-282292 / 94420 10093"
    },
    "Maria Ayurveda College, Kanyakumari": {
        "website": "http://www.mariaayurvedacollege.org",
        "principal_email": "mariaayurvedacollege@gmail.com",
        "principal_phone": "+91 9443150352",
        "general_contact": "mariaayurvedacollege@gmail.com | +91 9443150352"
    },
    "MET Engineering College, Nagercoil": {
        "website": "https://metcolleges.in",
        "principal_email": "metec09@gmail.com",
        "principal_phone": "04652-262662",
        "general_contact": "metec09@gmail.com | 04652-262662 / 04652-262789"
    },
    "Sivaji College of Engineering and Technology, Kanyakumari": {
        "website": "https://sivajicollegeofengineering.com",
        "principal_email": "sivajicollege@gmail.com",
        "principal_phone": "0471-2253115",
        "general_contact": "sivajicollege@gmail.com | 0471-2253115 / 94471 27777"
    },
    "Immanuel Arasar JJ College of Engineering, Nagercoil": {
        "website": "http://www.immanuelarasarinstitutions.com",
        "principal_email": "immanuelarasarcollege@gmail.com",
        "principal_phone": "+91 94436 06955",
        "general_contact": "immanuelarasarcollege@gmail.com | +91 94436 06955 / 04651-292368"
    },
    "Good Shepherd College of Engineering and Technology, Kanyakumari": {
        "website": "https://gscet.org",
        "principal_email": "principal@gscet.org",
        "principal_phone": "04651-285100",
        "general_contact": "gscet2018@gmail.com | 04651-285100 / 7373002888"
    },
    "Catherine Booth College of Nursing, Nagercoil": {
        "website": "http://sacbcn.org",
        "principal_email": "salvationarmycon@gmail.com",
        "principal_phone": "04652-272068",
        "general_contact": "salvationarmycon@gmail.com | 04652-272068"
    },
    "National Institute of Co-Operative Arts and Science (NICAS), Kanyakumari": {
        "website": "http://nicollege.com",
        "principal_email": "nicollege2001@yahoo.co.in",
        "principal_phone": "04651-250266",
        "general_contact": "nicollege2001@yahoo.co.in | 04651-250266"
    },
    "Lourdes Mount College of Engineering and Technology": {
        "website": "http://lourdesmountcollege.com",
        "principal_email": "lourdes.mount@gmail.com",
        "principal_phone": "04651-267733",
        "general_contact": "lourdes.mount@gmail.com | 04651-267733"
    },
    "Sivanthi College of Nursing, Nagercoil": {
        "website": "https://sivanthingl.edu.in",
        "principal_email": "drsacon@aei.edu.in",
        "principal_phone": "04652-287251",
        "general_contact": "sivanthi_aditanar@yahoo.com | 04652-287251"
    }
}

updated_items = 0
for item in COLLEGES_DATA:
    name = item["name"]
    for key, val in UPDATES.items():
        if key.lower() in name.lower() or name.lower() in key.lower():
            for field, new_val in val.items():
                item[field] = new_val
                updated_items += 1

print(f"Applied {updated_items} new updates across target colleges!")

# Re-generate both Excel workbooks
create_validated_excel("d:/LINKEDSTORY/Projects/kanyakumari_colleges.xlsx")
create_validated_excel("d:/LINKEDSTORY/Projects/kanyakumari_colleges_validated.xlsx")
