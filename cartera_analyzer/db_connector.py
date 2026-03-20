"""
Conexión a la base de datos.
Soporta modo local (XAMPP directo) y remoto (SSH tunnel a producción).
Usa SQLAlchemy para compatibilidad correcta con pandas.
"""
import pandas as pd
from sqlalchemy import create_engine, text
from contextlib import contextmanager
import config

_tunnel = None  # keep reference alive for remote mode


@contextmanager
def get_connection():
    """Crea conexión SQLAlchemy según el modo configurado (local o remote)."""
    global _tunnel
    if config.MODE == "remote":
        from sshtunnel import SSHTunnelForwarder
        _tunnel = SSHTunnelForwarder(
            (config.REMOTE_SSH_HOST, config.REMOTE_SSH_PORT),
            ssh_username=config.REMOTE_SSH_USER,
            ssh_pkey=config.REMOTE_SSH_KEY,
            remote_bind_address=(config.REMOTE_DB_HOST, config.REMOTE_DB_PORT),
            local_bind_address=("127.0.0.1", 0),
        )
        _tunnel.start()
        try:
            url = (f"mysql+pymysql://{config.REMOTE_DB_USER}:{config.REMOTE_DB_PASSWORD}"
                   f"@127.0.0.1:{_tunnel.local_bind_port}/{config.REMOTE_DB_NAME}?charset=utf8mb4")
            engine = create_engine(url)
            with engine.connect() as conn:
                yield conn
            engine.dispose()
        finally:
            _tunnel.close()
            _tunnel = None
    else:
        pwd = config.LOCAL_DB_PASSWORD or ""
        url = (f"mysql+pymysql://{config.LOCAL_DB_USER}:{pwd}"
               f"@{config.LOCAL_DB_HOST}:{config.LOCAL_DB_PORT}/{config.LOCAL_DB_NAME}?charset=utf8mb4")
        engine = create_engine(url)
        with engine.connect() as conn:
            yield conn
        engine.dispose()


def query_df(conn, sql, params=None):
    """Ejecuta una query SQL y devuelve un DataFrame de pandas."""
    return pd.read_sql(text(sql), conn, params=params)


# ─────────────────────────────────────────────
# Queries pre-armadas para el broker analizado
# ─────────────────────────────────────────────

def load_polizas(conn, broker_id=None):
    """Carga todas las pólizas del broker."""
    broker_id = broker_id or config.BROKER_ID
    return query_df(conn, """
        SELECT p.id, p.policy_number, p.status, p.start_date, p.end_date,
               p.premium_amount, p.total_amount, p.commission_percentage,
               p.commission_amount, p.numero_renovacion,
               p.client_id, p.aseguradora_id, p.ramo_id, p.broker_id,
               p.product_name, p.insurance_company, p.payment_frequency,
               p.created_at, p.updated_at, p.deleted_at,
               a.nombre AS aseguradora_nombre,
               r.nombre AS ramo_nombre,
               p.client_name AS cliente_nombre,
               p.client_document AS cliente_documento
        FROM polizas p
        LEFT JOIN aseguradoras a ON a.id = p.aseguradora_id
        LEFT JOIN ramos r ON r.id = p.ramo_id
        WHERE p.broker_id = :broker_id AND p.deleted_at IS NULL
        ORDER BY p.id
    """, {"broker_id": broker_id})


def load_cartera_items(conn, broker_id=None):
    """Carga todos los cartera_items del broker.
    Local schema: numero_pago (not numero_cuota), no total_cuotas,
    comision_a_recibir (not valor_comision), estado_cartera (not estado),
    anexo_numero (not numero_anexo).
    """
    broker_id = broker_id or config.BROKER_ID
    return query_df(conn, """
        SELECT ci.id, ci.poliza_id, ci.broker_id,
               ci.numero_pago AS numero_cuota,
               ci.prima_total_pago,
               ci.comision_a_recibir AS valor_comision,
               ci.saldo_pendiente_oficina, ci.saldo_pendiente_aseguradora,
               ci.estado_cartera AS estado,
               ci.fecha_limite_pago,
               ci.numero_renovacion,
               ci.anexo_numero AS numero_anexo,
               ci.prima_total,
               ci.valor_recaudado_oficina,
               ci.valor_pagado_aseguradora,
               ci.comision_recibida,
               ci.created_at
        FROM cartera_items ci
        WHERE ci.broker_id = :broker_id
        ORDER BY ci.poliza_id, ci.numero_renovacion, ci.numero_pago
    """, {"broker_id": broker_id})


