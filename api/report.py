"""NAVO report generator (Vercel Python function).

POST /api/report?fmt=xlsx|docx|pptx with the dashboard JSON built by the page.
Returns a native Office file with real charts. The page only sends data the
signed-in person can already see (Supabase row level security applies first).
"""
import io
import os
os.environ.setdefault("MPLCONFIGDIR", "/tmp/mpl")
import json
from datetime import datetime
from http.server import BaseHTTPRequestHandler

TEAL = "0F4C45"
DARK = "0F3F39"
AMBER = "E8A317"
RED = "C2392F"
GREEN = "2F8A57"
BLUE = "2D6AA6"
GREY = "5D6B67"
LIGHT = "F3F5F4"
FONT = "Arial"


def health_label(s):
    if s is None:
        return "No data"
    if s < 70:
        return "Intervention"
    if s < 80:
        return "Review"
    return "Monitor"


def health_rgb(s):
    if s is None:
        return "9AA5A1"
    if s >= 90:
        return GREEN
    if s >= 80:
        return BLUE
    if s >= 70:
        return "C77A0A"
    return RED


def fmt_pct(v):
    return "—" if v is None else f"{v}%"


def kpi_rows(d):
    k, p = d["kpis"], d.get("prev") or {}
    return [
        ("Average site health", k.get("score"), p.get("score"), "0-100, higher is better"),
        ("Reports", k.get("reports"), p.get("reports"), "All site reports"),
        ("Near misses", k.get("nearMiss"), p.get("nearMiss"), "Reported near misses"),
        ("Incidents", k.get("incidents"), p.get("incidents"), f"{k.get('openInv', 0)} open more than 14 days"),
        ("Action closure on time (%)", k.get("closure"), p.get("closure"), f"{k.get('overdue', 0)} overdue"),
        ("Inspections", k.get("insp"), p.get("insp"), "" if k.get("atRisk") is None else f"{k.get('atRisk')}% items at risk"),
        ("Leadership walkthroughs", k.get("walks"), p.get("walks"), f"Plan {k.get('plan') or 0}"),
    ]


