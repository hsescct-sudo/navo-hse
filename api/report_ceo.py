"""NAVO · CEO bi-monthly HSSE report and environmental performance report.

Built from the figures the signed-in person sees on the page (kind "ceo" or "env").
Each format tells the same story: headline rates against target, then the detail,
then the method notes. Blank values are shown as "—" (not reported), never as zero.
"""
import io

from docx import Document
from docx.enum.section import WD_ORIENT
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt, RGBColor, Cm
from openpyxl import Workbook
from openpyxl.chart import BarChart, Reference
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from pptx import Presentation
from pptx.chart.data import CategoryChartData
from pptx.dml.color import RGBColor as PRGB
from pptx.enum.chart import XL_CHART_TYPE, XL_LEGEND_POSITION
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.util import Inches, Pt as PPt

NAVY, NAVY2, TEAL, TEAL2 = "0B1A31", "14325C", "16C2AE", "0E9E8E"
RED, GREEN, AMBER, GREY, INK, LINE, PALE = "D23B3F", "1F9D63", "D97706", "5F6F84", "122033", "DFE5EE", "F3F6FA"
FONT = "Arial"


def _v(x, dec=0):
    if x is None or x == "":
        return "—"
    try:
        x = float(x)
    except (TypeError, ValueError):
        return str(x)
    if dec:
        return f"{x:,.{dec}f}"
    return f"{x:,.0f}" if abs(x) >= 1 or x == 0 else f"{x:,.2f}"


def _short(x):
    x = _num(x)
    if x is None:
        return "—"
    if abs(x) >= 1e6:
        return f"{x / 1e6:,.2f}M"
    if abs(x) >= 1e5:
        return f"{x / 1e3:,.0f}k"
    return f"{x:,.0f}" if abs(x) >= 10 or float(x).is_integer() else f"{x:,.1f}"


def _num(x):
    try:
        return None if x is None or x == "" else float(x)
    except (TypeError, ValueError):
        return None


def _rate_status(v, t):
    if v is None or t is None:
        return GREY, "No data"
    return (GREEN, "On target") if v <= t else (RED, "Above target")


# =====================================================================  POWERPOINT
def _prs():
    p = Presentation()
    p.slide_width, p.slide_height = Inches(13.333), Inches(7.5)
    return p


def _rect(s, x, y, w, h, fill, line=None, shape=MSO_SHAPE.RECTANGLE):
    r = s.shapes.add_shape(shape, Inches(x), Inches(y), Inches(w), Inches(h))
    r.fill.solid(); r.fill.fore_color.rgb = PRGB.from_string(fill)
    if line:
        r.line.color.rgb = PRGB.from_string(line)
    else:
        r.line.fill.background()
    r.shadow.inherit = False
    return r


def _txt(s, x, y, w, h, text, size=12, bold=False, color=INK, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP):
    tb = s.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame; tf.word_wrap = True; tf.vertical_anchor = anchor
    tf.margin_left = tf.margin_right = Inches(0.05); tf.margin_top = tf.margin_bottom = Inches(0.02)
    lines = text if isinstance(text, list) else [text]
    for i, ln in enumerate(lines):
        para = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        para.alignment = align
        run = para.add_run(); run.text = str(ln)
        run.font.size = PPt(size); run.font.bold = bold; run.font.name = FONT; run.font.color.rgb = PRGB.from_string(color)
    return tb


def _frame(p, title, sub, footer):
    s = p.slides.add_slide(p.slide_layouts[6])
    _rect(s, 0, 0, 13.333, 7.5, "EEF2F8")
    _rect(s, 0, 0, 13.333, 1.0, NAVY)
    _rect(s, 0, 1.0, 13.333, 0.06, TEAL)
    _txt(s, 0.45, 0.16, 10.5, 0.5, title, 24, True, "FFFFFF")
    if sub:
        _txt(s, 0.45, 0.6, 11, 0.32, sub, 12, False, "A9BDD3")
    _txt(s, 0.45, 7.08, 12.4, 0.3, footer, 9, False, GREY)
    return s


