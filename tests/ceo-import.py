"""Builds a small workbook in the client's CEO bi-monthly layout and checks the reader."""
import io, os, sys
from datetime import datetime
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from openpyxl import Workbook
from api.ceo_xlsx import parse

wb = Workbook(); wb.active.title = "Sheet1"; ws = wb.create_sheet("Sheet2")
rows = [["SAFETY ", "YTD (Sep 24)", "1-2 Week", "3-4 Week", "YTD (Oct 24)", "1-2 Week", "3-4 Week"],
        ["Total Manhours Worked ", 100, None, None, 130, 20], ["RTAC", 3, 1, None, 4], ["NCR Major", 0, 2, None, 2, 1], [],
        ["HEALTH, MEDICAL & CAMP", "YTD (Sep 24)", "1-2 Week", "3-4 Week", "YTD (Oct 24)", "1-2 Week", "3-4 Week"],
        ["Camp Audit Performance Index (Internal)", 0.9616, None, None, 0.9618], [],
        ["TRAINING", "YTD (Sep 24)", "1-2 Week", "3-4 Week", "Target", "Completed"], ["IOSH Work Safely", 237, 158, None, 1200, 663], [],
        ["SECURITY", datetime(2024, 9, 1), datetime(2024, 10, 1)], ["Compliance Team Patrols", 1344, 1905], [],
        ["LIFTING", "July to Oct 24", None, None, "YTD (Oct 24)", "1-2 Week", "3-4 Week"], ["Number of completed lift plans", 25, None, None, 25, 2, 2], [],
        ["No. of Observations per Shift", datetime(2024, 8, 1), datetime(2024, 9, 1)], ["Day", 12, 28], ["Night", 6, 12]]
for r in rows:
    ws.append([None] + r)
b = io.BytesIO(); wb.save(b)
d = parse(b.getvalue())
P = d["periods"]
assert P["2024-09"]["opening"]["manhours"] == 100 and P["2024-10"]["opening"]["manhours"] == 130, P
assert P["2024-10"]["h1"]["rtac"] == 1 and P["2024-11"]["h1"]["manhours"] == 20 and P["2024-11"]["h1"]["ncrMajor"] == 1
assert P["2024-10"]["opening"]["campIdxInt"] == 96.18
assert d["targets"]["ioshWSTarget"] == 1200 and d["targets"]["ioshWS"] == 663
assert d["monthly"]["2024-10"]["patrols"] == 1905
assert P["2024-11"]["h2"]["liftPlans"] == 2
assert d["tables"]["obsShift"]["Night"]["2024-09"] == 12
try:
    parse(b"nope"); raise SystemExit("bad file accepted")
except ValueError:
    pass
print("ceo-import ok")