# ---------------------------------------------------------------- Excel
def build_xlsx(d):
    from openpyxl import Workbook
    from openpyxl.chart import BarChart, LineChart, PieChart, Reference
    from openpyxl.chart.label import DataLabelList
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
    from openpyxl.utils import get_column_letter

    wb = Workbook()
    ws = wb.active
    ws.title = "Dashboard"
    thin = Side(style="thin", color="D5DDDA")
    box = Border(left=thin, right=thin, top=thin, bottom=thin)
    hfill = PatternFill("solid", fgColor=TEAL)
    hfont = Font(name=FONT, bold=True, color="FFFFFF")
    base = Font(name=FONT, size=10)

    def header(sheet, row, cols):
        for i, c in enumerate(cols, 1):
            cell = sheet.cell(row=row, column=i, value=c)
            cell.fill, cell.font, cell.border = hfill, hfont, box
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    ws.sheet_view.showGridLines = False
    ws.column_dimensions["A"].width = 32
    for c in "BCDEFGHIJ":
        ws.column_dimensions[c].width = 14
    ws["A1"] = f"NAVO HSE · {d['title']}"
    ws["A1"].font = Font(name=FONT, size=18, bold=True, color=DARK)
    ws["A2"] = f"{d['tier']} dashboard · {d['monthLabel']}{(' · ' + d['country']) if d.get('country') else ''} · {d['projects']} projects · {d['headcount']:,} workers"
    ws["A2"].font = Font(name=FONT, size=10, color=GREY)
    ws["A3"] = f"Generated {d['generated']} from live NAVO records"
    ws["A3"].font = Font(name=FONT, size=9, italic=True, color=GREY)

    header(ws, 5, ["Indicator", "This month", "Last month", "Change", "Note"])
    ws.column_dimensions["E"].width = 34
    for i, (name, cur, prev, note) in enumerate(kpi_rows(d), 6):
        ws.cell(row=i, column=1, value=name).font = Font(name=FONT, bold=True)
        ws.cell(row=i, column=2, value=cur)
        ws.cell(row=i, column=3, value=prev)
        ws.cell(row=i, column=4, value=f'=IF(OR(B{i}="",C{i}=""),"",B{i}-C{i})')
        ws.cell(row=i, column=5, value=note)
        for c in range(1, 6):
            cell = ws.cell(row=i, column=c)
            cell.border = box
            if c in (2, 3, 4):
                cell.alignment = Alignment(horizontal="center")
                cell.number_format = "General"
    ws["B6"].fill = PatternFill("solid", fgColor=health_rgb(d["kpis"].get("score")))
    ws["B6"].font = Font(name=FONT, bold=True, color="FFFFFF")
    ws["A13"] = "Status"
    ws["A13"].font = Font(name=FONT, bold=True)
    ws["B13"] = '=IF(B6="","No data",IF(B6<70,"Intervention",IF(B6<80,"Review","Monitor")))'

    # Children (platforms / businesses / projects)
    kids = d.get("children") or []
    cs = wb.create_sheet(d["childLabel"][:28] or "Breakdown")
    cs.sheet_view.showGridLines = False
    cols = [d["childLabel"], "Projects", "Reports", "Near misses", "Incidents", "Closure on time (%)", "Overdue actions", "Inspections", "Walkthroughs", "Walk plan", "Site health"]
    header(cs, 1, cols)
    cs.column_dimensions["A"].width = 34
    for c in range(2, len(cols) + 1):
        cs.column_dimensions[get_column_letter(c)].width = 14
    for r, c in enumerate(kids, 2):
        vals = [c["name"], c["projects"], c["reports"], c["nearMiss"], c["incidents"], c["closure"], c["overdue"], c["insp"], c["walks"], c["plan"], c["score"]]
        for j, v in enumerate(vals, 1):
            cell = cs.cell(row=r, column=j, value=v)
            cell.border, cell.font = box, base
            if j > 1:
                cell.alignment = Alignment(horizontal="center")
        cs.cell(row=r, column=11).fill = PatternFill("solid", fgColor=health_rgb(c["score"]))
        cs.cell(row=r, column=11).font = Font(name=FONT, bold=True, color="FFFFFF")
    if kids:
        tr = len(kids) + 2
        cs.cell(row=tr, column=1, value="Total / average").font = Font(name=FONT, bold=True)
        for j in (2, 3, 4, 5, 7, 8, 9, 10):
            L = get_column_letter(j)
            cs.cell(row=tr, column=j, value=f"=SUM({L}2:{L}{tr-1})").font = Font(name=FONT, bold=True)
        for j in (6, 11):
            L = get_column_letter(j)
            cs.cell(row=tr, column=j, value=f'=IFERROR(ROUND(AVERAGE({L}2:{L}{tr-1}),1),"")').font = Font(name=FONT, bold=True)
        for j in range(1, 12):
            cs.cell(row=tr, column=j).border = box
            cs.cell(row=tr, column=j).fill = PatternFill("solid", fgColor=LIGHT)
        cs.cell(row=tr + 2, column=1, value="Closure on time and site health are averages of the rows above.").font = Font(name=FONT, size=9, italic=True, color=GREY)

    # Trend
    ts = wb.create_sheet("Trend")
    ts.sheet_view.showGridLines = False
    header(ts, 1, ["Month", "Reports", "Near misses", "Incidents", "Site health"])
    ts.column_dimensions["A"].width = 14
    for r, t in enumerate(d["trend"], 2):
        for j, v in enumerate([t["label"], t["reports"], t["nearMiss"], t["incidents"], t["score"]], 1):
            ts.cell(row=r, column=j, value=v).border = box

    # Categories and mix
    cat = wb.create_sheet("Categories")
    cat.sheet_view.showGridLines = False
    header(cat, 1, ["High-energy category", "Events"])
    cat.column_dimensions["A"].width = 28
    for r, (n, v) in enumerate(d.get("categories") or [], 2):
        cat.cell(row=r, column=1, value=n).border = box
        cat.cell(row=r, column=2, value=v).border = box
    mix_row = max(len(d.get("categories") or []), 1) + 4
    header(cat, mix_row, ["Report type", "Count"])
    for i, (n, v) in enumerate([("Incidents", d["mix"]["incidents"]), ("Hazards", d["mix"]["hazards"]), ("Good practice", d["mix"]["good"])], mix_row + 1):
        cat.cell(row=i, column=1, value=n).border = box
        cat.cell(row=i, column=2, value=v).border = box

    # Overdue actions
    od = wb.create_sheet("Overdue actions")
    od.sheet_view.showGridLines = False
    header(od, 1, ["Action", "Project", "Owner", "Due", "Days overdue", "Priority"])
    od.column_dimensions["A"].width = 48
    od.column_dimensions["B"].width = 30
    od.column_dimensions["C"].width = 18
    for r, a in enumerate(d.get("overdue") or [], 2):
        for j, v in enumerate([a["title"], a["project"], a["owner"], a["due"], a["daysOver"], a["priority"]], 1):
            od.cell(row=r, column=j, value=v).border = box
    if not d.get("overdue"):
        od["A2"] = "No overdue actions."

    # Charts on the dashboard sheet
    def style(ch, title):
        ch.title = title
        ch.style = 10
        ch.height, ch.width = 7.5, 15
        ch.legend = None
        return ch

    n = len(d["trend"])
    bc = style(BarChart(), "Reports, last 6 months")
    bc.add_data(Reference(ts, min_col=2, min_row=1, max_row=n + 1), titles_from_data=True)
    bc.set_categories(Reference(ts, min_col=1, min_row=2, max_row=n + 1))
    bc.series[0].graphicalProperties.solidFill = TEAL
    ws.add_chart(bc, "G5")

    lc = style(LineChart(), "Average site health")
    lc.add_data(Reference(ts, min_col=5, min_row=1, max_row=n + 1), titles_from_data=True)
    lc.set_categories(Reference(ts, min_col=1, min_row=2, max_row=n + 1))
    lc.series[0].graphicalProperties.line.solidFill = AMBER
    lc.series[0].graphicalProperties.line.width = 28000
    lc.series[0].smooth = False
    lc.y_axis.scaling.min, lc.y_axis.scaling.max = 0, 100
    ws.add_chart(lc, "G21")

    if kids:
        kc = style(BarChart(), f"Site health by {d['childLabel'].lower()}")
        kc.type = "bar"
        kc.add_data(Reference(cs, min_col=11, min_row=1, max_row=len(kids) + 1), titles_from_data=True)
        kc.set_categories(Reference(cs, min_col=1, min_row=2, max_row=len(kids) + 1))
        kc.series[0].graphicalProperties.solidFill = BLUE
        kc.x_axis.scaling.orientation = "maxMin"
        kc.y_axis.scaling.min, kc.y_axis.scaling.max = 0, 100
        kc.height = max(7.5, 0.7 * len(kids) + 2)
        ws.add_chart(kc, "A16")

    pc = PieChart()
    pc.title = "Report mix"
    pc.height, pc.width = 7.5, 10
    pc.add_data(Reference(cat, min_col=2, min_row=mix_row, max_row=mix_row + 3), titles_from_data=True)
    pc.set_categories(Reference(cat, min_col=1, min_row=mix_row + 1, max_row=mix_row + 3))
    pc.dataLabels = DataLabelList()
    pc.dataLabels.showPercent = True
    pc.dataLabels.showVal = pc.dataLabels.showCatName = pc.dataLabels.showSerName = pc.dataLabels.showLegendKey = False
    from openpyxl.chart.series import DataPoint
    for i, col in enumerate([RED, "C77A0A", GREEN]):
        pt = DataPoint(idx=i)
        pt.graphicalProperties.solidFill = col
        pc.series[0].dPt.append(pt)
    ws.add_chart(pc, "Q5")

    if d.get("categories"):
        cc = style(BarChart(), "High-energy categories")
        cc.type = "bar"
        cc.add_data(Reference(cat, min_col=2, min_row=1, max_row=len(d["categories"]) + 1), titles_from_data=True)
        cc.set_categories(Reference(cat, min_col=1, min_row=2, max_row=len(d["categories"]) + 1))
        cc.series[0].graphicalProperties.solidFill = RED
        cc.x_axis.scaling.orientation = "maxMin"
        ws.add_chart(cc, "Q21")

    for sheet in wb.worksheets:
        for row in sheet.iter_rows():
            for cell in row:
                if cell.value is not None and cell.font.name != FONT:
                    f = cell.font
                    cell.font = Font(name=FONT, size=f.size or 10, bold=f.bold, italic=f.italic, color=f.color.rgb if f.color is not None and f.color.type == "rgb" else None)
    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


# ---------------------------------------------------------------- chart images for Word
def chart_png(kind, labels, values, title, colors=None, target=None, horizontal=False):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 9})
    fig, ax = plt.subplots(figsize=(6.4, 2.8 if not horizontal else max(2.4, 0.38 * len(labels) + 0.8)), dpi=200)
    if kind == "pie":
        vals = [v for v in values]
        if sum(vals) == 0:
            vals = [1 for _ in vals]
        ax.pie(vals, labels=[f"{l} ({v})" for l, v in zip(labels, values)], colors=colors, startangle=90,
               wedgeprops=dict(width=0.42, edgecolor="white"))
        ax.set_aspect("equal")
    elif kind == "line":
        ys = [float("nan") if v is None else v for v in values]
        ax.plot(labels, ys, color="#" + AMBER, linewidth=2.4, marker="o")
        for x, y in zip(labels, values):
            if y is not None:
                ax.annotate(f"{y:g}", (x, y), textcoords="offset points", xytext=(0, 6), ha="center", fontsize=8)
        ax.set_ylim(0, 105)
    else:
        cols = colors or ["#" + TEAL] * len(values)
        if horizontal:
            ax.barh(labels, values, color=cols)
            ax.invert_yaxis()
            for i, v in enumerate(values):
                ax.text(v, i, f" {v:g}", va="center", fontsize=8)
        else:
            ax.bar(labels, values, color=cols)
            for i, v in enumerate(values):
                ax.text(i, v, f"{v:g}", ha="center", va="bottom", fontsize=8)
    if target is not None and kind != "pie":
        (ax.axvline if horizontal else ax.axhline)(target, color="#" + RED, linestyle="--", linewidth=1)
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    ax.set_title(title, loc="left", fontsize=11, fontweight="bold", color="#" + DARK)
    fig.tight_layout()
    buf = io.BytesIO()
    fig.savefig(buf, format="png")
    plt.close(fig)
    buf.seek(0)
    return buf