def _table(s, x, y, w, header, rows, widths, size=10.5, row_h=0.34, num_from=1):
    shape = s.shapes.add_table(len(rows) + 1, len(header), Inches(x), Inches(y), Inches(w), Inches(row_h * (len(rows) + 1)))
    t = shape.table
    for i, cw in enumerate(widths):
        t.columns[i].width = Inches(cw)
    for r in range(len(rows) + 1):
        t.rows[r].height = Inches(row_h)
        for c in range(len(header)):
            cell = t.cell(r, c)
            val = header[c] if r == 0 else rows[r - 1][c]
            cell.text = str(val)
            cell.margin_left = cell.margin_right = Inches(0.08)
            cell.vertical_anchor = MSO_ANCHOR.MIDDLE
            para = cell.text_frame.paragraphs[0]
            para.alignment = PP_ALIGN.RIGHT if c >= num_from else PP_ALIGN.LEFT
            run = para.runs[0]
            run.font.size = PPt(size); run.font.name = FONT
            run.font.bold = r == 0 or c == len(header) - 1
            run.font.color.rgb = PRGB.from_string("FFFFFF" if r == 0 else INK)
            cell.fill.solid()
            cell.fill.fore_color.rgb = PRGB.from_string(NAVY2 if r == 0 else ("FFFFFF" if r % 2 else PALE))
    return t


def _bar(s, x, y, w, h, cats, series, colors, stacked=False, legend=True, title=None):
    cd = CategoryChartData(); cd.categories = cats
    for name, vals in series:
        cd.add_series(name, [0 if v is None else v for v in vals])
    kind = XL_CHART_TYPE.COLUMN_STACKED if stacked else XL_CHART_TYPE.COLUMN_CLUSTERED
    ch = s.shapes.add_chart(kind, Inches(x), Inches(y), Inches(w), Inches(h), cd).chart
    ch.has_legend = legend and len(series) > 1
    if ch.has_legend:
        ch.legend.position = XL_LEGEND_POSITION.BOTTOM; ch.legend.include_in_layout = False; ch.legend.font.size = PPt(10)
    ch.has_title = bool(title)
    if title:
        ch.chart_title.text_frame.text = title
        ch.chart_title.text_frame.paragraphs[0].runs[0].font.size = PPt(13)
        ch.chart_title.text_frame.paragraphs[0].runs[0].font.bold = True
    ch.category_axis.tick_labels.font.size = PPt(9)
    ch.value_axis.tick_labels.font.size = PPt(9)
    ch.value_axis.major_gridlines.format.line.color.rgb = PRGB.from_string(LINE)
    for i, ser in enumerate(ch.series):
        ser.format.fill.solid(); ser.format.fill.fore_color.rgb = PRGB.from_string(colors[i % len(colors)])
    return ch


def _card(s, x, y, w, h, label, value, sub, accent):
    _rect(s, x + 0.04, y + 0.06, w, h, "D3DCE8")
    _rect(s, x, y, w, h, "FFFFFF", LINE)
    _rect(s, x, y, w, 0.08, accent)
    _txt(s, x + 0.18, y + 0.2, w - 0.3, 0.3, label, 11, True, GREY)
    _txt(s, x + 0.18, y + 0.5, w - 0.3, 0.7, value, 30 if len(str(value)) <= 7 else 24, True, accent if accent in (RED, GREEN) else INK)
    if sub:
        _txt(s, x + 0.18, y + h - 0.45, w - 0.3, 0.35, sub, 10, False, GREY)


def _cover(p, kicker, title, sub, note):
    s = p.slides.add_slide(p.slide_layouts[6])
    _rect(s, 0, 0, 13.333, 7.5, NAVY)
    _rect(s, 0, 5.6, 13.333, 1.9, "081427")
    _rect(s, 0.7, 1.55, 0.12, 2.1, TEAL)
    _txt(s, 1.05, 1.45, 11, 0.4, kicker, 14, True, "7EE8D8")
    _txt(s, 1.05, 1.9, 11.5, 1.2, title, 40, True, "FFFFFF")
    _txt(s, 1.05, 3.05, 11.5, 0.6, sub, 18, False, "B7C9DF")
    _txt(s, 1.05, 6.0, 11.5, 0.9, note, 11, False, "8FA7C0")
    return s


