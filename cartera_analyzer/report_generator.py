"""
Generador de reportes HTML y CSV a partir de los resultados de los analizadores.
Produce un reporte HTML interactivo con tablas, indicadores y conclusiones.
"""
import os
import pandas as pd
from datetime import datetime
from config import OUTPUT_DIR

SEVERITY_COLORS = {
    "critical": "#dc2626",
    "error": "#dc2626",
    "warning": "#f59e0b",
    "info": "#3b82f6",
}

SEVERITY_ICONS = {
    "critical": "&#9888;",   # ⚠
    "error": "&#10060;",     # ❌
    "warning": "&#9888;",    # ⚠
    "info": "&#8505;",       # ℹ
}

SEVERITY_ORDER = {"critical": 0, "error": 1, "warning": 2, "info": 3}


def _df_to_html(df, max_rows=200):
    """Convierte un DataFrame a una tabla HTML estilizada."""
    if df is None or df.empty:
        return "<p><em>Sin datos</em></p>"
    df_show = df.head(max_rows).copy()
    # Formatear números
    for col in df_show.select_dtypes(include=["float64", "float32"]).columns:
        df_show[col] = df_show[col].apply(lambda x: f"{x:,.2f}" if pd.notna(x) else "")
    html = df_show.to_html(index=False, classes="data-table", border=0, na_rep="-")
    if len(df) > max_rows:
        html += f"<p class='truncated'>Mostrando {max_rows} de {len(df)} filas</p>"
    return html


def generate_report(all_results, db_stats=None):
    """
    Genera el reporte HTML principal.

    Args:
        all_results: lista de dicts con resultados de cada analizador
        db_stats: dict con estadísticas generales de la DB
    """
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    timestamp_file = datetime.now().strftime("%Y%m%d_%H%M%S")

    # Consolidar hallazgos
    all_findings = []
    for result in all_results:
        for f in result.get("findings", []):
            f["section"] = result["title"]
            all_findings.append(f)

    all_findings.sort(key=lambda x: SEVERITY_ORDER.get(x.get("severity", "info"), 99))

    # Conteos
    counts = {}
    for f in all_findings:
        sev = f.get("severity", "info")
        counts[sev] = counts.get(sev, 0) + 1

    # ─── HTML ───
    html_parts = [_html_header(timestamp, counts)]

    # Resumen ejecutivo
    html_parts.append(_executive_summary(all_findings, counts, db_stats))

    # Cada sección de análisis
    for i, result in enumerate(all_results):
        html_parts.append(_section_html(result, i))

    # Hallazgos consolidados
    html_parts.append(_consolidated_findings(all_findings))

    html_parts.append(_html_footer())

    html = "\n".join(html_parts)

    # Guardar HTML
    html_path = os.path.join(OUTPUT_DIR, f"reporte_cartera_{timestamp_file}.html")
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html)

    # También guardar latest
    latest_path = os.path.join(OUTPUT_DIR, "reporte_cartera_latest.html")
    with open(latest_path, "w", encoding="utf-8") as f:
        f.write(html)

    # Exportar detalles a CSV
    csv_dir = os.path.join(OUTPUT_DIR, f"csv_{timestamp_file}")
    os.makedirs(csv_dir, exist_ok=True)
    for result in all_results:
        section_name = result["title"].replace(" ", "_").replace(":", "")[:40]
        for detail_name, detail_df in result.get("details", {}).items():
            if isinstance(detail_df, pd.DataFrame) and not detail_df.empty:
                csv_path = os.path.join(csv_dir, f"{section_name}__{detail_name}.csv")
                detail_df.to_csv(csv_path, index=False)

    print(f"\n{'='*60}")
    print(f"REPORTE GENERADO")
    print(f"{'='*60}")
    print(f"  HTML: {html_path}")
    print(f"  Latest: {latest_path}")
    print(f"  CSVs: {csv_dir}/")
    print(f"  Hallazgos: {len(all_findings)} total")
    for sev in ["critical", "error", "warning", "info"]:
        if sev in counts:
            print(f"    {sev.upper()}: {counts[sev]}")
    print(f"{'='*60}\n")

    return html_path