# ---------------------------------------------------------------- Word
def build_docx(d):
    from docx import Document
    from docx.enum.table import WD_TABLE_ALIGNMENT
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    from docx.shared import Pt, RGBColor, Cm

    doc = Document()
    sec = doc.sections[0]
    sec.left_margin = sec.right_margin = Cm(2)
    st = doc.styles["Normal"]
    st.font.name, st.font.size = FONT, Pt(10)

    def shade(cell, hexcolor):
        tcPr = cell._tc.get_or_add_tcPr()
        shd = OxmlElement("w:shd")
        shd.set(qn("w:val"), "clear")
        shd.set(qn("w:color"), "auto")
        shd.set(qn("w:fill"), hexcolor)
        tcPr.append(shd)

    def table(rows, head, widths=None, color_col=None):
        t = doc.add_table(rows=1, cols=len(head))
        t.style = "Table Grid"
        t.alignment = WD_TABLE_ALIGNMENT.CENTER
        for i, h in enumerate(head):
            c = t.rows[0].cells[i]
            c.text = ""
            r = c.paragraphs[0].add_run(str(h))
            r.bold, r.font.color.rgb = True, RGBColor(255, 255, 255)
            shade(c, TEAL)
        for row in rows:
            cells = t.add_row().cells
            for i, v in enumerate(row):
                cells[i].text = "—" if v is None else str(v)
            if color_col is not None:
                shade(cells[color_col], health_rgb(row[color_col] if isinstance(row[color_col], (int, float)) else None))
                for p in cells[color_col].paragraphs:
                    for r in p.runs:
                        r.font.color.rgb = RGBColor(255, 255, 255)
                        r.bold = True
        if widths:
            for row in t.rows:
                for i, w in enumerate(widths):
                    row.cells[i].width = Cm(w)
        return t

    def h(text, lvl=1):
        p = doc.add_heading(text, level=lvl)
        for r in p.runs:
            r.font.color.rgb = RGBColor.from_string(DARK)
            r.font.name = FONT

    title = doc.add_paragraph()
    r = title.add_run("NAVO HSE")
    r.bold, r.font.size, r.font.color.rgb = True, Pt(12), RGBColor.from_string(AMBER)
    h(f"{d['title']} · Monthly HSE Report", 0)
    p = doc.add_paragraph()
    p.add_run(f"{d['tier']} level · {d['monthLabel']}{(' · ' + d['country']) if d.get('country') else ''}\n").bold = True
    p.add_run(f"{d['projects']} projects · {d['headcount']:,} workers · generated {d['generated']} from live NAVO records")

    k = d["kpis"]
    h("1. Summary")
    doc.add_paragraph(
        f"Average site health is {k.get('score') if k.get('score') is not None else 'not available'}"
        f" ({health_label(k.get('score'))}). {k.get('reports', 0)} reports were logged this month, including "
        f"{k.get('nearMiss', 0)} near misses and {k.get('incidents', 0)} incidents. "
        f"{fmt_pct(k.get('closure'))} of actions due were closed on time and {k.get('overdue', 0)} actions are overdue."
    )
    table([(n, c, p_, note) for n, c, p_, note in kpi_rows(d)], ["Indicator", "This month", "Last month", "Note"], [6, 2.6, 2.6, 5.8])

    kids = d.get("children") or []
    if kids:
        h(f"2. By {d['childLabel'].lower()}")
        doc.add_picture(chart_png("bar", [c["name"][:22] for c in kids], [c["score"] or 0 for c in kids], f"Site health by {d['childLabel'].lower()}",
                                  colors=["#" + health_rgb(c["score"]) for c in kids], target=80, horizontal=True), width=Cm(16))
        table([(c["name"], c["projects"], c["reports"], c["incidents"], fmt_pct(c["closure"]), c["overdue"], c["score"]) for c in kids],
              [d["childLabel"], "Projects", "Reports", "Incidents", "Closure", "Overdue", "Health"], [5.4, 1.8, 1.8, 1.8, 2, 1.8, 2], color_col=6)

    h("3. Trends")
    labels = [t["label"] for t in d["trend"]]
    doc.add_picture(chart_png("bar", labels, [t["reports"] for t in d["trend"]], "Reports, last 6 months"), width=Cm(16))
    doc.add_picture(chart_png("line", labels, [t["score"] for t in d["trend"]], "Average site health (blank = no records that month)"), width=Cm(16))

    h("4. Risk profile")
    m = d["mix"]
    doc.add_picture(chart_png("pie", ["Incidents", "Hazards", "Good practice"], [m["incidents"], m["hazards"], m["good"]], "Report mix",
                              colors=["#" + RED, "#C77A0A", "#" + GREEN]), width=Cm(11))
    if d.get("categories"):
        cats = d["categories"]
        doc.add_picture(chart_png("bar", [c[0] for c in cats], [c[1] for c in cats], "High-energy categories",
                                  colors=["#" + RED] * len(cats), horizontal=True), width=Cm(16))

    h("5. Overdue actions")
    if d.get("overdue"):
        table([(a["title"], a["project"], a["owner"], a["due"], a["daysOver"]) for a in d["overdue"]],
              ["Action", "Project", "Owner", "Due", "Days over"], [6.5, 4, 2.6, 2, 1.8])
    else:
        doc.add_paragraph("No overdue actions this month.")

    h("6. Review and sign-off")
    table([("Prepared by", "", ""), ("Reviewed by", "", ""), ("Approved by", "", "")], ["Role", "Name", "Signature / date"], [4, 6, 7])
    out = io.BytesIO()
    doc.save(out)
    return out.getvalue()