def ceo_pptx(d):
    p = _prs()
    foot = f"NAVO · {d.get('scopeLabel', '')} · {d.get('monthLabel', '')} · generated {d.get('generated', '')}" + (" · ILLUSTRATIVE DATA" if d.get("sample") else "")
    _cover(p, "CEO BI-MONTHLY HSSE REPORT", d.get("scopeLabel", "Corporation"), f"Reporting month {d.get('monthLabel', '')} · weeks 1–2, weeks 3–4, month and year to date",
           "Safety · Environment · Health & camp · Training · Security · Lifting · CCTV" + ("\nIllustrative data: sample records are included." if d.get("sample") else ""))

    # Headline
    s = _frame(p, "Headline performance", "Year to date against the approved targets", foot)
    rates = d.get("rates") or {}
    tg = rates.get("targets") or {}
    for i, (k, lbl) in enumerate([("ltifr", "LTIFR"), ("trcf", "TRCF"), ("ltisr", "LTISR")]):
        v = _num((rates.get("ytd") or {}).get(k)); t = _num(tg.get(k)); col, st = _rate_status(v, t)
        mv = _num((rates.get("month") or {}).get(k))
        _card(s, 0.5 + i * 4.15, 1.35, 3.9, 1.75, lbl, "—" if v is None else f"{v:.2f}", f"{st} · target {_v(t, 2)} · month {'—' if mv is None else f'{mv:.2f}'}", col)
    for i, (lbl, v) in enumerate(d.get("tiles") or []):
        x = 0.5 + (i % 6) * 2.07
        _card(s, x, 3.35, 1.92, 1.45, lbl, _short(v), "", TEAL2)
    att = d.get("attention") or ["No indicator needs management attention this month."]
    _rect(s, 0.5, 5.05, 12.35, 1.85, "FFFFFF", LINE)
    _txt(s, 0.7, 5.15, 6, 0.35, "Management attention", 14, True, INK)
    _txt(s, 0.7, 5.55, 12, 1.3, ["• " + a for a in att[:5]], 11.5, False, INK)

    # One slide (or two) per section
    for sec in d.get("sections") or []:
        rows = sec.get("rows") or []
        for k in range(0, len(rows), 12):
            chunk = rows[k:k + 12]
            s = _frame(p, sec.get("title", ""), f"{d.get('monthLabel', '')}" + (" · continued" if k else ""), foot)
            _table(s, 0.45, 1.3, 12.4, ["Indicator", "Weeks 1–2", "Weeks 3–4", d.get("monthLabel", "Month"), "YTD"],
                   [[r.get("label", "") + ("  (auto)" if r.get("src") == "auto" else ""), _v(r.get("w1")) if r.get("src") not in ("month", "env") else "month", _v(r.get("w2")) if r.get("src") not in ("month", "env") else "month", _v(r.get("mon")), _v(r.get("ytd"))] for r in chunk],
                   [6.4, 1.45, 1.45, 1.55, 1.55], size=11, row_h=0.42)

    # Environment summary chart
    env = d.get("env") or {}
    if env.get("months"):
        s = _frame(p, "Environmental performance", f"{env.get('year', '')} by month", foot)
        _bar(s, 0.45, 1.3, 6.2, 5.5, env["months"], [("Scope 1 – diesel", env.get("scope1", [])), ("Scope 2 – electricity", env.get("scope2", []))], [AMBER, "2F6FD8"], stacked=True, title="GHG emissions (tCO₂e)")
        _bar(s, 6.75, 1.3, 6.1, 5.5, env["months"], [("Recycled / reused", env.get("diverted", [])), ("Disposed", env.get("disposed", []))], [GREEN, "94A3B8"], stacked=True, title="Waste (t)")

    s = _frame(p, "Method and data rules", "", foot)
    _txt(s, 0.6, 1.4, 12.1, 5.4, ["• " + n for n in (d.get("notes") or [])], 13, False, INK)
    b = io.BytesIO(); p.save(b); return b.getvalue()