def load_pagos_polizas(conn, broker_id=None):
    """Carga todos los pagos de pólizas del broker.
    Local schema: monto_pagado (not valor_pagado), metodo_pago (not medio_pago),
    no cartera_item_id, no numero_recibo in pagos_polizas.
    """
    broker_id = broker_id or config.BROKER_ID
    return query_df(conn, """
        SELECT pp.id, pp.poliza_id,
               NULL AS cartera_item_id,
               pp.tipo_recaudo,
               pp.monto_pagado AS valor_pagado,
               pp.fecha_pago,
               pp.numero_renovacion,
               pp.metodo_pago AS medio_pago,
               pp.recibo_caja_id AS numero_recibo,
               pp.created_at
        FROM pagos_polizas pp
        WHERE pp.broker_id = :broker_id
        ORDER BY pp.poliza_id, pp.id
    """, {"broker_id": broker_id})


def load_cobros_comision(conn, broker_id=None):
    """Carga todos los cobros de comisión del broker.
    Local table: cobros_comisiones (not cobros_comision).
    monto_comision, monto_cobrado, monto_pendiente.
    """
    broker_id = broker_id or config.BROKER_ID
    return query_df(conn, """
        SELECT cc.id, cc.poliza_id,
               NULL AS cartera_item_id,
               cc.aseguradora_id,
               cc.monto_comision AS valor_comision,
               cc.monto_cobrado AS valor_cobrado,
               cc.monto_pendiente AS saldo_pendiente,
               cc.estado, cc.fecha_cobro,
               cc.numero_renovacion, cc.created_at
        FROM cobros_comisiones cc
        WHERE cc.broker_id = :broker_id
        ORDER BY cc.poliza_id, cc.id
    """, {"broker_id": broker_id})


def load_recibos_caja(conn, broker_id=None):
    """Carga todos los recibos de caja del broker."""
    broker_id = broker_id or config.BROKER_ID
    return query_df(conn, """
        SELECT rc.id, rc.numero_recibo, rc.poliza_id,
               rc.valor_recaudado_en_oficina, rc.valor_a_pagar,
               rc.fecha_realizo_pago_oficina,
               CASE WHEN rc.activo = 1 THEN 'activo' ELSE 'inactivo' END AS estado,
               rc.created_at
        FROM recibos_caja rc
        WHERE rc.broker_id = :broker_id AND rc.deleted_at IS NULL
        ORDER BY rc.id
    """, {"broker_id": broker_id})


def load_aseguradoras(conn, broker_id=None):
    """Carga las aseguradoras del broker."""
    broker_id = broker_id or config.BROKER_ID
    return query_df(conn, """
        SELECT id, nombre, cuit AS nit FROM aseguradoras
        WHERE broker_id = :broker_id
        ORDER BY id
    """, {"broker_id": broker_id})


def load_all_data(conn, broker_id=None):
    """Carga todos los datasets de la DB en un diccionario."""
    broker_id = broker_id or config.BROKER_ID
    return {
        "polizas": load_polizas(conn, broker_id),
        "cartera_items": load_cartera_items(conn, broker_id),
        "pagos_polizas": load_pagos_polizas(conn, broker_id),
        "cobros_comision": load_cobros_comision(conn, broker_id),
        "recibos_caja": load_recibos_caja(conn, broker_id),
        "aseguradoras": load_aseguradoras(conn, broker_id),
    }