# ---------------------------------------------------------------- PowerPoint
def build_pptx(d):
    from pptx import Presentation
    from pptx.chart.data import CategoryChartData
    from pptx.dml.color import RGBColor
    from pptx.enum.chart import XL_CHART_TYPE, XL_LEGEND_POSITION, XL_LABEL_POSITION
    from pptx.enum.shapes import MSO_SHAPE
    from pptx.util import Inches, Pt

    prs = Presentation()
    prs.slide_width, prs.slide_height = Inches(13.333), Inches(7.5)
    blank = prs.slide_layouts[6]
    rgb = RGBColor.from_string

    def bg(slide, color):
        f = slide.background.fill
        f.solid()
        f.fore_color.rgb = rgb(color)

    def text(slide, x, y, w, hgt, s, size=18, bold=False, color=DARK, align=None):
        tb = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(hgt))
        tf = tb.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        r = p.add_run()
        r.text = s
        r.font.size, r.font.bold, r.font.name = Pt(size), bold, FONT
        r.font.color.rgb = rgb(color)
        if align:
            p.alignment = align
        return tb

    def title_slide(t, eyebrow):
        s = prs.slides.add_slide(blank)
        bg(s, "F3F5F4")
        text(s, 0.7, 0.45, 12, 0.4, eyebrow.upper(), 13, True, "B47A06")
        text(s, 0.7, 0.8, 12, 0.9, t, 32, True, DARK)
        return s

    def chart(slide, kind, cats, series, x, y, w, hgt, colors=None, legend=False, pct=False):
        cd = CategoryChartData()
        cd.categories = cats
        for name, vals in series:
            cd.add_series(name, vals)
        gf = slide.shapes.add_chart(kind, Inches(x), Inches(y), Inches(w), Inches(hgt), cd)
        ch = gf.chart
        ch.font.size, ch.font.name = Pt(12), FONT
        ch.has_legend = legend
        if legend:
            ch.legend.position = XL_LEGEND_POSITION.RIGHT
            ch.legend.include_in_layout = False
        plot = ch.plots[0]
        plot.has_data_labels = True
        plot.data_labels.font.size = Pt(11)
        if pct:
            plot.data_labels.show_percentage = True
            plot.data_labels.show_value = False
        if colors and kind in (XL_CHART_TYPE.PIE, XL_CHART_TYPE.DOUGHNUT):
            for i, c in enumerate(colors):
                pt = plot.series[0].points[i]
                pt.format.fill.solid()
                pt.format.fill.fore_color.rgb = rgb(c)
        elif colors:
            for i, c in enumerate(colors):
                pt = plot.series[0].points[i]
                pt.format.fill.solid()
                pt.format.fill.fore_color.rgb = rgb(c)
        return ch

    # Cover
    s = prs.slides.add_slide(blank)
    bg(s, DARK)
    text(s, 0.8, 0.7, 6, 0.6, "NAVO HSE", 20, True, AMBER)
    text(s, 0.8, 2.3, 11.5, 1.6, d["title"], 48, True, "F2F5F3")
    text(s, 0.8, 3.9, 11.5, 0.6, f"{d['tier']} HSE report · {d['monthLabel']}{(' · ' + d['country']) if d.get('country') else ''}", 22, False, "BFD8D3")
    text(s, 0.8, 6.5, 11.5, 0.4, f"{d['projects']} projects · {d['headcount']:,} workers · generated {d['generated']} from live NAVO records", 13, False, "BFD8D3")

    # KPI tiles
    s = title_slide("Performance this month", "Summary")
    k, pv = d["kpis"], d.get("prev") or {}
    tiles = [("Site health", k.get("score"), pv.get("score"), True), ("Reports", k.get("reports"), pv.get("reports"), True),
             ("Near misses", k.get("nearMiss"), pv.get("nearMiss"), True), ("Incidents", k.get("incidents"), pv.get("incidents"), False),
             ("Closure on time", k.get("closure"), pv.get("closure"), True), ("Overdue actions", k.get("overdue"), pv.get("overdue"), False),
             ("Inspections", k.get("insp"), pv.get("insp"), True), ("Walkthroughs", k.get("walks"), pv.get("walks"), True)]
    for i, (lab, cur, prev, up_good) in enumerate(tiles):
        x, y = 0.7 + (i % 4) * 3.05, 2.0 + (i // 4) * 2.4
        box = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x), Inches(y), Inches(2.85), Inches(2.1))
        box.adjustments[0] = 0.08
        box.fill.solid()
        box.fill.fore_color.rgb = rgb(health_rgb(cur)) if lab == "Site health" else rgb("FFFFFF")
        box.line.color.rgb = rgb("D5DDDA")
        dark = lab == "Site health"
        text(s, x + 0.2, y + 0.15, 2.5, 0.4, lab.upper(), 12, True, "FFFFFF" if dark else GREY)
        val = "—" if cur is None else (f"{cur}%" if lab == "Closure on time" else f"{cur:g}" if isinstance(cur, (int, float)) else str(cur))
        text(s, x + 0.2, y + 0.55, 2.5, 0.9, val, 40, True, "FFFFFF" if dark else DARK)
        if isinstance(cur, (int, float)) and isinstance(prev, (int, float)) and cur != prev:
            good = (cur > prev) == up_good
            text(s, x + 0.2, y + 1.5, 2.5, 0.4, f"{'▲' if cur > prev else '▼'} {abs(round(cur - prev, 1)):g} vs last month", 12, False,
                 "FFFFFF" if dark else (GREEN if good else RED))

    kids = d.get("children") or []
    if kids:
        s = title_slide(f"Site health by {d['childLabel'].lower()}", "Breakdown")
        ch = chart(s, XL_CHART_TYPE.BAR_CLUSTERED, [c["name"][:28] for c in kids], [("Site health", [c["score"] or 0 for c in kids])],
                   0.7, 1.8, 6.4, 5.3, colors=[health_rgb(c["score"]) for c in kids])
        ch.category_axis.reverse_order = True
        ch.value_axis.maximum_scale, ch.value_axis.minimum_scale = 100, 0
        rows = min(len(kids), 12)
        tbl = s.shapes.add_table(rows + 1, 5, Inches(7.4), Inches(1.8), Inches(5.3), Inches(0.4 * (rows + 1))).table
        for j, hd in enumerate([d["childLabel"], "Reports", "Incidents", "Overdue", "Health"]):
            tbl.cell(0, j).text = hd
        for i, c in enumerate(kids[:rows], 1):
            for j, v in enumerate([c["name"], c["reports"], c["incidents"], c["overdue"], c["score"]]):
                tbl.cell(i, j).text = "—" if v is None else str(v)
        for row in tbl.rows:
            for cell in row.cells:
                for p in cell.text_frame.paragraphs:
                    for r in p.runs:
                        r.font.size, r.font.name = Pt(11), FONT
        tbl.columns[0].width = Inches(2.1)

    s = title_slide("Six-month trend", "Trends")
    labels = [t["label"] for t in d["trend"]]
    ch = chart(s, XL_CHART_TYPE.COLUMN_CLUSTERED, labels, [("Reports", [t["reports"] for t in d["trend"]])], 0.7, 1.8, 6, 5.2, colors=[TEAL] * len(labels))
    ch.has_title = True
    ch.chart_title.text_frame.text = "Reports"
    ch = chart(s, XL_CHART_TYPE.LINE_MARKERS, labels, [("Site health", [t["score"] for t in d["trend"]])], 6.9, 1.8, 5.8, 5.2)
    ch.has_title = True
    ch.chart_title.text_frame.text = "Average site health"
    ch.value_axis.maximum_scale, ch.value_axis.minimum_scale = 100, 0
    ch.plots[0].series[0].format.line.color.rgb = rgb(AMBER)

    s = title_slide("Where the risk is", "Risk profile")
    m = d["mix"]
    chart(s, XL_CHART_TYPE.DOUGHNUT, ["Incidents", "Hazards", "Good practice"], [("Reports", [m["incidents"], m["hazards"], m["good"]])],
          0.7, 1.8, 5.6, 5.2, colors=[RED, "C77A0A", GREEN], legend=True, pct=True)
    cats = d.get("categories") or []
    if cats:
        ch = chart(s, XL_CHART_TYPE.BAR_CLUSTERED, [c[0] for c in cats], [("Events", [c[1] for c in cats])], 6.6, 1.8, 6.1, 5.2, colors=[RED] * len(cats))
        ch.category_axis.reverse_order = True
        ch.has_title = True
        ch.chart_title.text_frame.text = "High-energy categories"
    else:
        text(s, 6.8, 3.5, 5.5, 1, "No high-energy events reported this month.", 18, False, GREY)

    s = title_slide("Overdue actions", "Follow-up")
    od = (d.get("overdue") or [])[:10]
    if od:
        tbl = s.shapes.add_table(len(od) + 1, 5, Inches(0.7), Inches(1.8), Inches(12), Inches(0.42 * (len(od) + 1))).table
        for j, hd in enumerate(["Action", "Project", "Owner", "Due", "Days over"]):
            tbl.cell(0, j).text = hd
        for i, a in enumerate(od, 1):
            for j, v in enumerate([a["title"], a["project"], a["owner"], a["due"], a["daysOver"]]):
                tbl.cell(i, j).text = str(v)
        widths = [5.2, 3.2, 1.6, 1.0, 1.0]
        for j, w in enumerate(widths):
            tbl.columns[j].width = Inches(w)
        for row in tbl.rows:
            for cell in row.cells:
                for p in cell.text_frame.paragraphs:
                    for r in p.runs:
                        r.font.size, r.font.name = Pt(12), FONT
    else:
        text(s, 0.7, 2.2, 12, 1, "No overdue actions this month.", 24, False, GREEN)

    out = io.BytesIO()
    prs.save(out)
    return out.getvalue()