def env_pptx(d):
    p = _prs()
    foot = f"NAVO · {d.get('scopeLabel', '')} · {d.get('year', '')} · generated {d.get('generated', '')}" + (" · ILLUSTRATIVE DATA" if d.get("sample") else "")
    _cover(p, "ENVIRONMENTAL PERFORMANCE REPORT", d.get("scopeLabel", "Corporation"), f"{d.get('frequencyLabel', 'Monthly')} report · {d.get('year', '')}",
           "Energy · Emissions · Water · Waste" + ("\nIllustrative data: sample records are included." if d.get("sample") else ""))
    y, ly, tg = d.get("ytd") or {}, d.get("prev") or {}, d.get("targets") or {}
    s = _frame(p, "Year to date against last year and targets", "", foot)
    cards = [("Electricity (kWh)", "electricity", tg.get("elec")), ("Diesel (L)", "diesel", tg.get("diesel")), ("Water (m³)", "water", tg.get("water")), ("GHG (tCO₂e)", "ghg", None)]
    for i, (lbl, k, t) in enumerate(cards):
        v, pv = _num(y.get(k)), _num(ly.get(k))
        ch = (v - pv) / pv * 100 if v is not None and pv else None
        col = GREY if ch is None else (GREEN if (t is not None and ch <= -float(t)) else RED if t is not None else (GREEN if ch <= 0 else RED))
        _card(s, 0.5 + i * 3.1, 1.35, 2.9, 1.75, lbl, _short(v), "No baseline" if ch is None else f"{ch:+.1f}% vs last year" + (f" · target −{t}%" if t is not None else ""), col)
    dv = _num(y.get("diversion")); dt = _num(tg.get("diversion"))
    _card(s, 0.5, 3.35, 2.9, 1.6, "Waste diversion", "—" if dv is None else f"{dv:.1f}%", f"target {_v(dt)}%", GREEN if dv is not None and dt is not None and dv >= dt else RED if dv is not None else GREY)
    it = _num(y.get("intensity"))
    _card(s, 3.6, 3.35, 2.9, 1.6, "Carbon intensity", "—" if it is None else f"{it:,.1f}", "tCO₂e per million man-hours", TEAL2)
    _card(s, 6.7, 3.35, 2.9, 1.6, "Scope 1 (diesel)", _short(y.get("scope1")), "tCO₂e", AMBER)
    _card(s, 9.8, 3.35, 3.05, 1.6, "Scope 2 (electricity)", _short(y.get("scope2")), "tCO₂e", "2F6FD8")
    f = d.get("factors") or {}
    _txt(s, 0.55, 5.25, 12.2, 1.5, [f"Emission factors: grid electricity {f.get('elec')} kg CO₂/kWh · diesel {f.get('diesel')} kg CO₂/L · diesel recorded in tonnes converted at 1,190 L/t.",
                                     "Blank = not reported; zero = confirmed zero. Coverage shows how many project-months reported energy or water data."], 11.5, False, GREY)
    P = d.get("periods") or []
    cats = [r.get("label", "") for r in P]
    if P:
        s = _frame(p, "Energy and water", "", foot)
        _bar(s, 0.45, 1.3, 6.2, 5.5, cats, [("Electricity (kWh)", [_num(r.get("electricity")) for r in P])], [GREEN], title="Electricity (kWh)")
        _bar(s, 6.75, 1.3, 6.1, 5.5, cats, [("Diesel (L)", [_num(r.get("diesel")) for r in P])], [AMBER], title="Diesel (litres)")
        s = _frame(p, "Emissions and waste", "", foot)
        _bar(s, 0.45, 1.3, 6.2, 5.5, cats, [("Scope 1", [_num(r.get("scope1")) for r in P]), ("Scope 2", [_num(r.get("scope2")) for r in P])], [AMBER, "2F6FD8"], stacked=True, title="GHG emissions (tCO₂e)")
        _bar(s, 6.75, 1.3, 6.1, 5.5, cats, [("Water (m³)", [_num(r.get("water")) for r in P])], ["0284C7"], title="Water (m³)")
        for k in range(0, len(P), 12):
            s = _frame(p, "Period summary", "" if not k else "continued", foot)
            _table(s, 0.35, 1.3, 12.6, ["Period", "Electricity kWh", "Diesel L", "Water m³", "Waste div. %", "GHG tCO₂e", "Coverage"],
                   [[r.get("label", ""), _v(r.get("electricity")), _v(r.get("diesel")), _v(r.get("water")), "—" if r.get("diversion") is None else f"{r['diversion']:.1f}%", _v(r.get("ghg"), 1), r.get("coverage", "")] for r in P[k:k + 12]],
                   [2.0, 1.9, 1.8, 1.7, 1.6, 1.8, 1.8], size=11, row_h=0.4)
    b = io.BytesIO(); p.save(b); return b.getvalue()


