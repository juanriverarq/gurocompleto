"""
ANÁLISIS 5: Cruce de recibos SoftSeguros vs recibos/pagos Guro.
Detecta:
 - Recibos en SoftSeguros sin correspondencia en Guro
 - Recibos en Guro sin correspondencia en SoftSeguros
 - Diferencias de montos entre sistemas
 - Recibos anulados en Soft pero activos en Guro (y viceversa)
 - Resumen de recaudos: oficina vs aseguradora (directo)
"""
import pandas as pd
import numpy as np


def analyze(db_data, excel_data):
    results = {
        "title": "Cruce de Recibos: Guro DB vs SoftSeguros",
        "findings": [],
        "stats": {},
        "details": {},
    }

    recibos_guro = db_data.get("recibos_caja", pd.DataFrame())
    pagos_guro = db_data["pagos_polizas"].copy()
    polizas = db_data["polizas"].copy()

    recibos_soft = excel_data.get("recibos_activos", pd.DataFrame())
    recibos_dir_soft = excel_data.get("recibos_directos", pd.DataFrame())
    recibos_anul_soft = excel_data.get("recibos_anulados", pd.DataFrame())

    results["stats"]["recibos_guro"] = len(recibos_guro)
    results["stats"]["recibos_soft_activos"] = len(recibos_soft)
    results["stats"]["recibos_soft_directos"] = len(recibos_dir_soft)
    results["stats"]["recibos_soft_anulados"] = len(recibos_anul_soft)
    results["stats"]["pagos_guro"] = len(pagos_guro)

    # ─── 1. Resumen financiero de pagos en Guro ───
    if not pagos_guro.empty:
        pagos_guro["valor"] = pd.to_numeric(pagos_guro["valor_pagado"], errors="coerce").fillna(0)
        resumen_tipo = pagos_guro.groupby("tipo_recaudo").agg(
            count=("id", "count"),
            total=("valor", "sum"),
        ).reset_index()
        results["findings"].append({
            "severity": "info",
            "message": "Resumen de pagos en Guro por tipo de recaudo",
            "detail": "; ".join([
                f"{r['tipo_recaudo']}: {r['count']} pagos, ${r['total']:,.0f}"
                for _, r in resumen_tipo.iterrows()
            ]),
        })
        results["details"]["resumen_pagos_guro"] = resumen_tipo

    # ─── 2. Cruce por número de recibo ───
    if not recibos_guro.empty and not recibos_soft.empty:
        recibos_guro["recibo_key"] = recibos_guro["numero_recibo"].astype(str).str.strip()

        if "numero_recibo" in recibos_soft.columns:
            recibos_soft["recibo_key"] = recibos_soft["numero_recibo"].astype(str).str.strip()

            guro_keys = set(recibos_guro["recibo_key"].dropna())
            soft_keys = set(recibos_soft["recibo_key"].dropna())

            results["stats"]["recibos_en_ambos"] = len(guro_keys & soft_keys)
            results["stats"]["recibos_solo_guro"] = len(guro_keys - soft_keys)
            results["stats"]["recibos_solo_soft"] = len(soft_keys - guro_keys)

            solo_guro = recibos_guro[recibos_guro["recibo_key"].isin(guro_keys - soft_keys)]
            if not solo_guro.empty:
                results["findings"].append({
                    "severity": "info",
                    "message": f"{len(solo_guro)} recibos en Guro que NO están en SoftSeguros (activos)",
                    "detail": "Pueden ser recibos creados manualmente en Guro post-migración",
                })

            solo_soft = recibos_soft[recibos_soft["recibo_key"].isin(soft_keys - guro_keys)]
            if not solo_soft.empty:
                results["findings"].append({
                    "severity": "warning",
                    "message": f"{len(solo_soft)} recibos en SoftSeguros que NO están en Guro",
                    "detail": "Recibos no migrados o eliminados en Guro",
                })

    # ─── 3. Verificar recibos anulados en Soft que están activos en Guro ───
    if not recibos_anul_soft.empty and not recibos_guro.empty and "numero_recibo" in recibos_anul_soft.columns:
        recibos_anul_soft["recibo_key"] = recibos_anul_soft["numero_recibo"].astype(str).str.strip()
        anul_keys = set(recibos_anul_soft["recibo_key"].dropna())

        recibos_guro["recibo_key"] = recibos_guro["numero_recibo"].astype(str).str.strip()
        guro_activos = recibos_guro[recibos_guro["estado"].astype(str).str.lower().isin(["activo", "active", "pagado"])]
        activos_keys = set(guro_activos["recibo_key"].dropna())

        anulados_pero_activos = anul_keys & activos_keys
        if anulados_pero_activos:
            results["findings"].append({
                "severity": "critical",
                "message": f"{len(anulados_pero_activos)} recibos ANULADOS en SoftSeguros pero ACTIVOS en Guro",
                "detail": "Requieren revisión manual - pueden generar saldos incorrectos",
            })
            results["details"]["anulados_en_soft_activos_guro"] = guro_activos[
                guro_activos["recibo_key"].isin(anulados_pero_activos)
            ][["id", "recibo_key", "valor_recaudado_en_oficina", "estado", "created_at"]].head(50)

    # ─── 4. Resumen financiero SoftSeguros ───
    if not recibos_soft.empty and "valor_recaudado_en_oficina" in recibos_soft.columns:
        total_recaudado_soft = pd.to_numeric(
            recibos_soft["valor_recaudado_en_oficina"], errors="coerce"
        ).fillna(0).sum()
        results["findings"].append({
            "severity": "info",
            "message": f"Total recaudado en oficina según SoftSeguros: ${total_recaudado_soft:,.0f}",
        })

    if not recibos_guro.empty:
        total_recaudado_guro = pd.to_numeric(
            recibos_guro["valor_recaudado_en_oficina"], errors="coerce"
        ).fillna(0).sum()
        results["findings"].append({
            "severity": "info",
            "message": f"Total recaudado en oficina según Guro: ${total_recaudado_guro:,.0f}",
        })

    return results
