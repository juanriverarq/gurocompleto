import React, { useState, useEffect, useContext } from 'react';
import { Card, Badge, Button, Modal, Checkbox, Label, ToggleSwitch, Spinner, TextInput } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { CustomizerContext } from 'src/context/CustomizerContext';
import { useToast } from 'src/hooks/use-toast';
import { suraScraperService, SuraConnectionStatus, SuraPoliza, SuraPolizaDetail, SuraCliente, SuraDataType } from 'src/services/suraScraperService';

// Tipos para las aseguradoras
interface Aseguradora {
  id: string;
  nombre: string;
  logoUrl: string;
  color: string;
  conectada: boolean;
}

// Tipos para los robots
interface Robot {
  id: string;
  nombre: string;
  descripcion: string;
  icon: string;
  iconColor: string;
  aseguradorasDisponibles: string[];
  activo: boolean;
  ultimaSincronizacion?: string;
  registrosPendientes?: number;
  modoAutomatico: boolean;
  frecuencia: number; // en minutos
}

// Opciones de frecuencia de sincronización
const FRECUENCIAS = [
  { value: 5, label: '5 minutos' },
  { value: 10, label: '10 minutos' },
  { value: 15, label: '15 minutos' },
  { value: 30, label: '30 minutos' },
  { value: 60, label: '1 hora' },
  { value: 120, label: '2 horas' },
  { value: 360, label: '6 horas' },
  { value: 720, label: '12 horas' },
  { value: 1440, label: '24 horas' },
];