# =====================================================================  WORD
def _doc(title, sub):
    doc = Document()
    sec = doc.sections[0]
    sec.orientation = WD_ORIENT.LANDSCAPE
    sec.page_width, sec.page_height = sec.page_height, sec.page_width
    for side in ("left_margin", "right_margin", "top_margin", "bottom_margin"):
        setattr(sec, side, Cm(1.6))
    st = doc.styles["Normal"]; st.font.name = FONT; st.font.size = Pt(10)
    h = doc.add_paragraph(); r = h.add_run(title); r.bold = True; r.font.size = Pt(22); r.font.color.rgb = RGBColor.from_string(NAVY)
    s = doc.add_paragraph(); r = s.add_run(sub); r.font.size = Pt(11); r.font.color.rgb = RGBColor.from_string(GREY)
    return doc


def _h(doc, text):
    p = doc.add_paragraph(); p.paragraph_format.space_before = Pt(12)
    r = p.add_run(text.upper()); r.bold = True; r.font.size = Pt(12); r.font.color.rgb = RGBColor.from_string(TEAL2)


def _shade(cell, color):
    tcPr = cell._tc.get_or_add_tcPr(); sh = OxmlElement("w:shd")
    sh.set(qn("w:val"), "clear"); sh.set(qn("w:color"), "auto"); sh.set(qn("w:fill"), color); tcPr.append(sh)


def _dtable(doc, header, rows, widths_cm):
    t = doc.add_table(rows=1, cols=len(header)); t.alignment = WD_TABLE_ALIGNMENT.CENTER; t.style = "Table Grid"
    for i, hd in enumerate(header):
        c = t.rows[0].cells[i]; c.text = ""; r = c.paragraphs[0].add_run(str(hd)); r.bold = True; r.font.color.rgb = RGBColor.from_string("FFFFFF"); r.font.size = Pt(9.5); _shade(c, NAVY2)
    for j, row in enumerate(rows):
        cells = t.add_row().cells
        for i, v in enumerate(row):
            cells[i].text = ""; para = cells[i].paragraphs[0]; r = para.add_run(str(v)); r.font.size = Pt(9.5)
            if i: para.alignment = 2
            if j % 2: _shade(cells[i], PALE)
    for row in t.rows:
        for i, w in enumerate(widths_cm):
            row.cells[i].width = Cm(w)
    return t


