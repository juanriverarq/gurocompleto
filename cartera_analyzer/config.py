"""
Configuración central del analizador de cartera.
Soporta conexión local (XAMPP) y remota (producción vía SSH tunnel).
"""
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ─── Modo: "local" o "remote" ───
MODE = "local"

# ─── MySQL LOCAL (XAMPP) ───
LOCAL_DB_HOST     = "127.0.0.1"
LOCAL_DB_PORT     = 3306
LOCAL_DB_NAME     = "Guro"
LOCAL_DB_USER     = "root"
LOCAL_DB_PASSWORD = ""

# ─── MySQL REMOTO (producción, a través de SSH tunnel) ───
REMOTE_SSH_HOST = "178.18.246.209"
REMOTE_SSH_PORT = 22
REMOTE_SSH_USER = "root"
REMOTE_SSH_KEY  = os.path.expanduser("~/.ssh/guro_deploy")
REMOTE_DB_HOST     = "127.0.0.1"
REMOTE_DB_PORT     = 3306
REMOTE_DB_NAME     = "guro_bd"
REMOTE_DB_USER     = "guro_bd"
REMOTE_DB_PASSWORD = "Jua88riv25."

# ─── Broker a analizar ───
BROKER_ID = 54  # Seguros Santa María

# ─── Archivos Excel SoftSeguros ───
EXCEL_FILES = {
    # Producción total (pólizas con detalle completo)
    "produccion": os.path.join(BASE_DIR, "produccion_total.xlsx"),
    # Pólizas exportadas
    "polizas_soft": os.path.join(BASE_DIR, "data", "pólizas (3).xlsx"),
    # Cartera
    "cartera_por_cobrar": os.path.join(BASE_DIR, "cartera", "por_cobrar (1).xlsx"),
    "cartera_por_pagar": os.path.join(BASE_DIR, "cartera", "por_pagar_aseguradoras.xlsx"),
    "comisiones_por_cobrar": os.path.join(BASE_DIR, "cartera", "comisiones_por_cobrar.xlsx"),
    "comisiones_recibidas": os.path.join(BASE_DIR, "cartera", "comisiones_recibidas (1).xlsx"),
    # Recibos
    "recibos_activos": os.path.join(BASE_DIR, "recibos", "listado_de_recibos_activos.xlsx"),
    "recibos_directos": os.path.join(BASE_DIR, "recibos", "listado_de_recibos_directos.xlsx"),
    "recibos_anulados": os.path.join(BASE_DIR, "recibos", "listado_de_recibos_anulados.xlsx"),
    # Recaudos
    "recaudos_activos": os.path.join(BASE_DIR, "data", "recaudos-activos.xlsx"),
    "recaudos_directos": os.path.join(BASE_DIR, "data", "recaudos-directos.xlsx"),
    "recaudos_anulados": os.path.join(BASE_DIR, "data", "recaudos-anulados.xlsx"),
    # Pagos
    "pagos_cartera_cobrar": os.path.join(BASE_DIR, "data", "Listado de pagos cartera por cobrar.xlsx"),
    "pagos_cartera_pagar": os.path.join(BASE_DIR, "data", "Listado de pagos cartera por pagar compania (1).xlsx"),
    # Clientes
    "clientes_soft": os.path.join(BASE_DIR, "data", "listado_de_clientes_contactos_vehiculos (2).xlsx"),
}

# ─── Salida de reportes ───
OUTPUT_DIR = os.path.join(BASE_DIR, "cartera_analyzer", "output")
os.makedirs(OUTPUT_DIR, exist_ok=True)