// Logos de aseguradoras (tomados del comparador de seguros)
const COMPANY_LOGOS: Record<string, { url: string; color: string }> = {
  'sura': { url: 'https://images.seeklogo.com/logo-png/32/1/sura-logo-png_seeklogo-328191.png', color: '#0033A0' },
  'bolivar': { url: 'https://d1yjjnpx0p53s8.cloudfront.net/styles/logo-thumbnail/s3/032019/seguros_bolivar.jpg?Kv_sRIqG71PgCVryIyJxZ48DlEBN3xJt&itok=YAoRdSt8', color: '#00529B' },
  'allianz': { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Allianz.svg/1280px-Allianz.svg.png', color: '#003781' },
  'hdi': { url: 'https://www.hdi.cl/media/506086/microsoftteams-image-58.png', color: '#006747' },
};

// Aseguradoras disponibles (solo SURA por ahora)
const ASEGURADORAS: Aseguradora[] = [
  { id: 'sura', nombre: 'Sura', logoUrl: COMPANY_LOGOS['sura'].url, color: COMPANY_LOGOS['sura'].color, conectada: false },
];

// Robots disponibles
const ROBOTS_INICIALES: Robot[] = [
  {
    id: 'sync-cartera',
    nombre: 'Sincronizar Cartera',
    descripcion: 'Sincroniza automáticamente la cartera de clientes con las aseguradoras seleccionadas',
    icon: 'solar:wallet-bold-duotone',
    iconColor: 'text-primary',
    aseguradorasDisponibles: ['sura', 'bolivar', 'allianz', 'hdi'],
    activo: false,
    modoAutomatico: false,
    frecuencia: 30,
  },
  {
    id: 'sync-clientes',
    nombre: 'Sincronizar Clientes',
    descripcion: 'Importa y actualiza información de clientes desde las aseguradoras',
    icon: 'solar:users-group-rounded-bold-duotone',
    iconColor: 'text-success',
    aseguradorasDisponibles: ['sura', 'bolivar', 'allianz'],
    activo: false,
    modoAutomatico: false,
    frecuencia: 60,
  },
  {
    id: 'sync-polizas',
    nombre: 'Sincronizar Pólizas',
    descripcion: 'Mantiene actualizadas las pólizas con la información de las aseguradoras',
    icon: 'solar:shield-check-bold-duotone',
    iconColor: 'text-info',
    aseguradorasDisponibles: ['sura', 'bolivar', 'allianz', 'hdi'],
    activo: false,
    modoAutomatico: false,
    frecuencia: 60,
  },
];

const Robots = () => {
  const { isBorderRadius } = useContext(CustomizerContext);
  const { toast } = useToast();

  // Estados
  const [robots, setRobots] = useState<Robot[]>(ROBOTS_INICIALES);
  const [aseguradoras, setAseguradoras] = useState<Aseguradora[]>(ASEGURADORAS);
  const [selectedRobot, setSelectedRobot] = useState<Robot | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [selectedAseguradora, setSelectedAseguradora] = useState<Aseguradora | null>(null);
  const [robotAseguradoras, setRobotAseguradoras] = useState<string[]>([]);
  const [modoAutomatico, setModoAutomatico] = useState(false);
  const [frecuencia, setFrecuencia] = useState(30);
  const [loading, setLoading] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>('sura');
  const [collapsedSections, setCollapsedSections] = useState<{ robots: boolean }>({ robots: true });

  // === SURA Descarga state ===
  // Inline audit: tracks which rows are approved (key = id or numero_poliza)
  const [suraApprovedRows, setSuraApprovedRows] = useState<Set<string>>(new Set());
  const [suraAutoApprove, setSuraAutoApprove] = useState(false);
  const [suraStatus, setSuraStatus] = useState<SuraConnectionStatus | null>(null);
  const [suraDataType, setSuraDataType] = useState<SuraDataType>('clientes');
  const [suraPolizas, setSuraPolizas] = useState<SuraPoliza[]>([]);
  const [suraClientes, setSuraClientes] = useState<SuraCliente[]>([]);
  const [suraLoading, setSuraLoading] = useState(false);
  const [suraConnecting, setSuraConnecting] = useState(false);
  const [suraCookies, setSuraCookies] = useState('');
  const [showSuraLoginModal, setShowSuraLoginModal] = useState(false);
  const [suraLoginMode, setSuraLoginMode] = useState<'credentials' | 'cookies'>('credentials');
  const [suraUser, setSuraUser] = useState('');
  const [suraPassword, setSuraPassword] = useState('');
  const [suraShowPassword, setSuraShowPassword] = useState(false);
  const [suraMfaCode, setSuraMfaCode] = useState('');
  const [suraMfaRequired, setSuraMfaRequired] = useState(false);
  const [suraDocType, setSuraDocType] = useState('C');

  const [suraPage, setSuraPage] = useState(1);
  const [suraMeta, setSuraMeta] = useState<{ total: number; has_more: boolean }>({ total: 0, has_more: false });
  const [suraSearch, setSuraSearch] = useState('');
  const [suraSelectedRows, setSuraSelectedRows] = useState<Set<string>>(new Set());
  const [suraImporting, setSuraImporting] = useState(false);
  const [existingDocs, setExistingDocs] = useState<Set<string>>(new Set());
  const [suraClientView, setSuraClientView] = useState<'nuevos' | 'importados'>('nuevos');
  const [suraExpandedPoliza, setSuraExpandedPoliza] = useState<string | null>(null);
  const [suraDetailCache, setSuraDetailCache] = useState<Record<string, SuraPolizaDetail>>({});
  const [suraDetailLoading, setSuraDetailLoading] = useState(false);
  const [showImportReport, setShowImportReport] = useState(false);
  const [importReport, setImportReport] = useState<{
    imported: { id: number; nombre: string; documento: string }[];
    duplicates: { sura_nombre: string; documento: string; existing_id: number; existing_nombre: string }[];
    errors: { nombre: string; documento?: string; reason: string }[];
    summary: { total: number; imported_count: number; duplicate_count: number; error_count: number };
  } | null>(null);

  // Fetch SURA status and existing docs on mount
  useEffect(() => {
    suraScraperService.getStatus().then(res => {
      if (res.success && res.data) {
        setSuraStatus(res.data);
        if (res.data.connected) {
          setAseguradoras(prev => prev.map(a => a.id === 'sura' ? { ...a, conectada: true } : a));
        }
      }
    }).catch(() => {});
    // Fetch existing document numbers to filter out already-imported clients
    suraScraperService.getExistingDocuments().then(res => {
      if (res.success && res.data) {
        setExistingDocs(new Set(res.data));
      }
    }).catch(() => {});
  }, []);

  // Parse cookies from either document.cookie format or Chrome DevTools table format
  const parseCookieInput = (input: string): string => {
    const trimmed = input.trim();
    // If it already looks like "name=value; name2=value2" format, return as-is
    if (/^[^=\s]+=[^;]*(?:;\s*[^=\s]+=[^;]*)*$/.test(trimmed) && !trimmed.includes('\t')) {
      return trimmed;
    }
    // Try to parse Chrome DevTools table format (tab-separated, first col=name, second col=value)
    const lines = trimmed.split('\n').filter(l => l.trim());
    const pairs: string[] = [];
    for (const line of lines) {
      const cols = line.split('\t');
      if (cols.length >= 2) {
        const name = cols[0].trim();
        const value = cols[1].trim();
        if (name && !name.includes(' ') && value) {
          pairs.push(`${name}=${value}`);
        }
      }
    }
    if (pairs.length > 0) return pairs.join('; ');
    // Fallback: return as-is
    return trimmed;
  };

  const handleSuraConnect = async () => {
    setSuraConnecting(true);
    try {
      let res: any;
      if (suraLoginMode === 'credentials') {
        if (!suraUser.trim() || !suraPassword.trim()) {
          toast({ title: 'Campos requeridos', description: 'Ingresa tu usuario y contraseña de SURA', variant: 'destructive' });
          setSuraConnecting(false);
          return;
        }
        if (suraMfaRequired && !suraMfaCode.trim()) {
          toast({ title: 'Código requerido', description: 'Ingresa el código de tu app autenticadora', variant: 'destructive' });
          setSuraConnecting(false);
          return;
        }
        res = await suraScraperService.connectWithCredentials(
          suraUser.trim(),
          suraPassword,
          suraMfaRequired ? suraMfaCode.trim() : undefined,
          suraDocType
        );
      } else {
        if (!suraCookies.trim()) {
          setSuraConnecting(false);
          return;
        }
        const cookieString = parseCookieInput(suraCookies);
        res = await suraScraperService.connect(cookieString);
      }
      if (res.success && res.data) {
        setSuraStatus(res.data);
        setAseguradoras(prev => prev.map(a => a.id === 'sura' ? { ...a, conectada: true } : a));
        setShowSuraLoginModal(false);
        setSuraCookies('');
        setSuraPassword('');
        setSuraMfaCode('');
        setSuraMfaRequired(false);
        toast({ title: 'Conectado con SURA', description: res.message || 'Sesión iniciada correctamente' });
      } else if (res.mfa_required) {
        setSuraMfaRequired(true);
        toast({ title: 'Código de verificación', description: 'Ingresa el código de tu app autenticadora (6 dígitos)' });
      } else {
        toast({ title: 'Error de conexión', description: res.message || 'Credenciales inválidas o sesión expirada', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'No se pudo conectar', variant: 'destructive' });
    } finally {
      setSuraConnecting(false);
    }
  };

  const handleSuraDisconnect = async () => {
    setSuraLoading(true);
    try {
      await suraScraperService.disconnect();
      setSuraStatus(null);
      setSuraPolizas([]);
      setSuraClientes([]);
      setAseguradoras(prev => prev.map(a => a.id === 'sura' ? { ...a, conectada: false } : a));
      toast({ title: 'Desconectado', description: 'Sesión de SURA cerrada' });
    } catch {
      // ignore
    } finally {
      setSuraLoading(false);
    }
  };

  const handleSuraFetch = async (page = 1, type?: SuraDataType) => {
    const t = type || suraDataType;
    setSuraLoading(true);
    try {
      const res = await suraScraperService.fetchPolizas(page, 50, t);
      if (res.success && res.data) {
        if (t === 'clientes') {
          const incoming = res.data as SuraCliente[];
          setSuraClientes(prev => {
            const existingKeys = new Set(prev.map(c => c.id));
            const newItems = incoming.filter(c => !existingKeys.has(c.id));
            const merged = [...prev];
            // Update existing records in place
            for (const item of incoming) {
              const idx = merged.findIndex(c => c.id === item.id);
              if (idx >= 0) merged[idx] = item;
            }
            // Append truly new ones
            merged.push(...newItems);
            // Auto-approve new items if toggle is on
            if (suraAutoApprove && newItems.length > 0) {
              setSuraApprovedRows(prev2 => new Set([...prev2, ...newItems.map(c => c.id)]));
            }
            if (newItems.length > 0) {
              toast({ title: `${newItems.length} nuevos clientes`, description: `Se encontraron ${newItems.length} clientes nuevos de ${incoming.length} consultados` });
            }
            return merged;
          });
        } else {
          const incoming = res.data as SuraPoliza[];
          setSuraPolizas(prev => {
            const existingKeys = new Set(prev.map(p => p.numero_poliza));
            const newItems = incoming.filter(p => !existingKeys.has(p.numero_poliza));
            const merged = [...prev];
            for (const item of incoming) {
              const idx = merged.findIndex(p => p.numero_poliza === item.numero_poliza);
              if (idx >= 0) merged[idx] = item;
            }
            merged.push(...newItems);
            if (suraAutoApprove && newItems.length > 0) {
              setSuraApprovedRows(prev2 => new Set([...prev2, ...newItems.map(p => p.numero_poliza)]));
            }
            if (newItems.length > 0) {
              toast({ title: `${newItems.length} nuevas pólizas`, description: `Se encontraron ${newItems.length} pólizas nuevas de ${incoming.length} consultadas` });
            }
            return merged;
          });
        }
        setSuraPage(page);
        setSuraMeta({ total: res.meta?.total || res.data.length, has_more: res.meta?.has_more || false });
      } else {
        // Check if backend flagged session as expired
        if ((res as any).session_expired) {
          setSuraStatus(prev => prev ? { ...prev, session_valid: false } : prev);
          toast({ title: 'Sesión expirada', description: res.message || 'La sesión de SURA expiró. Reconecta con tus credenciales.', variant: 'destructive' });
        } else {
          toast({ title: 'Error', description: res.message || `No se pudieron obtener los ${t}`, variant: 'destructive' });
        }
      }
    } catch (e: any) {
      const errMsg = e?.message || 'Error al consultar SURA';
      toast({ title: 'Error', description: errMsg, variant: 'destructive' });
    } finally {
      setSuraLoading(false);
    }
  };

  const handleSuraExport = async () => {
    setSuraLoading(true);
    try {
      const res = await suraScraperService.exportExcel(suraDataType);
      if (res.success) {
        toast({ title: 'Exportación lista', description: res.message || 'Datos exportados correctamente' });
      } else {
        toast({ title: 'Error', description: res.message || 'No se pudo exportar', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Error al exportar', variant: 'destructive' });
    } finally {
      setSuraLoading(false);
    }
  };

  const toggleSuraRow = (polizaNum: string) => {
    setSuraSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(polizaNum)) next.delete(polizaNum); else next.add(polizaNum);
      return next;
    });
  };

  const toggleAllSuraRows = () => {
    const filtered = suraDataType === 'clientes' ? filteredSuraClientes : filteredSuraPolizas;
    const keys = filtered.map(p => suraDataType === 'clientes' ? (p as SuraCliente).id : (p as SuraPoliza).numero_poliza);
    if (suraSelectedRows.size === filtered.length) {
      setSuraSelectedRows(new Set());
    } else {
      setSuraSelectedRows(new Set(keys));
    }
  };

  const filteredSuraPolizas = suraPolizas.filter(p => {
    if (!suraSearch.trim()) return true;
    const q = suraSearch.toLowerCase();
    return (
      (p.numero_poliza || '').toLowerCase().includes(q) ||
      (p.nombre_tomador || '').toLowerCase().includes(q) ||
      (p.dni_tomador || '').toLowerCase().includes(q) ||
      (p.ramo_nombre || '').toLowerCase().includes(q) ||
      (p.ciudad || '').toLowerCase().includes(q) ||
      (p.producto || '').toLowerCase().includes(q)
    );
  });

  const searchFilterCliente = (c: SuraCliente) => {
    if (!suraSearch.trim()) return true;
    const q = suraSearch.toLowerCase();
    return (
      (c.nombre || '').toLowerCase().includes(q) ||
      (c.numero_documento || '').toLowerCase().includes(q) ||
      (c.id || '').toLowerCase().includes(q) ||
      (c.ciudad || '').toLowerCase().includes(q) ||
      (c.correo || '').toLowerCase().includes(q) ||
      (c.tipo_vinculacion || '').toLowerCase().includes(q)
    );
  };

  // Split clients: nuevos = not in Guro, importados = already in Guro
  const suraNuevosClientes = suraClientes.filter(c => !existingDocs.has(c.numero_documento));
  const suraImportadosClientes = suraClientes.filter(c => existingDocs.has(c.numero_documento));
  const filteredSuraNuevos = suraNuevosClientes.filter(searchFilterCliente);
  const filteredSuraImportados = suraImportadosClientes.filter(searchFilterCliente);
  // For backward compat with polizas logic
  const filteredSuraClientes = suraClientView === 'nuevos' ? filteredSuraNuevos : filteredSuraImportados;

  const handleSuraSubTabChange = (type: SuraDataType) => {
    setSuraDataType(type);
    setSuraSearch('');
    setSuraSelectedRows(new Set());
    setSuraPage(1);
    // Auto-fetch if no data yet
    const hasData = type === 'clientes' ? suraClientes.length > 0 : suraPolizas.length > 0;
    if (!hasData) {
      handleSuraFetch(1, type);
    } else {
      // Update meta for current type
      const items = type === 'clientes' ? suraClientes : suraPolizas;
      setSuraMeta({ total: items.length, has_more: false });
    }
  };

  const handleSelectCompany = (id: string) => {
    if (selectedCompanyId === id) {
      setSelectedCompanyId(null);
    } else {
      setSelectedCompanyId(id);
      // For SURA, auto-check connection status
      if (id === 'sura' && !suraStatus) {
        suraScraperService.getStatus().then(res => {
          if (res.success && res.data?.connected) {
            setSuraStatus(res.data);
            setAseguradoras(prev => prev.map(a => a.id === 'sura' ? { ...a, conectada: true } : a));
          }
        }).catch(() => {});
      }
    }
  };

  const toggleSection = (key: 'robots') => {
    setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Estadísticas
  const robotsActivos = robots.filter(r => r.activo).length;
  const aseguradorasConectadas = aseguradoras.filter(a => a.conectada).length;

  // Inline audit helpers
  const suraGetRowKey = (item: SuraCliente | SuraPoliza, type: SuraDataType) =>
    type === 'clientes' ? (item as SuraCliente).id : (item as SuraPoliza).numero_poliza;

  const suraPendingCount = (() => {
    const items = suraDataType === 'clientes' ? suraClientes : suraPolizas;
    return items.filter(i => !suraApprovedRows.has(suraGetRowKey(i, suraDataType))).length;
  })();

  const handleSuraApproveRow = (key: string) => {
    setSuraApprovedRows(prev => new Set([...prev, key]));
  };

  const handleSuraApproveAll = () => {
    const items = suraDataType === 'clientes' ? filteredSuraClientes : filteredSuraPolizas;
    const keys = items.map(i => suraGetRowKey(i, suraDataType));
    setSuraApprovedRows(prev => new Set([...prev, ...keys]));
    toast({ title: 'Aprobados', description: `${keys.length} registros aprobados` });
  };

  // Toggle poliza detail expansion - fetch detail from SURA API on first expand
  const handleTogglePolizaDetail = async (poliza: SuraPoliza) => {
    const key = poliza.numero_poliza;
    if (suraExpandedPoliza === key) {
      setSuraExpandedPoliza(null);
      return;
    }
    setSuraExpandedPoliza(key);
    // If already cached, don't re-fetch
    if (suraDetailCache[key]) return;
    setSuraDetailLoading(true);
    try {
      const res = await suraScraperService.fetchPolizaDetail(
        key,
        poliza.ramo_codigo,
        poliza.fecha_fin,
      );
      if (res.success && res.data) {
        setSuraDetailCache(prev => ({ ...prev, [key]: res.data! }));
      } else {
        toast({ title: 'Error', description: res.message || 'No se pudo obtener el detalle', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Error de conexión', variant: 'destructive' });
    } finally {
      setSuraDetailLoading(false);
    }
  };

  // Import selected SURA clients to Guro
  const handleSuraImportClients = async () => {
    if (suraSelectedRows.size === 0 || suraDataType !== 'clientes') return;
    setSuraImporting(true);
    try {
      const clientsToImport = suraClientes.filter(c => suraSelectedRows.has(c.id));
      const res = await suraScraperService.importClients(clientsToImport);
      if (res.success && res.data) {
        setImportReport(res.data);
        setShowImportReport(true);
        setSuraSelectedRows(new Set());
        // Move imported docs to existingDocs so they disappear from "Nuevos" tab
        if (res.data.imported.length > 0) {
          setExistingDocs(prev => {
            const next = new Set(prev);
            res.data!.imported.forEach(c => next.add(c.documento));
            return next;
          });
        }
        const s = res.data.summary;
        if (s.imported_count > 0) {
          toast({ title: `${s.imported_count} clientes importados`, description: res.message || '' });
        }
        if (s.duplicate_count > 0) {
          toast({ title: `${s.duplicate_count} duplicados detectados`, description: 'Ya existen en Guro con el mismo documento', variant: 'destructive' });
        }
      } else {
        toast({ title: 'Error', description: res.message || 'No se pudieron importar los clientes', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Error al importar clientes', variant: 'destructive' });
    } finally {
      setSuraImporting(false);
    }
  };

  // Abrir modal de configuración de robot
  const handleConfigRobot = (robot: Robot) => {
    setSelectedRobot(robot);
    setRobotAseguradoras(robot.aseguradorasDisponibles.filter(a => 
      aseguradoras.find(as => as.id === a)?.conectada
    ));
    setModoAutomatico(robot.modoAutomatico);
    setFrecuencia(robot.frecuencia);
    setShowConfigModal(true);
  };

  // Guardar configuración del robot
  const handleSaveConfig = () => {
    if (!selectedRobot) return;

    setRobots(prev => prev.map(r => {
      if (r.id === selectedRobot.id) {
        return {
          ...r,
          activo: robotAseguradoras.length > 0,
          modoAutomatico,
          frecuencia,
        };
      }
      return r;
    }));

    toast({
      title: 'Configuración guardada',
      description: `Robot "${selectedRobot.nombre}" configurado correctamente`,
    });

    setShowConfigModal(false);
    setSelectedRobot(null);
  };

  // Abrir modal de login de aseguradora
  const handleLoginAseguradora = (aseguradora: Aseguradora) => {
    setSelectedAseguradora(aseguradora);
    setShowLoginModal(true);
  };

  // Simular conexión con aseguradora
  const handleConnectAseguradora = () => {
    if (!selectedAseguradora) return;

    setLoading(true);
    
    // Simular proceso de conexión
    setTimeout(() => {
      setAseguradoras(prev => prev.map(a => {
        if (a.id === selectedAseguradora.id) {
          return { ...a, conectada: true };
        }
        return a;
      }));

      toast({
        title: 'Conexión exitosa',
        description: `Conectado con ${selectedAseguradora.nombre}`,
      });

      setLoading(false);
      setShowLoginModal(false);
      setSelectedAseguradora(null);
    }, 1500);
  };

  // Desconectar aseguradora
  const handleDisconnectAseguradora = (aseguradora: Aseguradora) => {
    setAseguradoras(prev => prev.map(a => {
      if (a.id === aseguradora.id) {
        return { ...a, conectada: false };
      }
      return a;
    }));

    toast({
      title: 'Desconectado',
      description: `Se desconectó de ${aseguradora.nombre}`,
    });
  };

  // Ejecutar sincronización manual
  const handleSyncManual = (robot: Robot) => {
    setLoading(true);
    
    setTimeout(() => {
      toast({
        title: 'Sincronización completada',
        description: `${robot.nombre} ejecutado correctamente`,
      });
      setLoading(false);
    }, 2000);
  };

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark dark:text-white mb-2">
          Robots de Automatización
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Configura y gestiona los robots de sincronización automática con las aseguradoras
        </p>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Icon icon="solar:robot-bold-duotone" className="text-primary" width={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-dark dark:text-white">{robotsActivos}</h3>
              <p className="text-sm text-gray-500">Robots Activos</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-success/10 rounded-lg">
              <Icon icon="solar:link-bold-duotone" className="text-success" width={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-dark dark:text-white">{aseguradorasConectadas}</h3>
              <p className="text-sm text-gray-500">Aseguradoras Conectadas</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-warning/10 rounded-lg">
              <Icon icon="solar:clipboard-check-bold-duotone" className="text-warning" width={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-dark dark:text-white">{suraPendingCount}</h3>
              <p className="text-sm text-gray-500">Pendientes Revisión</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-info/10 rounded-lg">
              <Icon icon="solar:refresh-bold-duotone" className="text-info" width={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-dark dark:text-white">{robots.length}</h3>
              <p className="text-sm text-gray-500">Total Robots</p>
            </div>
          </div>
        </Card>
      </div>

      {/* ═══════════ COMPANY CHIPS BAR ═══════════ */}
      <Card className="mb-6 p-5" style={{ borderRadius: `${isBorderRadius}px` }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-dark dark:text-white flex items-center gap-2">
            <Icon icon="solar:shield-check-bold-duotone" width={22} className="text-primary" />
            Aseguradoras
          </h2>
          <span className="text-sm text-gray-500">
            {aseguradorasConectadas} de {aseguradoras.length} conectadas
          </span>
        </div>

        <div className="flex flex-wrap gap-3">
          {aseguradoras.map((aseg) => {
            const isSelected = selectedCompanyId === aseg.id;
            const isSuraConnected = aseg.id === 'sura' && suraStatus?.connected;
            const isConnected = aseg.conectada || isSuraConnected;
            const isSessionExpired = aseg.id === 'sura' && suraStatus?.connected && !suraStatus?.session_valid;

            return (
              <button
                key={aseg.id}
                onClick={() => handleSelectCompany(aseg.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all duration-200 min-w-[180px] ${
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-md shadow-primary/10 ring-1 ring-primary/20'
                    : isSessionExpired
                    ? 'border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-900/10 hover:border-red-400'
                    : isConnected
                    ? 'border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-900/10 hover:border-green-400'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center p-1.5 ${
                  isSessionExpired ? 'bg-white ring-2 ring-red-400' : isConnected ? 'bg-white ring-2 ring-green-400' : 'bg-white dark:bg-gray-700'
                }`}>
                  <img
                    src={aseg.logoUrl}
                    alt={aseg.nombre}
                    className={`w-full h-full object-contain ${!isConnected ? 'opacity-40 grayscale' : ''}`}
                  />
                </div>
                <div className="text-left">
                  <span className="text-sm font-semibold text-dark dark:text-white block">{aseg.nombre}</span>
                  <span className={`text-xs flex items-center gap-1 ${
                    isSessionExpired ? 'text-red-600 dark:text-red-400' : isConnected ? 'text-green-600 dark:text-green-400' : 'text-gray-400'
                  }`}>
                    <Icon icon={isSessionExpired ? 'solar:danger-triangle-bold' : isConnected ? 'solar:check-circle-bold' : 'solar:close-circle-linear'} width={12} />
                    {isSessionExpired ? 'Sesión expirada' : isConnected ? 'Conectada' : 'Sin conectar'}
                  </span>
                </div>
                {isSelected && (
                  <Icon icon="solar:alt-arrow-down-bold" width={16} className="text-primary ml-auto" />
                )}
              </button>
            );
          })}
        </div>
      </Card>

      {/* ═══════════ SELECTED COMPANY PANEL ═══════════ */}
      {selectedCompanyId && (() => {
        const company = aseguradoras.find(a => a.id === selectedCompanyId);
        if (!company) return null;

        // SURA-specific panel
        if (selectedCompanyId === 'sura') {
          const isSuraConnected = suraStatus?.connected;
          return (
            <Card className="mb-6 p-5" style={{ borderRadius: `${isBorderRadius}px` }}>
              {/* Banner de sesión expirada */}
              {isSuraConnected && !suraStatus?.session_valid && (
                <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-lg">
                      <Icon icon="solar:danger-triangle-bold" width={22} className="text-red-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-red-700 dark:text-red-300">Sesión expirada</p>
                      <p className="text-sm text-red-600 dark:text-red-400">
                        {suraStatus?.auth_method === 'credentials'
                          ? 'Renovando sesión automáticamente...'
                          : 'La sesión de SURA ha expirado. Reconecta para seguir descargando datos.'}
                      </p>
                    </div>
                  </div>
                  {suraStatus?.auth_method === 'credentials' ? (
                    <Button color="warning" size="sm" onClick={async () => {
                      const res = await suraScraperService.refreshSession();
                      if (res.success && res.data) {
                        setSuraStatus(res.data);
                        toast({ title: 'Sesión renovada', description: 'La sesión de SURA se renovó automáticamente.' });
                      } else {
                        toast({ title: 'Error', description: res.message || 'No se pudo renovar. Reconecta manualmente.', variant: 'destructive' });
                      }
                    }}>
                      <Icon icon="solar:refresh-bold" width={16} className="mr-1" />
                      Renovar sesión
                    </Button>
                  ) : (
                    <Button color="failure" size="sm" onClick={() => setShowSuraLoginModal(true)}>
                      <Icon icon="solar:login-2-bold" width={16} className="mr-1" />
                      Reconectar
                    </Button>
                  )}
                </div>
              )}
              {!isSuraConnected ? (
                <div className="text-center py-10">
                  <div className="w-20 h-20 mx-auto mb-5 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center">
                    <img src={company.logoUrl} alt={company.nombre} className="w-14 h-14 object-contain opacity-50 grayscale" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Conecta tu cuenta de SURA Asesores
                  </h3>
                  <p className="text-sm text-gray-500 mb-5 max-w-md mx-auto">
                    Ingresa tus credenciales del portal <strong>asistentevirtualasesores.sura.com</strong> para descargar automáticamente clientes y pólizas.
                  </p>
                  <div className="flex justify-center">
                    <Button color="primary" size="lg" onClick={() => setShowSuraLoginModal(true)}>
                      <Icon icon="solar:login-2-bold" width={20} className="mr-2" />
                      Iniciar sesión en SURA
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Connected header */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center ring-2 ring-green-400 p-2">
                        <img src={company.logoUrl} alt={company.nombre} className="w-full h-full object-contain" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-dark dark:text-white flex items-center gap-2">
                          SURA Asesores
                          <Icon icon="solar:check-circle-bold" className="text-green-500" width={18} />
                          {suraStatus.auth_method === 'credentials' ? (
                            <Badge color="success" size="xs">
                              <Icon icon="solar:refresh-circle-bold" width={12} className="mr-0.5" />Auto-renovación
                            </Badge>
                          ) : (
                            <Badge color="warning" size="xs">
                              <Icon icon="solar:cookie-bold" width={12} className="mr-0.5" />Cookies
                            </Badge>
                          )}
                        </h3>
                        <p className="text-sm text-gray-500">
                          Usuario: <strong>{suraStatus.username}</strong>
                          {suraStatus.last_sync_at && (
                            <span className="ml-3">Última sync: {new Date(suraStatus.last_sync_at).toLocaleString('es-CO')}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" color="light" onClick={handleSuraExport} disabled={suraLoading}>
                        <Icon icon="solar:file-download-bold" width={16} className="mr-1" />
                        Exportar Excel
                      </Button>
                      <Button size="sm" color="failure" outline onClick={handleSuraDisconnect} disabled={suraLoading}>
                        <Icon icon="solar:logout-2-bold" width={16} className="mr-1" />
                        Desconectar
                      </Button>
                    </div>
                  </div>

                  {/* Error banner */}
                  {suraStatus.last_error && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-400 text-sm">
                      <Icon icon="solar:danger-triangle-bold" width={18} />
                      {suraStatus.last_error}
                    </div>
                  )}

                  {/* Sub-tabs: Clientes | Pólizas | Carteras */}
                  <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700 mb-4">
                    {([
                      { key: 'clientes' as SuraDataType, label: 'Clientes', icon: 'solar:users-group-rounded-bold' },
                      { key: 'polizas' as SuraDataType, label: 'Pólizas', icon: 'solar:shield-check-bold' },
                    ]).map(tab => (
                      <button
                        key={tab.key}
                        onClick={() => handleSuraSubTabChange(tab.key)}
                        className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                          suraDataType === tab.key
                            ? 'border-primary text-primary'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                      >
                        <Icon icon={tab.icon} width={16} />
                        {tab.label}
                        {tab.key === 'clientes' && suraClientes.length > 0 && (
                          <Badge color={suraNuevosClientes.length > 0 ? 'info' : 'gray'} size="xs" className="ml-1">{suraNuevosClientes.length} nuevos</Badge>
                        )}
                        {tab.key === 'polizas' && suraPolizas.length > 0 && (
                          <Badge color="gray" size="xs" className="ml-1">{suraPolizas.length}</Badge>
                        )}
                      </button>
                    ))}
                    <button
                      disabled
                      className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 border-transparent text-gray-300 dark:text-gray-600 cursor-not-allowed"
                    >
                      <Icon icon="solar:wallet-bold" width={16} />
                      Carteras
                      <Badge color="gray" size="xs" className="ml-1">Próximamente</Badge>
                    </button>
                  </div>

                  {/* Data area */}
                  {(() => {
                    const currentItems = suraDataType === 'clientes' ? filteredSuraClientes : filteredSuraPolizas;
                    const allItems = suraDataType === 'clientes' ? suraClientes : suraPolizas;
                    const typeLabel = suraDataType === 'clientes' ? 'clientes' : 'pólizas';

                    return allItems.length === 0 && !suraLoading ? (
                      <div className="text-center py-10 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                        <Icon icon={suraDataType === 'clientes' ? 'solar:users-group-rounded-bold-duotone' : 'solar:shield-check-bold-duotone'} className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 mb-3">Presiona "Buscar" para consultar {typeLabel} de SURA</p>
                        <div className="flex justify-center">
                          <Button size="sm" color="primary" onClick={() => handleSuraFetch(1)}>
                            {suraLoading ? <Spinner size="sm" className="mr-2" /> : <Icon icon="solar:magnifer-bold" width={16} className="mr-1" />}
                            Buscar {typeLabel}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Search + actions bar */}
                        <div className="flex flex-col gap-3 mb-4">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <TextInput
                                placeholder={suraDataType === 'clientes' ? 'Buscar por nombre, documento, ciudad, correo...' : 'Buscar por póliza, tomador, documento, ramo...'}
                                value={suraSearch}
                                onChange={(e) => setSuraSearch(e.target.value)}
                                icon={() => <Icon icon="solar:magnifer-linear" width={16} />}
                                className="w-72"
                              />
                              <span className="text-sm text-gray-500">
                                {currentItems.length} de {suraMeta.total} {typeLabel}
                              </span>
                              <Button size="sm" color="primary" onClick={() => handleSuraFetch(1)} disabled={suraLoading}>
                                {suraLoading ? <Spinner size="sm" className="mr-1" /> : <Icon icon="solar:refresh-bold" width={14} className="mr-1" />}
                                Actualizar
                              </Button>
                            </div>
                            <div className="flex items-center gap-3">
                              {suraPendingCount > 0 && (
                                <Button size="sm" color="success" onClick={handleSuraApproveAll}>
                                  <Icon icon="solar:check-circle-bold" width={16} className="mr-1" />
                                  Aprobar todos ({suraPendingCount})
                                </Button>
                              )}
                              {suraSelectedRows.size > 0 && suraDataType === 'clientes' && (
                                <Button size="sm" color="primary" onClick={handleSuraImportClients} disabled={suraImporting}>
                                  {suraImporting ? <Spinner size="sm" className="mr-1" /> : <Icon icon="solar:download-bold" width={16} className="mr-1" />}
                                  Importar {suraSelectedRows.size} a Guro
                                </Button>
                              )}
                            </div>
                          </div>
                          {/* Auto-approve toggle */}
                          <div className="flex items-center gap-2">
                            <ToggleSwitch
                              checked={suraAutoApprove}
                              onChange={setSuraAutoApprove}
                              label=""
                            />
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              Aprobar automáticamente nuevos registros
                            </span>
                            {suraAutoApprove && (
                              <Badge color="success" size="xs">
                                <Icon icon="solar:bolt-bold" width={12} className="mr-0.5" />Auto
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Loading overlay */}
                        {suraLoading && (
                          <div className="flex items-center justify-center py-8">
                            <Spinner size="lg" />
                            <span className="ml-3 text-gray-500">Consultando SURA Asesores...</span>
                          </div>
                        )}

                        {/* === CLIENTES: Nuevos / Importados sub-tabs === */}
                        {!suraLoading && suraDataType === 'clientes' && suraClientes.length > 0 && (
                          <div className="flex items-center gap-2 mb-3">
                            <button
                              onClick={() => { setSuraClientView('nuevos'); setSuraSelectedRows(new Set()); }}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                suraClientView === 'nuevos'
                                  ? 'bg-primary text-white'
                                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                              }`}
                            >
                              Nuevos
                              <Badge color={suraClientView === 'nuevos' ? 'light' : 'info'} size="xs" className="ml-1.5">{suraNuevosClientes.length}</Badge>
                            </button>
                            <button
                              onClick={() => { setSuraClientView('importados'); setSuraSelectedRows(new Set()); }}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                suraClientView === 'importados'
                                  ? 'bg-green-600 text-white'
                                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                              }`}
                            >
                              Importados
                              <Badge color={suraClientView === 'importados' ? 'light' : 'success'} size="xs" className="ml-1.5">{suraImportadosClientes.length}</Badge>
                            </button>
                          </div>
                        )}

                        {/* Empty state for current client view */}
                        {!suraLoading && suraDataType === 'clientes' && suraClientes.length > 0 && filteredSuraClientes.length === 0 && (
                          <div className="text-center py-8 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                            <Icon icon={suraClientView === 'nuevos' ? 'solar:check-circle-bold-duotone' : 'solar:users-group-rounded-bold-duotone'} className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                            <p className="text-gray-500 text-sm">
                              {suraClientView === 'nuevos'
                                ? 'Todos los clientes escaneados ya están importados en Guro'
                                : 'Aún no se han importado clientes de SURA'}
                            </p>
                          </div>
                        )}

                        {/* === CLIENTES TABLE === */}
                        {!suraLoading && suraDataType === 'clientes' && filteredSuraClientes.length > 0 && (
                          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                            <table className="guro-table text-sm w-full" style={{ minWidth: '1100px' }}>
                              <thead>
                                <tr>
                                  <th className="w-10 whitespace-nowrap">
                                    <Checkbox
                                      checked={suraSelectedRows.size === filteredSuraClientes.length && filteredSuraClientes.length > 0}
                                      onChange={toggleAllSuraRows}
                                    />
                                  </th>
                                  <th className="whitespace-nowrap">Nombre</th>
                                  <th className="whitespace-nowrap">Tipo Doc</th>
                                  <th className="whitespace-nowrap">Documento</th>
                                  <th className="whitespace-nowrap">Dirección</th>
                                  <th className="whitespace-nowrap">Ciudad</th>
                                  <th className="whitespace-nowrap">Teléfono</th>
                                  <th className="whitespace-nowrap">Celular</th>
                                  <th className="whitespace-nowrap">Correo</th>
                                  <th className="whitespace-nowrap">Vinculación</th>
                                  <th className="whitespace-nowrap">Tipo</th>
                                  <th className="text-center whitespace-nowrap">Estado</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filteredSuraClientes.map((c) => {
                                  const isApproved = suraApprovedRows.has(c.id);
                                  return (
                                  <tr key={c.id} className={suraSelectedRows.has(c.id) ? 'bg-primary/5' : !isApproved ? 'bg-yellow-50/50 dark:bg-yellow-900/5' : ''}>
                                    <td>
                                      <Checkbox
                                        checked={suraSelectedRows.has(c.id)}
                                        onChange={() => toggleSuraRow(c.id)}
                                      />
                                    </td>
                                    <td className="font-medium"><div className="max-w-[220px] truncate" title={c.nombre}>{c.nombre}</div></td>
                                    <td className="whitespace-nowrap"><Badge color="gray" size="xs">{c.tipo_documento}</Badge></td>
                                    <td className="font-mono whitespace-nowrap">{c.numero_documento}</td>
                                    <td><div className="max-w-[180px] truncate text-xs" title={c.direccion}>{c.direccion}</div></td>
                                    <td className="text-xs whitespace-nowrap">{c.ciudad}</td>
                                    <td className="text-xs whitespace-nowrap">{c.telefono_fijo}</td>
                                    <td className="text-xs whitespace-nowrap">{c.telefono_celular}</td>
                                    <td><div className="max-w-[160px] truncate text-xs" title={c.correo}>{c.correo}</div></td>
                                    <td className="text-xs whitespace-nowrap">{c.tipo_vinculacion}</td>
                                    <td className="whitespace-nowrap"><Badge color={c.tipo_persona === 'J' ? 'purple' : 'info'} size="xs">{c.tipo_persona === 'J' ? 'Jurídica' : 'Natural'}</Badge></td>
                                    <td className="text-center whitespace-nowrap">
                                      {isApproved ? (
                                        <Badge color="success" size="xs"><Icon icon="solar:check-circle-bold" width={12} className="mr-0.5" />Aprobado</Badge>
                                      ) : (
                                        <button onClick={() => handleSuraApproveRow(c.id)} className="text-xs text-green-600 hover:text-green-800 inline-flex items-center gap-0.5 font-medium">
                                          <Icon icon="solar:check-circle-linear" width={14} />Aprobar
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* === POLIZAS TABLE === */}
                        {!suraLoading && suraDataType === 'polizas' && filteredSuraPolizas.length > 0 && (
                          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                            <table className="guro-table text-sm w-full" style={{ minWidth: '1300px' }}>
                              <thead>
                                <tr>
                                  <th className="w-10 whitespace-nowrap">
                                    <Checkbox
                                      checked={suraSelectedRows.size === filteredSuraPolizas.length && filteredSuraPolizas.length > 0}
                                      onChange={toggleAllSuraRows}
                                    />
                                  </th>
                                  <th className="whitespace-nowrap">Ramo</th>
                                  <th className="whitespace-nowrap">Producto</th>
                                  <th className="whitespace-nowrap">Póliza</th>
                                  <th className="whitespace-nowrap">Tipo Doc</th>
                                  <th className="whitespace-nowrap">Documento</th>
                                  <th className="whitespace-nowrap">Tomador</th>
                                  <th className="whitespace-nowrap">Teléfono</th>
                                  <th className="whitespace-nowrap">Celular</th>
                                  <th className="whitespace-nowrap">Ciudad</th>
                                  <th className="whitespace-nowrap">Oficina</th>
                                  <th className="whitespace-nowrap">Inicio</th>
                                  <th className="whitespace-nowrap">Fin</th>
                                  <th className="whitespace-nowrap">Forma Pago</th>
                                  <th className="text-center whitespace-nowrap">Estado</th>
                                  <th className="text-center whitespace-nowrap w-10">Detalle</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filteredSuraPolizas.map((p, idx) => {
                                  const isApproved = suraApprovedRows.has(p.numero_poliza);
                                  const isExpanded = suraExpandedPoliza === p.numero_poliza;
                                  const detail = suraDetailCache[p.numero_poliza];
                                  return (
                                  <React.Fragment key={`${p.numero_poliza}-${idx}`}>
                                  <tr className={`cursor-pointer ${suraSelectedRows.has(p.numero_poliza) ? 'bg-primary/5' : !isApproved ? 'bg-yellow-50/50 dark:bg-yellow-900/5' : ''}`}>
                                    <td>
                                      <Checkbox
                                        checked={suraSelectedRows.has(p.numero_poliza)}
                                        onChange={() => toggleSuraRow(p.numero_poliza)}
                                      />
                                    </td>
                                    <td className="whitespace-nowrap">
                                      <span className="font-medium">{p.ramo_nombre}</span>
                                      <span className="text-xs text-gray-400 ml-1">({p.ramo_codigo})</span>
                                    </td>
                                    <td><div className="max-w-[150px] truncate text-xs" title={p.producto}>{p.producto}</div></td>
                                    <td className="whitespace-nowrap">
                                      <span className="font-mono font-semibold text-primary">{p.numero_poliza}</span>
                                    </td>
                                    <td className="whitespace-nowrap"><Badge color="gray" size="xs">{p.tipo_dni_tomador}</Badge></td>
                                    <td className="font-mono whitespace-nowrap">{p.dni_tomador}</td>
                                    <td className="font-medium"><div className="max-w-[180px] truncate" title={p.nombre_tomador}>{p.nombre_tomador}</div></td>
                                    <td className="text-xs whitespace-nowrap">{p.telefono_tomador}</td>
                                    <td className="text-xs whitespace-nowrap">{p.celular_tomador}</td>
                                    <td className="text-xs whitespace-nowrap">{p.ciudad}</td>
                                    <td><div className="max-w-[130px] truncate text-xs" title={p.oficina}>{p.oficina}</div></td>
                                    <td className="text-xs whitespace-nowrap">{p.fecha_inicio}</td>
                                    <td className="text-xs whitespace-nowrap">{p.fecha_fin}</td>
                                    <td className="whitespace-nowrap"><Badge color="info" size="xs">{p.forma_pago}</Badge></td>
                                    <td className="text-center whitespace-nowrap">
                                      {isApproved ? (
                                        <Badge color="success" size="xs"><Icon icon="solar:check-circle-bold" width={12} className="mr-0.5" />Aprobado</Badge>
                                      ) : (
                                        <button onClick={() => handleSuraApproveRow(p.numero_poliza)} className="text-xs text-green-600 hover:text-green-800 inline-flex items-center gap-0.5 font-medium mx-auto">
                                          <Icon icon="solar:check-circle-linear" width={14} />Aprobar
                                        </button>
                                      )}
                                    </td>
                                    <td className="text-center">
                                      <button
                                        onClick={() => handleTogglePolizaDetail(p)}
                                        className="text-xs text-blue-600 hover:text-blue-800 inline-flex items-center gap-0.5 font-medium"
                                        title="Ver detalle completo"
                                      >
                                        {suraDetailLoading && isExpanded ? (
                                          <Spinner size="xs" />
                                        ) : (
                                          <Icon icon={isExpanded ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'} width={16} />
                                        )}
                                      </button>
                                    </td>
                                  </tr>
                                  {/* Expanded detail row */}
                                  {isExpanded && (
                                    <tr className="bg-blue-50/50 dark:bg-blue-900/10">
                                      <td colSpan={16} className="p-0">
                                        <div className="p-4">
                                          {suraDetailLoading && !detail ? (
                                            <div className="flex items-center gap-2 text-sm text-gray-500 py-3">
                                              <Spinner size="sm" /> Cargando detalle de póliza...
                                            </div>
                                          ) : detail ? (
                                            <div className="space-y-4">
                                              {/* Header info */}
                                              <div className="flex items-center gap-2 mb-2">
                                                <Icon icon="solar:document-text-bold" width={18} className="text-blue-600" />
                                                <span className="font-semibold text-sm text-blue-800 dark:text-blue-300">
                                                  Detalle completo — {p.ramo_nombre}
                                                </span>
                                                <Badge color="gray" size="xs">{detail._endpoint_used}</Badge>
                                              </div>

                                              {/* General info grid */}
                                              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                                {detail.poliza && (
                                                  <div className="bg-white dark:bg-gray-800 rounded-lg p-2.5 border border-gray-100 dark:border-gray-700">
                                                    <div className="text-[10px] text-gray-400 uppercase tracking-wide">Póliza</div>
                                                    <div className="text-sm font-semibold font-mono">{detail.poliza}</div>
                                                  </div>
                                                )}
                                                {detail.estado && (
                                                  <div className="bg-white dark:bg-gray-800 rounded-lg p-2.5 border border-gray-100 dark:border-gray-700">
                                                    <div className="text-[10px] text-gray-400 uppercase tracking-wide">Estado</div>
                                                    <div className="text-sm"><Badge color={detail.estado === 'VIGENTE' ? 'success' : 'warning'} size="xs">{detail.estado}</Badge></div>
                                                  </div>
                                                )}
                                                {detail.plan && (
                                                  <div className="bg-white dark:bg-gray-800 rounded-lg p-2.5 border border-gray-100 dark:border-gray-700">
                                                    <div className="text-[10px] text-gray-400 uppercase tracking-wide">Plan</div>
                                                    <div className="text-sm">{detail.plan}</div>
                                                  </div>
                                                )}
                                                {detail.tipoPoliza && (
                                                  <div className="bg-white dark:bg-gray-800 rounded-lg p-2.5 border border-gray-100 dark:border-gray-700">
                                                    <div className="text-[10px] text-gray-400 uppercase tracking-wide">Tipo Póliza</div>
                                                    <div className="text-sm">{detail.tipoPoliza}</div>
                                                  </div>
                                                )}
                                                {detail.nombreTomador && (
                                                  <div className="bg-white dark:bg-gray-800 rounded-lg p-2.5 border border-gray-100 dark:border-gray-700">
                                                    <div className="text-[10px] text-gray-400 uppercase tracking-wide">Tomador</div>
                                                    <div className="text-sm font-medium">{detail.nombreTomador}</div>
                                                  </div>
                                                )}
                                                {detail.nombreAsegurado && (
                                                  <div className="bg-white dark:bg-gray-800 rounded-lg p-2.5 border border-gray-100 dark:border-gray-700">
                                                    <div className="text-[10px] text-gray-400 uppercase tracking-wide">Asegurado</div>
                                                    <div className="text-sm font-medium">{detail.nombreAsegurado}</div>
                                                  </div>
                                                )}
                                                {detail.nombreBeneficiario && (
                                                  <div className="bg-white dark:bg-gray-800 rounded-lg p-2.5 border border-gray-100 dark:border-gray-700">
                                                    <div className="text-[10px] text-gray-400 uppercase tracking-wide">Beneficiario</div>
                                                    <div className="text-sm">{detail.nombreBeneficiario}</div>
                                                  </div>
                                                )}
                                                {detail.oficina && (
                                                  <div className="bg-white dark:bg-gray-800 rounded-lg p-2.5 border border-gray-100 dark:border-gray-700">
                                                    <div className="text-[10px] text-gray-400 uppercase tracking-wide">Oficina</div>
                                                    <div className="text-sm">{detail.oficina}</div>
                                                  </div>
                                                )}
                                                {detail.fechaExpedicion && (
                                                  <div className="bg-white dark:bg-gray-800 rounded-lg p-2.5 border border-gray-100 dark:border-gray-700">
                                                    <div className="text-[10px] text-gray-400 uppercase tracking-wide">Expedición</div>
                                                    <div className="text-sm">{detail.fechaExpedicion}</div>
                                                  </div>
                                                )}
                                                {detail.fechaInicioVigenciaRiesgo && (
                                                  <div className="bg-white dark:bg-gray-800 rounded-lg p-2.5 border border-gray-100 dark:border-gray-700">
                                                    <div className="text-[10px] text-gray-400 uppercase tracking-wide">Inicio Vigencia</div>
                                                    <div className="text-sm">{detail.fechaInicioVigenciaRiesgo}</div>
                                                  </div>
                                                )}
                                                {detail.fechaFinVigenciaRiesgo && (
                                                  <div className="bg-white dark:bg-gray-800 rounded-lg p-2.5 border border-gray-100 dark:border-gray-700">
                                                    <div className="text-[10px] text-gray-400 uppercase tracking-wide">Fin Vigencia</div>
                                                    <div className="text-sm">{detail.fechaFinVigenciaRiesgo}</div>
                                                  </div>
                                                )}
                                                {detail.ptprimaformapago && (
                                                  <div className="bg-white dark:bg-gray-800 rounded-lg p-2.5 border border-gray-100 dark:border-gray-700">
                                                    <div className="text-[10px] text-gray-400 uppercase tracking-wide">Prima</div>
                                                    <div className="text-sm font-semibold text-green-700">${Number(detail.ptprimaformapago).toLocaleString('es-CO')}</div>
                                                  </div>
                                                )}
                                              </div>

                                              {/* Autos-specific fields */}
                                              {(detail.placa || detail.vehiculo || detail.marca) && (
                                                <div>
                                                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                                                    <Icon icon="solar:car-bold" width={14} /> Vehículo
                                                  </h4>
                                                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                                    {detail.placa && (
                                                      <div className="bg-white dark:bg-gray-800 rounded-lg p-2.5 border border-gray-100 dark:border-gray-700">
                                                        <div className="text-[10px] text-gray-400 uppercase tracking-wide">Placa</div>
                                                        <div className="text-sm font-bold font-mono">{detail.placa}</div>
                                                      </div>
                                                    )}
                                                    {detail.vehiculo && (
                                                      <div className="bg-white dark:bg-gray-800 rounded-lg p-2.5 border border-gray-100 dark:border-gray-700">
                                                        <div className="text-[10px] text-gray-400 uppercase tracking-wide">Vehículo</div>
                                                        <div className="text-sm">{detail.vehiculo}</div>
                                                      </div>
                                                    )}
                                                    {detail.marca && (
                                                      <div className="bg-white dark:bg-gray-800 rounded-lg p-2.5 border border-gray-100 dark:border-gray-700">
                                                        <div className="text-[10px] text-gray-400 uppercase tracking-wide">Marca</div>
                                                        <div className="text-sm">{detail.marca}</div>
                                                      </div>
                                                    )}
                                                    {detail.modelo && (
                                                      <div className="bg-white dark:bg-gray-800 rounded-lg p-2.5 border border-gray-100 dark:border-gray-700">
                                                        <div className="text-[10px] text-gray-400 uppercase tracking-wide">Modelo</div>
                                                        <div className="text-sm">{detail.modelo}</div>
                                                      </div>
                                                    )}
                                                    {detail.chasis && (
                                                      <div className="bg-white dark:bg-gray-800 rounded-lg p-2.5 border border-gray-100 dark:border-gray-700">
                                                        <div className="text-[10px] text-gray-400 uppercase tracking-wide">Chasis</div>
                                                        <div className="text-sm font-mono text-xs">{detail.chasis}</div>
                                                      </div>
                                                    )}
                                                    {detail.motor && (
                                                      <div className="bg-white dark:bg-gray-800 rounded-lg p-2.5 border border-gray-100 dark:border-gray-700">
                                                        <div className="text-[10px] text-gray-400 uppercase tracking-wide">Motor</div>
                                                        <div className="text-sm font-mono text-xs">{detail.motor}</div>
                                                      </div>
                                                    )}
                                                    {detail.zona && (
                                                      <div className="bg-white dark:bg-gray-800 rounded-lg p-2.5 border border-gray-100 dark:border-gray-700">
                                                        <div className="text-[10px] text-gray-400 uppercase tracking-wide">Zona</div>
                                                        <div className="text-sm">{detail.zona}</div>
                                                      </div>
                                                    )}
                                                    {detail.valorVehiculo && (
                                                      <div className="bg-white dark:bg-gray-800 rounded-lg p-2.5 border border-gray-100 dark:border-gray-700">
                                                        <div className="text-[10px] text-gray-400 uppercase tracking-wide">Valor Vehículo</div>
                                                        <div className="text-sm font-semibold text-green-700">${Number(detail.valorVehiculo).toLocaleString('es-CO')}</div>
                                                      </div>
                                                    )}
                                                    {detail.bonificacion && (
                                                      <div className="bg-white dark:bg-gray-800 rounded-lg p-2.5 border border-gray-100 dark:border-gray-700">
                                                        <div className="text-[10px] text-gray-400 uppercase tracking-wide">Bonificación</div>
                                                        <div className="text-sm">{detail.bonificacion}%</div>
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                              )}

                                              {/* Coberturas table */}
                                              {detail.coberturas && detail.coberturas.length > 0 && (
                                                <div>
                                                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                                                    <Icon icon="solar:shield-check-bold" width={14} /> Coberturas ({detail.coberturas.length})
                                                  </h4>
                                                  <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                                                    <table className="text-xs w-full">
                                                      <thead className="bg-gray-50 dark:bg-gray-800">
                                                        <tr>
                                                          <th className="px-3 py-1.5 text-left font-medium">Cobertura</th>
                                                          <th className="px-3 py-1.5 text-right font-medium">Valor Asegurado</th>
                                                          <th className="px-3 py-1.5 text-right font-medium">Deducible</th>
                                                          <th className="px-3 py-1.5 text-right font-medium">Prima</th>
                                                        </tr>
                                                      </thead>
                                                      <tbody>
                                                        {detail.coberturas.map((cob, ci) => (
                                                          <tr key={ci} className="border-t border-gray-100 dark:border-gray-700">
                                                            <td className="px-3 py-1.5">{cob.cobertura || cob.nombreCobertura || '-'}</td>
                                                            <td className="px-3 py-1.5 text-right font-mono">{cob.valorAsegurado ? `$${Number(cob.valorAsegurado).toLocaleString('es-CO')}` : '-'}</td>
                                                            <td className="px-3 py-1.5 text-right">{cob.deducible || '-'}</td>
                                                            <td className="px-3 py-1.5 text-right font-mono">{cob.prima ? `$${Number(cob.prima).toLocaleString('es-CO')}` : '-'}</td>
                                                          </tr>
                                                        ))}
                                                      </tbody>
                                                    </table>
                                                  </div>
                                                </div>
                                              )}

                                              {/* Asesores */}
                                              {detail.asesores && detail.asesores.length > 0 && (
                                                <div>
                                                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                                                    <Icon icon="solar:users-group-rounded-bold" width={14} /> Asesores ({detail.asesores.length})
                                                  </h4>
                                                  <div className="flex flex-wrap gap-2">
                                                    {detail.asesores.map((a, ai) => (
                                                      <div key={ai} className="bg-white dark:bg-gray-800 rounded-lg px-3 py-1.5 border border-gray-100 dark:border-gray-700 text-xs">
                                                        <span className="font-medium">{a.nombreAsesor || a.codigoAsesor}</span>
                                                        {a.participacion && <span className="text-gray-400 ml-1">({a.participacion}%)</span>}
                                                      </div>
                                                    ))}
                                                  </div>
                                                </div>
                                              )}

                                              {/* Recibos pendientes */}
                                              {detail._recibos_pendientes && detail._recibos_pendientes.length > 0 && (
                                                <div>
                                                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                                                    <Icon icon="solar:bill-list-bold" width={14} /> Recibos Pendientes ({detail._recibos_pendientes.length})
                                                  </h4>
                                                  <Badge color="warning" size="xs">{detail._recibos_pendientes.length} recibo(s) pendiente(s)</Badge>
                                                </div>
                                              )}

                                              {/* Raw data toggle for debugging */}
                                              <details className="mt-2">
                                                <summary className="text-[10px] text-gray-400 cursor-pointer hover:text-gray-600">Ver JSON crudo</summary>
                                                <pre className="mt-1 text-[10px] bg-gray-100 dark:bg-gray-900 rounded p-2 max-h-60 overflow-auto">
                                                  {JSON.stringify(detail, null, 2)}
                                                </pre>
                                              </details>
                                            </div>
                                          ) : (
                                            <div className="text-sm text-gray-400 py-2">No se pudo cargar el detalle.</div>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                  </React.Fragment>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Pagination */}
                        {suraMeta.has_more && (
                          <div className="flex justify-center gap-2 mt-4">
                            <Button size="sm" color="light" disabled={suraPage <= 1} onClick={() => handleSuraFetch(suraPage - 1)}>
                              <Icon icon="solar:arrow-left-linear" width={16} className="mr-1" /> Anterior
                            </Button>
                            <span className="flex items-center text-sm text-gray-500 px-3">Página {suraPage}</span>
                            <Button size="sm" color="light" disabled={!suraMeta.has_more} onClick={() => handleSuraFetch(suraPage + 1)}>
                              Siguiente <Icon icon="solar:arrow-right-linear" width={16} className="ml-1" />
                            </Button>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </>
              )}
            </Card>
          );
        }

        // Generic panel for other companies (not yet integrated)
        return (
          <Card className="mb-6 p-5" style={{ borderRadius: `${isBorderRadius}px` }}>
            <div className="text-center py-10">
              <div className="w-20 h-20 mx-auto mb-5 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center">
                <img src={company.logoUrl} alt={company.nombre} className="w-14 h-14 object-contain opacity-50 grayscale" />
              </div>
              <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                {company.nombre}
              </h3>
              <p className="text-sm text-gray-500 mb-4 max-w-md mx-auto">
                La integración con {company.nombre} estará disponible próximamente. Podrás sincronizar clientes, pólizas y carteras.
              </p>
              {company.conectada ? (
                <div className="flex items-center justify-center gap-2">
                  <Badge color="success" size="sm">
                    <Icon icon="solar:check-circle-bold" width={14} className="mr-1" />
                    Conectada
                  </Badge>
                  <Button size="sm" color="failure" outline onClick={() => handleDisconnectAseguradora(company)}>
                    Desconectar
                  </Button>
                </div>
              ) : (
                <Button color="primary" onClick={() => handleLoginAseguradora(company)}>
                  <Icon icon="solar:login-2-bold" width={16} className="mr-1" />
                  Conectar con {company.nombre}
                </Button>
              )}
            </div>
          </Card>
        );
      })()}

      {/* ═══════════ COLLAPSIBLE: ROBOTS DE AUTOMATIZACIÓN ═══════════ */}
      <Card className="mb-6" style={{ borderRadius: `${isBorderRadius}px` }}>
        <button
          onClick={() => toggleSection('robots')}
          className="w-full flex items-center justify-between p-5 text-left"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-lg">
              <Icon icon="solar:bolt-circle-bold-duotone" className="text-primary" width={22} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-dark dark:text-white">Robots de Automatización</h2>
              <p className="text-sm text-gray-500">{robotsActivos} activos de {robots.length} configurados</p>
            </div>
          </div>
          <Icon
            icon="solar:alt-arrow-down-bold"
            width={20}
            className={`text-gray-400 transition-transform duration-200 ${!collapsedSections.robots ? 'rotate-180' : ''}`}
          />
        </button>

        {!collapsedSections.robots && (
          <div className="px-5 pb-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {robots.map((robot) => (
                <Card
                  key={robot.id}
                  className={`p-4 border-2 transition-all ${
                    robot.activo ? 'border-primary bg-primary/5' : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-lg ${robot.activo ? 'bg-primary/20' : 'bg-gray-100 dark:bg-gray-800'}`}>
                        <Icon icon={robot.icon} className={robot.iconColor} width={28} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-dark dark:text-white">{robot.nombre}</h3>
                        <span className={`text-xs font-medium ${robot.activo ? 'text-green-600' : 'text-gray-500'}`}>
                          {robot.activo ? '● Activo' : '○ Inactivo'}
                        </span>
                      </div>
                    </div>
                    {robot.activo && (
                      <div className="text-right text-xs text-gray-500">
                        <div>Cada {FRECUENCIAS.find(f => f.value === robot.frecuencia)?.label || `${robot.frecuencia} min`}</div>
                        {robot.modoAutomatico && <div className="text-blue-500">Sin auditor</div>}
                      </div>
                    )}
                  </div>

                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {robot.descripcion}
                  </p>

                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xs text-gray-500">Aseguradoras:</span>
                    <div className="flex gap-1">
                      {robot.aseguradorasDisponibles.map((asegId) => {
                        const aseg = aseguradoras.find(a => a.id === asegId);
                        return aseg ? (
                          <div
                            key={asegId}
                            className={`w-8 h-8 rounded-full flex items-center justify-center overflow-hidden ${
                              aseg.conectada ? 'bg-white ring-2 ring-green-400' : 'bg-gray-100'
                            }`}
                            title={aseg.nombre}
                          >
                            <img
                              src={aseg.logoUrl}
                              alt={aseg.nombre}
                              className={`w-6 h-6 object-contain ${!aseg.conectada ? 'opacity-40 grayscale' : ''}`}
                            />
                          </div>
                        ) : null;
                      })}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      color="primary"
                      className="flex-1"
                      onClick={() => handleConfigRobot(robot)}
                    >
                      <Icon icon="solar:settings-bold" width={16} className="mr-1" />
                      Configurar
                    </Button>
                    {robot.activo && (
                      <Button
                        size="sm"
                        color="light"
                        onClick={() => handleSyncManual(robot)}
                        disabled={loading}
                      >
                        <Icon icon="solar:refresh-bold" width={16} />
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Modal Login SURA - Credenciales o Cookies */}
      <Modal show={showSuraLoginModal} onClose={() => { setShowSuraLoginModal(false); setSuraCookies(''); setSuraPassword(''); setSuraMfaCode(''); setSuraMfaRequired(false); }} size="lg">
        <Modal.Header>
          <div className="flex items-center gap-3">
            <img src={COMPANY_LOGOS['sura'].url} alt="SURA" className="w-8 h-8 object-contain" />
            <span>Conectar con SURA Asesores</span>
          </div>
        </Modal.Header>
        <Modal.Body>
          {/* Mode toggle */}
          <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700 mb-5">
            <button
              onClick={() => setSuraLoginMode('credentials')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                suraLoginMode === 'credentials'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Icon icon="solar:lock-password-bold" width={16} />
              Credenciales
              <Badge color="success" size="xs">Recomendado</Badge>
            </button>
            <button
              onClick={() => setSuraLoginMode('cookies')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                suraLoginMode === 'cookies'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Icon icon="solar:cookie-bold" width={16} />
              Cookies (manual)
            </button>
          </div>

          {/* Credentials mode */}
          {suraLoginMode === 'credentials' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                <Icon icon="solar:shield-check-bold-duotone" width={24} className="text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-1">Inicio de sesión automático</h3>
                  <p className="text-sm text-blue-700 dark:text-blue-400">
                    Ingresa tus credenciales del portal SURA Asesores. Se almacenan encriptadas y la sesión se renueva automáticamente.
                  </p>
                </div>
              </div>

              {!suraMfaRequired ? (
                <>
                  <div className="flex gap-3">
                    <div className="w-1/3">
                      <Label htmlFor="sura-doctype" className="mb-1.5 block font-medium text-sm">Tipo Doc.</Label>
                      <select
                        id="sura-doctype"
                        value={suraDocType}
                        onChange={(e) => setSuraDocType(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 p-2.5 text-sm dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="C">Cédula</option>
                        <option value="E">Cédula Ext.</option>
                        <option value="A">NIT</option>
                        <option value="P">Pasaporte</option>
                        <option value="T">Tarj. Identidad</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <Label htmlFor="sura-user" className="mb-1.5 block font-medium text-sm">Número de identificación</Label>
                      <TextInput
                        id="sura-user"
                        placeholder="Ej: 1020397190"
                        value={suraUser}
                        onChange={(e) => setSuraUser(e.target.value)}
                        icon={() => <Icon icon="solar:user-id-bold" width={16} />}
                        autoFocus
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="sura-pass" className="mb-1.5 block font-medium text-sm">PIN (4 dígitos)</Label>
                    <div className="relative">
                      <TextInput
                        id="sura-pass"
                        type={suraShowPassword ? 'text' : 'password'}
                        placeholder="Tu PIN de SURA"
                        value={suraPassword}
                        onChange={(e) => setSuraPassword(e.target.value)}
                        icon={() => <Icon icon="solar:lock-bold" width={16} />}
                        maxLength={4}
                        onKeyDown={(e) => e.key === 'Enter' && handleSuraConnect()}
                      />
                      <button
                        type="button"
                        onClick={() => setSuraShowPassword(!suraShowPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <Icon icon={suraShowPassword ? 'solar:eye-bold' : 'solar:eye-closed-bold'} width={18} />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl">
                    <Icon icon="solar:smartphone-bold-duotone" width={24} className="text-yellow-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-yellow-800 dark:text-yellow-300 mb-1">Verificación de doble factor</h3>
                      <p className="text-sm text-yellow-700 dark:text-yellow-400">
                        Abre tu app autenticadora y escribe el código de 6 dígitos que aparece para SURA.
                      </p>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="sura-mfa" className="mb-1.5 block font-medium text-sm">Código de verificación</Label>
                    <TextInput
                      id="sura-mfa"
                      placeholder="Código de 6 dígitos"
                      value={suraMfaCode}
                      onChange={(e) => setSuraMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      icon={() => <Icon icon="solar:shield-keyhole-bold" width={16} />}
                      maxLength={6}
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleSuraConnect()}
                    />
                    <p className="text-xs text-gray-400 mt-1">El código cambia cada 30 segundos. Al marcar "Recordar dispositivo", no se pedirá MFA por 8 días.</p>
                  </div>
                  <button
                    onClick={() => { setSuraMfaRequired(false); setSuraMfaCode(''); }}
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    <Icon icon="solar:arrow-left-linear" width={14} />
                    Volver a credenciales
                  </button>
                </div>
              )}

              <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <Icon icon="solar:refresh-circle-bold-duotone" width={20} className="text-green-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-green-700 dark:text-green-400">
                  <strong>Sesión persistente:</strong> Después de verificar, la sesión se renueva automáticamente sin MFA por 8 días.
                </p>
              </div>
            </div>
          )}

          {/* Cookies mode (fallback) */}
          {suraLoginMode === 'cookies' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl">
                <Icon icon="solar:info-circle-bold-duotone" width={24} className="text-yellow-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-yellow-800 dark:text-yellow-300 mb-1">Método manual</h3>
                  <p className="text-sm text-yellow-700 dark:text-yellow-400">
                    Copia las cookies desde el navegador. La sesión no se renovará automáticamente.
                  </p>
                  <div className="mt-2 space-y-1.5 text-sm text-yellow-700 dark:text-yellow-400">
                    <p>1. Abre <a href="https://asistentevirtualasesores.sura.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">SURA Asesores</a> e inicia sesión</p>
                    <p>2. Presiona <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-700 rounded border text-xs font-mono">F12</kbd> → Application → Cookies</p>
                    <p>3. Selecciona todo y copia (<kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-700 rounded border text-xs font-mono">Ctrl+A</kbd>, <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-700 rounded border text-xs font-mono">Ctrl+C</kbd>)</p>
                  </div>
                </div>
              </div>
              <div>
                <Label htmlFor="sura-cookies" className="mb-1.5 block font-medium">Cookies de sesión SURA</Label>
                <textarea
                  id="sura-cookies"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm p-3 h-24 font-mono resize-none focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="Pega aquí las cookies copiadas..."
                  value={suraCookies}
                  onChange={(e) => setSuraCookies(e.target.value)}
                />
                <p className="text-xs text-gray-400 mt-1">Se almacenan encriptadas y solo se usan para consultar el API de SURA.</p>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            color="primary"
            onClick={handleSuraConnect}
            disabled={suraConnecting || (suraLoginMode === 'credentials'
              ? (suraMfaRequired ? !suraMfaCode.trim() : (!suraUser.trim() || !suraPassword.trim()))
              : !suraCookies.trim())}
          >
            {suraConnecting ? (
              <><Spinner size="sm" className="mr-2" />{suraMfaRequired ? 'Verificando código...' : suraLoginMode === 'credentials' ? 'Iniciando sesión...' : 'Validando sesión...'}</>
            ) : (
              <><Icon icon={suraMfaRequired ? 'solar:shield-keyhole-bold' : 'solar:link-circle-bold'} width={16} className="mr-1" />{suraMfaRequired ? 'Verificar código' : 'Conectar con SURA'}</>
            )}
          </Button>
          <Button color="light" onClick={() => { setShowSuraLoginModal(false); setSuraCookies(''); setSuraPassword(''); setSuraMfaCode(''); setSuraMfaRequired(false); }}>Cancelar</Button>
        </Modal.Footer>
      </Modal>

      {/* Modal de configuración de robot */}
      <Modal show={showConfigModal} onClose={() => setShowConfigModal(false)} size="lg">
        <Modal.Header>
          <div className="flex items-center gap-3">
            {selectedRobot && (
              <>
                <Icon icon={selectedRobot.icon} className={selectedRobot.iconColor} width={24} />
                <span>Configurar {selectedRobot.nombre}</span>
              </>
            )}
          </div>
        </Modal.Header>
        <Modal.Body>
          {selectedRobot && (
            <div className="space-y-6">
              <p className="text-gray-600 dark:text-gray-400">
                {selectedRobot.descripcion}
              </p>

              {/* Selección de aseguradoras */}
              <div>
                <Label className="mb-3 block font-medium">
                  Aseguradoras a sincronizar
                </Label>
                <div className="space-y-3">
                  {selectedRobot.aseguradorasDisponibles.map((asegId) => {
                    const aseg = aseguradoras.find(a => a.id === asegId);
                    if (!aseg) return null;

                    return (
                      <div
                        key={asegId}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          aseg.conectada ? 'border-gray-200 dark:border-gray-700' : 'border-gray-100 bg-gray-50 dark:bg-gray-800'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            id={`aseg-${asegId}`}
                            checked={robotAseguradoras.includes(asegId)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setRobotAseguradoras([...robotAseguradoras, asegId]);
                              } else {
                                setRobotAseguradoras(robotAseguradoras.filter(a => a !== asegId));
                              }
                            }}
                            disabled={!aseg.conectada}
                          />
                          <Label htmlFor={`aseg-${asegId}`} className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded bg-white flex items-center justify-center p-1">
                              <img src={aseg.logoUrl} alt={aseg.nombre} className={`max-w-full max-h-full object-contain ${!aseg.conectada ? 'opacity-50 grayscale' : ''}`} />
                            </div>
                            <span>{aseg.nombre}</span>
                          </Label>
                        </div>
                        {!aseg.conectada && (
                          <Badge color="gray" size="sm">No conectada</Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
                {aseguradoras.filter(a => selectedRobot.aseguradorasDisponibles.includes(a.id) && !a.conectada).length > 0 && (
                  <p className="text-sm text-gray-500 mt-2">
                    <Icon icon="solar:info-circle-bold" className="inline mr-1" width={14} />
                    Conecta las aseguradoras desde el panel superior para habilitarlas
                  </p>
                )}
              </div>

              {/* Frecuencia de sincronización */}
              <div>
                <Label className="mb-3 block font-medium">
                  <Icon icon="solar:clock-circle-bold" className="inline mr-2" width={16} />
                  Frecuencia de sincronización
                </Label>
                <select
                  value={frecuencia}
                  onChange={(e) => setFrecuencia(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 p-2.5 dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {FRECUENCIAS.map((f) => (
                    <option key={f.value} value={f.value}>
                      Cada {f.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-2">
                  El robot se ejecutará automáticamente con esta frecuencia cuando esté activo
                </p>
              </div>

              {/* Modo automático */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-medium">Modo automático</Label>
                    <p className="text-sm text-gray-500">
                      Los datos se sincronizarán automáticamente sin pasar por el auditor
                    </p>
                  </div>
                  <ToggleSwitch
                    checked={modoAutomatico}
                    onChange={setModoAutomatico}
                  />
                </div>
                {modoAutomatico && (
                  <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Icon icon="solar:danger-triangle-bold" className="text-yellow-500" width={18} />
                      <p className="text-sm text-yellow-700 dark:text-yellow-400">
                        Los datos se aplicarán directamente sin revisión previa. Asegúrate de que la configuración sea correcta.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setShowConfigModal(false)}>
            Cancelar
          </Button>
          <Button color="primary" onClick={handleSaveConfig}>
            <Icon icon="solar:check-circle-bold" width={16} className="mr-1" />
            Guardar configuración
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal de login de aseguradora */}
      <Modal show={showLoginModal} onClose={() => setShowLoginModal(false)}>
        <Modal.Header>
          <div className="flex items-center gap-3">
            {selectedAseguradora && (
              <>
                <div className="w-8 h-8 rounded bg-white flex items-center justify-center p-1">
                  <img src={selectedAseguradora.logoUrl} alt={selectedAseguradora.nombre} className="max-w-full max-h-full object-contain" />
                </div>
                <span>Conectar con {selectedAseguradora.nombre}</span>
              </>
            )}
          </div>
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              Ingresa tus credenciales de {selectedAseguradora?.nombre} para conectar tu cuenta.
            </p>

            <div>
              <Label htmlFor="usuario" className="mb-2 block">
                Usuario / Email
              </Label>
              <input
                type="text"
                id="usuario"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 p-2.5 dark:bg-gray-700"
                placeholder="usuario@ejemplo.com"
              />
            </div>

            <div>
              <Label htmlFor="password" className="mb-2 block">
                Contraseña
              </Label>
              <input
                type="password"
                id="password"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 p-2.5 dark:bg-gray-700"
                placeholder="••••••••"
              />
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-start gap-2">
                <Icon icon="solar:shield-check-bold" className="text-blue-500" width={18} />
                <p className="text-sm text-blue-700 dark:text-blue-400">
                  Tus credenciales se almacenan de forma segura y encriptada. Solo se utilizan para sincronizar datos.
                </p>
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setShowLoginModal(false)}>
            Cancelar
          </Button>
          <Button color="primary" onClick={handleConnectAseguradora} disabled={loading}>
            {loading ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Conectando...
              </>
            ) : (
              <>
                <Icon icon="solar:login-2-bold" width={16} className="mr-1" />
                Conectar
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal de reporte de importación SURA → Guro */}
      <Modal show={showImportReport} onClose={() => setShowImportReport(false)} size="xl">
        <Modal.Header>
          <div className="flex items-center gap-3">
            <Icon icon="solar:document-text-bold-duotone" className="text-primary" width={24} />
            <span>Reporte de Importación</span>
          </div>
        </Modal.Header>
        <Modal.Body>
          {importReport && (
            <div className="space-y-5">
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
                  <p className="text-2xl font-bold text-dark dark:text-white">{importReport.summary.total}</p>
                  <p className="text-xs text-gray-500">Total enviados</p>
                </div>
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                  <p className="text-2xl font-bold text-green-600">{importReport.summary.imported_count}</p>
                  <p className="text-xs text-green-600">Importados</p>
                </div>
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-center">
                  <p className="text-2xl font-bold text-yellow-600">{importReport.summary.duplicate_count}</p>
                  <p className="text-xs text-yellow-600">Duplicados</p>
                </div>
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-center">
                  <p className="text-2xl font-bold text-red-600">{importReport.summary.error_count}</p>
                  <p className="text-xs text-red-600">Errores</p>
                </div>
              </div>

              {/* Imported list */}
              {importReport.imported.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-green-700 dark:text-green-400 mb-2 flex items-center gap-1">
                    <Icon icon="solar:check-circle-bold" width={16} />
                    Clientes importados ({importReport.imported.length})
                  </h4>
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-green-200 dark:border-green-800">
                    <table className="w-full text-sm">
                      <thead className="bg-green-50 dark:bg-green-900/30 sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-1.5 text-xs">ID</th>
                          <th className="text-left px-3 py-1.5 text-xs">Nombre</th>
                          <th className="text-left px-3 py-1.5 text-xs">Documento</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importReport.imported.map((c) => (
                          <tr key={c.id} className="border-t border-green-100 dark:border-green-900">
                            <td className="px-3 py-1.5 font-mono text-xs">{c.id}</td>
                            <td className="px-3 py-1.5">{c.nombre}</td>
                            <td className="px-3 py-1.5 font-mono">{c.documento}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Duplicates list */}
              {importReport.duplicates.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-yellow-700 dark:text-yellow-400 mb-2 flex items-center gap-1">
                    <Icon icon="solar:copy-bold" width={16} />
                    Duplicados detectados ({importReport.duplicates.length})
                  </h4>
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <table className="w-full text-sm">
                      <thead className="bg-yellow-50 dark:bg-yellow-900/30 sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-1.5 text-xs">SURA</th>
                          <th className="text-left px-3 py-1.5 text-xs">Documento</th>
                          <th className="text-left px-3 py-1.5 text-xs">Existente en Guro</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importReport.duplicates.map((d, i) => (
                          <tr key={i} className="border-t border-yellow-100 dark:border-yellow-900">
                            <td className="px-3 py-1.5">{d.sura_nombre}</td>
                            <td className="px-3 py-1.5 font-mono">{d.documento}</td>
                            <td className="px-3 py-1.5 text-xs">
                              <span className="text-gray-500">#{d.existing_id}</span> {d.existing_nombre}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Errors list */}
              {importReport.errors.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-2 flex items-center gap-1">
                    <Icon icon="solar:danger-triangle-bold" width={16} />
                    Errores ({importReport.errors.length})
                  </h4>
                  <div className="max-h-32 overflow-y-auto rounded-lg border border-red-200 dark:border-red-800">
                    {importReport.errors.map((e, i) => (
                      <div key={i} className="px-3 py-2 border-b border-red-100 dark:border-red-900 last:border-0 text-sm">
                        <span className="font-medium">{e.nombre}</span>
                        {e.documento && <span className="text-gray-500 ml-1">({e.documento})</span>}
                        <span className="text-red-500 ml-2 text-xs">— {e.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button color="primary" onClick={() => setShowImportReport(false)}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default Robots;
