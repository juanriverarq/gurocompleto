#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════╗
║          GURO CARTERA ANALYZER — Motor Principal             ║
║                                                              ║
║  Ejecuta todos los módulos de análisis y genera reportes.    ║
║  Uso: python run_analysis.py [--skip-db] [--broker=ID]       ║
╚══════════════════════════════════════════════════════════════╝
"""
import sys
import os
import time
import argparse

# Asegurar que el directorio del script está en el path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich import box

console = Console()


def main():
    parser = argparse.ArgumentParser(description="Guro Cartera Analyzer")
    parser.add_argument("--skip-db", action="store_true", help="Saltar conexión a DB (solo Excel)")
    parser.add_argument("--broker", type=int, default=54, help="ID del broker a analizar (default: 54)")
    parser.add_argument("--only", type=str, help="Ejecutar solo un análisis: poliza_cross, renovaciones, cartera, aseguradoras, recibos, comisiones")
    args = parser.parse_args()

    console.print(Panel.fit(
        "[bold white]GURO CARTERA ANALYZER[/]\n"
        "[dim]Sistema de diagnóstico de cruces de datos y cartera[/]",
        border_style="blue",
    ))

    # ═══════════════════════════════════════
    # 1. Cargar datos de Excel (siempre)
    # ═══════════════════════════════════════
    console.print("\n[bold cyan]FASE 1: Carga de datos Excel (SoftSeguros)[/]")
    from excel_loader import load_all_excel
    excel_data = load_all_excel()

    excel_summary = Table(title="Archivos Excel Cargados", box=box.ROUNDED)
    excel_summary.add_column("Archivo", style="cyan")
    excel_summary.add_column("Filas", justify="right", style="green")
    excel_summary.add_column("Columnas", justify="right")
    for name, df in excel_data.items():
        excel_summary.add_row(name, f"{len(df):,}", str(len(df.columns)))
    console.print(excel_summary)

    # ═══════════════════════════════════════
    # 2. Cargar datos de DB (producción)
    # ═══════════════════════════════════════
    db_data = {}
    db_stats = {}

    if args.skip_db:
        console.print("\n[yellow]⚠  Saltando conexión a DB (--skip-db)[/]")
        import pandas as pd
        for key in ["polizas", "cartera_items", "pagos_polizas", "cobros_comision", "recibos_caja", "aseguradoras"]:
            db_data[key] = pd.DataFrame()
    else:
        import config
        config.BROKER_ID = args.broker
        mode_label = "LOCAL (XAMPP)" if config.MODE == "local" else "REMOTA (SSH tunnel)"
        console.print(f"\n[bold cyan]FASE 2: Conexión a DB {mode_label} (broker_id={args.broker})[/]")
        from db_connector import get_connection, load_all_data

        try:
            with Progress(SpinnerColumn(), TextColumn("[progress.description]{task.description}"), console=console) as progress:
                task = progress.add_task("Conectando a MySQL...", total=None)

                with get_connection() as conn:
                    progress.update(task, description="Conexión activa, cargando datos...")
                    db_data = load_all_data(conn, args.broker)

                    from sqlalchemy import text as sa_text
                    import pandas as pd
                    bp = {"broker_id": args.broker}
                    db_stats["Pólizas totales (DB)"] = conn.execute(sa_text("SELECT COUNT(*) as c FROM polizas WHERE broker_id = :broker_id AND deleted_at IS NULL"), bp).scalar()
                    db_stats["Cartera items (DB)"] = conn.execute(sa_text("SELECT COUNT(*) as c FROM cartera_items WHERE broker_id = :broker_id"), bp).scalar()
                    db_stats["Pagos pólizas (DB)"] = conn.execute(sa_text("SELECT COUNT(*) as c FROM pagos_polizas WHERE broker_id = :broker_id"), bp).scalar()
                    db_stats["Cobros comisión (DB)"] = conn.execute(sa_text("SELECT COUNT(*) as c FROM cobros_comisiones WHERE broker_id = :broker_id"), bp).scalar()
                    db_stats["Recibos caja (DB)"] = conn.execute(sa_text("SELECT COUNT(*) as c FROM recibos_caja WHERE broker_id = :broker_id"), bp).scalar()

                    progress.update(task, description="Datos cargados exitosamente")

            db_summary = Table(title="Datos DB Cargados", box=box.ROUNDED)
            db_summary.add_column("Dataset", style="cyan")
            db_summary.add_column("Registros", justify="right", style="green")
            for name, df in db_data.items():
                db_summary.add_row(name, f"{len(df):,}")
            console.print(db_summary)

        except Exception as e:
            console.print(f"\n[red bold]ERROR conectando a DB: {e}[/]")
            console.print("[yellow]Continuando solo con datos de Excel...[/]")
            import pandas as pd
            for key in ["polizas", "cartera_items", "pagos_polizas", "cobros_comision", "recibos_caja", "aseguradoras"]:
                db_data[key] = pd.DataFrame()

    # ═══════════════════════════════════════
    # 3. Ejecutar analizadores
    # ═══════════════════════════════════════
    console.print("\n[bold cyan]FASE 3: Ejecutando análisis[/]")

    from analyzers import poliza_cross, renovaciones, cartera_integrity, aseguradoras, recibos_cross, comisiones

    analyzers = {
        "poliza_cross": ("Cruce de Pólizas DB vs SoftSeguros", poliza_cross.analyze),
        "renovaciones": ("Renovaciones y Coherencia", renovaciones.analyze),
        "cartera": ("Integridad de Cartera y Saldos", cartera_integrity.analyze),
        "aseguradoras": ("Integridad de Aseguradoras", aseguradoras.analyze),
        "recibos": ("Cruce de Recibos", recibos_cross.analyze),
        "comisiones": ("Análisis de Comisiones", comisiones.analyze),
    }

    # Filtrar si --only
    if args.only:
        if args.only in analyzers:
            analyzers = {args.only: analyzers[args.only]}
        else:
            console.print(f"[red]Analizador '{args.only}' no existe. Opciones: {list(analyzers.keys())}[/]")
            sys.exit(1)

    all_results = []
    for key, (name, analyzer_fn) in analyzers.items():
        console.print(f"  [dim]▸[/] {name}...", end=" ")
        t0 = time.time()
        try:
            result = analyzer_fn(db_data, excel_data)
            elapsed = time.time() - t0
            n_findings = len(result.get("findings", []))
            n_critical = sum(1 for f in result.get("findings", []) if f.get("severity") == "critical")

            status = "[green]OK[/]"
            if n_critical > 0:
                status = f"[red bold]{n_critical} CRITICOS[/]"
            elif n_findings > 0:
                status = f"[yellow]{n_findings} hallazgos[/]"

            console.print(f"{status} ({elapsed:.1f}s)")
            all_results.append(result)
        except Exception as e:
            console.print(f"[red]ERROR: {e}[/]")
            import traceback
            traceback.print_exc()
            all_results.append({
                "title": name,
                "findings": [{"severity": "error", "message": f"Error ejecutando análisis: {str(e)}"}],
                "stats": {},
                "details": {},
            })

    # ═══════════════════════════════════════
    # 4. Generar reporte
    # ═══════════════════════════════════════
    console.print("\n[bold cyan]FASE 4: Generando reporte[/]")
    from report_generator import generate_report

    # Agregar stats de Excel al resumen
    db_stats["Producción SoftSeguros (filas)"] = len(excel_data.get("produccion", []))
    db_stats["Recibos activos SoftSeguros"] = len(excel_data.get("recibos_activos", []))

    report_path = generate_report(all_results, db_stats)

    console.print(Panel.fit(
        f"[bold green]Reporte generado exitosamente[/]\n"
        f"[dim]{report_path}[/]",
        border_style="green",
    ))

    # Resumen final en consola
    total_critical = sum(
        sum(1 for f in r.get("findings", []) if f.get("severity") == "critical")
        for r in all_results
    )
    total_warning = sum(
        sum(1 for f in r.get("findings", []) if f.get("severity") == "warning")
        for r in all_results
    )

    if total_critical > 0:
        console.print(f"\n[red bold]⚠  {total_critical} problemas CRITICOS encontrados — requieren acción inmediata[/]")
    if total_warning > 0:
        console.print(f"[yellow]⚠  {total_warning} advertencias — requieren revisión[/]")
    if total_critical == 0 and total_warning == 0:
        console.print("\n[green bold]✓ Sin problemas críticos ni advertencias[/]")


if __name__ == "__main__":
    main()
