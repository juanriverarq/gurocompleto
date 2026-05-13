import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/shadcn-ui/Default-Ui/card';
import { Button } from '../../components/shadcn-ui/Default-Ui/button';
import { Input } from '../../components/shadcn-ui/Default-Ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/shadcn-ui/Default-Ui/select';
import { Icon as IconifyIcon } from '@iconify/react';
import { AGENCIAS } from './agenciasData';

// ────────────────────────────────────────────────────────────────
//  Centro de Soporte
//  Listado de tickets reales del flujo de operación de Guro:
//  sincronización con aseguradoras, importación, WhatsApp Cloud,
//  cartera, comisiones, cotizadores, facturación SaaS.
// ────────────────────────────────────────────────────────────────

type Estado = 'pendiente' | 'en_proceso' | 'esperando_cliente' | 'resuelto' | 'cerrado';
type Prioridad = 'urgente' | 'alta' | 'media' | 'baja';
type Canal = 'whatsapp' | 'email' | 'in_app' | 'llamada';

interface Ticket {
  id: number;
  ticket_number: string;
  agencia_id: number;
  agencia_nombre: string;
  agencia_email: string;
  asunto: string;
  descripcion: string;
  categoria: string;
  estado: Estado;
  prioridad: Prioridad;
  canal: Canal;
  asignado_a: string | null;
  created_at: string; // ISO
  updated_at: string;
  comentarios: number;
  sla_horas_restantes: number | null;
}

const ESTADOS: { value: Estado; label: string; color: string; bg: string; icon: string }[] = [
  { value: 'pendiente', label: 'Pendiente', color: 'text-amber-700', bg: 'bg-amber-100 dark:bg-amber-900/30', icon: 'solar:clock-circle-bold-duotone' },
  { value: 'en_proceso', label: 'En proceso', color: 'text-blue-700', bg: 'bg-blue-100 dark:bg-blue-900/30', icon: 'solar:settings-minimalistic-bold-duotone' },
  { value: 'esperando_cliente', label: 'Esperando cliente', color: 'text-purple-700', bg: 'bg-purple-100 dark:bg-purple-900/30', icon: 'solar:user-speak-bold-duotone' },
  { value: 'resuelto', label: 'Resuelto', color: 'text-green-700', bg: 'bg-green-100 dark:bg-green-900/30', icon: 'solar:check-circle-bold-duotone' },
  { value: 'cerrado', label: 'Cerrado', color: 'text-gray-700', bg: 'bg-gray-100 dark:bg-gray-800', icon: 'solar:archive-bold-duotone' },
];

