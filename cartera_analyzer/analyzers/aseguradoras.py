"""
ANÁLISIS 4: Integridad de aseguradoras y FKs.
Detecta:
 - Pólizas con aseguradora_id que no existe en tabla aseguradoras
 - Nombres de aseguradora en SoftSeguros sin match en Guro
 - Cobros de comisión con aseguradora_id inválido
 - Mapeo sugerido de aseguradoras huérfanas
"""
import pandas as pd
from difflib import get_close_matches


def analyze(db_data, excel_data):
    results = {
        "title": "Integridad de Aseguradoras y Foreign Keys",
        "findings": [],
        "stats": {},
        "details": {},
    }

    polizas = db_data["polizas"].copy()
    aseguradoras = db_data["aseguradoras"].copy()
    cobros = db_data["cobros_comision"].copy()
    produccion = excel_data.get("produccion", pd.DataFrame())

    aseg_ids = set(aseguradoras["id"].values) if not aseguradoras.empty else set()

    results["stats"]["total_aseguradoras"] = len(aseguradoras)

    # ─── 1. Pólizas con aseguradora_id inválido ───
    if not polizas.empty and aseg_ids:
        pol_invalid_aseg = polizas[
            polizas["aseguradora_id"].notna() &
            ~polizas["aseguradora_id"].isin(aseg_ids)
        ]
        if not pol_invalid_aseg.empty:
            orphan_ids = pol_invalid_aseg["aseguradora_id"].value_counts().to_dict()
            results["findings"].append({
                "severity": "critical",
                "message": f"{len(pol_invalid_aseg)} pólizas con aseguradora_id que NO existe en tabla aseguradoras",
                "detail": f"IDs huérfanos y sus conteos: {dict(list(orphan_ids.items())[:20])}",
            })
            results["details"]["polizas_aseg_invalida"] = pol_invalid_aseg[
                ["id", "policy_number", "aseguradora_id", "insurance_company", "status"]
            ].head(100)

    # ─── 2. Cobros con aseguradora_id inválido ───
    if not cobros.empty and aseg_ids:
        cobros_invalid = cobros[
            cobros["aseguradora_id"].notna() &
            ~cobros["aseguradora_id"].isin(aseg_ids)
        ]
        if not cobros_invalid.empty:
            results["findings"].append({
                "severity": "warning",
                "message": f"{len(cobros_invalid)} cobros de comisión con aseguradora_id inválido",
            })

    # ─── 3. Nombres de aseguradora SoftSeguros vs Guro ───
    if not produccion.empty and "aseguradora" in produccion.columns and not aseguradoras.empty:
        soft_names = set(produccion["aseguradora"].dropna().astype(str).str.strip().str.upper().unique())
        guro_names = set(aseguradoras["nombre"].dropna().astype(str).str.strip().str.upper().unique())

        soft_only = soft_names - guro_names
        mapping_suggestions = []
        for name in sorted(soft_only):
            matches = get_close_matches(name, list(guro_names), n=1, cutoff=0.6)
            mapping_suggestions.append({
                "nombre_soft": name,
                "match_guro": matches[0] if matches else "SIN MATCH",
                "polizas_afectadas": int(produccion[
                    produccion["aseguradora"].astype(str).str.strip().str.upper() == name
                ].shape[0]),
            })

        if mapping_suggestions:
            df_map = pd.DataFrame(mapping_suggestions)
            sin_match = df_map[df_map["match_guro"] == "SIN MATCH"]
            results["findings"].append({
                "severity": "info",
                "message": f"{len(soft_only)} nombres de aseguradora en SoftSeguros no coinciden exactamente con Guro",
                "detail": f"Con match cercano: {len(df_map) - len(sin_match)}, sin match: {len(sin_match)}",
            })
            results["details"]["aseg_name_mapping"] = df_map.sort_values(
                "polizas_afectadas", ascending=False
            )

    return results
