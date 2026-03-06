import json
import re
from pathlib import Path

import requests


def get_last_semesters():
    latest_semesters_url = (
        "https://michael-maltsev.github.io/technion-calendar-events/latest.json"
    )
    sap_semesters_url = (
        "https://michael-maltsev.github.io/technion-sap-info-fetcher/last_semesters.json"
    )

    latest_semesters = requests.get(latest_semesters_url).json()
    sap_semesters_response = requests.get(sap_semesters_url).json()

    sap_semesters = {}
    for sap_semester in sap_semesters_response:
        semester = str(sap_semester["year"]) + str(
            sap_semester["semester"] - 200 + 1
        ).zfill(2)
        sap_semesters[semester] = {
            "start": sap_semester["start"],
            "end": sap_semester["end"],
        }

    last_semesters = {}
    for semester in sorted(set(latest_semesters) | set(sap_semesters)):
        latest_semester = latest_semesters.get(semester, {})
        sap_semester = sap_semesters.get(semester, {})

        start = latest_semester.get("startDate") or sap_semester.get("start")
        end = latest_semester.get("endDate") or sap_semester.get("end")

        if start is None or end is None:
            continue

        last_semesters[semester] = {
            "start": start,
            "end": end,
            "in_sap": semester in sap_semesters,
        }

    return last_semesters


def get_available_semesters(index_html_path: Path):
    index_html = index_html_path.read_text(encoding="utf-8")

    available_semesters = re.findall(
        r"\bvar availableSemesters = ([^;]*);\n", index_html
    )
    if len(available_semesters) != 1:
        raise RuntimeError("Could not find availableSemesters in index.html")

    return json.loads(available_semesters[0])


def set_available_semesters(index_html_path: Path, available_semesters: dict):
    index_html = index_html_path.read_text(encoding="utf-8")

    available_semesters_str = json.dumps(available_semesters)
    available_semesters_str = re.sub(
        r'\s*("\d{6}_?":)', '\n' + ' ' * 8 + r'\g<1>', available_semesters_str
    )
    available_semesters_str = re.sub(r'\}$', r'\n    \g<0>', available_semesters_str)

    index_html, number_of_subs_made = re.subn(
        r"(\bvar availableSemesters = )[^;]*(;\n)",
        rf"\g<1>{available_semesters_str.replace('\\', '\\\\')}\g<2>",
        index_html,
    )
    if number_of_subs_made != 1:
        raise RuntimeError("Could not set availableSemesters in index.html")

    index_html_path.write_text(index_html, encoding="utf-8")


def main():
    index_html_path = Path("index.html")
    available_semesters = get_available_semesters(index_html_path)
    last_semesters = get_last_semesters()

    available_semesters_original = available_semesters.copy()

    for semester, semester_data in last_semesters.items():
        if semester in available_semesters:
            del available_semesters[semester]
        
        if semester + "_" in available_semesters:
            del available_semesters[semester + "_"]

        if semester_data["in_sap"]:
            key = semester
        else:
            key = semester + "_"

        available_semesters[key] = {
            "start": semester_data["start"],
            "end": semester_data["end"],
        }

    if available_semesters == available_semesters_original:
        print("Nothing to update")
        return

    # Keep the dict sorted by key.
    available_semesters = dict(sorted(available_semesters.items()))

    set_available_semesters(index_html_path, available_semesters)
    print("Updated availableSemesters in index.html")


if __name__ == "__main__":
    main()