BUILDERS = {
    "xlsx": (build_xlsx, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    "docx": (build_docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    "pptx": (build_pptx, "application/vnd.openxmlformats-officedocument.presentationml.presentation"),
}




# ---------------- Executive summary (Corporation / Construction / Non-Construction) ----------------
NAVY = "0B4F3C"


def _n(v, dec=0):
    if v is None:
        return "—"
    try:
        v = float(v)
    except Exception:
        return str(v)
    if abs(v) >= 1e6:
        return f"{v/1e6:.2f}M"
    return f"{v:,.{dec}f}"


def _exec_rows(d):
    c, p = d.get("cur", {}), d.get("prev", {})
    rows = [("Fatalities", "fat", 0), ("Lost time injuries", "lti", 0), ("Total recordable cases", "trc", 0), ("First aid cases", "fac", 0),
            ("Near misses", "nm", 0), ("Lost workdays", "lost", 0)]
    lead = [("Inspections", "insp", 0), ("Walkthroughs", "walks", 0), ("Safety observations", "obs", 0), ("Training hours", "trainH", 0),
            ("Training completion %", "trainPct", 0), ("Audits", "audits", 0), ("Critical control checks", "cc", 0), ("Emergency drills", "drills", 0)]
    acts = [("Total actions", "acts", 0), ("Open", "open", 0), ("Closed", "closed", 0), ("Overdue", "over", 0), ("Closure %", "closePct", 0),
            ("High priority", "crit", 0), ("Avg. days to close", "avgClose", 1)]
    work = [("Total projects", "projects", 0), ("Active projects", "active", 0), ("Total manpower", "manpower", 0), ("Man-hours (latest month)", "monthHours", 0),
            ("Cumulative man-hours", "hours", 0)]
    f = lambda L: [(lbl, _n(c.get(k), dec), _n(p.get(k), dec)) for lbl, k, dec in L]
    return f(work), f(rows), f(lead), f(acts)


def build_exec_pptx(d):
    from pptx import Presentation
    from pptx.util import Inches, Pt
    from pptx.dml.color import RGBColor
    from pptx.chart.data import CategoryChartData
    from pptx.enum.chart import XL_CHART_TYPE, XL_LEGEND_POSITION
    from pptx.enum.shapes import MSO_SHAPE
    prs = Presentation()
    prs.slide_width, prs.slide_height = Inches(13.333), Inches(7.5)
    blank = prs.slide_layouts[6]
    rgb = lambda h: RGBColor.from_string(h)
    tg, c, p = d.get("targets", {}), d.get("cur", {}), d.get("prev", {})

    def text(s, x, y, w, h, t, size=14, bold=False, color="252423", align=None):
        tb = s.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
        tf = tb.text_frame
        tf.word_wrap = True
        para = tf.paragraphs[0]
        para.text = str(t)
        para.font.size, para.font.bold, para.font.name = Pt(size), bold, FONT
        para.font.color.rgb = rgb(color)
        if align:
            para.alignment = align
        return tb

    def frame(title):
        s = prs.slides.add_slide(blank)
        bar = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, Inches(0.9))
        bar.fill.solid(); bar.fill.fore_color.rgb = rgb(NAVY); bar.line.fill.background()
        text(s, 0.4, 0.15, 10, 0.6, title, 24, True, "FFFFFF")
        text(s, 9.3, 0.25, 3.8, 0.5, d.get("period", ""), 14, False, "D9F2E6")
        foot = f'{d.get("brand","NAVO")} · {d.get("title","")} · {d.get("country","")} · generated {d.get("generated","")}'
        if d.get("illustrative"):
            foot += " · ILLUSTRATIVE DATA – not verified company performance"
        text(s, 0.4, 7.05, 12.5, 0.35, foot, 9, False, "8A8886")
        return s

    def table(s, x, y, w, rows, head, colw=None):
        t = s.shapes.add_table(len(rows) + 1, len(head), Inches(x), Inches(y), Inches(w), Inches(0.32 * (len(rows) + 1))).table
        for j, hd in enumerate(head):
            cell = t.cell(0, j); cell.text = hd
            cell.fill.solid(); cell.fill.fore_color.rgb = rgb(NAVY)
            pr = cell.text_frame.paragraphs[0]; pr.font.size = Pt(11); pr.font.bold = True; pr.font.color.rgb = rgb("FFFFFF"); pr.font.name = FONT
        for i, r in enumerate(rows, 1):
            for j, v in enumerate(r):
                cell = t.cell(i, j); cell.text = str(v)
                cell.fill.solid(); cell.fill.fore_color.rgb = rgb("FFFFFF" if i % 2 else "F2F6F4")
                pr = cell.text_frame.paragraphs[0]; pr.font.size = Pt(10.5); pr.font.name = FONT
        if colw:
            for j, cw in enumerate(colw):
                t.columns[j].width = Inches(cw)
        return t

    # 1. cover
    s = prs.slides.add_slide(blank)
    bg = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, prs.slide_height)
    bg.fill.solid(); bg.fill.fore_color.rgb = rgb(NAVY); bg.line.fill.background()
    text(s, 0.8, 2.2, 11.5, 1.2, d.get("title", "Executive Summary"), 40, True, "FFFFFF")
    text(s, 0.8, 3.4, 11.5, 0.6, f'HSE performance · {d.get("period","")} · compared with {d.get("prevPeriod","")}', 18, False, "D9F2E6")
    text(s, 0.8, 4.0, 11.5, 0.6, d.get("country", ""), 14, False, "D9F2E6")
    if d.get("illustrative"):
        text(s, 0.8, 5.2, 11.5, 0.6, "ILLUSTRATIVE DATA – figures are generated sample records, not verified company performance", 13, True, "F5B82E")
    text(s, 0.8, 6.6, 11.5, 0.5, f'{d.get("brand","NAVO")} HSE · generated {d.get("generated","")}', 12, False, "B8D8CC")

    # 2. KPIs actual vs target
    s = frame("Safety performance · actual vs target")
    mult = d.get("mult", 1000000)
    for i, (lbl, k) in enumerate([("LTIFR", "ltifr"), ("LTISR", "ltisr"), ("TRCF", "trcf")]):
        act, t = float(c.get(k) or 0), float(tg.get(k) or 0)
        ok = act <= t
        box = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.5 + i * 4.2), Inches(1.2), Inches(3.9), Inches(1.9))
        box.fill.solid(); box.fill.fore_color.rgb = rgb("E6F5EC" if ok else "FDECEC"); box.line.color.rgb = rgb(GREEN if ok else RED)
        col = "1E7A3C" if ok else "B3261E"
        text(s, 0.7 + i * 4.2, 1.3, 3.5, 0.4, lbl, 16, True, col)
        text(s, 0.7 + i * 4.2, 1.7, 3.5, 0.8, f"{act:.2f}", 40, True, col)
        text(s, 0.7 + i * 4.2, 2.55, 3.5, 0.4, f'Target {t:.2f} · previous {float(p.get(k) or 0):.2f}', 12, False, "444444")
    cd = CategoryChartData(); cd.categories = ["LTIFR", "LTISR", "TRCF"]
    cd.add_series("Actual", [float(c.get(k) or 0) for k in ("ltifr", "ltisr", "trcf")])
    cd.add_series("Target", [float(tg.get(k) or 0) for k in ("ltifr", "ltisr", "trcf")])
    ch = s.shapes.add_chart(XL_CHART_TYPE.COLUMN_CLUSTERED, Inches(0.5), Inches(3.3), Inches(7.5), Inches(3.6), cd).chart
    ch.has_legend = True; ch.legend.position = XL_LEGEND_POSITION.BOTTOM; ch.legend.include_in_layout = False
    ch.plots[0].has_data_labels = True; ch.plots[0].data_labels.number_format = "0.00"; ch.plots[0].data_labels.number_format_is_linked = False
    ch.series[0].format.fill.solid(); ch.series[0].format.fill.fore_color.rgb = rgb(NAVY)
    ch.series[1].format.fill.solid(); ch.series[1].format.fill.fore_color.rgb = rgb("F5B82E")
    text(s, 8.3, 3.4, 4.6, 3.4, f"Rates per {int(mult):,} man-hours.\n\nLTIFR = lost time injuries × {int(mult):,} ÷ man-hours\nLTISR = lost workdays × {int(mult):,} ÷ man-hours\nTRCF = recordable cases (LTI + RWC + MTC) × {int(mult):,} ÷ man-hours\n\nInjury-free man-hours: {_n(d.get('safeHours'))}", 12, False, "333333")

    work, lag, lead, acts = _exec_rows(d)
    # 3. Workforce, lagging, leading
    s = frame("Workforce, safety statistics and leading indicators")
    table(s, 0.4, 1.15, 4.1, work + lag, ["Indicator", "Current", "Previous"], [2.3, 0.9, 0.9])
    table(s, 4.8, 1.15, 4.0, lead, ["Leading indicator", "Current", "Previous"], [2.2, 0.9, 0.9])
    table(s, 9.1, 1.15, 3.9, acts, ["Corrective actions", "Current", "Previous"], [2.1, 0.9, 0.9])

    # 4. trend + actions
    s = frame("Monthly performance trend")
    months = d.get("months", [])
    cd = CategoryChartData(); cd.categories = months
    cd.add_series("Recordable cases (previous year)", [v or 0 for v in d.get("trendTrcPrev", [])])
    cd.add_series("Recordable cases (this year)", [v or 0 for v in d.get("trendTrc", [])])
    ch = s.shapes.add_chart(XL_CHART_TYPE.COLUMN_CLUSTERED, Inches(0.4), Inches(1.1), Inches(7.6), Inches(2.9), cd).chart
    ch.has_legend = True; ch.legend.position = XL_LEGEND_POSITION.BOTTOM; ch.legend.include_in_layout = False
    ch.series[0].format.fill.solid(); ch.series[0].format.fill.fore_color.rgb = rgb("B9C7E4")
    ch.series[1].format.fill.solid(); ch.series[1].format.fill.fore_color.rgb = rgb(NAVY)
    cd = CategoryChartData(); cd.categories = months
    cd.add_series("LTIFR", [v or 0 for v in d.get("trendLtifr", [])]); cd.add_series("Target", [float(tg.get("ltifr") or 0)] * len(months))
    ch = s.shapes.add_chart(XL_CHART_TYPE.LINE_MARKERS, Inches(0.4), Inches(4.05), Inches(7.6), Inches(2.9), cd).chart
    ch.has_legend = True; ch.legend.position = XL_LEGEND_POSITION.BOTTOM; ch.legend.include_in_layout = False
    cd = CategoryChartData(); cd.categories = ["Closed", "Open, on time", "Overdue"]
    cd.add_series("Actions", [c.get("closed") or 0, max(0, (c.get("open") or 0) - (c.get("over") or 0)), c.get("over") or 0])
    ch = s.shapes.add_chart(XL_CHART_TYPE.DOUGHNUT, Inches(8.3), Inches(1.1), Inches(4.7), Inches(4.2), cd).chart
    ch.has_legend = True; ch.legend.position = XL_LEGEND_POSITION.BOTTOM; ch.legend.include_in_layout = False
    ch.plots[0].has_data_labels = True
    for i, col in enumerate([GREEN, BLUE, RED]):
        pt = ch.plots[0].series[0].points[i]; pt.format.fill.solid(); pt.format.fill.fore_color.rgb = rgb(col)
    text(s, 8.3, 5.4, 4.7, 1.4, f'Action closure {c.get("closePct") if c.get("closePct") is not None else "—"}% · {c.get("over",0)} overdue · average {c.get("avgClose") or "—"} days to close', 13, True, "333333")

    # 5. divisions
    s = frame("Division comparison")
    divs = d.get("divisions", [])[:14]
    table(s, 0.4, 1.15, 12.5, [(x["name"], _n(x["hours"]), f'{x["ltifr"]:.2f}', f'{x["trcf"]:.2f}', x["lti"], x["trc"], x["insp"], "—" if x["closure"] is None else f'{x["closure"]}%') for x in divs],
          ["Division", "Man-hours", "LTIFR", "TRCF", "LTI", "Recordables", "Inspections", "Action closure"], [3.3, 1.5, 1.1, 1.1, 1.0, 1.4, 1.4, 1.7])

    # 6. projects + risk
    s = frame("Project ranking and critical risk distribution")
    pr = d.get("projects", [])[:12]
    table(s, 0.4, 1.15, 7.4, [(i + 1, x["name"], x["division"], f'{x["trcf"]:.2f}', x["over"]) for i, x in enumerate(pr)], ["#", "Project", "Division", "TRCF", "Overdue actions"], [0.4, 3.0, 1.8, 0.9, 1.3])
    risk = d.get("risk", [])
    if risk:
        cd = CategoryChartData(); cd.categories = [r[0] for r in risk]; cd.add_series("Reports", [r[1] for r in risk])
        ch = s.shapes.add_chart(XL_CHART_TYPE.BAR_CLUSTERED, Inches(8.1), Inches(1.15), Inches(4.9), Inches(5.6), cd).chart
        ch.has_legend = False; ch.plots[0].has_data_labels = True
        ch.series[0].format.fill.solid(); ch.series[0].format.fill.fore_color.rgb = rgb(NAVY)
    out = io.BytesIO(); prs.save(out); return out.getvalue()