def ceo_docx(d):
    doc = _doc("CEO bi-monthly HSSE report", f"{d.get('scopeLabel', '')} · {d.get('monthLabel', '')} · generated {d.get('generated', '')}" + (" · illustrative data" if d.get("sample") else ""))
    rates = d.get("rates") or {}; tg = rates.get("targets") or {}
    _h(doc, "Headline performance (year to date)")
    _dtable(doc, ["Rate", "YTD", "Month", "Target", "Status"],
            [[lbl, _v(_num((rates.get('ytd') or {}).get(k)), 2), _v(_num((rates.get('month') or {}).get(k)), 2), _v(_num(tg.get(k)), 2), _rate_status(_num((rates.get('ytd') or {}).get(k)), _num(tg.get(k)))[1]] for k, lbl in [("ltifr", "LTIFR"), ("trcf", "TRCF"), ("ltisr", "LTISR")]],
            [6, 4, 4, 4, 5])
    _dtable(doc, [t[0] for t in d.get("tiles") or []], [[_v(t[1]) for t in d.get("tiles") or []]], [4] * len(d.get("tiles") or [])) if d.get("tiles") else None
    _h(doc, "Management attention")
    for a in d.get("attention") or ["No indicator needs management attention this month."]:
        doc.add_paragraph(a, style="List Bullet")
    for sec in d.get("sections") or []:
        _h(doc, sec.get("title", ""))
        _dtable(doc, ["Indicator", "Weeks 1–2", "Weeks 3–4", d.get("monthLabel", "Month"), "YTD"],
                [[r.get("label", ""), _v(r.get("w1")) if r.get("src") not in ("month", "env") else "month", _v(r.get("w2")) if r.get("src") not in ("month", "env") else "month", _v(r.get("mon")), _v(r.get("ytd"))] for r in sec.get("rows") or []],
                [11, 3.2, 3.2, 3.4, 3.4])
    _h(doc, "Method and data rules")
    for n in d.get("notes") or []:
        doc.add_paragraph(n, style="List Bullet")
    b = io.BytesIO(); doc.save(b); return b.getvalue()


def env_docx(d):
    doc = _doc("Environmental performance report", f"{d.get('scopeLabel', '')} · {d.get('frequencyLabel', 'Monthly')} · {d.get('year', '')} · generated {d.get('generated', '')}" + (" · illustrative data" if d.get("sample") else ""))
    y, ly, tg = d.get("ytd") or {}, d.get("prev") or {}, d.get("targets") or {}
    _h(doc, "Year to date")
    rows = []
    for lbl, k, t in [("Electricity (kWh)", "electricity", tg.get("elec")), ("Diesel (L)", "diesel", tg.get("diesel")), ("Water (m³)", "water", tg.get("water")), ("GHG emissions (tCO₂e)", "ghg", None), ("Scope 1 (tCO₂e)", "scope1", None), ("Scope 2 (tCO₂e)", "scope2", None)]:
        v, pv = _num(y.get(k)), _num(ly.get(k)); ch = (v - pv) / pv * 100 if v is not None and pv else None
        rows.append([lbl, _v(v, 1 if 'tCO' in lbl else 0), _v(pv, 1 if 'tCO' in lbl else 0), "—" if ch is None else f"{ch:+.1f}%", "—" if t is None else f"−{t}%"])
    dv = _num(y.get("diversion")); rows.append(["Waste diversion (%)", "—" if dv is None else f"{dv:.1f}%", "—" if _num(ly.get("diversion")) is None else f"{_num(ly.get('diversion')):.1f}%", "", f"{tg.get('diversion', '—')}%"])
    _dtable(doc, ["Indicator", "This year", "Last year (same months)", "Change", "Target"], rows, [8, 4, 5, 3, 3])
    _h(doc, "By period")
    _dtable(doc, ["Period", "Electricity kWh", "Diesel L", "Water m³", "Diverted t", "Disposed t", "Diversion %", "GHG tCO₂e", "Coverage"],
            [[r.get("label", ""), _v(r.get("electricity")), _v(r.get("diesel")), _v(r.get("water")), _v(r.get("wasteDiverted"), 1), _v(r.get("wasteDisposed"), 1), "—" if r.get("diversion") is None else f"{r['diversion']:.1f}", _v(r.get("ghg"), 1), r.get("coverage", "")] for r in d.get("periods") or []],
            [3, 3, 3, 3, 2.6, 2.6, 2.4, 3, 2.4])
    f = d.get("factors") or {}
    _h(doc, "Method")
    for n in [f"Grid electricity factor {f.get('elec')} kg CO₂/kWh; diesel {f.get('diesel')} kg CO₂/L; diesel recorded in tonnes converted at 1,190 L/t.",
              "Scope 1 covers diesel; scope 2 covers grid electricity. Other fuels are not included.",
              "Blank = not reported; zero = confirmed zero. Coverage = project-months with energy or water data / project-months in scope.",
              "Waste figures come from the monthly performance data."]:
        doc.add_paragraph(n, style="List Bullet")
    b = io.BytesIO(); doc.save(b); return b.getvalue()


