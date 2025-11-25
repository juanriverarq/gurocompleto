import { useEffect, useState } from 'react';
import {
  Card,
  Badge,
  Button,
  Alert,
  Modal,
  TextInput,
  Select,
  ToggleSwitch,
  Spinner,
  Tabs,
} from 'flowbite-react';
import { Icon } from '@iconify/react';
import enlacesService from 'src/services/enlacesCotizacionService';
import { miniWebService } from 'src/services/miniWebService';
import { INSURANCE_PRODUCTS, FIELDS_BY_TIPO } from 'src/data/insuranceProducts';
import CotizacionesRecibidas from './CotizacionesRecibidas';
import PermissionGate from 'src/components/PermissionGate';
import { useUnifiedAuth } from 'src/context/UnifiedAuthContext';

const enlacesData: any[] = [];

const tiposSeguro = INSURANCE_PRODUCTS;

const getTipoInfo = (tipo: string) => {
  return tiposSeguro.find((t) => t.value === tipo) || tiposSeguro[0];
};

const EnlacesCotizacion = () => {
  const { hasPermission } = useUnifiedAuth();
  const canCreate = hasPermission('enlaces_cotizacion', 'crear');
  const canEdit = hasPermission('enlaces_cotizacion', 'editar');
  const canDelete = hasPermission('enlaces_cotizacion', 'eliminar');
  const [enlaces, setEnlaces] = useState<any[]>(enlacesData);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filtroTipo] = useState('todos');
  const [nuevoEnlace, setNuevoEnlace] = useState({
    nombre: '',
    tipo: 'vida',
    descripcion: '',
    mensaje_bienvenida: '',
  });
  const [agencySlug, setAgencySlug] = useState<string>('');
  const [analytics, setAnalytics] = useState<
    Record<string, { visits: number; quotes: number; conversion_rate: number }>
  >({});
  const [quotesByKey, setQuotesByKey] = useState<Record<string, number>>({});
  const [visitsByKey, setVisitsByKey] = useState<Record<string, number>>({});
  // Fallbacks por tipo (sin depender del slug) para cuando aún no hay slug de agencia
  const [visitsByTipo, setVisitsByTipo] = useState<Record<string, number>>({});
  const [quotesByTipo, setQuotesByTipo] = useState<Record<string, number>>({});

  const enlacesFiltrados =
    filtroTipo === 'todos' ? enlaces : enlaces.filter((e) => e.tipo === filtroTipo);

  const totalEnlaces = enlaces.length;
  const enlacesActivos = enlaces.filter((e) => e.activo).length;
  const baseSlug = agencySlug || 'mi-agencia';
  const totalVisitas = enlaces.reduce((acc, e) => {
    const key = `${baseSlug}:${e.tipo}`;
    const v = (visitsByKey[key] ??
      visitsByTipo[e.tipo] ??
      e.visitas ??
      analytics[e.tipo]?.visits ??
      0) as number;
    return acc + v;
  }, 0);
  const totalCotizaciones = enlaces.reduce((acc, e) => {
    const key = `${baseSlug}:${e.tipo}`;
    const q = (quotesByKey[key] ??
      quotesByTipo[e.tipo] ??
      e.cotizaciones ??
      analytics[e.tipo]?.quotes ??
      0) as number;
    return acc + q;
  }, 0);

  const copiarEnlace = (enlace: string) => {
    navigator.clipboard.writeText(enlace);
  };

  const generarEnlace = (tipo: string, _nombre: string) => {
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    const slugAgencia = agencySlug || 'mi-agencia';
    return `${base}/web/${slugAgencia}/${tipo}`;
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await enlacesService.list({ per_page: 100 });
        const rows = (res?.data || res?.data?.data || res || []).data || res?.data || [];
        setEnlaces(rows);

        // Cargar analíticas y conteos reales usando localStorage (fallback sin backend)
        const baseSlugLocal = agencySlug || 'mi-agencia';

        // Visitas por enlace (slug:tipo) y por tipo (sin slug)
        const analyticsData: Record<string, any> = {};
        const visitsMap: Record<string, number> = {};
        const visitsTipoMap: Record<string, number> = {};
        try {
          const rawVisits = localStorage.getItem('visits_log');
          if (rawVisits) {
            const visits = JSON.parse(rawVisits) as Array<{ slug: string; tipo?: string }>;
            for (const v of visits) {
              if (!v.tipo) continue;
              const kTipo = v.tipo;
              visitsTipoMap[kTipo] = (visitsTipoMap[kTipo] || 0) + 1;
              if (v.slug === baseSlugLocal) {
                const k = `${baseSlugLocal}:${v.tipo}`;
                visitsMap[k] = (visitsMap[k] || 0) + 1;
              }
            }
          }
        } catch {}

        for (const enlace of rows) {
          const k = `${baseSlugLocal}:${enlace.tipo}`;
          const visits = (visitsMap[k] ?? enlace.visitas ?? 0) as number;
          analyticsData[enlace.tipo] = {
            visits,
            quotes: 0,
            conversion_rate: 0,
          };
        }
        setAnalytics(analyticsData);
        setVisitsByKey(visitsMap);
        setVisitsByTipo(visitsTipoMap);

        // Cotizaciones reales por enlace (slug:tipo) y por tipo (sin slug)
        const quotesMap: Record<string, number> = {};
        const quotesTipoMap: Record<string, number> = {};
        try {
          const raw = localStorage.getItem('quotes_submissions');
          if (raw) {
            const subs = JSON.parse(raw) as Array<{ slug: string; tipo: string }>;
            for (const s of subs) {
              quotesTipoMap[s.tipo] = (quotesTipoMap[s.tipo] || 0) + 1;
              if (s.slug === baseSlugLocal) {
                const key = `${baseSlugLocal}:${s.tipo}`;
                quotesMap[key] = (quotesMap[key] || 0) + 1;
              }
            }
          }
        } catch {}
        setQuotesByKey(quotesMap);
        setQuotesByTipo(quotesTipoMap);
      } catch (_) {
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [agencySlug]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const cfg = await miniWebService.getConfig();
        if (mounted && cfg.success && cfg.data?.slug) {
          setAgencySlug(cfg.data.slug);
        }
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <PermissionGate
      route="/apps/marketing/enlaces-cotizacion"
      action="ver"
      fallback={<Alert color="warning">No tienes permisos para ver Enlaces de Cotización.</Alert>}
    >
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark dark:text-white mb-2">Enlaces de Cotización</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Crea enlaces personalizados de cotización y gestiona las cotizaciones recibidas.
        </p>
      </div>

      <Tabs aria-label="Enlaces de cotización tabs" className="mb-6">
        <Tabs.Item active title="Enlaces" icon={() => <Icon icon="solar:link-bold" width={16} />}>
          {/* Estadísticas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <Card className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Icon icon="solar:link-bold" className="text-primary" width={24} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-dark dark:text-white">{totalEnlaces}</h3>
                  <p className="text-sm text-gray-500">Enlaces Totales</p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-success/10 rounded-lg">
                  <Icon icon="solar:check-circle-bold" className="text-success" width={24} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-dark dark:text-white">{enlacesActivos}</h3>
                  <p className="text-sm text-gray-500">Enlaces Activos</p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-info/10 rounded-lg">
                  <Icon icon="solar:eye-bold" className="text-info" width={24} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-dark dark:text-white">{totalVisitas}</h3>
                  <p className="text-sm text-gray-500">Visitas Totales</p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-warning/10 rounded-lg">
                  <Icon icon="solar:document-text-bold" className="text-warning" width={24} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-dark dark:text-white">
                    {totalCotizaciones}
                  </h3>
                  <p className="text-sm text-gray-500">Cotizaciones</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Sección Enlaces Activos */}
          <Card className="mb-6">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Icon icon="solar:link-bold" className="text-primary" width={24} />
                  <h3 className="text-xl font-semibold text-dark dark:text-white">
                    Enlaces Activos
                  </h3>
                  <Badge color="success" className="ml-2">
                    {enlacesActivos} Productos
                  </Badge>
                </div>
                {canCreate && (
                  <Button color="primary" onClick={() => setShowModal(true)}>
                    <Icon icon="solar:add-circle-bold" className="mr-2" width={16} />
                    Nuevo Enlace
                  </Button>
                )}
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {enlacesFiltrados.map((enlace) => {
                  const tipoInfo = getTipoInfo(enlace.tipo);
                  return (
                    <div
                      key={enlace.id}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                            <Icon icon={tipoInfo.icon} className={tipoInfo.color} width={24} />
                          </div>
                          <div>
                            <h4 className="font-semibold text-dark dark:text-white">
                              {enlace.nombre}
                            </h4>
                            <p className="text-sm text-gray-500">{enlace.descripcion}</p>
                          </div>
                        </div>

                        {canEdit ? (
                          <ToggleSwitch
                            checked={!!enlace.activo}
                            onChange={async () => {
                              try {
                                await enlacesService.toggle(Number(enlace.id));
                                const res = await enlacesService.list({ per_page: 100 });
                                const rows =
                                  (res?.data || res?.data?.data || res || []).data ||
                                  res?.data ||
                                  [];
                                setEnlaces(rows);
                              } catch (_) {}
                            }}
                          />
                        ) : (
                          <Badge color={enlace.activo ? 'success' : 'gray'}>
                            {enlace.activo ? 'Activo' : 'Inactivo'}
                          </Badge>
                        )}
                      </div>

                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 mb-3">
                        <div className="flex items-center gap-2 text-sm">
                          <Icon icon="solar:link-bold" className="text-gray-500" width={16} />
                          <code className="text-primary font-mono">
                            {agencySlug
                              ? `${window.location.origin}/web/${agencySlug}/${enlace.tipo}`
                              : enlace.enlace || ''}
                          </code>
                          <Button
                            size="xs"
                            color="light"
                            onClick={() =>
                              copiarEnlace(
                                agencySlug
                                  ? `${window.location.origin}/web/${agencySlug}/${enlace.tipo}`
                                  : enlace.enlace || '',
                              )
                            }
                            title="Copiar enlace"
                          >
                            <Icon icon="solar:copy-bold" width={14} />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                        <div>
                          <span className="text-gray-500">Visitas:</span>
                          <span className="font-medium text-dark dark:text-white ml-1">
                            {
                              (visitsByKey[`${baseSlug}:${enlace.tipo}`] ??
                                visitsByTipo[enlace.tipo] ??
                                enlace.visitas ??
                                analytics[enlace.tipo]?.visits ??
                                0) as number
                            }
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Cotizaciones:</span>
                          <span className="font-medium text-dark dark:text-white ml-1">
                            {
                              (quotesByKey[`${baseSlug}:${enlace.tipo}`] ??
                                quotesByTipo[enlace.tipo] ??
                                enlace.cotizaciones ??
                                analytics[enlace.tipo]?.quotes ??
                                0) as number
                            }
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 mb-3">
                        Tasa de conversión:{' '}
                        {(() => {
                          const v = (visitsByKey[`${baseSlug}:${enlace.tipo}`] ??
                            visitsByTipo[enlace.tipo] ??
                            enlace.visitas ??
                            analytics[enlace.tipo]?.visits ??
                            0) as number;
                          const q = (quotesByKey[`${baseSlug}:${enlace.tipo}`] ??
                            quotesByTipo[enlace.tipo] ??
                            enlace.cotizaciones ??
                            analytics[enlace.tipo]?.quotes ??
                            0) as number;
                          return v > 0 ? Math.round((q / v) * 100) : 0;
                        })()}
                        %
                      </div>

                      <div className="flex gap-2">
                        <Button size="xs" color="primary" className="flex-1">
                          <Icon icon="solar:share-bold" className="mr-1" width={12} />
                          Compartir
                        </Button>
                        <Button size="xs" color="info">
                          <Icon icon="solar:chart-bold" width={12} />
                        </Button>
                        {canDelete && (
                          <Button
                            size="xs"
                            color="failure"
                            onClick={async () => {
                              // Verificar si hay cotizaciones para este enlace
                              const cotizacionesRaw = localStorage.getItem('quotes_submissions');
                              let cotizacionesCount = 0;
                              if (cotizacionesRaw) {
                                try {
                                  const cotizaciones = JSON.parse(cotizacionesRaw);
                                  cotizacionesCount = cotizaciones.filter(
                                    (c: any) => c.tipo === enlace.tipo,
                                  ).length;
                                } catch {}
                              }

                              const confirmMessage =
                                cotizacionesCount > 0
                                  ? `¿Estás seguro de eliminar este enlace? Se perderán ${cotizacionesCount} cotización(es) asociada(s). Esta acción no se puede deshacer.`
                                  : '¿Estás seguro de eliminar este enlace?';

                              if (window.confirm(confirmMessage)) {
                                try {
                                  await enlacesService.remove(Number(enlace.id));
                                  const res = await enlacesService.list({ per_page: 100 });
                                  const rows =
                                    (res?.data || res?.data?.data || res || []).data ||
                                    res?.data ||
                                    [];
                                  setEnlaces(rows);
                                } catch (_) {}
                              }
                            }}
                          >
                            <Icon icon="solar:trash-bin-minimalistic-2-bold" width={12} />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* Modal Nuevo Enlace */}
          <Modal show={showModal} onClose={() => setShowModal(false)} size="lg">
            <Modal.Header>Crear Nuevo Enlace de Cotización</Modal.Header>
            <Modal.Body>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nombre del Enlace
                  </label>
                  <TextInput
                    placeholder="Ej: Seguro de Auto Premium"
                    value={nuevoEnlace.nombre}
                    onChange={(e) => setNuevoEnlace({ ...nuevoEnlace, nombre: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tipo de Seguro
                  </label>
                  <Select
                    value={nuevoEnlace.tipo}
                    onChange={(e) => setNuevoEnlace({ ...nuevoEnlace, tipo: e.target.value })}
                  >
                    {tiposSeguro.map((tipo) => (
                      <option key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Descripción
                  </label>
                  <TextInput
                    placeholder="Descripción breve del producto"
                    value={nuevoEnlace.descripcion}
                    onChange={(e) =>
                      setNuevoEnlace({ ...nuevoEnlace, descripcion: e.target.value })
                    }
                  />
                </div>

                {nuevoEnlace.nombre && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Enlace Generado
                    </label>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                      <code className="text-primary font-mono text-sm">
                        {generarEnlace(nuevoEnlace.tipo, nuevoEnlace.nombre)}
                      </code>
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Campos predefinidos para {getTipoInfo(nuevoEnlace.tipo).label}
                  </label>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                    <ul className="text-sm grid md:grid-cols-2 gap-2">
                      {(FIELDS_BY_TIPO[nuevoEnlace.tipo] || []).map((f) => (
                        <li key={f.key} className="flex items-center gap-2">
                          <Badge color="light">{f.type}</Badge>
                          <span className="text-dark dark:text-white">{f.label}</span>
                          {f.type === 'select' && f.options?.length ? (
                            <span className="text-xs text-gray-500">
                              ({f.options.length} opciones)
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button color="light" onClick={() => setShowModal(false)}>
                Cancelar
              </Button>
              {canCreate && (
                <Button
                  color="primary"
                  onClick={async () => {
                    if (!nuevoEnlace.nombre.trim()) return;
                    try {
                      setLoading(true);
                      await enlacesService.create({
                        nombre: nuevoEnlace.nombre,
                        tipo: nuevoEnlace.tipo,
                        descripcion: nuevoEnlace.descripcion,
                        mensaje_bienvenida: nuevoEnlace.mensaje_bienvenida,
                        // Configuración de campos para el formulario público
                        config_campos: FIELDS_BY_TIPO[nuevoEnlace.tipo] || [],
                        // URL sugerida (el backend puede ignorarla si construye su propia URL)
                        enlace_sugerido: generarEnlace(nuevoEnlace.tipo, nuevoEnlace.nombre),
                      });
                      const res = await enlacesService.list({ per_page: 100 });
                      const rows =
                        (res?.data || res?.data?.data || res || []).data || res?.data || [];
                      setEnlaces(rows);
                      setShowModal(false);
                      setNuevoEnlace({
                        nombre: '',
                        tipo: 'vida',
                        descripcion: '',
                        mensaje_bienvenida: '',
                      });
                    } catch (_) {
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  <Icon icon="solar:add-circle-bold" className="mr-2" width={16} />
                  Crear Enlace
                </Button>
              )}
            </Modal.Footer>
          </Modal>
        </Tabs.Item>

        <Tabs.Item
          title="Cotizaciones"
          icon={() => <Icon icon="solar:document-text-bold" width={16} />}
        >
          <CotizacionesRecibidas />
        </Tabs.Item>
      </Tabs>

      {loading && (
        <div className="fixed inset-0 bg-black/10 flex items-center justify-center">
          <Spinner />
        </div>
      )}
    </PermissionGate>
  );
};

export default EnlacesCotizacion;
