"""
Merge freshly scraped Scrapling data into Excel workbooks
"""
import json
import openpyxl

with open("d:/LINKEDSTORY/Projects/scraped_contacts.json", "r", encoding="utf-8") as f:
    scraped_data = json.load(f)

# Load existing validated dataset script and update
from generate_validated_colleges import COLLEGES_DATA, create_validated_excel

updated_count = 0

for item in COLLEGES_DATA:
    college_name = item["name"]
    # Find match in scraped results
    match = None
    for key, data in scraped_data.items():
        if key.lower() in college_name.lower() or college_name.lower() in key.lower():
            match = data
            break
        # Match by domain
        if item.get("website") and item["website"] != "Not Available":
            clean_item_web = item["website"].replace("https://", "").replace("http://", "").replace("www.", "").strip("/")
            clean_match_web = data["base_url"].replace("https://", "").replace("http://", "").replace("www.", "").strip("/")
            if clean_item_web and clean_item_web in clean_match_web or clean_match_web in clean_item_web:
                match = data
                break

    if match:
        if match.get("principal_name") != "Not Available" and item["principal_name"] == "Not Available":
            item["principal_name"] = match["principal_name"]
            updated_count += 1
        if match.get("principal_email") != "Not Available" and item["principal_email"] == "Not Available":
            item["principal_email"] = match["principal_email"]
            updated_count += 1
        if match.get("principal_phone") != "Not Available" and item["principal_phone"] == "Not Available":
            item["principal_phone"] = match["principal_phone"]
            updated_count += 1
        if match.get("general_contact") != "Not Available" and (item["general_contact"] == "Not Available" or "check" in item["general_contact"]):
            item["general_contact"] = match["general_contact"]
            updated_count += 1

print(f"Updated {updated_count} fields with Scrapling scraped data!")

# Regenerate validated spreadsheet
create_validated_excel("d:/LINKEDSTORY/Projects/kanyakumari_colleges_validated.xlsx")
create_validated_excel("d:/LINKEDSTORY/Projects/kanyakumari_colleges.xlsx")
