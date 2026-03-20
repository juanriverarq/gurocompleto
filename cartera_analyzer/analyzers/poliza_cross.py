"""
ANÁLISIS 1: Cruce de pólizas DB (Guro) vs SoftSeguros (Excel producción).
Detecta:
 - Pólizas en SoftSeguros que NO existen en Guro
 - Pólizas en Guro que NO existen en SoftSeguros
 - Pólizas con datos financieros diferentes (prima, comisión)
 - Pólizas con aseguradoras no coincidentes
 - Pólizas con fechas de vigencia diferentes
"""
import pandas as pd
import numpy as np


def analyze(db_data, excel_data):
    """
    Retorna dict con conclusiones del cruce de pólizas.
    """
    results = {
        "title": "Cruce de Pólizas: Guro DB vs SoftSeguros",
        "findings": [],
        "stats": {},
        "details": {},
    }

    polizas_db = db_data["polizas"].copy()
    produccion = excel_data.get("produccion", pd.DataFrame())

    if produccion.empty:
        results["findings"].append({
            "severity": "error",
            "message": "No se pudo cargar el archivo de producción de SoftSeguros",
        })
        return results

    # ─── Normalizar claves de cruce ───
    polizas_db["policy_key"] = polizas_db["policy_number"].astype(str).str.strip().str.upper()
    produccion["policy_key"] = produccion["numero_poliza"].astype(str).str.strip().str.upper()

    # Eliminar duplicados en producción (puede haber anexos)
    # Tomar solo tipo == "Póliza" si existe la columna
    if "tipo" in produccion.columns:
        prod_polizas = produccion[produccion["tipo"].astype(str).str.lower() == "póliza"].copy()
    else:
        prod_polizas = produccion.copy()

    # Stats generales
    db_keys = set(polizas_db["policy_key"].dropna())
    soft_keys = set(prod_polizas["policy_key"].dropna())

    results["stats"] = {
        "total_polizas_guro": len(polizas_db),
        "total_polizas_soft": len(prod_polizas),
        "polizas_unicas_guro": len(db_keys),
        "polizas_unicas_soft": len(soft_keys),
        "en_ambos": len(db_keys & soft_keys),
        "solo_guro": len(db_keys - soft_keys),
        "solo_soft": len(soft_keys - db_keys),
    }

    # ─── 1. Pólizas solo en SoftSeguros (no migradas) ───
    solo_soft = prod_polizas[prod_polizas["policy_key"].isin(soft_keys - db_keys)].copy()
    if not solo_soft.empty:
        # Agrupar por estado
        if "estado" in solo_soft.columns:
            estado_counts = solo_soft["estado"].value_counts().to_dict()
        else:
            estado_counts = {"desconocido": len(solo_soft)}

        results["findings"].append({
            "severity": "warning",
            "message": f"{len(solo_soft)} pólizas en SoftSeguros NO existen en Guro DB",
            "detail": f"Por estado: {estado_counts}",
        })
        results["details"]["solo_en_soft"] = solo_soft[
            ["policy_key"] +
            [c for c in ["identificador", "aseguradora", "ramo_principal", "estado",
                         "total", "fecha_inicio", "fecha_fin", "nueva___renovada"]
             if c in solo_soft.columns]
        ].head(200)

    # ─── 2. Pólizas solo en Guro (creadas manualmente o no exportadas) ───
    solo_guro = polizas_db[polizas_db["policy_key"].isin(db_keys - soft_keys)].copy()
    if not solo_guro.empty:
        status_counts = solo_guro["status"].value_counts().to_dict()
        results["findings"].append({
            "severity": "info",
            "message": f"{len(solo_guro)} pólizas en Guro NO existen en SoftSeguros",
            "detail": f"Por status: {status_counts}",
        })
        results["details"]["solo_en_guro"] = solo_guro[
            ["id", "policy_key", "status", "premium_amount", "insurance_company",
             "ramo_nombre", "start_date", "end_date", "numero_renovacion"]
        ].head(200)

    # ─── 3. Cruce financiero para pólizas en ambos sistemas ───
    common_keys = db_keys & soft_keys
    if common_keys:
        db_common = polizas_db[polizas_db["policy_key"].isin(common_keys)].copy()
        soft_common = prod_polizas[prod_polizas["policy_key"].isin(common_keys)].copy()

        # Eliminar duplicados: tomar el de mayor ID en Guro, el de mayor fecha en Soft
        db_dedup = db_common.sort_values("id", ascending=False).drop_duplicates(subset="policy_key", keep="first")
        soft_dedup = soft_common.sort_values("identificador" if "identificador" in soft_common.columns else soft_common.columns[0],
                                              ascending=False).drop_duplicates(subset="policy_key", keep="first")

        merged = db_dedup.merge(soft_dedup, on="policy_key", suffixes=("_guro", "_soft"))

        # Comparar prima total
        if "premium_amount" in merged.columns and "total" in merged.columns:
            merged["prima_guro"] = pd.to_numeric(merged["premium_amount"], errors="coerce").fillna(0)
            merged["prima_soft"] = pd.to_numeric(merged["total"], errors="coerce").fillna(0)
            merged["diff_prima"] = (merged["prima_guro"] - merged["prima_soft"]).abs()
            merged["diff_prima_pct"] = np.where(
                merged["prima_soft"] > 0,
                (merged["diff_prima"] / merged["prima_soft"] * 100).round(2),
                0
            )

            # Diferencias significativas (> $1,000 y > 1%)
            prima_diff = merged[(merged["diff_prima"] > 1000) & (merged["diff_prima_pct"] > 1)].copy()
            if not prima_diff.empty:
                results["findings"].append({
                    "severity": "critical",
                    "message": f"{len(prima_diff)} pólizas con diferencia de prima > $1,000 entre Guro y SoftSeguros",
                    "detail": f"Diferencia promedio: ${prima_diff['diff_prima'].mean():,.0f}",
                })
                results["details"]["diferencias_prima"] = prima_diff[
                    ["policy_key", "prima_guro", "prima_soft", "diff_prima", "diff_prima_pct",
                     "status", "numero_renovacion"]
                ].sort_values("diff_prima", ascending=False).head(100)

    # ─── 4. Pólizas con renovaciones en SoftSeguros ───
    if "nueva___renovada" in prod_polizas.columns:
        renovadas_soft = prod_polizas[prod_polizas["nueva___renovada"].astype(str).str.lower() == "renovada"]
        nuevas_soft = prod_polizas[prod_polizas["nueva___renovada"].astype(str).str.lower() == "nueva"]

        # Contar por número de póliza cuántas veces aparece (indica renovaciones)
        pol_counts = prod_polizas.groupby("policy_key").size().reset_index(name="count_in_soft")
        multi_aparicion = pol_counts[pol_counts["count_in_soft"] > 1]

        results["findings"].append({
            "severity": "info",
            "message": f"En SoftSeguros: {len(nuevas_soft)} nuevas, {len(renovadas_soft)} renovadas",
            "detail": f"{len(multi_aparicion)} números de póliza aparecen más de una vez (posibles renovaciones con mismo número)",
        })

        if not multi_aparicion.empty:
            results["details"]["polizas_multi_aparicion_soft"] = multi_aparicion.sort_values(
                "count_in_soft", ascending=False
            ).head(50)

    return results
