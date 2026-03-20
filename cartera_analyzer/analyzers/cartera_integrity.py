"""
ANÁLISIS 3: Integridad de cartera_items, pagos y saldos.
Detecta:
 - cartera_items huérfanos (poliza_id no existe)
 - Saldos negativos
 - Cuotas duplicadas (mismo poliza_id + renovacion + numero_cuota)
 - Prima total no coincide con suma de cuotas
 - Saldo calculado vs saldo almacenado (recalculo de pagos)
 - Pagos sin cartera_item asociado
 - Pagos cuyo valor excede la prima de la cuota
 - Cruce cartera SoftSeguros vs cartera Guro (saldos)
"""
import pandas as pd
import numpy as np


def _safe_cols(df, cols):
    """Return only cols that exist in df."""
    return [c for c in cols if c in df.columns]


def analyze(db_data, excel_data):
    results = {
        "title": "Integridad de Cartera: Saldos, Pagos y Cuotas",
        "findings": [],
        "stats": {},
        "details": {},
    }

    polizas = db_data["polizas"].copy()
    cartera = db_data["cartera_items"].copy()
    pagos = db_data["pagos_polizas"].copy()
    cobros = db_data["cobros_comision"].copy()

    if cartera.empty:
        results["findings"].append({"severity": "error", "message": "No hay cartera_items en la DB"})
        return results

    results["stats"]["total_cartera_items"] = len(cartera)
    results["stats"]["total_pagos"] = len(pagos)
    results["stats"]["total_cobros"] = len(cobros)

    # ─── 1. Cartera_items huérfanos ───
    poliza_ids = set(polizas["id"].values)
    orphan_ci = cartera[~cartera["poliza_id"].isin(poliza_ids)]
    if not orphan_ci.empty:
        results["findings"].append({
            "severity": "critical",
            "message": f"{len(orphan_ci)} cartera_items con poliza_id que NO existe en polizas (huérfanos)",
        })
        results["details"]["cartera_huerfanos"] = orphan_ci[
            _safe_cols(orphan_ci, ["id", "poliza_id", "numero_cuota", "total_cuotas", "prima_total_pago",
             "saldo_pendiente_oficina", "numero_renovacion"])
        ].head(100)

    # ─── 2. Saldos negativos ───
    neg_oficina = cartera[cartera["saldo_pendiente_oficina"].fillna(0) < -0.01]
    neg_aseg = cartera[cartera["saldo_pendiente_aseguradora"].fillna(0) < -0.01]
    if not neg_oficina.empty:
        results["findings"].append({
            "severity": "warning",
            "message": f"{len(neg_oficina)} cartera_items con saldo_pendiente_oficina NEGATIVO",
            "detail": f"Suma total negativa: ${neg_oficina['saldo_pendiente_oficina'].sum():,.0f}",
        })
        results["details"]["saldos_negativos_oficina"] = neg_oficina[
            ["id", "poliza_id", "numero_cuota", "prima_total_pago",
             "saldo_pendiente_oficina", "numero_renovacion"]
        ].sort_values("saldo_pendiente_oficina").head(50)

    if not neg_aseg.empty:
        results["findings"].append({
            "severity": "warning",
            "message": f"{len(neg_aseg)} cartera_items con saldo_pendiente_aseguradora NEGATIVO",
            "detail": f"Suma total negativa: ${neg_aseg['saldo_pendiente_aseguradora'].sum():,.0f}",
        })

    # ─── 3. Cuotas duplicadas ───
    cartera["renov_int"] = pd.to_numeric(cartera["numero_renovacion"], errors="coerce").fillna(0).astype(int)
    dupes = cartera.groupby(["poliza_id", "renov_int", "numero_cuota"]).size().reset_index(name="count")
    dupes = dupes[dupes["count"] > 1]
    if not dupes.empty:
        results["findings"].append({
            "severity": "critical",
            "message": f"{len(dupes)} combinaciones (poliza_id, renovacion, cuota) DUPLICADAS",
            "detail": "Genera saldos inflados y confusión en pagos",
        })
        dupes_detail = dupes.merge(
            polizas[["id", "policy_number"]],
            left_on="poliza_id", right_on="id", how="left"
        )
        results["details"]["cuotas_duplicadas"] = dupes_detail[
            ["poliza_id", "policy_number", "renov_int", "numero_cuota", "count"]
        ].sort_values("count", ascending=False).head(50)

    # ─── 4. Prima total vs suma de cuotas ───
    # Para cada póliza+renovación, la suma de prima_total_pago debe ser consistente
    agg_dict = {
        "suma_prima": ("prima_total_pago", "sum"),
        "count_cuotas": ("id", "count"),
    }
    if "total_cuotas" in cartera.columns:
        agg_dict["total_cuotas_col"] = ("total_cuotas", "max")
    ci_sum = cartera.groupby(["poliza_id", "renov_int"]).agg(**agg_dict).reset_index()

    ci_sum = ci_sum.merge(
        polizas[["id", "policy_number", "premium_amount", "numero_renovacion"]],
        left_on="poliza_id", right_on="id", how="left"
    )
    ci_sum["premium"] = pd.to_numeric(ci_sum["premium_amount"], errors="coerce").fillna(0)
    ci_sum["diff_prima"] = (ci_sum["suma_prima"] - ci_sum["premium"]).abs()

    # Inconsistencia: cuotas registradas != total_cuotas declarado
    if "total_cuotas_col" in ci_sum.columns:
        ci_sum["cuotas_faltantes"] = ci_sum["total_cuotas_col"].fillna(0).astype(int) - ci_sum["count_cuotas"]
        faltantes = ci_sum[ci_sum["cuotas_faltantes"] != 0]
        if not faltantes.empty:
            results["findings"].append({
                "severity": "warning",
                "message": f"{len(faltantes)} pólizas+renovación con cuotas registradas ≠ total_cuotas declarado",
                "detail": f"Con cuotas de más: {(faltantes['cuotas_faltantes'] < 0).sum()}, "
                          f"con cuotas de menos: {(faltantes['cuotas_faltantes'] > 0).sum()}",
            })
            results["details"]["cuotas_faltantes"] = faltantes[
                _safe_cols(faltantes, ["poliza_id", "policy_number", "renov_int", "count_cuotas",
                 "total_cuotas_col", "cuotas_faltantes", "suma_prima", "premium"])
            ].sort_values("cuotas_faltantes", key=abs, ascending=False).head(100)

    # ─── 5. Recálculo de saldos: pagos reales vs saldo almacenado ───
    if not pagos.empty:
        # Suma de pagos por cartera_item_id
        pago_sums = pagos.groupby("cartera_item_id").agg(
            total_pagado_oficina=("valor_pagado", lambda x: x[pagos.loc[x.index, "tipo_recaudo"] == "oficina"].sum()),
            total_pagado_aseg=("valor_pagado", lambda x: x[pagos.loc[x.index, "tipo_recaudo"] == "aseguradora"].sum()),
            count_pagos=("id", "count"),
        ).reset_index()

        ci_check = cartera.merge(pago_sums, left_on="id", right_on="cartera_item_id", how="left")
        ci_check["total_pagado_oficina"] = ci_check["total_pagado_oficina"].fillna(0)
        ci_check["total_pagado_aseg"] = ci_check["total_pagado_aseg"].fillna(0)

        # Saldo esperado oficina = prima_total_pago - total_pagado_oficina
        ci_check["saldo_esperado_oficina"] = ci_check["prima_total_pago"] - ci_check["total_pagado_oficina"]
        ci_check["diff_saldo_oficina"] = (ci_check["saldo_pendiente_oficina"] - ci_check["saldo_esperado_oficina"]).abs()

        saldo_bad = ci_check[ci_check["diff_saldo_oficina"] > 1]  # >$1 de diferencia
        if not saldo_bad.empty:
            results["findings"].append({
                "severity": "critical",
                "message": f"{len(saldo_bad)} cartera_items con saldo_oficina almacenado ≠ saldo calculado (prima - pagos)",
                "detail": f"Diferencia total: ${saldo_bad['diff_saldo_oficina'].sum():,.0f}",
            })
            saldo_bad = saldo_bad.merge(
                polizas[["id", "policy_number"]],
                left_on="poliza_id", right_on="id", how="left", suffixes=("", "_pol")
            )
            results["details"]["saldos_descuadrados"] = saldo_bad[
                _safe_cols(saldo_bad, ["poliza_id", "policy_number", "numero_cuota", "prima_total_pago",
                 "total_pagado_oficina", "saldo_pendiente_oficina",
                 "saldo_esperado_oficina", "diff_saldo_oficina", "numero_renovacion"])
            ].sort_values("diff_saldo_oficina", ascending=False).head(100)

    # ─── 6. Pagos sin cartera_item ───
    if not pagos.empty:
        pagos_sin_ci = pagos[pagos["cartera_item_id"].isna() | (pagos["cartera_item_id"] == 0)]
        if not pagos_sin_ci.empty:
            results["findings"].append({
                "severity": "warning",
                "message": f"{len(pagos_sin_ci)} pagos sin cartera_item_id asignado",
            })
            results["details"]["pagos_sin_cartera"] = pagos_sin_ci[
                ["id", "poliza_id", "tipo_recaudo", "valor_pagado", "fecha_pago", "numero_renovacion"]
            ].head(50)

    # ─── 7. Cruce con cartera SoftSeguros ───
    soft_cartera = excel_data.get("cartera_por_cobrar", pd.DataFrame())
    if not soft_cartera.empty and "numero_poliza" in soft_cartera.columns:
        soft_cartera["policy_key"] = soft_cartera["numero_poliza"].astype(str).str.strip().str.upper()
        polizas["policy_key"] = polizas["policy_number"].astype(str).str.strip().str.upper()

        # Sumar saldo por póliza en SoftSeguros
        if "saldo_pendiente_oficina" in soft_cartera.columns:
            soft_saldo = soft_cartera.groupby("policy_key").agg(
                saldo_soft_oficina=("saldo_pendiente_oficina", "sum"),
                cuotas_soft=("policy_key", "count"),
            ).reset_index()

            # Sumar saldo por póliza en Guro
            ci_with_key = cartera.merge(
                polizas[["id", "policy_key"]], left_on="poliza_id", right_on="id", how="left"
            )
            guro_saldo = ci_with_key.groupby("policy_key").agg(
                saldo_guro_oficina=("saldo_pendiente_oficina", "sum"),
                cuotas_guro=("poliza_id", "count"),
            ).reset_index()

            cross = soft_saldo.merge(guro_saldo, on="policy_key", how="outer")
            cross["saldo_soft_oficina"] = cross["saldo_soft_oficina"].fillna(0)
            cross["saldo_guro_oficina"] = cross["saldo_guro_oficina"].fillna(0)
            cross["diff_saldo"] = (cross["saldo_guro_oficina"] - cross["saldo_soft_oficina"]).abs()

            diff_gt_1k = cross[cross["diff_saldo"] > 1000]
            if not diff_gt_1k.empty:
                results["findings"].append({
                    "severity": "critical",
                    "message": f"{len(diff_gt_1k)} pólizas con diferencia de saldo oficina > $1,000 entre Guro y SoftSeguros",
                    "detail": f"Diferencia total: ${diff_gt_1k['diff_saldo'].sum():,.0f}",
                })
                results["details"]["saldo_cross_soft_guro"] = diff_gt_1k.sort_values(
                    "diff_saldo", ascending=False
                ).head(100)

    return results
