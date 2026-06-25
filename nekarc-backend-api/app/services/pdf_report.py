"""Server-side PDF generation (reportlab — pure-python, no system deps)."""
import io


def _table_style():
    from reportlab.lib import colors
    from reportlab.platypus import TableStyle

    return TableStyle(
        [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a8a")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cbd5e1")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f1f5f9")]),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]
    )


def build_pdf(project_name: str, report: dict) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import (Paragraph, SimpleDocTemplate, Spacer, Table)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
        title=f"{project_name} — Network Design",
    )
    styles = getSampleStyleSheet()
    story = [
        Paragraph("Network Architecture Report", styles["Title"]),
        Paragraph(f"Project: {project_name}", styles["Normal"]),
        Spacer(1, 8 * mm),
    ]

    totals = report.get("totals") or {}
    if totals:
        story.append(Paragraph("Project Summary", styles["Heading2"]))
        rows = [[str(k).replace("_", " ").title(), str(v)] for k, v in totals.items()]
        t = Table([["Metric", "Value"], *rows], colWidths=[80 * mm, 80 * mm])
        t.setStyle(_table_style())
        story.extend([t, Spacer(1, 6 * mm)])

    bom = report.get("bom") or []
    if bom:
        story.append(Paragraph("Bill of Materials", styles["Heading2"]))
        rows = [[b.get("cat", ""), b.get("item", ""), str(b.get("qty", "")), b.get("note", "")] for b in bom]
        t = Table([["Category", "Item", "Qty", "Notes"], *rows], colWidths=[25 * mm, 55 * mm, 15 * mm, 65 * mm])
        t.setStyle(_table_style())
        story.extend([t, Spacer(1, 6 * mm)])

    vlans = report.get("vlans") or []
    if vlans:
        story.append(Paragraph("VLAN Plan", styles["Heading2"]))
        rows = [[str(v.get("id", "")), v.get("name", ""), v.get("dhcp", "")] for v in vlans]
        t = Table([["VLAN", "Name", "DHCP"], *rows], colWidths=[20 * mm, 70 * mm, 70 * mm])
        t.setStyle(_table_style())
        story.append(t)

    doc.build(story)
    return buf.getvalue()
