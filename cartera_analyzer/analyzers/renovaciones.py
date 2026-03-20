"""
ANÁLISIS 2: Renovaciones y su coherencia.
Detecta:
 - Pólizas con numero_renovacion > 0 pero cartera_items en R=0
 - Pólizas con cartera_items en múltiples renovaciones (ej: R=0 y R=1)
 - Pólizas renovadas que no tienen cartera_items en la renovación actual
 - Pagos asignados a una renovación diferente a sus cartera_items
 - Comisiones con renovación inconsistente
 - Conteo de renovaciones en DB vs historial en SoftSeguros
"""
import pandas as pd
import numpy as np


def analyze(db_data, excel_data):
    results = {
        "title": "Análisis de Renovaciones y Coherencia numero_renovacion",
        "findings": [],
        "stats": {},
        "details": {},
    }

    polizas = db_data["polizas"].copy()
    cartera = db_data["cartera_items"].copy()
    pagos = db_data["pagos_polizas"].copy()
    cobros = db_data["cobros_comision"].copy()
    produccion = excel_data.get("produccion", pd.DataFrame())

    # ─── Stats generales de renovación en DB ───
    polizas["renov_int"] = pd.to_numeric(polizas["numero_renovacion"], errors="coerce").fillna(0).astype(int)
    renov_dist = polizas["renov_int"].value_counts().sort_index()
    results["stats"]["distribucion_renovacion_polizas"] = renov_dist.to_dict()
    results["stats"]["polizas_con_renovacion_gt0"] = int((polizas["renov_int"] > 0).sum())
    results["stats"]["total_polizas"] = len(polizas)

    # ─── 1. Pólizas con R>0 pero cartera_items solo en R=0 ───
    polizas_renov = polizas[polizas["renov_int"] > 0].copy()

    if not polizas_renov.empty and not cartera.empty:
        mismatch_list = []
        for _, pol in polizas_renov.iterrows():
            pol_id = pol["id"]
            pol_renov = int(pol["renov_int"])
            ci = cartera[cartera["poliza_id"] == pol_id]
            if ci.empty:
                mismatch_list.append({
                    "poliza_id": pol_id,
                    "policy_number": pol["policy_number"],
                    "poliza_renovacion": pol_renov,
                    "cartera_renovaciones": "SIN CARTERA",
                    "count_items": 0,
                    "issue": "sin_cartera",
                })
                continue

            ci_renovaciones = set(pd.to_numeric(ci["numero_renovacion"], errors="coerce").fillna(0).astype(int).unique())
            if pol_renov not in ci_renovaciones:
                mismatch_list.append({
                    "poliza_id": pol_id,
                    "policy_number": pol["policy_number"],
                    "poliza_renovacion": pol_renov,
                    "cartera_renovaciones": str(sorted(ci_renovaciones)),
                    "count_items": len(ci),
                    "issue": "renovacion_mismatch",
                })

        if mismatch_list:
            df_mismatch = pd.DataFrame(mismatch_list)
            by_issue = df_mismatch["issue"].value_counts().to_dict()
            results["findings"].append({
                "severity": "critical",
                "message": f"{len(df_mismatch)} pólizas con R>0 no tienen cartera_items en su renovación actual",
                "detail": f"sin_cartera: {by_issue.get('sin_cartera', 0)}, renovacion_mismatch: {by_issue.get('renovacion_mismatch', 0)}",
            })
            results["details"]["renov_mismatch_polizas"] = df_mismatch

    # ─── 2. Pólizas con cartera_items en múltiples renovaciones ───
    if not cartera.empty:
        ci_renov_per_poliza = cartera.groupby("poliza_id")["numero_renovacion"].apply(
            lambda x: sorted(x.fillna(0).astype(int).unique().tolist())
        ).reset_index(name="renovaciones")
        ci_renov_per_poliza["n_renovaciones"] = ci_renov_per_poliza["renovaciones"].apply(len)
        multi_renov = ci_renov_per_poliza[ci_renov_per_poliza["n_renovaciones"] > 1]

        if not multi_renov.empty:
            multi_renov = multi_renov.merge(
                polizas[["id", "policy_number", "numero_renovacion", "status"]],
                left_on="poliza_id", right_on="id", how="left"
            )
            results["findings"].append({
                "severity": "warning",
                "message": f"{len(multi_renov)} pólizas tienen cartera_items en MÚLTIPLES renovaciones",
                "detail": "Puede generar saldos inflados al sumar cuotas de períodos distintos",
            })
            results["details"]["cartera_multi_renovacion"] = multi_renov[
                ["poliza_id", "policy_number", "numero_renovacion", "renovaciones", "n_renovaciones", "status"]
            ].sort_values("n_renovaciones", ascending=False).head(100)

    # ─── 3. Pagos con renovación diferente a su cartera_item ───
    if not pagos.empty and not cartera.empty:
        pagos_with_ci = pagos[pagos["cartera_item_id"].notna()].copy()
        if not pagos_with_ci.empty:
            pagos_with_ci = pagos_with_ci.merge(
                cartera[["id", "numero_renovacion"]].rename(columns={
                    "id": "cartera_item_id",
                    "numero_renovacion": "ci_renovacion"
                }),
                on="cartera_item_id", how="left"
            )
            pagos_with_ci["pago_renov"] = pagos_with_ci["numero_renovacion"].fillna(0).astype(int)
            pagos_with_ci["ci_renov"] = pagos_with_ci["ci_renovacion"].fillna(0).astype(int)
            pagos_mismatched = pagos_with_ci[pagos_with_ci["pago_renov"] != pagos_with_ci["ci_renov"]]

            if not pagos_mismatched.empty:
                results["findings"].append({
                    "severity": "warning",
                    "message": f"{len(pagos_mismatched)} pagos tienen numero_renovacion diferente a su cartera_item",
                    "detail": "El pago apunta a una cuota de otra renovación",
                })
                results["details"]["pagos_renov_mismatch"] = pagos_mismatched[
                    ["id", "poliza_id", "cartera_item_id", "pago_renov", "ci_renov",
                     "tipo_recaudo", "valor_pagado"]
                ].head(100)

    # ─── 4. Cobros comisión con renovación inconsistente ───
    if not cobros.empty and not cartera.empty:
        cobros_with_ci = cobros[cobros["cartera_item_id"].notna()].copy()
        if not cobros_with_ci.empty:
            cobros_with_ci = cobros_with_ci.merge(
                cartera[["id", "numero_renovacion"]].rename(columns={
                    "id": "cartera_item_id",
                    "numero_renovacion": "ci_renovacion"
                }),
                on="cartera_item_id", how="left"
            )
            cobros_with_ci["cobro_renov"] = cobros_with_ci["numero_renovacion"].fillna(0).astype(int)
            cobros_with_ci["ci_renov"] = cobros_with_ci["ci_renovacion"].fillna(0).astype(int)
            cobros_mismatch = cobros_with_ci[cobros_with_ci["cobro_renov"] != cobros_with_ci["ci_renov"]]

            if not cobros_mismatch.empty:
                results["findings"].append({
                    "severity": "warning",
                    "message": f"{len(cobros_mismatch)} cobros de comisión con renovación inconsistente vs cartera_item",
                })
                results["details"]["cobros_renov_mismatch"] = cobros_mismatch[
                    ["id", "poliza_id", "cartera_item_id", "cobro_renov", "ci_renov",
                     "valor_comision", "valor_cobrado"]
                ].head(100)

    # ─── 5. Cruce renovaciones DB vs SoftSeguros ───
    if not produccion.empty and "nueva___renovada" in produccion.columns:
        produccion["policy_key"] = produccion["numero_poliza"].astype(str).str.strip().str.upper()

        # Contar cuántas veces aparece cada póliza en producción (cada aparición = una vigencia)
        soft_counts = produccion.groupby("policy_key").size().reset_index(name="vigencias_soft")

        polizas["policy_key"] = polizas["policy_number"].astype(str).str.strip().str.upper()
        polizas["expected_vigencias"] = polizas["numero_renovacion"].fillna(0).astype(int) + 1

        merged = polizas[["id", "policy_key", "policy_number", "numero_renovacion", "expected_vigencias", "status"]].merge(
            soft_counts, on="policy_key", how="inner"
        )
        merged["diff_vigencias"] = merged["expected_vigencias"] - merged["vigencias_soft"]
        discrepantes = merged[merged["diff_vigencias"] != 0]

        if not discrepantes.empty:
            results["findings"].append({
                "severity": "info",
                "message": f"{len(discrepantes)} pólizas con # vigencias diferente entre Guro (R+1) y SoftSeguros",
                "detail": f"Guro dice más vigencias: {(discrepantes['diff_vigencias'] > 0).sum()}, "
                          f"SoftSeguros dice más: {(discrepantes['diff_vigencias'] < 0).sum()}",
            })
            results["details"]["vigencias_discrepantes"] = discrepantes.sort_values(
                "diff_vigencias", key=abs, ascending=False
            ).head(100)

    return results