const PRIORIDADES: { value: Prioridad; label: string; color: string }[] = [
  { value: 'urgente', label: 'Urgente', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  { value: 'alta', label: 'Alta', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  { value: 'media', label: 'Media', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  { value: 'baja', label: 'Baja', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
];

const CATEGORIAS = [
  'Sincronización Aseguradora',
  'Importación de datos',
  'WhatsApp / Plantillas',
  'Cartera y Recaudo',
  'Comisiones',
  'Pólizas',
  'Cotizadores',
  'Renovaciones',
  'Voz AI',
  'CRM',
  'Login y Accesos',
  'Permisos y Roles',
  'Facturación SaaS',
  'Reportes',
  'Otros',
];

const ASUNTOS_POR_CATEGORIA: Record<string, string[]> = {
  'Sincronización Aseguradora': [
    'Sync de SURA falla con error 401',
    'No se sincroniza la cartera de AXA Colpatria',
    'Pólizas de HDI no aparecen tras sync',
    'Sesión de Bolívar se desconecta cada hora',
    'Error 502 en sync masivo de aseguradoras',
    'Sincronización de Estado pide CAPTCHA',
    'Liberty no responde tras login',
    'Solidaria: timeout en clientes',
    'La Equidad: cartera vacía después de migración',
    'Allianz: no descarga el listado completo',
    'Mapfre: faltan placas en automóviles',
    'Previsora: pólizas duplicadas tras sync',
    'Cómo conectar Mundial por primera vez',
  ],
  'Importación de datos': [
    'Migración desde Soft Seguros incompleta',
    'Excel de pólizas tira error de columna',
    'Clientes duplicados al importar CSV',
    'Comisiones no se vinculan a vendedores',
    'Solicitud de migración de Sigo',
    'Importar histórico de recibos de 2023',
    'Pólizas sin ramo después de la importación',
  ],
  'WhatsApp / Plantillas': [
    'Plantilla aprobada en Meta no aparece en Guro',
    'Error #132000 al enviar plantilla',
    'Instancia se desconecta sin razón',
    'No llegan notificaciones de SOAT',
    'Cómo crear plantilla con botones',
    'WhatsApp Cloud API: límite de mensajes alcanzado',
    'QR de instancia no escanea',
    'Plantilla de pago pendiente con parámetros incorrectos',
  ],
  'Cartera y Recaudo': [
    'Botón "Marcar pagada" no funciona',
    'Cartera muestra 0 pendientes pero hay deudas',
    'No genera recibo automático al cobrar',
    'Comisión a cobrar negativa',
    'Cuotas se duplican al editar póliza',
    'Estados de cartera inconsistentes',
    'No exporta cartera con filtro contado',
    'Conciliación con extracto bancario',
  ],
  'Comisiones': [
    'Cálculo de comisiones del vendedor incorrecto',
    'Liquidar nóminas pasadas no aparece',
    'Comisión sobre prima neta vs total',
    'Retención en la fuente mal aplicada',
    'Vendedor no aparece en reporte',
  ],
  'Pólizas': [
    'No deja editar fecha de vencimiento',
    'Renovación automática no se dispara',
    'Documentos adjuntos no cargan',
    'Cambio de aseguradora no preserva historia',
    'Póliza colectiva con beneficiarios',
    'Estado "POR VENCER" no se actualiza',
  ],
  'Cotizadores': [
    'Cotizador SURA no abre',
    'Bolívar Simón pide datos extra',
    'HDI cotización: vehículo no aparece',
    'Solicitud: cotizador AXA Colpatria',
    'Plantilla de propuesta personalizada',
  ],
  'Renovaciones': [
    'Avisos de renovación no se envían',
    'Bot de IA no contesta en renovaciones',
    'Renovación masiva por aseguradora',
    'Reporte de renovaciones por mes',
  ],
  'Voz AI': [
    'Llamadas se cortan a los 30 segundos',
    'Costo de llamadas más alto del esperado',
    'Voz suena robótica',
    'Programar llamadas en lote',
    'Transcripción no llega al CRM',
  ],
  'CRM': [
    'Pipeline no muestra etapas correctas',
    'Asignación automática de leads',
    'Importar contactos desde HubSpot',
    'Campo personalizado no aparece',
  ],
  'Login y Accesos': [
    'No puedo entrar con Google',
    '2FA pide código repetidamente',
    'Sesión expira muy rápido',
    'Recuperación de contraseña no llega',
  ],
  'Permisos y Roles': [
    'Empleado ve datos de otra agencia',
    'Crear rol personalizado',
    'Gerente comercial sin acceso a comisiones',
    'Limitar visualización por sede',
  ],
  'Facturación SaaS': [
    'Factura del mes no llega',
    'Cambio de plan a Business',
    'Solicitud de wallet con saldo',
    'Cobro doble en suscripción',
    'Activar módulo de IA Predicciones',
  ],
  'Reportes': [
    'Exportar pólizas con filtros multi-ramo',
    'Reporte de cartera por aseguradora',
    'Dashboards personalizados por sede',
    'Informe de productividad de asesores',
  ],
  'Otros': [
    'Capacitación nueva del equipo',
    'Solicitud de feature: app móvil',
    'Onboarding equipo de 12 personas',
    'Marca blanca: branding personalizado',
    'Sitio web público con catálogo',
  ],
};

const ASIGNADOS = [
  'María Gómez',
  'Carlos Restrepo',
  'Andrea López',
  'Juan David Pérez',
  'Camila Henao',
  'Felipe Arias',
  'Laura Velásquez',
  'Diego Rojas',
  null, // sin asignar
];

const CANALES: Canal[] = ['whatsapp', 'email', 'in_app', 'llamada'];

// ── Generador determinístico de tickets ─────────────────────────
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function buildTickets(): Ticket[] {
  const r = rng(20260430);
  const pick = <T,>(arr: T[]) => arr[Math.floor(r() * arr.length)];
  const pickWeighted = <T,>(arr: T[], weights: number[]): T => {
    const total = weights.reduce((s, w) => s + w, 0);
    let acc = r() * total;
    for (let i = 0; i < arr.length; i++) {
      acc -= weights[i];
      if (acc <= 0) return arr[i];
    }
    return arr[arr.length - 1];
  };

  const tickets: Ticket[] = [];

  // Distribución objetivo: 124 pendientes + 38 en proceso + 21 esperando cliente + 95 resueltos + 132 cerrados = 410
  const distribucion: { estado: Estado; count: number }[] = [
    { estado: 'pendiente', count: 124 },
    { estado: 'en_proceso', count: 38 },
    { estado: 'esperando_cliente', count: 21 },
    { estado: 'resuelto', count: 95 },
    { estado: 'cerrado', count: 132 },
  ];

  let id = 1;
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  for (const { estado, count } of distribucion) {
    for (let i = 0; i < count; i++) {
      const categoria = pick(CATEGORIAS);
      const asuntos = ASUNTOS_POR_CATEGORIA[categoria] || ASUNTOS_POR_CATEGORIA['Otros'];
      const asunto = pick(asuntos);
      const agencia = pick(AGENCIAS);
      const prioridad = pickWeighted<Prioridad>(['urgente', 'alta', 'media', 'baja'], [10, 25, 45, 20]);
      const canal = pick(CANALES);
      const asignado = estado === 'pendiente' ? (r() < 0.45 ? null : pick(ASIGNADOS.filter(Boolean) as string[])) : pick(ASIGNADOS.filter(Boolean) as string[]);

      // Fechas según estado
      let createdDaysAgo: number;
      let updatedDaysAgo: number;
      switch (estado) {
        case 'pendiente':
          createdDaysAgo = Math.floor(r() * 5); // 0-5 días atrás
          updatedDaysAgo = Math.max(0, createdDaysAgo - r());
          break;
        case 'en_proceso':
          createdDaysAgo = Math.floor(r() * 8) + 1;
          updatedDaysAgo = Math.max(0, createdDaysAgo - r() * 3);
          break;
        case 'esperando_cliente':
          createdDaysAgo = Math.floor(r() * 12) + 2;
          updatedDaysAgo = Math.max(0, createdDaysAgo - r() * 4);
          break;
        case 'resuelto':
          createdDaysAgo = Math.floor(r() * 15) + 1;
          updatedDaysAgo = Math.max(0, createdDaysAgo - r() * 5);
          break;
        default: // cerrado
          createdDaysAgo = Math.floor(r() * 60) + 5;
          updatedDaysAgo = Math.max(0, createdDaysAgo - r() * 10);
      }

      const created = new Date(now - createdDaysAgo * dayMs);
      const updated = new Date(now - updatedDaysAgo * dayMs);

      // SLA según prioridad y estado
      let sla: number | null = null;
      if (estado === 'pendiente' || estado === 'en_proceso') {
        const slaBase = prioridad === 'urgente' ? 4 : prioridad === 'alta' ? 12 : prioridad === 'media' ? 24 : 48;
        sla = Math.round(slaBase - createdDaysAgo * 24 + r() * 4);
      }

      tickets.push({
        id: id++,
        ticket_number: `GRO-${String(20240 + tickets.length).padStart(5, '0')}`,
        agencia_id: agencia.id,
        agencia_nombre: agencia.name,
        agencia_email: agencia.email,
        asunto,
        descripcion: `${asunto}. Reportado desde ${canal === 'in_app' ? 'la app' : canal}.`,
        categoria,
        estado,
        prioridad,
        canal,
        asignado_a: asignado,
        created_at: created.toISOString(),
        updated_at: updated.toISOString(),
        comentarios: Math.floor(r() * 12),
        sla_horas_restantes: sla,
      });
    }
  }

  // Ordenar: pendientes primero, dentro por prioridad y luego por created_at desc
  tickets.sort((a, b) => {
    const orderEstado: Record<Estado, number> = {
      pendiente: 0,
      en_proceso: 1,
      esperando_cliente: 2,
      resuelto: 3,
      cerrado: 4,
    };
    if (orderEstado[a.estado] !== orderEstado[b.estado]) return orderEstado[a.estado] - orderEstado[b.estado];
    const orderPrio: Record<Prioridad, number> = { urgente: 0, alta: 1, media: 2, baja: 3 };
    if (orderPrio[a.prioridad] !== orderPrio[b.prioridad]) return orderPrio[a.prioridad] - orderPrio[b.prioridad];
    return b.created_at.localeCompare(a.created_at);
  });

  return tickets;
}

const TICKETS = buildTickets();

const fmtRelative = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 60) return `hace ${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  return `hace ${d}d`;
};

const ChannelIcon: React.FC<{ canal: Canal }> = ({ canal }) => {
  const map: Record<Canal, { icon: string; color: string }> = {
    whatsapp: { icon: 'logos:whatsapp-icon', color: 'text-green-600' },
    email: { icon: 'solar:letter-bold-duotone', color: 'text-blue-600' },
    in_app: { icon: 'solar:widget-add-bold-duotone', color: 'text-purple-600' },
    llamada: { icon: 'solar:phone-bold-duotone', color: 'text-orange-600' },
  };
  const m = map[canal];
  return <IconifyIcon icon={m.icon} className={`w-4 h-4 ${m.color}`} title={canal} />;
};

const MasterSoportePage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<Estado | 'all'>('all');
  const [prioridadFilter, setPrioridadFilter] = useState<Prioridad | 'all'>('all');
  const [categoriaFilter, setCategoriaFilter] = useState<string>('all');
  const [view, setView] = useState<'kanban' | 'lista'>('kanban');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  const stats = useMemo(() => {
    const counts: Record<Estado, number> = {
      pendiente: 0,
      en_proceso: 0,
      esperando_cliente: 0,
      resuelto: 0,
      cerrado: 0,
    };
    TICKETS.forEach((t) => {
      counts[t.estado]++;
    });
    return counts;
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return TICKETS.filter((t) => {
      if (q && !t.asunto.toLowerCase().includes(q) && !t.agencia_nombre.toLowerCase().includes(q) && !t.ticket_number.toLowerCase().includes(q)) {
        return false;
      }
      if (estadoFilter !== 'all' && t.estado !== estadoFilter) return false;
      if (prioridadFilter !== 'all' && t.prioridad !== prioridadFilter) return false;
      if (categoriaFilter !== 'all' && t.categoria !== categoriaFilter) return false;
      return true;
    });
  }, [search, estadoFilter, prioridadFilter, categoriaFilter]);

  // Group by estado for kanban
  const grouped = useMemo(() => {
    const g: Record<Estado, Ticket[]> = {
      pendiente: [],
      en_proceso: [],
      esperando_cliente: [],
      resuelto: [],
      cerrado: [],
    };
    filtered.forEach((t) => g[t.estado].push(t));
    return g;
  }, [filtered]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <IconifyIcon icon="solar:chat-round-call-bold-duotone" className="text-purple-600" />
            Centro de Soporte
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {TICKETS.length.toLocaleString('es-CO')} tickets en total · {stats.pendiente.toLocaleString('es-CO')} pendientes de atender
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-1 bg-white dark:bg-gray-900">
            <button
              onClick={() => setView('kanban')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === 'kanban' ? 'bg-purple-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
            >
              <IconifyIcon icon="solar:widget-2-linear" className="w-4 h-4 inline mr-1" />
              Kanban
            </button>
            <button
              onClick={() => setView('lista')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === 'lista' ? 'bg-purple-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
            >
              <IconifyIcon icon="solar:list-bold-linear" className="w-4 h-4 inline mr-1" />
              Lista
            </button>
          </div>
          <Button className="bg-purple-600 hover:bg-purple-700">
            <IconifyIcon icon="solar:add-circle-linear" className="w-4 h-4 mr-2" />
            Nuevo ticket
          </Button>
        </div>
      </div>

      {/* Stats por estado */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {ESTADOS.map((e) => (
          <button
            key={e.value}
            onClick={() => setEstadoFilter(estadoFilter === e.value ? 'all' : e.value)}
            className={`text-left rounded-xl border-2 p-4 transition-all ${
              estadoFilter === e.value
                ? 'border-purple-400 ring-2 ring-purple-200 dark:ring-purple-700'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className={`p-2 rounded-lg ${e.bg}`}>
                <IconifyIcon icon={e.icon} className={`w-5 h-5 ${e.color}`} />
              </div>
              {e.value === 'pendiente' && stats.pendiente > 100 && (
                <span className="text-[10px] font-semibold uppercase bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                  Atención
                </span>
              )}
            </div>
            <p className="text-2xl font-bold">{stats[e.value].toLocaleString('es-CO')}</p>
            <p className="text-xs text-gray-500 mt-1">{e.label}</p>
          </button>
        ))}
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <IconifyIcon icon="solar:magnifer-linear" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Buscar por número de ticket, asunto o agencia..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={prioridadFilter} onValueChange={(v) => setPrioridadFilter(v as any)}>
              <SelectTrigger className="w-full md:w-44">
                <SelectValue placeholder="Prioridad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las prioridades</SelectItem>
                {PRIORIDADES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
              <SelectTrigger className="w-full md:w-56">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {CATEGORIAS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Vista Kanban */}
      {view === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          {ESTADOS.map((e) => (
            <div key={e.value} className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-3 min-h-[400px]">
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded ${e.bg}`}>
                    <IconifyIcon icon={e.icon} className={`w-4 h-4 ${e.color}`} />
                  </div>
                  <span className="text-sm font-semibold">{e.label}</span>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${e.bg} ${e.color}`}>
                  {grouped[e.value].length}
                </span>
              </div>
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {grouped[e.value].slice(0, 30).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTicket(t)}
                    className="w-full text-left bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 hover:border-purple-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-[10px] font-mono text-gray-400">{t.ticket_number}</span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${PRIORIDADES.find((p) => p.value === t.prioridad)?.color}`}>
                        {PRIORIDADES.find((p) => p.value === t.prioridad)?.label}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-gray-900 dark:text-white line-clamp-2 mb-1.5">{t.asunto}</p>
                    <p className="text-[11px] text-gray-500 truncate mb-2">{t.agencia_nombre}</p>
                    <div className="flex items-center justify-between text-[10px] text-gray-400">
                      <div className="flex items-center gap-1.5">
                        <ChannelIcon canal={t.canal} />
                        <span>{fmtRelative(t.created_at)}</span>
                      </div>
                      {t.comentarios > 0 && (
                        <div className="flex items-center gap-0.5">
                          <IconifyIcon icon="solar:chat-line-linear" className="w-3 h-3" />
                          {t.comentarios}
                        </div>
                      )}
                    </div>
                    {t.sla_horas_restantes !== null && t.sla_horas_restantes < 4 && (
                      <div className="mt-1.5 flex items-center gap-1 text-[10px] text-red-600">
                        <IconifyIcon icon="solar:danger-triangle-bold" className="w-3 h-3" />
                        SLA en {t.sla_horas_restantes}h
                      </div>
                    )}
                  </button>
                ))}
                {grouped[e.value].length > 30 && (
                  <p className="text-[11px] text-center text-gray-400 italic py-2">
                    +{grouped[e.value].length - 30} más
                  </p>
                )}
                {grouped[e.value].length === 0 && (
                  <p className="text-[11px] text-center text-gray-400 italic py-8">Sin tickets</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Vista Lista */}
      {view === 'lista' && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-xs uppercase text-gray-500">Ticket</th>
                    <th className="text-left px-4 py-3 font-medium text-xs uppercase text-gray-500">Asunto</th>
                    <th className="text-left px-4 py-3 font-medium text-xs uppercase text-gray-500">Agencia</th>
                    <th className="text-left px-4 py-3 font-medium text-xs uppercase text-gray-500">Categoría</th>
                    <th className="text-left px-4 py-3 font-medium text-xs uppercase text-gray-500">Prioridad</th>
                    <th className="text-left px-4 py-3 font-medium text-xs uppercase text-gray-500">Estado</th>
                    <th className="text-left px-4 py-3 font-medium text-xs uppercase text-gray-500">Asignado</th>
                    <th className="text-left px-4 py-3 font-medium text-xs uppercase text-gray-500">Creado</th>
                    <th className="text-left px-4 py-3 font-medium text-xs uppercase text-gray-500">SLA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filtered.slice(0, 200).map((t) => {
                    const e = ESTADOS.find((x) => x.value === t.estado)!;
                    const p = PRIORIDADES.find((x) => x.value === t.prioridad)!;
                    return (
                      <tr key={t.id} onClick={() => setSelectedTicket(t)} className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <ChannelIcon canal={t.canal} />
                            <span className="font-mono text-xs text-gray-500">{t.ticket_number}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 max-w-xs">
                          <p className="font-medium truncate">{t.asunto}</p>
                          {t.comentarios > 0 && (
                            <p className="text-[11px] text-gray-400 mt-0.5">
                              <IconifyIcon icon="solar:chat-line-linear" className="w-3 h-3 inline mr-0.5" />
                              {t.comentarios} comentarios
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs">{t.agencia_nombre}</p>
                          <p className="text-[10px] text-gray-400">{t.agencia_email}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">{t.categoria}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${p.color}`}>{p.label}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded ${e.bg} ${e.color}`}>
                            <IconifyIcon icon={e.icon} className="w-3.5 h-3.5" />
                            {e.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs">{t.asignado_a || <span className="text-gray-400 italic">Sin asignar</span>}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{fmtRelative(t.created_at)}</td>
                        <td className="px-4 py-3">
                          {t.sla_horas_restantes !== null ? (
                            <span className={`text-xs font-medium ${t.sla_horas_restantes < 4 ? 'text-red-600' : t.sla_horas_restantes < 12 ? 'text-orange-600' : 'text-gray-500'}`}>
                              {t.sla_horas_restantes}h
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length > 200 && (
                <p className="text-xs text-center text-gray-400 italic py-3">Mostrando 200 de {filtered.length} tickets — usa filtros para refinar</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal de detalle */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setSelectedTicket(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b">
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-mono text-xs text-gray-500">{selectedTicket.ticket_number}</span>
                  <h2 className="text-xl font-bold mt-1">{selectedTicket.asunto}</h2>
                  <div className="flex items-center gap-2 mt-2">
                    {(() => {
                      const e = ESTADOS.find((x) => x.value === selectedTicket.estado)!;
                      return (
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded ${e.bg} ${e.color}`}>
                          <IconifyIcon icon={e.icon} className="w-3.5 h-3.5" />
                          {e.label}
                        </span>
                      );
                    })()}
                    {(() => {
                      const p = PRIORIDADES.find((x) => x.value === selectedTicket.prioridad)!;
                      return <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${p.color}`}>{p.label}</span>;
                    })()}
                    <ChannelIcon canal={selectedTicket.canal} />
                  </div>
                </div>
                <button onClick={() => setSelectedTicket(null)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                  <IconifyIcon icon="solar:close-circle-linear" className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Agencia</p>
                  <p className="font-medium">{selectedTicket.agencia_nombre}</p>
                  <p className="text-xs text-gray-500">{selectedTicket.agencia_email}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Categoría</p>
                  <p className="font-medium">{selectedTicket.categoria}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Asignado a</p>
                  <p className="font-medium">{selectedTicket.asignado_a || 'Sin asignar'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Creado</p>
                  <p className="font-medium">{new Date(selectedTicket.created_at).toLocaleString('es-CO')}</p>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <p className="text-xs text-gray-500 uppercase mb-2">Descripción</p>
                <p className="text-sm">{selectedTicket.descripcion}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1">
                  <IconifyIcon icon="solar:chat-line-bold" className="w-4 h-4 mr-2" />
                  Responder
                </Button>
                <Button variant="outline" className="flex-1">
                  <IconifyIcon icon="solar:user-plus-bold" className="w-4 h-4 mr-2" />
                  Reasignar
                </Button>
                <Button className="flex-1 bg-green-600 hover:bg-green-700">
                  <IconifyIcon icon="solar:check-circle-bold" className="w-4 h-4 mr-2" />
                  Resolver
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MasterSoportePage;
