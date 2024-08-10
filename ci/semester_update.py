import json
import re
from pathlib import Path

import requests


def get_last_semesters():
    last_semesters_url = "https://michael-maltsev.github.io/technion-sap-info-fetcher/last_semesters.json"
    last_semesters_sap = requests.get(last_semesters_url).json()

    last_semesters = {}
    for last_semester in last_semesters_sap:
        semester = str(last_semester["year"]) + str(
            last_semester["semester"] - 200 + 1
        ).zfill(2)
        last_semesters[semester] = {
            "start": last_semester["start"],
            "end": last_semester["end"],
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

    available_semesters_updated = False
    for semester, semester_data in last_semesters.items():
        if semester in available_semesters:
            continue

        if semester + "_" in available_semesters:
            available_semesters[semester] = available_semesters[semester + "_"]
            del available_semesters[semester + "_"]
            available_semesters_updated = True
            continue

        available_semesters[semester] = semester_data
        available_semesters_updated = True

    if not available_semesters_updated:
        print("Nothing to update")
        return

    set_available_semesters(index_html_path, available_semesters)
    print("Updated availableSemesters in index.html")


if __name__ == "__main__":
    main()
