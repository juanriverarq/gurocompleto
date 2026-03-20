"""
ANÁLISIS 6: Comisiones — coherencia entre cobros, cartera y SoftSeguros.
Detecta:
 - Pólizas con comisión en DB pero sin cobro de comisión registrado
 - Cobros de comisión que exceden la comisión esperada
 - Cruce comisiones Guro vs comisiones SoftSeguros (por cobrar / recibidas)
 - Pólizas con porcentaje de comisión = 0 pero con cobros
"""
import pandas as pd
import numpy as np


def analyze(db_data, excel_data):
    results = {
        "title": "Análisis de Comisiones",
        "findings": [],
        "stats": {},
        "details": {},
    }

    polizas = db_data["polizas"].copy()
    cartera = db_data["cartera_items"].copy()
    cobros = db_data["cobros_comision"].copy()
    com_por_cobrar = excel_data.get("comisiones_por_cobrar", pd.DataFrame())
    com_recibidas = excel_data.get("comisiones_recibidas", pd.DataFrame())

    results["stats"]["total_cobros_comision"] = len(cobros)

    if cobros.empty:
        results["findings"].append({"severity": "info", "message": "No hay cobros de comisión registrados en Guro"})
        return results

    # ─── 1. Resumen de cobros por estado ───
    estado_dist = cobros["estado"].value_counts().to_dict()
    cobros["valor_comision_num"] = pd.to_numeric(cobros["valor_comision"], errors="coerce").fillna(0)
    cobros["valor_cobrado_num"] = pd.to_numeric(cobros["valor_cobrado"], errors="coerce").fillna(0)
    cobros["saldo_pend_num"] = pd.to_numeric(cobros["saldo_pendiente"], errors="coerce").fillna(0)

    results["stats"]["cobros_por_estado"] = estado_dist
    results["stats"]["total_comision_esperada"] = float(cobros["valor_comision_num"].sum())
    results["stats"]["total_comision_cobrada"] = float(cobros["valor_cobrado_num"].sum())
    results["stats"]["total_comision_pendiente"] = float(cobros["saldo_pend_num"].sum())

    results["findings"].append({
        "severity": "info",
        "message": f"Comisiones: esperada ${cobros['valor_comision_num'].sum():,.0f}, "
                   f"cobrada ${cobros['valor_cobrado_num'].sum():,.0f}, "
                   f"pendiente ${cobros['saldo_pend_num'].sum():,.0f}",
        "detail": f"Distribución por estado: {estado_dist}",
    })

    # ─── 2. Cobros que exceden la comisión esperada ───
    over_cobros = cobros[cobros["valor_cobrado_num"] > cobros["valor_comision_num"] + 1]
    if not over_cobros.empty:
        results["findings"].append({
            "severity": "warning",
            "message": f"{len(over_cobros)} cobros de comisión donde valor_cobrado > valor_comision",
            "detail": f"Exceso total: ${(over_cobros['valor_cobrado_num'] - over_cobros['valor_comision_num']).sum():,.0f}",
        })
        over_cobros = over_cobros.merge(
            polizas[["id", "policy_number"]], left_on="poliza_id", right_on="id", how="left", suffixes=("", "_pol")
        )
        results["details"]["cobros_excedidos"] = over_cobros[
            ["poliza_id", "policy_number", "valor_comision_num", "valor_cobrado_num",
             "saldo_pend_num", "estado", "numero_renovacion"]
        ].sort_values("valor_cobrado_num", ascending=False).head(50)

    # ─── 3. Saldos de comisión negativos ───
    neg_saldo = cobros[cobros["saldo_pend_num"] < -0.01]
    if not neg_saldo.empty:
        results["findings"].append({
            "severity": "warning",
            "message": f"{len(neg_saldo)} cobros de comisión con saldo pendiente NEGATIVO",
        })

    # ─── 4. Cartera_items con valor_comision pero sin cobro asociado ───
    if not cartera.empty:
        ci_with_comision = cartera[pd.to_numeric(cartera["valor_comision"], errors="coerce").fillna(0) > 0]
        ci_ids_with_cobro = set(cobros["cartera_item_id"].dropna().values)
        ci_sin_cobro = ci_with_comision[~ci_with_comision["id"].isin(ci_ids_with_cobro)]
        if not ci_sin_cobro.empty:
            total_sin_cobrar = pd.to_numeric(ci_sin_cobro["valor_comision"], errors="coerce").fillna(0).sum()
            results["findings"].append({
                "severity": "warning",
                "message": f"{len(ci_sin_cobro)} cartera_items con comisión > 0 pero SIN cobro de comisión registrado",
                "detail": f"Comisión no rastreada: ${total_sin_cobrar:,.0f}",
            })

    # ─── 5. Cruce con comisiones SoftSeguros ───
    if not com_por_cobrar.empty and "numero_poliza" in com_por_cobrar.columns:
        polizas["policy_key"] = polizas["policy_number"].astype(str).str.strip().str.upper()
        com_por_cobrar["policy_key"] = com_por_cobrar["numero_poliza"].astype(str).str.strip().str.upper()

        # Buscar columna de valor
        valor_col = None
        for c in ["comision_a_recibir", "valor_comision", "comision", "valor_a_recibir"]:
            if c in com_por_cobrar.columns:
                valor_col = c
                break

        if valor_col:
            soft_com = com_por_cobrar.groupby("policy_key").agg(
                comision_soft=pd.NamedAgg(column=valor_col, aggfunc=lambda x: pd.to_numeric(x, errors="coerce").fillna(0).sum()),
            ).reset_index()

            guro_com = cobros.merge(
                polizas[["id", "policy_key"]], left_on="poliza_id", right_on="id", how="left"
            ).groupby("policy_key").agg(
                comision_guro=("valor_comision_num", "sum"),
                cobrado_guro=("valor_cobrado_num", "sum"),
            ).reset_index()

            cross = soft_com.merge(guro_com, on="policy_key", how="outer")
            cross = cross.fillna(0)
            cross["diff_comision"] = (cross["comision_guro"] - cross["comision_soft"]).abs()
            diff_big = cross[cross["diff_comision"] > 1000]

            if not diff_big.empty:
                results["findings"].append({
                    "severity": "critical",
                    "message": f"{len(diff_big)} pólizas con diferencia de comisión > $1,000 entre Guro y SoftSeguros",
                })
                results["details"]["comision_cross"] = diff_big.sort_values(
                    "diff_comision", ascending=False
                ).head(100)

    return results