# =====================================================================  EXCEL
_HEAD = PatternFill("solid", fgColor=NAVY2)
_BAND = PatternFill("solid", fgColor=PALE)
_THIN = Border(bottom=Side(style="thin", color=LINE))


def _sheet(ws, title, sub, header, rows, widths, num_fmt="#,##0"):
    ws["A1"] = title; ws["A1"].font = Font(name=FONT, size=15, bold=True, color=NAVY)
    ws["A2"] = sub; ws["A2"].font = Font(name=FONT, size=10, color=GREY)
    for i, hd in enumerate(header, 1):
        c = ws.cell(row=4, column=i, value=hd); c.fill = _HEAD; c.font = Font(name=FONT, bold=True, color="FFFFFF"); c.alignment = Alignment(horizontal="center" if i > 1 else "left", vertical="center", wrap_text=True)
    ws.row_dimensions[4].height = 30
    for j, row in enumerate(rows, 5):
        for i, v in enumerate(row, 1):
            c = ws.cell(row=j, column=i, value=v); c.font = Font(name=FONT, size=10); c.border = _THIN
            if isinstance(v, (int, float)):
                c.number_format = num_fmt; c.alignment = Alignment(horizontal="right")
            if (j - 5) % 2:
                c.fill = _BAND
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = "B5"


def _cell(v):
    n = _num(v)
    return n if n is not None else None


def ceo_xlsx(d):
    wb = Workbook(); ws = wb.active; ws.title = "Headline"
    rates = d.get("rates") or {}; tg = rates.get("targets") or {}
    sub = f"{d.get('scopeLabel', '')} · {d.get('monthLabel', '')} · generated {d.get('generated', '')}" + (" · illustrative data" if d.get("sample") else "")
    rows = [[lbl, _cell((rates.get('ytd') or {}).get(k)), _cell((rates.get('month') or {}).get(k)), _cell(tg.get(k)), _rate_status(_num((rates.get('ytd') or {}).get(k)), _num(tg.get(k)))[1]] for k, lbl in [("ltifr", "LTIFR"), ("trcf", "TRCF"), ("ltisr", "LTISR")]]
    rows += [[]] + [[lbl, _cell(v)] for lbl, v in d.get("tiles") or []]
    _sheet(ws, "CEO bi-monthly HSSE report", sub, ["Indicator", "YTD", "Month", "Target", "Status"], rows, [34, 16, 14, 14, 16], "#,##0.00")
    for sec in d.get("sections") or []:
        w = wb.create_sheet(sec.get("title", "Section")[:28].replace("/", "-").replace("&", "and"))
        _sheet(w, sec.get("title", ""), sub, ["Indicator", "Weeks 1–2", "Weeks 3–4", d.get("monthLabel", "Month"), "YTD", "Source"],
               [[r.get("label", ""), None if r.get("src") in ("month", "env") else _cell(r.get("w1")), None if r.get("src") in ("month", "env") else _cell(r.get("w2")), _cell(r.get("mon")), _cell(r.get("ytd")), {"auto": "Calculated", "month": "Monthly data", "env": "Environmental data"}.get(r.get("src"), "Entered")] for r in sec.get("rows") or []],
               [46, 14, 14, 16, 16, 18], "#,##0.##")
    w = wb.create_sheet("Notes")
    _sheet(w, "Method and data rules", sub, ["Note"], [[n] for n in d.get("notes") or []], [140])
    b = io.BytesIO(); wb.save(b); return b.getvalue()