def _html_header(timestamp, counts):
    critical = counts.get("critical", 0)
    warning = counts.get("warning", 0)
    info = counts.get("info", 0)

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Reporte Cartera - {timestamp}</title>
<style>
    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
           background: #0f172a; color: #e2e8f0; line-height: 1.6; }}
    .container {{ max-width: 1400px; margin: 0 auto; padding: 20px; }}
    .header {{ background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
               border-radius: 16px; padding: 32px; margin-bottom: 24px;
               border: 1px solid #475569; }}
    .header h1 {{ font-size: 28px; font-weight: 700; color: #f1f5f9; margin-bottom: 8px; }}
    .header .subtitle {{ color: #94a3b8; font-size: 14px; }}
    .kpi-row {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 16px; margin-bottom: 24px; }}
    .kpi {{ background: #1e293b; border-radius: 12px; padding: 20px;
            border: 1px solid #334155; text-align: center; }}
    .kpi .value {{ font-size: 36px; font-weight: 700; }}
    .kpi .label {{ color: #94a3b8; font-size: 13px; margin-top: 4px; }}
    .kpi.critical .value {{ color: #ef4444; }}
    .kpi.warning .value {{ color: #f59e0b; }}
    .kpi.info .value {{ color: #3b82f6; }}
    .kpi.ok .value {{ color: #22c55e; }}
    .section {{ background: #1e293b; border-radius: 12px; padding: 24px;
                margin-bottom: 20px; border: 1px solid #334155; }}
    .section h2 {{ font-size: 20px; font-weight: 600; color: #f1f5f9;
                   margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #334155; }}
    .finding {{ padding: 12px 16px; border-radius: 8px; margin-bottom: 10px;
                border-left: 4px solid; }}
    .finding.critical {{ background: #451a1a; border-color: #dc2626; }}
    .finding.warning {{ background: #451a03; border-color: #f59e0b; }}
    .finding.info {{ background: #172554; border-color: #3b82f6; }}
    .finding .severity {{ font-size: 12px; font-weight: 700; text-transform: uppercase;
                          letter-spacing: 0.05em; }}
    .finding .message {{ font-size: 15px; font-weight: 500; margin-top: 2px; }}
    .finding .detail {{ font-size: 13px; color: #94a3b8; margin-top: 4px; }}
    .stats-grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                   gap: 12px; margin-bottom: 16px; }}
    .stat-item {{ background: #0f172a; border-radius: 8px; padding: 12px 16px;
                  display: flex; justify-content: space-between; align-items: center; }}
    .stat-item .key {{ color: #94a3b8; font-size: 13px; }}
    .stat-item .val {{ font-weight: 600; color: #e2e8f0; }}
    .data-table {{ width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 12px; }}
    .data-table th {{ background: #334155; color: #e2e8f0; padding: 8px 10px;
                      text-align: left; font-weight: 600; white-space: nowrap;
                      position: sticky; top: 0; }}
    .data-table td {{ padding: 6px 10px; border-bottom: 1px solid #1e293b;
                      color: #cbd5e1; white-space: nowrap; max-width: 300px;
                      overflow: hidden; text-overflow: ellipsis; }}
    .data-table tr:hover td {{ background: #1e293b; }}
    .table-wrapper {{ max-height: 500px; overflow: auto; border-radius: 8px;
                      border: 1px solid #334155; }}
    .truncated {{ color: #94a3b8; font-size: 12px; font-style: italic; margin-top: 8px; }}
    .collapsible {{ cursor: pointer; user-select: none; }}
    .collapsible::before {{ content: '\\25B6'; display: inline-block; margin-right: 8px;
                            transition: transform 0.2s; font-size: 12px; }}
    .collapsible.open::before {{ transform: rotate(90deg); }}
    .collapse-content {{ display: none; margin-top: 12px; }}
    .collapse-content.open {{ display: block; }}
    .badge {{ display: inline-block; padding: 2px 8px; border-radius: 4px;
              font-size: 11px; font-weight: 600; }}
    .badge-critical {{ background: #7f1d1d; color: #fca5a5; }}
    .badge-warning {{ background: #78350f; color: #fcd34d; }}
    .badge-info {{ background: #1e3a5f; color: #93c5fd; }}
    h3 {{ color: #e2e8f0; font-size: 16px; margin: 16px 0 8px; }}
</style>
</head>
<body>
<div class="container">
    <div class="header">
        <h1>Reporte de Analisis de Cartera</h1>
        <div class="subtitle">Generado: {timestamp} | Broker: Seguros Santa Maria (ID: 54)</div>
    </div>
    <div class="kpi-row">
        <div class="kpi critical"><div class="value">{critical}</div><div class="label">CRITICOS</div></div>
        <div class="kpi warning"><div class="value">{warning}</div><div class="label">ADVERTENCIAS</div></div>
        <div class="kpi info"><div class="value">{info}</div><div class="label">INFORMATIVOS</div></div>
        <div class="kpi ok"><div class="value">{critical + warning + info}</div><div class="label">TOTAL HALLAZGOS</div></div>
    </div>
"""


def _executive_summary(findings, counts, db_stats):
    critical_findings = [f for f in findings if f.get("severity") == "critical"]

    html = '<div class="section"><h2>Resumen Ejecutivo</h2>'

    if db_stats:
        html += '<div class="stats-grid">'
        for k, v in db_stats.items():
            if isinstance(v, (int, float)):
                val_str = f"{v:,.0f}" if isinstance(v, float) else f"{v:,}"
            else:
                val_str = str(v)
            html += f'<div class="stat-item"><span class="key">{k}</span><span class="val">{val_str}</span></div>'
        html += '</div>'

    if critical_findings:
        html += '<h3>Problemas Criticos que Requieren Accion</h3>'
        for f in critical_findings:
            html += f"""<div class="finding critical">
                <div class="severity" style="color:#ef4444">CRITICO - {f.get('section', '')}</div>
                <div class="message">{f['message']}</div>
                {'<div class="detail">' + f['detail'] + '</div>' if f.get('detail') else ''}
            </div>"""

    html += '</div>'
    return html


def _section_html(result, idx):
    title = result["title"]
    findings = result.get("findings", [])
    stats = result.get("stats", {})
    details = result.get("details", {})

    html = f'<div class="section"><h2>{idx + 1}. {title}</h2>'

    # Stats
    if stats:
        html += '<div class="stats-grid">'
        for k, v in stats.items():
            if isinstance(v, dict):
                val_str = ", ".join(f"{kk}: {vv}" for kk, vv in v.items())
            elif isinstance(v, (int, float)):
                val_str = f"{v:,.0f}" if isinstance(v, float) else f"{v:,}"
            else:
                val_str = str(v)
            label = k.replace("_", " ").title()
            html += f'<div class="stat-item"><span class="key">{label}</span><span class="val">{val_str}</span></div>'
        html += '</div>'

    # Findings
    for f in findings:
        sev = f.get("severity", "info")
        html += f"""<div class="finding {sev}">
            <div class="severity" style="color:{SEVERITY_COLORS.get(sev, '#94a3b8')}">{sev.upper()}</div>
            <div class="message">{f['message']}</div>
            {'<div class="detail">' + f['detail'] + '</div>' if f.get('detail') else ''}
        </div>"""

    # Details (collapsible tables)
    for name, df in details.items():
        if isinstance(df, pd.DataFrame) and not df.empty:
            label = name.replace("_", " ").title()
            html += f"""
            <h3 class="collapsible" onclick="toggleCollapse(this)">{label} ({len(df)} filas)</h3>
            <div class="collapse-content">
                <div class="table-wrapper">{_df_to_html(df)}</div>
            </div>"""

    html += '</div>'
    return html


def _consolidated_findings(findings):
    html = '<div class="section"><h2>Todos los Hallazgos (ordenados por severidad)</h2>'
    for i, f in enumerate(findings):
        sev = f.get("severity", "info")
        html += f"""<div class="finding {sev}">
            <div class="severity" style="color:{SEVERITY_COLORS.get(sev, '#94a3b8')}">
                {sev.upper()} | {f.get('section', '')}
            </div>
            <div class="message">{i + 1}. {f['message']}</div>
            {'<div class="detail">' + f['detail'] + '</div>' if f.get('detail') else ''}
        </div>"""
    html += '</div>'
    return html


def _html_footer():
    return """
    <div style="text-align:center; color:#64748b; font-size:12px; padding:24px 0;">
        Generado por Guro Cartera Analyzer &mdash; Sistema de diagnostico automatizado
    </div>
</div>
<script>
function toggleCollapse(el) {
    el.classList.toggle('open');
    var content = el.nextElementSibling;
    content.classList.toggle('open');
}
</script>
</body>
</html>"""