def build_exec_pdf(d):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.backends.backend_pdf import PdfPages
    from matplotlib.patches import FancyBboxPatch, Rectangle
    tg, c, p = d.get("targets", {}), d.get("cur", {}), d.get("prev", {})
    navy, red, green = "#" + NAVY, "#B3261E", "#1E7A3C"
    out = io.BytesIO()
    foot = f'{d.get("brand","NAVO")} · {d.get("title","")} · {d.get("country","")} · generated {d.get("generated","")}' + (" · ILLUSTRATIVE DATA – not verified company performance" if d.get("illustrative") else "")

    def page(title):
        fig = plt.figure(figsize=(11.69, 8.27), dpi=150)
        fig.patches.append(Rectangle((0, .92), 1, .08, transform=fig.transFigure, color=navy, zorder=-1))
        fig.text(.03, .945, title, color="white", fontsize=18, weight="bold", va="center")
        fig.text(.97, .945, d.get("period", ""), color="#D9F2E6", fontsize=12, ha="right", va="center")
        fig.text(.03, .02, foot, color="#8A8886", fontsize=7.5)
        return fig

    def tbl(fig, rect, rows, head, cw=None):
        ax = fig.add_axes(rect); ax.axis("off")
        t = ax.table(cellText=[[str(v) for v in r] for r in rows] or [["—"] * len(head)], colLabels=head, loc="upper center", cellLoc="left", colWidths=cw)
        t.auto_set_font_size(False); t.set_fontsize(8.5); t.scale(1, 1.35)
        for (i, j), cell in t.get_celld().items():
            cell.set_edgecolor("#DDDDDD")
            if i == 0:
                cell.set_facecolor(navy); cell.get_text().set_color("white"); cell.get_text().set_weight("bold")
            elif i % 2 == 0:
                cell.set_facecolor("#F2F6F4")

    with PdfPages(out) as pdf:
        # cover + KPI tiles
        fig = page(d.get("title", "Executive Summary"))
        fig.text(.03, .86, f'HSE performance · {d.get("period","")} compared with {d.get("prevPeriod","")} · {d.get("country","")}', fontsize=12, color="#333333")
        if d.get("illustrative"):
            fig.text(.03, .82, "ILLUSTRATIVE DATA – generated sample records, not verified company performance", fontsize=10, color="#9A6B00", weight="bold")
        for i, (lbl, k) in enumerate([("LTIFR", "ltifr"), ("LTISR", "ltisr"), ("TRCF", "trcf")]):
            act, t = float(c.get(k) or 0), float(tg.get(k) or 0); ok = act <= t; col = green if ok else red
            x = .03 + i * .32
            fig.patches.append(FancyBboxPatch((x, .55), .3, .22, boxstyle="round,pad=0.005", transform=fig.transFigure, facecolor="#E6F5EC" if ok else "#FDECEC", edgecolor=col))
            fig.text(x + .015, .735, lbl, fontsize=14, weight="bold", color=col)
            fig.text(x + .015, .63, f"{act:.2f}", fontsize=34, weight="bold", color=col)
            fig.text(x + .015, .575, f'Target {t:.2f} · previous {float(p.get(k) or 0):.2f}', fontsize=10, color="#444444")
        mult = int(d.get("mult", 1000000))
        fig.text(.03, .5, f"Rates per {mult:,} man-hours. LTIFR = lost time injuries × {mult:,} ÷ man-hours · LTISR = lost workdays × {mult:,} ÷ man-hours · TRCF = recordable cases × {mult:,} ÷ man-hours.", fontsize=8.5, color="#555555")
        work, lag, lead, acts = _exec_rows(d)
        tbl(fig, [.03, .06, .3, .4], work + lag, ["Indicator", "Current", "Previous"], [.55, .22, .23])
        tbl(fig, [.36, .06, .3, .4], lead, ["Leading indicator", "Current", "Previous"], [.55, .22, .23])
        tbl(fig, [.69, .06, .28, .4], acts, ["Corrective actions", "Current", "Previous"], [.55, .22, .23])
        pdf.savefig(fig); plt.close(fig)
        # trends
        fig = page("Monthly performance trend")
        months = d.get("months", []); xs = range(len(months))
        ax = fig.add_axes([.06, .53, .55, .33])
        ax.bar([x - .2 for x in xs], [v or 0 for v in d.get("trendTrcPrev", [])], .4, color="#B9C7E4", label="Recordables previous year")
        ax.bar([x + .2 for x in xs], [v or 0 for v in d.get("trendTrc", [])], .4, color=navy, label="Recordables this year")
        ax.set_xticks(list(xs)); ax.set_xticklabels(months, fontsize=8); ax.legend(fontsize=8, frameon=False); ax.spines[["top", "right"]].set_visible(False)
        ax = fig.add_axes([.06, .1, .55, .33])
        ax.plot(list(xs), [v if v is not None else float("nan") for v in d.get("trendLtifr", [])], marker="o", color="#E66C37", label="LTIFR")
        ax.axhline(float(tg.get("ltifr") or 0), color=red, ls="--", label="Target")
        ax.set_xticks(list(xs)); ax.set_xticklabels(months, fontsize=8); ax.legend(fontsize=8, frameon=False); ax.spines[["top", "right"]].set_visible(False)
        ax = fig.add_axes([.67, .45, .3, .4])
        vals = [c.get("closed") or 0, max(0, (c.get("open") or 0) - (c.get("over") or 0)), c.get("over") or 0]
        if sum(vals):
            ax.pie(vals, labels=["Closed", "Open, on time", "Overdue"], colors=[green, "#2D6AA6", red], wedgeprops=dict(width=.38), autopct="%1.0f%%", textprops=dict(fontsize=8))
        ax.set_title("Corrective actions", fontsize=11)
        fig.text(.67, .38, f'Closure {c.get("closePct") if c.get("closePct") is not None else "—"}% · {c.get("over",0)} overdue\nAverage {c.get("avgClose") or "—"} days to close · {c.get("crit",0)} high priority', fontsize=10)
        pdf.savefig(fig); plt.close(fig)
        # divisions + projects + risk
        fig = page("Divisions, projects and critical risks")
        divs = d.get("divisions", [])[:14]
        tbl(fig, [.03, .47, .94, .42], [(x["name"], _n(x["hours"]), f'{x["ltifr"]:.2f}', f'{x["trcf"]:.2f}', x["lti"], x["trc"], x["insp"], "—" if x["closure"] is None else f'{x["closure"]}%') for x in divs],
            ["Division", "Man-hours", "LTIFR", "TRCF", "LTI", "Recordables", "Inspections", "Action closure"], [.24, .12, .09, .09, .08, .12, .12, .14])
        pr = d.get("projects", [])[:10]
        tbl(fig, [.03, .05, .55, .38], [(i + 1, x["name"], x["division"], f'{x["trcf"]:.2f}', x["over"]) for i, x in enumerate(pr)], ["#", "Project", "Division", "TRCF", "Overdue"], [.06, .44, .24, .12, .14])
        risk = d.get("risk", [])
        if risk:
            ax = fig.add_axes([.74, .07, .23, .33])
            ax.barh([r[0] for r in risk][::-1], [r[1] for r in risk][::-1], color=navy)
            ax.tick_params(labelsize=7.5); ax.set_title("Critical risk distribution", fontsize=10); ax.spines[["top", "right"]].set_visible(False)
        pdf.savefig(fig); plt.close(fig)
    return out.getvalue()