def env_xlsx(d):
    wb = Workbook(); ws = wb.active; ws.title = "Period summary"
    sub = f"{d.get('scopeLabel', '')} · {d.get('frequencyLabel', 'Monthly')} · {d.get('year', '')} · generated {d.get('generated', '')}" + (" · illustrative data" if d.get("sample") else "")
    P = d.get("periods") or []
    _sheet(ws, "Environmental performance", sub, ["Period", "Electricity (kWh)", "Renewable (kWh)", "Diesel (L)", "Potable water (m³)", "Non-potable water (m³)", "Water total (m³)", "Waste diverted (t)", "Waste disposed (t)", "Diversion (%)", "Scope 1 (tCO₂e)", "Scope 2 (tCO₂e)", "GHG total (tCO₂e)", "Coverage"],
           [[r.get("label", ""), _cell(r.get("electricity")), _cell(r.get("renewable")), _cell(r.get("diesel")), _cell(r.get("waterPotable")), _cell(r.get("waterNonPotable")), _cell(r.get("water")), _cell(r.get("wasteDiverted")), _cell(r.get("wasteDisposed")), _cell(r.get("diversion")), _cell(r.get("scope1")), _cell(r.get("scope2")), _cell(r.get("ghg")), r.get("coverage", "")] for r in P],
           [16, 16, 15, 14, 16, 18, 15, 15, 15, 12, 14, 14, 15, 12], "#,##0.0")
    if P:
        ch = BarChart(); ch.type = "col"; ch.grouping = "stacked"; ch.overlap = 100; ch.title = "GHG emissions (tCO₂e)"; ch.height = 8; ch.width = 18
        ch.add_data(Reference(ws, min_col=11, max_col=12, min_row=4, max_row=4 + len(P)), titles_from_data=True)
        ch.set_categories(Reference(ws, min_col=1, min_row=5, max_row=4 + len(P)))
        ws.add_chart(ch, f"B{len(P) + 7}")
    w = wb.create_sheet("Source data")
    src = d.get("source") or []
    keys = ["project", "month", "electricity", "renewable", "dieselL", "waterPotable", "waterNonPotable", "offset"]
    _sheet(w, "Source data (environmental entries)", sub, ["Project", "Month", "Electricity (kWh)", "Renewable (kWh)", "Diesel (L)", "Potable water (m³)", "Non-potable water (m³)", "Offset (tCO₂e)"],
           [[r.get(k) if k in ("project", "month") else _cell(r.get(k)) for k in keys] for r in src] or [["No environmental entries for this selection"]], [30, 12, 16, 15, 14, 16, 18, 14])
    f = d.get("factors") or {}; tg = d.get("targets") or {}
    w = wb.create_sheet("Notes")
    _sheet(w, "Method", sub, ["Item", "Value"], [["Grid electricity factor (kg CO₂/kWh)", _cell(f.get("elec"))], ["Diesel factor (kg CO₂/L)", _cell(f.get("diesel"))], ["Diesel tonnes to litres", 1190],
                                                ["Electricity reduction target (%)", _cell(tg.get("elec"))], ["Diesel reduction target (%)", _cell(tg.get("diesel"))], ["Water reduction target (%)", _cell(tg.get("water"))], ["Waste diversion target (%)", _cell(tg.get("diversion"))],
                                                ["Rule", "Blank = not reported; zero = confirmed zero. Coverage = project-months with energy or water data / project-months in scope."]], [44, 60], "#,##0.###")
    b = io.BytesIO(); wb.save(b); return b.getvalue()


MIME = {"pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}
BUILD = {("ceo", "pptx"): ceo_pptx, ("ceo", "docx"): ceo_docx, ("ceo", "xlsx"): ceo_xlsx,
         ("env", "pptx"): env_pptx, ("env", "docx"): env_docx, ("env", "xlsx"): env_xlsx}


def make_ceo(kind, fmt, data):
    fn = BUILD.get((kind, fmt))
    if not fn:
        raise ValueError("This report exports as PowerPoint, Word or Excel")
    return fn(data), MIME[fmt]
