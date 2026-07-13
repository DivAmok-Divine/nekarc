"""Server-side PDF generation (reportlab — pure-python, no system deps)."""
import base64
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
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import (Image as RLImage, PageBreak, Paragraph,
                                    SimpleDocTemplate, Spacer, Table)

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

    small = ParagraphStyle("small", parent=styles["Normal"], fontSize=7, leading=8)

    totals = report.get("totals") or {}
    if totals:
        story.append(Paragraph("Project Summary", styles["Heading2"]))
        rows = [[str(k).replace("_", " ").title(), str(v)] for k, v in totals.items()]
        t = Table([["Metric", "Value"], *rows], colWidths=[80 * mm, 80 * mm])
        t.setStyle(_table_style())
        story.extend([t, Spacer(1, 6 * mm)])

    floors = report.get("floors") or []
    if floors:
        story.append(Paragraph("Floor-by-Floor Summary", styles["Heading2"]))
        has_geo = any(f.get("area_m2") for f in floors)
        if has_geo:
            header = ["Floor", "WS", "WiFi", "APs", "Switch", "Ports", "Area m²", "Cable m", "Max Run", "IDF", "Note"]
            col_w = [22, 10, 12, 10, 14, 12, 15, 15, 15, 8, 27]
            rows = [
                [
                    Paragraph(str(f.get("name", "")), small), str(f.get("ws", "")), str(f.get("wifi", "")),
                    str(f.get("aps", "")), str(f.get("switch", "—")), str(f.get("ports", "")),
                    str(f.get("area_m2", "")), str(f.get("cable_m", "")), str(f.get("max_run_m", "")),
                    str(f.get("idf", "")), Paragraph(str(f.get("note", "")), small),
                ]
                for f in floors
            ]
        else:
            header = ["Floor", "WS", "WiFi", "APs", "Switch", "Ports"]
            col_w = [60, 20, 20, 20, 30, 30]
            rows = [
                [
                    Paragraph(str(f.get("name", "")), small), str(f.get("ws", "")), str(f.get("wifi", "")),
                    str(f.get("aps", "")), str(f.get("switch", "—")), str(f.get("ports", "")),
                ]
                for f in floors
            ]
        t = Table([header, *rows], colWidths=[w * mm for w in col_w])
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

    # ── Floor plans (rasterised geometry + device placement) ──
    plans = report.get("plans") or []
    plans = [p for p in plans if p.get("image")]
    if plans:
        content_w, max_h = 180 * mm, 215 * mm
        story.append(PageBreak())
        story.append(Paragraph("Floor Plans", styles["Heading2"]))
        for pl in plans:
            try:
                data = base64.b64decode(pl["image"])
            except Exception:  # noqa: BLE001
                continue
            w, h = pl.get("w") or 1, pl.get("h") or 1
            iw, ih = content_w, content_w * h / w
            if ih > max_h:
                iw, ih = max_h * w / h, max_h
            story.append(Paragraph(pl.get("name", "Floor"), styles["Heading3"]))
            story.append(RLImage(io.BytesIO(data), width=iw, height=ih))
            story.append(Spacer(1, 6 * mm))

    doc.build(story)
    return buf.getvalue()