def build_case_pdf(d):
    import textwrap
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.backends.backend_pdf import PdfPages
    lines=[]
    def add(label, value):
        if value is not None and str(value).strip():
            lines.extend(textwrap.wrap(label+": "+str(value), width=98, replace_whitespace=False)[:50])
            lines.append("")
    for label,key in [("Title","title"),("Case reference","reference"),("Report type","type"),("Status","status"),("Project","project"),("Date","date"),("Location","location"),("Category","category"),("Risk rating","risk"),("Description","description"),("Immediate action","immediateAction"),("Investigator conclusion","cause")]: add(label,d.get(key))
    add("Investigation review", "Recorded" if d.get("reviewed") else "Pending / not applicable")
    add("Source record (sign-in required)",d.get("sourceUrl"))
    for field in d.get("fields",[])[:80]: add(str(field.get("label","Field")),field.get("value"))
    for i,a in enumerate(d.get("actions",[])[:100]): add("Action "+str(i+1), str(a.get("title", ""))+" / Priority: "+str(a.get("priority", ""))+" / Due: "+str(a.get("due", ""))+" / Owner: "+str(a.get("owner", "")))
    out=io.BytesIO()
    with PdfPages(out) as pdf:
        for start in range(0,len(lines),42):
            fig=plt.figure(figsize=(8.27,11.69))
            fig.text(.07,.95,str(d.get("brand","NAVO"))+" HSSE case report",fontsize=17,weight="bold",color="#163b53")
            fig.text(.07,.905,str(d.get("title", ""))[:85],fontsize=12,weight="bold")
            if d.get("illustrative"): fig.text(.07,.875,"ILLUSTRATIVE DATA / DEMONSTRATION",fontsize=9,color="#996200")
            fig.text(.07,.84,"\n".join(lines[start:start+42]),fontsize=9.5,linespacing=1.5,va="top")
            fig.text(.07,.04,"Generated "+str(d.get("generated", ""))+" / Case "+str(d.get("reference", ""))+" / Page "+str(start//42+1),fontsize=8,color="#52697a")
            pdf.savefig(fig);plt.close(fig)
    return out.getvalue()


def build_history_pdf(d):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    rows=d.get('rows',[])[:5]
    fig=plt.figure(figsize=(11.69,8.27))
    fig.text(.06,.94,str(d.get('brand','NAVO'))+' / Five-year HSSE evidence',fontsize=20,weight='bold',color='#17394d')
    fig.text(.06,.89,str(d.get('scope','Corporation'))+' / '+str(d.get('period',''))+' / Current year: YTD',fontsize=12)
    if d.get('illustrative'):fig.text(.06,.85,'ILLUSTRATIVE DATA / NOT VERIFIED COMPANY PERFORMANCE',fontsize=10,color='#986600')
    ax=fig.add_axes([.09,.44,.84,.35])
    for k,color in [('ltifr','#235bc0'),('ltisr','#d27d35'),('trcf','#176b5b')]:ax.plot([r['year'] for r in rows],[r.get(k) for r in rows],marker='o',label=k.upper(),color=color)
    ax.set_xticks([r['year'] for r in rows]);ax.set_ylabel('Rate per 1,000,000 hours');ax.grid(axis='y',alpha=.2);ax.legend()
    table_ax=fig.add_axes([.06,.10,.88,.27]);table_ax.axis('off')
    values=[[r['year'],f"{r.get('hours',0):,}" if r.get('hours') else 'Not recorded',r.get('lti',0),r.get('lost',0),r.get('recordable',0)]+['Unavailable' if r.get(k) is None else f"{r[k]:.2f}" for k in ['ltifr','ltisr','trcf']] for r in rows]
    table=table_ax.table(cellText=values,colLabels=['Year','Exposure hours','LTI','Lost days','Recordables','LTIFR','LTISR','TRCF'],loc='upper center',cellLoc='center');table.auto_set_font_size(False);table.set_fontsize(10);table.scale(1,1.8)
    fig.text(.06,.05,'Missing exposure produces unavailable rates. Validate source figures and reporting boundaries before tender use.',fontsize=9,color='#52697a')
    out=io.BytesIO();fig.savefig(out,format='pdf');plt.close(fig);return out.getvalue()


def make(fmt, data):
    from api.report_complete import complete_docx, complete_xlsx, complete_pptx, brief_pdf
    from api.report_layout import executive_pdf, history_pdf, case_pdf, executive_pptx
    if data.get("kind") == "history":
        if fmt != "pdf": raise ValueError("Historical evidence exports as PDF")
        return history_pdf(data), "application/pdf"
    if data.get("kind") == "case":
        if fmt != "pdf": raise ValueError("Case reports export as PDF")
        return case_pdf(data), "application/pdf"
    if data.get("kind") == "template":
        if fmt != "xlsx": raise ValueError("The import template is an Excel file")
        from api.excel_io import template_xlsx
        return template_xlsx(data), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    if data.get("kind") in ("ceo", "env"):
        from api.report_ceo import make_ceo
        data.setdefault("generated", datetime.utcnow().strftime("%d %b %Y"))
        return make_ceo(data["kind"], fmt, data)
    if data.get("kind") == "exec":
        data.setdefault("generated", datetime.utcnow().strftime("%d %b %Y"))
        if fmt == "pdf":
            return (brief_pdf(data) if data.get("brief") else executive_pdf(data)), "application/pdf"
        if fmt == "pptx":
            return complete_pptx(data), "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        if fmt == "docx": return complete_docx(data), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        if fmt == "xlsx": return complete_xlsx(data), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        raise ValueError("Unknown executive report format")
    if fmt not in BUILDERS:
        raise ValueError("Unknown format")
    data.setdefault("generated", datetime.utcnow().strftime("%d %b %Y"))
    fn, mime = BUILDERS[fmt]
    return fn(data), mime


class handler(BaseHTTPRequestHandler):
    def _deny(self):
        msg = json.dumps({"error": "Please sign in again to download reports."}).encode()
        self.send_response(401)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(msg)))
        self.end_headers()
        self.wfile.write(msg)

    def do_POST(self):
        from api.auth import token_from, user_id
        if not user_id(token_from(self.headers)):
            return self._deny()
        try:
            from urllib.parse import urlparse, parse_qs
            fmt = parse_qs(urlparse(self.path).query).get("fmt", ["xlsx"])[0]
            n = int(self.headers.get("content-length") or 0)
            if n > 2_000_000:
                raise ValueError("Request too large")
            data = json.loads(self.rfile.read(n) or b"{}")
            body, mime = make(fmt, data)
            safe = "".join(ch if ch.isascii() and (ch.isalnum() or ch in "-_ ") else "_" for ch in str(data.get("title", "report")))[:60].strip() or "report"
            self.send_response(200)
            self.send_header("Content-Type", mime)
            month = "".join(ch for ch in str(data.get("month", "")) if ch.isascii() and (ch.isalnum() or ch in "-_ "))[:24]
            if fmt not in ("xlsx", "docx", "pptx", "pdf"): raise ValueError("Unknown format")
            self.send_header("Content-Disposition", f'attachment; filename="NAVO {safe} {month}.{fmt}"')
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except Exception as e:  # report the problem to the page in plain words
            msg = json.dumps({"error": str(e)}).encode()
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(msg)))
            self.end_headers()
            self.wfile.write(msg)
