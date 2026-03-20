"""
Carga y normaliza todos los archivos Excel exportados de SoftSeguros.
Cada función devuelve un DataFrame con columnas normalizadas (snake_case).
"""
import pandas as pd
import os
from config import EXCEL_FILES


def _load(key, sheet=0, header_row=0):
    """Carga un Excel por clave de config. Retorna DataFrame o vacío si no existe."""
    path = EXCEL_FILES.get(key)
    if not path or not os.path.exists(path):
        print(f"  [WARN] Archivo no encontrado: {key} -> {path}")
        return pd.DataFrame()
    df = pd.read_excel(path, sheet_name=sheet, header=header_row, engine="openpyxl")
    df.columns = [str(c).strip() for c in df.columns]
    return df


def _normalize_cols(df):
    """Convierte nombres de columnas a snake_case limpio."""
    import re
    new_cols = {}
    for c in df.columns:
        nc = c.lower().strip()
        nc = nc.replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u").replace("ñ", "n")
        nc = re.sub(r"[^a-z0-9]+", "_", nc)
        nc = nc.strip("_")
        new_cols[c] = nc
    return df.rename(columns=new_cols)


# ─────────────────────────────────────────
# Loaders específicos
# ─────────────────────────────────────────

def load_produccion():
    """Producción total de SoftSeguros: todas las pólizas con detalle financiero."""
    df = _load("produccion", sheet="Producción total")
    if df.empty:
        return df
    df = _normalize_cols(df)
    # Tipos de datos
    for col in ["prima_neta", "gastos_de_expedicion", "iva", "valor_financiacion", "total",
                 "comision", "porcentaje_de_comision", "participacion", "porcentaje_de_iva"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
    for col in ["fecha_inicio", "fecha_fin", "fecha_expedicion", "fecha_creacion", "fecha_cancelada"]:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce")
    if "numero_poliza" in df.columns:
        df["numero_poliza"] = df["numero_poliza"].astype(str).str.strip()
    return df


def load_polizas_soft():
    """Pólizas exportadas de SoftSeguros (archivo data/pólizas)."""
    df = _load("polizas_soft")
    if df.empty:
        return df
    df = _normalize_cols(df)
    if "numero_poliza" in df.columns:
        df["numero_poliza"] = df["numero_poliza"].astype(str).str.strip()
    return df


def load_cartera_por_cobrar():
    """Cartera por cobrar clientes (SoftSeguros)."""
    df = _load("cartera_por_cobrar", sheet="Por cobrar")
    if df.empty:
        return df
    df = _normalize_cols(df)
    for col in ["valor_prima_neta", "valor_neto_a_pagar", "prima_total_del_pago",
                 "valor_prima_total", "saldo_pendiente_oficina", "saldo_pendiente_aseguradora",
                 "comision_a_recibir", "comision_vendedor",
                 "recaudado_aseguradora_pendiente_por_cobrar_al_cliente"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
    for col in ["fecha_limite_de_pago", "fecha_compromiso_de_pago",
                 "fecha_inicio_vigencia_poliza", "fecha_fin_vigencia_poliza"]:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce")
    if "numero_poliza" in df.columns:
        df["numero_poliza"] = df["numero_poliza"].astype(str).str.strip()
    return df


def load_cartera_por_pagar():
    """Cartera por pagar a aseguradoras (SoftSeguros)."""
    df = _load("cartera_por_pagar", sheet="Por pagar aseguradoras")
    if df.empty:
        return df
    df = _normalize_cols(df)
    for col in ["valor_prima_neta", "valor_neto_a_pagar", "prima_total_del_pago",
                 "valor_prima_total", "saldo_pendiente_oficina", "saldo_pendiente_aseguradora",
                 "valor_recaudado_en_oficina", "comision_a_recibir", "comision_vendedor"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
    if "numero_poliza" in df.columns:
        df["numero_poliza"] = df["numero_poliza"].astype(str).str.strip()
    return df


def load_comisiones_por_cobrar():
    """Comisiones por cobrar (SoftSeguros)."""
    df = _load("comisiones_por_cobrar")
    if df.empty:
        return df
    df = _normalize_cols(df)
    if "numero_poliza" in df.columns:
        df["numero_poliza"] = df["numero_poliza"].astype(str).str.strip()
    return df


def load_comisiones_recibidas():
    """Comisiones recibidas (SoftSeguros)."""
    df = _load("comisiones_recibidas")
    if df.empty:
        return df
    df = _normalize_cols(df)
    if "numero_poliza" in df.columns:
        df["numero_poliza"] = df["numero_poliza"].astype(str).str.strip()
    return df


def load_recibos_activos():
    """Recibos activos de SoftSeguros (~35k registros)."""
    df = _load("recibos_activos", sheet="Listado Recibos")
    if df.empty:
        return df
    df = _normalize_cols(df)
    for col in ["valor_a_pagar", "valor_recaudado_en_oficina", "comision_agencia"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
    if "numero_poliza" in df.columns:
        df["numero_poliza"] = df["numero_poliza"].astype(str).str.strip()
    return df


def load_recibos_directos():
    """Recibos directos de SoftSeguros."""
    df = _load("recibos_directos", sheet="Listado Recibos")
    if df.empty:
        return df
    df = _normalize_cols(df)
    if "numero_poliza" in df.columns:
        df["numero_poliza"] = df["numero_poliza"].astype(str).str.strip()
    return df


def load_recibos_anulados():
    """Recibos anulados de SoftSeguros."""
    df = _load("recibos_anulados", sheet="Listado Recibos")
    if df.empty:
        return df
    df = _normalize_cols(df)
    if "numero_poliza" in df.columns:
        df["numero_poliza"] = df["numero_poliza"].astype(str).str.strip()
    return df


def load_clientes_soft():
    """Clientes de SoftSeguros."""
    df = _load("clientes_soft", sheet="Clientes")
    if df.empty:
        return df
    df = _normalize_cols(df)
    return df


def load_all_excel():
    """Carga todos los archivos Excel en un diccionario."""
    print("=" * 60)
    print("CARGANDO ARCHIVOS EXCEL DE SOFTSEGUROS")
    print("=" * 60)
    data = {}
    loaders = {
        "produccion": load_produccion,
        "polizas_soft": load_polizas_soft,
        "cartera_por_cobrar": load_cartera_por_cobrar,
        "cartera_por_pagar": load_cartera_por_pagar,
        "comisiones_por_cobrar": load_comisiones_por_cobrar,
        "comisiones_recibidas": load_comisiones_recibidas,
        "recibos_activos": load_recibos_activos,
        "recibos_directos": load_recibos_directos,
        "recibos_anulados": load_recibos_anulados,
        "clientes_soft": load_clientes_soft,
    }
    for name, loader in loaders.items():
        print(f"  Cargando {name}...", end=" ")
        df = loader()
        data[name] = df
        print(f"{len(df)} filas, {len(df.columns)} cols")
    print()
    return data
