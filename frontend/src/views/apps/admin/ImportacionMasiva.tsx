import React, { useEffect, useMemo, useState } from 'react';
import { Card, Button, Select, Badge, Table, Alert, Progress } from 'flowbite-react';
import { Icon } from '@iconify/react';
import {
  getMeta,
  dryRunImport,
  executeImport,
  ImportMetaResponse,
  getJobs,
} from 'src/services/importService';

type Step = 1 | 2 | 3 | 4;

// Orden de importación recomendado con descripciones
const IMPORT_ORDER = [
  {
    key: 'aseguradoras',
    label: 'Aseguradoras',
    icon: 'solar:buildings-2-bold-duotone',
    color: 'bg-blue-500',
    description: 'Compañías de seguros con las que trabajas',
    step: 1,
  },
  {
    key: 'ramos',
    label: 'Ramos',
    icon: 'solar:layers-bold-duotone',
    color: 'bg-purple-500',
    description: 'Tipos de seguros (Auto, Vida, Hogar, etc.)',
    step: 2,
  },
  {
    key: 'vendedores',
    label: 'Vendedores',
    icon: 'solar:users-group-rounded-bold-duotone',
    color: 'bg-green-500',
    description: 'Equipo de ventas y asesores',
    step: 3,
  },
  {
    key: 'clientes',
    label: 'Clientes',
    icon: 'solar:user-id-bold-duotone',
    color: 'bg-amber-500',
    description: 'Tomadores y asegurados',
    step: 4,
  },
  {
    key: 'polizas',
    label: 'Pólizas',
    icon: 'solar:document-text-bold-duotone',
    color: 'bg-red-500',
    description: 'Contratos de seguros (requiere clientes, aseguradoras y ramos)',
    step: 5,
  },
];

const ImportacionMasiva: React.FC = () => {
  const [step, setStep] = useState<Step>(1);
  const [meta, setMeta] = useState<ImportMetaResponse['entities']>({} as any);
  const [entity, setEntity] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [upsertKey, setUpsertKey] = useState<string>('');
  const [autoCreate, setAutoCreate] = useState<boolean>(false); // Auto-crear entidades relacionadas
  const [importLimit, setImportLimit] = useState<string>(''); // Límite de registros (vacío = todos)
  const [preview, setPreview] = useState<any[]>([]);
  const [totalRows, setTotalRows] = useState<number>(0);
  const [rowsToImport, setRowsToImport] = useState<number>(0);
  const [errors, setErrors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    inserted: number;
    updated: number;
    failed: number;
    auto_created?: Record<string, string[]>;
  } | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Plantillas recomendadas por entidad (campos más comunes)
  const templateColumns: Record<string, string[]> = {
    aseguradoras: [
      'nombre', 'nit', 'email', 'telefono', 'direccion', 
      'cuenta_bancaria', 'link_pago', 'codigo_intermediario',
      'retencion', 'iva', 'retencion_iva'
    ],
    ramos: ['nombre', 'subramo', 'calcular_iva_pri_a_pre', 'vista_mapa_oportunidad'],
    vendedores: [
      'nombres', 'tipo_documento', 'numero_documento', 'telefono', 'celular', 'email',
      'cuenta_bancaria', 'tipo_persona', 'tipo_retencion', 'es_agencia',
      'porcentaje_comision', 'calcular_comision_sobre', 'porcentaje_retencion',
      'porcentaje_retencion_ica', 'porcentaje_iva', 'porcentaje_retencion_iva',
      'fecha_vinculacion'
    ],
    clientes: [
      'tipo_cliente', 'nombre', 'apellidos', 'tipo_documento', 'documento',
      'email', 'telefono', 'celular', 'fecha_nacimiento', 'genero', 'estado_civil',
      'direccion', 'ciudad', 'departamento', 'pais', 'codigo_postal',
      'ocupacion', 'empresa', 'razon_social', 'ingresos_mensuales',
      'contacto_emergencia_nombre', 'contacto_emergencia_telefono', 'contacto_emergencia_parentesco',
      'estado', 'prioridad', 'origen', 'notas'
    ],
    polizas: [
      // Identificación
      'numero_poliza', 'numero_interno', 'tipo',
      // Aseguradora y producto
      'aseguradora', 'ramo', 'subramo', 'producto', 'descripcion',
      // Cliente
      'cliente_documento', 'cliente_nombre', 'cliente_email',
      // Vendedor 1
      'vendedor_email', 'vendedor_nombre',
      // Vendedor 2 (opcional)
      'vendedor_2_email', 'vendedor_2_nombre',
      // Enlace externo
      'enlace_externo',
      // Fechas
      'fecha_emision', 'fecha_inicio', 'fecha_fin', 'fecha_vencimiento_pago', 'fecha_renovacion', 'fecha_recepcion',
      // Valores
      'prima_neta', 'valor_asegurado', 'deducible', 'total',
      // Comisiones
      'porcentaje_comision', 'monto_comision', 'porcentaje_iva', 'monto_iva',
      'gastos_adicionales', 'gastos_adicionales_aplica_iva',
      // Pago
      'frecuencia_pago', 'medio_pago', 'banco', 'pago_semestral', 'numero_cuotas',
      'ultimos_4_tarjeta', 'numero_cheque', 'plazo_convenio', 'numero_cuenta_debito',
      // Estado
      'estado', 'estado_pago', 'notas_estado', 'motivo',
      // Beneficiario
      'beneficiario_nombre', 'beneficiario_documento', 'beneficiario_parentesco', 'beneficiario_telefono',
      // Tomador
      'tomador_nombre', 'tomador_documento',
      // Asegurado
      'asegurado_nombre', 'asegurado_documento',
      // Vehículo
      'placa_vehiculo',
      // Renovación
      'es_renovable', 'dias_aviso_renovacion',
      // Otros campos de comisión
      'pri_a_pre', 'participacion', 'co_corretaje', 'comision_agencia',
      'porcentaje_retencion', 'porcentaje_reteiva', 'beneficiario_en_giro',
      // Notas
      'notas'
    ],
  };

  const templateSamples: Record<string, string[][]> = {
    aseguradoras: [
      ['Seguros Ejemplo S.A.', '900123456-1', 'contacto@segurosejemplo.com', '3001234567', 'Cra 7 # 123-45', '123456789', 'https://pagos.ejemplo.com', 'INT001', '0', '19', '0'],
      ['Aseguradora ACME', '800987654-2', 'soporte@acme.com', '6011234567', 'Av. Siempre Viva 742', '987654321', '', 'INT002', '0', '19', '0'],
    ],
    ramos: [
      ['Automóviles', 'Vehículos particulares', 'si', 'si'],
      ['Hogar', 'Vivienda', 'no', 'no'],
      ['Vida', 'Vida individual', 'no', 'si'],
    ],
    vendedores: [
      ['Juan Pérez', 'CC', '1012345678', '3001234567', '3001234567', 'juan.perez@email.com', '123456789', 'natural', '', 'no', '10', 'prima_neta', '0', '0', '0', '0', '2024-01-15'],
      ['Agencia ABC', 'NIT', '900111222-3', '6011234567', '', 'agencia@abc.com', '987654321', 'juridica', '', 'si', '15', 'agencia', '11', '0', '19', '15', '2023-06-01'],
    ],
    clientes: [
      ['natural', 'María', 'García López', 'CC', '1012345678', 'maria.garcia@mail.com', '6011234567', '3205557788', '1985-03-15', 'femenino', 'casada', 'Calle 10 # 20-30', 'Bogotá', 'Cundinamarca', 'Colombia', '110111', 'Ingeniera', '', '', '5000000', 'Pedro García', '3001112233', 'Esposo', 'activo', 'alta', 'Referido', ''],
      ['juridica', 'Comercial XYZ', '', 'NIT', '900123456-1', 'ventas@xyz.com', '6017778899', '3109998877', '', '', '', 'Calle 80 # 50-60', 'Bogotá', 'Cundinamarca', 'Colombia', '110221', '', 'Comercial XYZ S.A.S.', 'Comercial XYZ S.A.S.', '50000000', 'Ana Martínez', '3002223344', 'Gerente', 'activo', 'media', 'Web', 'Cliente corporativo'],
    ],
    polizas: [
      // Ejemplo 1: Póliza de auto completa con 2 vendedores
      [
        'POL-2025-0001', 'INT-001', 'individual', // Identificación
        'Seguros Ejemplo S.A.', 'Automóviles', 'Vehículos particulares', 'Todo Riesgo Auto', 'Cobertura completa', // Aseguradora y producto
        '1012345678', 'María García', 'maria.garcia@mail.com', // Cliente
        'juan.perez@email.com', 'Juan Pérez', // Vendedor 1
        'ana.martinez@email.com', 'Ana Martínez', // Vendedor 2 (opcional)
        'https://portal.aseguradora.com/poliza/123', // Enlace externo
        '2025-01-15', '2025-01-15', '2026-01-14', '2025-02-15', '2026-01-01', '2025-01-10', // Fechas
        '1200000', '50000000', '500000', '1428000', // Valores
        '10', '120000', '19', '228000', '0', 'no', // Comisiones
        'anual', 'transferencia', 'Bancolombia', 'no', '1', '', '', '', '', // Pago
        'activa', 'pagado', '', '', // Estado
        'Pedro García', '1012345679', 'Esposo', '3001112233', // Beneficiario
        'María García', '1012345678', // Tomador
        'María García', '1012345678', // Asegurado
        'ABC123', // Vehículo
        'si', '30', // Renovación
        '', '', '', '', '0', '0', 'no', // Otros campos comisión
        'Póliza renovada automáticamente' // Notas
      ],
      // Ejemplo 2: Póliza empresarial con solo 1 vendedor
      [
        'POL-2025-0002', 'INT-002', 'colectiva',
        'Aseguradora ACME', 'Hogar', 'Vivienda', 'Hogar Plus', 'Protección integral',
        '900123456-1', 'Comercial XYZ', 'ventas@xyz.com',
        '', '', // Vendedor 1 vacío
        '', '', // Vendedor 2 vacío
        '', // Enlace externo vacío
        '2025-02-01', '2025-02-01', '2026-01-31', '2025-03-01', '', '2025-01-28',
        '3500000', '200000000', '1000000', '4165000',
        '12', '420000', '19', '665000', '50000', 'si',
        'semestral', 'debito', 'Davivienda', 'si', '2', '', '', '', '123456789',
        'activa', 'pendiente', '', '',
        '', '', '', '',
        'Comercial XYZ S.A.S.', '900123456-1',
        'Comercial XYZ S.A.S.', '900123456-1',
        '',
        'no', '',
        '100', '50', '25', '10', '11', '15', 'si',
        'Póliza corporativa con cobertura especial'
      ],
    ],
  };

  const downloadCsvTemplate = (ent: string) => {
    const cols = templateColumns[normalize(ent)] || [];
    if (!cols.length) return;
    const rows = templateSamples[normalize(ent)] || [];
    const escape = (s: string) => {
      const needs = /[",\n]/.test(s);
      let v = s.replace(/"/g, '""');
      return needs ? `"${v}"` : v;
    };
    const lines = [cols, ...rows].map((arr) =>
      arr.map((cell) => escape(String(cell ?? ''))).join(','),
    );
    const csv = lines.join('\n') + '\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plantilla_${normalize(ent)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Helpers: normalización y sinónimos para autocompletar mapeo
  const normalize = (s?: string) =>
    (s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

  const getSynonyms = (ent: string) => {
    const base: Record<string, string[]> = {
      nombre: [
        'name',
        'razon_social',
        'razon',
        'compania',
        'compania_de_seguros',
        'aseguradora',
        'cliente',
        'full_name',
        'razón_social',
        'company',
        'business_name',
      ],
      codigo: ['codigo', 'código', 'code', 'id', 'clave'],
      documento: [
        'documento',
        'identificacion',
        'identificación',
        'cedula',
        'cedula_ciudadania',
        'nit',
        'nif',
        'dni',
        'numero_documento',
        'doc',
        'rut',
      ],
      email: ['correo', 'correo_electronico', 'mail', 'e_mail'],
      telefono: ['telefono', 'teléfono', 'celular', 'movil', 'móvil', 'phone', 'whatsapp'],
      direccion: ['direccion', 'dirección', 'address', 'dir'],
      ciudad: ['ciudad', 'municipio', 'localidad', 'city'],
      departamento: ['departamento', 'region', 'provincia', 'estado'],
      numero: ['numero', 'número', 'num'],
      poliza: ['poliza', 'póliza', 'numero_poliza', 'num_poliza', 'pol', 'policy'],
      prima: ['prima', 'prima_neta', 'valor_prima', 'monto', 'premium', 'premium_amount', 'valor'],
      ramo: ['ramo', 'tipo_de_seguro', 'linea', 'linea_de_negocio'],
      aseguradora: ['aseguradora', 'compania', 'compañia', 'cia', 'compania_seguros'],
      fecha_emision: [
        'fecha_emision',
        'fecha_de_emision',
        'emision',
        'issue_date',
        'fecha_emision_poliza',
      ],
      vigencia_desde: ['vigencia_desde', 'inicio_vigencia', 'fecha_inicio', 'start_date'],
      vigencia_hasta: ['vigencia_hasta', 'fin_vigencia', 'fecha_fin', 'end_date'],
      archivo: [
        'archivo',
        'file',
        'documento',
        'doc',
        'path',
        'url',
        'enlace',
        'filename',
        'file_url',
      ],
      descripcion: ['descripcion', 'descripción', 'detail', 'notes', 'observaciones', 'detalle'],
    };
    const perEntity: Record<string, Record<string, string[]>> = {
      aseguradora: {
        nombre: ['aseguradora', 'compania', 'compañia', 'nombre_aseguradora'],
        nit: ['nit', 'nif', 'rut', 'documento', 'identificacion', 'tax_id'],
        email: ['correo', 'email'],
        telefono: ['telefono', 'celular', 'movil'],
        direccion: ['direccion', 'dirección'],
        ciudad: ['ciudad', 'municipio'],
      },
      ramos: {
        nombre: ['ramo', 'tipo_de_seguro', 'linea'],
        codigo: ['codigo', 'id'],
      },
      clientes: {
        tipo_persona: ['tipo_persona', 'tipo', 'persona_natural', 'persona_juridica'],
        tipo_documento: ['tipo_documento', 'tdoc'],
        numero_documento: [
          'numero_documento',
          'documento',
          'identificacion',
          'cedula',
          'cédula',
          'dni',
          'nit',
          'rut',
        ],
        nombres: ['nombres', 'nombre', 'primer_nombre', 'full_name', 'nombres_cliente'],
        apellidos: ['apellidos', 'apellido', 'primer_apellido', 'segundo_apellido'],
        email: ['correo', 'correo_electronico', 'email'],
        telefono: ['telefono', 'celular', 'movil'],
        direccion: ['direccion', 'dirección'],
        ciudad: ['ciudad', 'municipio'],
        departamento: ['departamento', 'region', 'provincia'],
      },
      polizas: {
        numero: ['numero_poliza', 'poliza', 'póliza', 'num_poliza', 'policy'],
        aseguradora: ['aseguradora', 'compania', 'compañia'],
        ramo: ['ramo', 'tipo_de_seguro'],
        fecha_emision: ['fecha_emision', 'issue_date'],
        vigencia_desde: ['vigencia_desde', 'inicio_vigencia', 'start_date'],
        vigencia_hasta: ['vigencia_hasta', 'fin_vigencia', 'end_date'],
        prima: ['prima', 'prima_neta', 'valor_prima', 'premium'],
        tomador: ['tomador', 'cliente', 'asegurado', 'contratante'],
        estado: ['estado', 'status'],
      },
      anexos: {
        archivo: ['archivo', 'file', 'path', 'url', 'filename', 'file_url'],
        descripcion: ['descripcion', 'detalle', 'notes'],
        poliza: ['poliza', 'numero_poliza', 'num_poliza', 'policy'],
      },
    };
    return { ...base, ...(perEntity[normalize(ent)] || {}) };
  };

  const suggestMapping = ({
    fields,
    headers,
    ent,
  }: {
    fields: string[];
    headers: string[];
    ent: string;
  }) => {
    const used = new Set<string>();
    const result: Record<string, string> = {};
    const synonyms = getSynonyms(ent);
    const normalizedHeaders = headers.map((h) => ({ raw: h, norm: normalize(h) }));

    const findHeader = (targetNorm: string): string | null => {
      // 1) exact match
      const exact = normalizedHeaders.find((h) => h.norm === targetNorm && !used.has(h.raw));
      if (exact) return exact.raw;
      // 2) synonyms
      const syns = synonyms[targetNorm] || [];
      for (const s of syns) {
        const hit = normalizedHeaders.find((h) => h.norm === normalize(s) && !used.has(h.raw));
        if (hit) return hit.raw;
      }
      // 3) fuzzy includes
      const fuzzy = normalizedHeaders.find(
        (h) => !used.has(h.raw) && (h.norm.includes(targetNorm) || targetNorm.includes(h.norm)),
      );
      if (fuzzy) return fuzzy.raw;
      return null;
    };

    for (const f of fields) {
      const fNorm = normalize(f);
      const header = findHeader(fNorm);
      if (header) {
        result[f] = header;
        used.add(header);
      }
    }
    return result;
  };

  // Campos y claves únicas derivados de meta/entidad
  const fields = useMemo(
    () => (entity && meta[entity]?.fields ? meta[entity].fields : []),
    [entity, meta],
  );
  const uniqueKeys = useMemo(
    () => (entity && meta[entity]?.unique_keys ? meta[entity].unique_keys : []),
    [entity, meta],
  );

  // Obtener campos requeridos desde el backend (meta) o usar valores por defecto
  const getRequiredFields = (): string[] => {
    // Primero intentar obtener del backend
    if (meta[entity]?.required_fields?.length) {
      return meta[entity].required_fields;
    }
    // Fallback a valores por defecto
    const defaults: Record<string, string[]> = {
      aseguradoras: ['nombre'],
      ramos: ['nombre'],
      vendedores: ['nombres', 'email'],
      clientes: ['nombre'],
      polizas: ['numero_poliza'],
    };
    return defaults[normalize(entity)] || [];
  };

  // Validar que al menos un campo esté mapeado
  const validateMapping = (): { ok: boolean; errors: string[] } => {
    const validationErrors: string[] = [];
    
    // Verificar que hay al menos un campo mapeado
    const mappedFields = Object.entries(mapping).filter(([_, csvCol]) => csvCol && csvCol.trim() !== '');
    if (mappedFields.length === 0) {
      validationErrors.push('Debes mapear al menos un campo para poder importar');
      return { ok: false, errors: validationErrors };
    }

    // Obtener campos requeridos
    const requiredFields = getRequiredFields();
    
    // Verificar campos requeridos (solo si hay campos requeridos definidos)
    if (requiredFields.length > 0) {
      const mappedFieldNames = mappedFields.map(([field]) => normalize(field));
      const missingRequired = requiredFields.filter(req => {
        // Buscar si algún campo mapeado coincide con el requerido (normalizado)
        return !mappedFieldNames.some(mapped => 
          normalize(mapped) === normalize(req) || 
          mapped.includes(normalize(req)) || 
          normalize(req).includes(mapped)
        );
      });
      
      if (missingRequired.length > 0) {
        validationErrors.push(
          `Campos requeridos sin mapear: ${missingRequired.join(', ')}. ` +
          `Asegúrate de que tu archivo tenga estos campos y estén mapeados.`
        );
      }
    }

    return { ok: validationErrors.length === 0, errors: validationErrors };
  };

  useEffect(() => {
    (async () => {
      const res = await getMeta();
      if (res?.success) {
        setMeta(res.entities);
        // Preselección priorizada si no hay entidad
        const priorities = ['aseguradora', 'ramos', 'clientes', 'polizas', 'anexos'];
        if (!entity) {
          const available = Object.keys(res.entities || {});
          const pick = priorities.find((p) => available.includes(p));
          if (pick) setEntity(pick);
        }
      }
      loadJobs();
    })();
  }, []);

  // Función para cargar historial de jobs
  const loadJobs = async () => {
    try {
      const jobsRes = await getJobs(10);
      if (jobsRes?.success) setJobs(jobsRes.data || []);
    } catch (e) {
      console.warn('Error cargando historial de importaciones:', e);
    }
  };

  // Sugerir upsert_key automáticamente si hay claves únicas
  useEffect(() => {
    if (entity) {
      const uniq = meta?.[entity]?.unique_keys || [];
      if (uniq.length && !upsertKey) setUpsertKey(uniq[0]);
    }
  }, [entity, meta, upsertKey]);

  // Autocompletar mapeo cuando hay headers y aún no se ha mapeado nada
  useEffect(() => {
    if (
      step >= 3 &&
      entity &&
      headers.length &&
      fields.length &&
      Object.keys(mapping).length === 0
    ) {
      const auto = suggestMapping({ fields, headers, ent: entity });
      if (Object.keys(auto).length) setMapping(auto);
    }
  }, [step, entity, headers, fields, mapping]);

  const handleFile = (f?: File) => {
    if (!f) return;
    setFile(f);
    setHeaders([]);
    setMapping({});
    setPreview([]);
    setErrors([]);
  };

  const fetchHeaders = async (): Promise<boolean> => {
    // Llamada en modo dry-run sin mapping para traer headers del archivo
    if (!file || !entity) {
      console.error('fetchHeaders: No hay archivo o entidad seleccionada', { file: !!file, entity });
      return false;
    }
    setLoading(true);
    setErrors([]);
    try {
      console.log('fetchHeaders: Enviando archivo al servidor...', { entity, fileName: file.name, fileSize: file.size });
      // Notar que el backend acepta mapping como objeto vacío para devolver solo headers
      const res = await dryRunImport({
        entity,
        file,
        mapping: {},
        upsert_key: upsertKey || undefined,
      });
      console.log('fetchHeaders: Respuesta del servidor:', res);
      if (res?.success) {
        const hdrs = Array.isArray(res.headers) ? res.headers.filter(Boolean) : [];
        console.log('fetchHeaders: Headers obtenidos:', hdrs);
        setHeaders(hdrs);
        return true;
      } else {
        setErrors([{ error: res?.message || 'Error al procesar el archivo' }]);
        return false;
      }
    } catch (e: any) {
      console.error('fetchHeaders: Error:', e);
      setErrors([{ error: e?.message || 'Error de conexión con el servidor' }]);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const runDry = async () => {
    if (!file || !entity) return;
    setLoading(true);
    setErrors([]);
    try {
      // Validar mapeo antes de previsualizar
      const validation = validateMapping();
      if (!validation.ok) {
        setErrors(validation.errors.map((err: string) => ({ error: err })));
        setLoading(false);
        return;
      }
      const res = await dryRunImport({ 
        entity, 
        file, 
        mapping, 
        upsert_key: upsertKey || undefined,
        limit: importLimit ? parseInt(importLimit) : undefined,
      });
      if (res?.success) {
        setHeaders(res.headers || []);
        setPreview(res.preview || []);
        setTotalRows(res.total_rows || 0);
        setRowsToImport(res.rows_to_import || res.total_rows || 0);
        setErrors(res.errors || []);
        setStep(4);
      } else {
        setErrors([{ error: res?.message || 'Error al procesar el archivo' }]);
      }
    } catch (e: any) {
      setErrors([{ error: e.message || 'Error de conexión con el servidor' }]);
    } finally {
      setLoading(false);
    }
  };

  const runExecute = async () => {
    if (!file || !entity) return;
    setLoading(true);
    setErrors([]);
    try {
      // Validar mapeo antes de importar
      const validation = validateMapping();
      if (!validation.ok) {
        setErrors(validation.errors.map((err: string) => ({ error: err })));
        setLoading(false);
        return;
      }
      const res = await executeImport({
        entity,
        file,
        mapping,
        upsert_key: upsertKey || undefined,
        auto_create: autoCreate,
        limit: importLimit ? parseInt(importLimit) : undefined,
      });
      if (res?.success) {
        setResult(res.summary || null);
        // Actualizar errores con los errores detallados de la importación
        if (res.errors && res.errors.length > 0) {
          setErrors(res.errors);
        }
        // Recargar historial de jobs
        loadJobs();
      } else {
        setErrors([{ error: res?.message || 'Error desconocido durante la importación' }]);
      }
    } catch (e: any) {
      setErrors([{ error: e.message || 'Error de conexión con el servidor' }]);
    } finally {
      setLoading(false);
    }
  };

  // Función para resetear y empezar nueva importación
  const resetImport = () => {
    setStep(1);
    setEntity('');
    setFile(null);
    setHeaders([]);
    setMapping({});
    setUpsertKey('');
    setAutoCreate(false);
    setImportLimit('');
    setPreview([]);
    setTotalRows(0);
    setRowsToImport(0);
    setErrors([]);
    setResult(null);
  };

  // Verificar si la entidad actual tiene relaciones auto-creables
  const hasAutoCreateRelations = meta[entity]?.auto_create_relations && 
    Object.keys(meta[entity].auto_create_relations || {}).length > 0;

  // Obtener info del orden de importación actual
  const currentImportInfo = IMPORT_ORDER.find((o) => o.key === entity);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
      {/* Header principal */}
      <div className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl">
                <Icon icon="solar:upload-bold-duotone" className="w-8 h-8 text-primary" />
              </div>
              Importación Masiva
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Carga tus datos de forma rápida y segura siguiendo el orden recomendado
            </p>
          </div>
          <div className="flex gap-2">
            <a href="/apps/admin/importacion-multiple">
              <Button color="primary" size="sm">
                <Icon icon="solar:layers-minimalistic-bold-duotone" className="w-4 h-4 mr-2" />
                Importación Múltiple
              </Button>
            </a>
            <Button color="light" size="sm" onClick={() => setShowHistory(!showHistory)}>
              <Icon icon="solar:history-bold" className="w-4 h-4 mr-2" />
              {showHistory ? 'Ocultar historial' : 'Ver historial'}
            </Button>
            {step > 1 && (
              <Button color="light" size="sm" onClick={resetImport}>
                <Icon icon="solar:restart-bold" className="w-4 h-4 mr-2" />
                Nueva importación
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Guía de orden de importación */}
      <Card className="mb-6 overflow-hidden">
        <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-800 border-b">
          <div className="flex items-center gap-2 mb-2">
            <Icon icon="solar:info-circle-bold" className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Orden recomendado de importación</h3>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Para evitar errores de dependencias, importa tus datos en este orden
          </p>
        </div>
        <div className="p-4">
          <div className="flex flex-wrap items-center justify-center gap-2 md:gap-4">
            {IMPORT_ORDER.map((item, idx) => (
              <React.Fragment key={item.key}>
                <button
                  onClick={() => {
                    if (meta[item.key]) {
                      setEntity(item.key);
                      if (step === 1) setStep(1);
                    }
                  }}
                  disabled={!meta[item.key]}
                  className={`
                    relative flex flex-col items-center p-3 md:p-4 rounded-xl transition-all duration-200 min-w-[100px]
                    ${entity === item.key 
                      ? 'bg-primary text-white shadow-lg scale-105 ring-2 ring-primary ring-offset-2' 
                      : meta[item.key] 
                        ? 'bg-white dark:bg-gray-800 hover:shadow-md hover:scale-102 border border-gray-200 dark:border-gray-700 cursor-pointer' 
                        : 'bg-gray-100 dark:bg-gray-800 opacity-50 cursor-not-allowed'}
                  `}
                >
                  <div className={`
                    absolute -top-2 -left-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                    ${entity === item.key ? 'bg-white text-primary' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'}
                  `}>
                    {item.step}
                  </div>
                  <div className={`p-2 rounded-lg mb-2 ${entity === item.key ? 'bg-white/20' : item.color + '/10'}`}>
                    <Icon 
                      icon={item.icon} 
                      className={`w-6 h-6 ${entity === item.key ? 'text-white' : item.color.replace('bg-', 'text-')}`} 
                    />
                  </div>
                  <span className={`text-sm font-medium ${entity === item.key ? 'text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                    {item.label}
                  </span>
                </button>
                {idx < IMPORT_ORDER.length - 1 && (
                  <Icon 
                    icon="solar:arrow-right-linear" 
                    className="w-5 h-5 text-gray-300 dark:text-gray-600 hidden md:block" 
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </Card>

      {/* Indicador de progreso de pasos */}
      <Card className="mb-6">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Progreso de importación
            </span>
            <Badge color={step === 4 && result ? 'success' : 'info'}>
              Paso {step} de 4
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map((s) => (
              <React.Fragment key={s}>
                <div 
                  className={`
                    flex items-center justify-center w-10 h-10 rounded-full font-semibold transition-all
                    ${step >= s 
                      ? step === s 
                        ? 'bg-primary text-white ring-4 ring-primary/20' 
                        : 'bg-green-500 text-white' 
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}
                  `}
                >
                  {step > s ? (
                    <Icon icon="solar:check-circle-bold" className="w-5 h-5" />
                  ) : (
                    s
                  )}
                </div>
                {s < 4 && (
                  <div className={`flex-1 h-1 rounded ${step > s ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>Seleccionar</span>
            <span>Subir archivo</span>
            <span>Mapear campos</span>
            <span>Importar</span>
          </div>
        </div>
      </Card>

      {/* Contenido principal según el paso */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel principal */}
        <div className="lg:col-span-2">
          {/* Paso 1: Selección de entidad */}
          {step === 1 && (
            <Card>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Icon icon="solar:widget-add-bold-duotone" className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Paso 1: Selecciona qué quieres importar
                    </h2>
                    <p className="text-sm text-gray-500">Elige el tipo de datos que vas a cargar</p>
                  </div>
                </div>

                {!entity ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {IMPORT_ORDER.filter((o) => meta[o.key]).map((item) => (
                      <button
                        key={item.key}
                        onClick={() => setEntity(item.key)}
                        className="flex items-start gap-4 p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-primary hover:bg-primary/5 transition-all text-left"
                      >
                        <div className={`p-3 rounded-xl ${item.color}/10`}>
                          <Icon icon={item.icon} className={`w-6 h-6 ${item.color.replace('bg-', 'text-')}`} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white">{item.label}</h3>
                          <p className="text-sm text-gray-500">{item.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className={`flex items-center gap-4 p-4 rounded-xl ${currentImportInfo?.color}/10 border-2 border-primary`}>
                      <div className={`p-3 rounded-xl ${currentImportInfo?.color}`}>
                        <Icon icon={currentImportInfo?.icon || ''} className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {currentImportInfo?.label || meta[entity]?.display_name}
                        </h3>
                        <p className="text-sm text-gray-500">{currentImportInfo?.description}</p>
                      </div>
                      <Button color="light" size="sm" onClick={() => setEntity('')}>
                        Cambiar
                      </Button>
                    </div>

                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        <Icon icon="solar:key-bold" className="w-4 h-4 inline mr-1" />
                        Clave para actualizar registros existentes (opcional)
                      </label>
                      <Select value={upsertKey} onChange={(e) => setUpsertKey(e.target.value)}>
                        <option value="">Solo insertar nuevos registros</option>
                        {uniqueKeys.map((k) => (
                          <option key={k} value={k}>
                            Actualizar por: {k}
                          </option>
                        ))}
                      </Select>
                      <p className="text-xs text-gray-500 mt-2">
                        Si seleccionas una clave, los registros existentes con el mismo valor serán actualizados
                      </p>
                    </div>

                    <div className="flex justify-end">
                      <Button onClick={() => setStep(2)} disabled={!entity} size="lg">
                        Continuar
                        <Icon icon="solar:arrow-right-linear" className="w-5 h-5 ml-2" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Paso 2: Subida de archivo */}
          {step === 2 && (
            <Card>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <Icon icon="solar:file-send-bold-duotone" className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Paso 2: Sube tu archivo
                    </h2>
                    <p className="text-sm text-gray-500">Formatos aceptados: CSV, XLSX</p>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Zona de drop */}
                  <label 
                    htmlFor="file-upload"
                    className={`
                      relative block border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer
                      ${file 
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20' 
                        : 'border-gray-300 dark:border-gray-600 hover:border-primary hover:bg-primary/5'}
                    `}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const droppedFile = e.dataTransfer.files?.[0];
                      if (droppedFile) {
                        handleFile(droppedFile);
                      }
                    }}
                  >
                    {file ? (
                      <div className="flex items-center justify-center gap-4">
                        <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                          <Icon icon="solar:file-check-bold-duotone" className="w-8 h-8 text-green-600" />
                        </div>
                        <div className="text-left">
                          <p className="font-semibold text-gray-900 dark:text-white">{file.name}</p>
                          <p className="text-sm text-gray-500">
                            {(file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <Button 
                          color="light" 
                          size="sm" 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setFile(null);
                          }}
                        >
                          <Icon icon="solar:trash-bin-trash-bold" className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Icon icon="solar:cloud-upload-bold-duotone" className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                        <p className="text-gray-600 dark:text-gray-400 mb-2">
                          Arrastra tu archivo aquí o haz clic para seleccionar
                        </p>
                        <p className="text-xs text-gray-400">
                          Formatos: CSV, XLSX
                        </p>
                      </>
                    )}
                    <input
                      id="file-upload"
                      type="file"
                      accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      onChange={(e) => {
                        const selectedFile = e.target.files?.[0];
                        if (selectedFile) {
                          handleFile(selectedFile);
                        }
                      }}
                      className="sr-only"
                    />
                  </label>

                  {/* Descargar plantillas */}
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                    <div className="flex items-center gap-2 mb-3">
                      <Icon icon="solar:download-bold" className="w-5 h-5 text-blue-600" />
                      <span className="font-medium text-gray-900 dark:text-white">
                        ¿No tienes un archivo? Descarga una plantilla
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        color="light"
                        onClick={() => downloadCsvTemplate(entity)}
                      >
                        <Icon icon="solar:document-text-bold" className="w-4 h-4 mr-2" />
                        Plantilla CSV
                      </Button>
                      <a
                        href={`${import.meta.env.VITE_API_URL || 'http://localhost:8081/api'}/saas/imports/template?entity=${entity}&format=xlsx`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Button size="sm" color="light">
                          <Icon icon="solar:document-bold" className="w-4 h-4 mr-2" />
                          Plantilla XLSX
                        </Button>
                      </a>
                    </div>
                  </div>

                  {/* Campos esperados */}
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Campos esperados para {meta[entity]?.display_name}:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {fields.map((f) => (
                        <Badge key={f} color="gray" className="text-xs">
                          {f}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Mostrar errores si los hay */}
                  {errors.length > 0 && (
                    <Alert color="failure" className="mt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon icon="solar:danger-triangle-bold" className="w-5 h-5" />
                        <span className="font-semibold">Error al procesar el archivo</span>
                      </div>
                      <ul className="list-disc list-inside text-sm">
                        {errors.slice(0, 5).map((e, i) => (
                          <li key={i}>{e.error || JSON.stringify(e)}</li>
                        ))}
                      </ul>
                    </Alert>
                  )}

                  <div className="flex justify-between">
                    <Button color="gray" onClick={() => setStep(1)}>
                      <Icon icon="solar:arrow-left-linear" className="w-5 h-5 mr-2" />
                      Atrás
                    </Button>
                    <Button
                      onClick={async () => {
                        const success = await fetchHeaders();
                        if (success) {
                          setStep(3);
                        }
                      }}
                      disabled={!file || loading}
                      size="lg"
                    >
                      {loading ? (
                        <>
                          <Icon icon="solar:refresh-bold" className="w-5 h-5 mr-2 animate-spin" />
                          Procesando archivo...
                        </>
                      ) : (
                        <>
                          Continuar
                          <Icon icon="solar:arrow-right-linear" className="w-5 h-5 ml-2" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Paso 3: Mapeo de columnas */}
          {step === 3 && (
            <Card>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                      <Icon icon="solar:link-bold-duotone" className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Paso 3: Mapea las columnas
                      </h2>
                      <p className="text-sm text-gray-500">
                        Relaciona las columnas de tu archivo con los campos del sistema
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setMapping(suggestMapping({ fields, headers, ent: entity }))}
                  >
                    <Icon icon="solar:magic-stick-2-bold" className="w-4 h-4 mr-2" />
                    Auto-mapear
                  </Button>
                </div>

                {/* Progreso de mapeo */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Campos mapeados
                    </span>
                    <span className="text-sm font-medium">
                      {Object.keys(mapping).filter((k) => mapping[k]).length} / {fields.length}
                    </span>
                  </div>
                  <Progress
                    progress={(Object.keys(mapping).filter((k) => mapping[k]).length / fields.length) * 100}
                    color="blue"
                    size="lg"
                  />
                </div>

                {/* Grid de mapeo */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {fields.map((f) => {
                    const requiredFields = getRequiredFields();
                    const isRequired = requiredFields.some(req => normalize(req) === normalize(f));
                    const isMapped = !!mapping[f];
                    return (
                      <div 
                        key={f} 
                        className={`p-4 rounded-xl border-2 transition-all ${
                          isMapped 
                            ? 'border-green-500 bg-green-50 dark:bg-green-900/20' 
                            : isRequired 
                              ? 'border-red-300 bg-red-50 dark:bg-red-900/20' 
                              : 'border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            {f}
                            {isRequired && (
                              <Badge color="failure" size="xs">Requerido</Badge>
                            )}
                          </label>
                          {isMapped && (
                            <Icon icon="solar:check-circle-bold" className="w-5 h-5 text-green-500" />
                          )}
                        </div>
                        <Select
                          value={mapping[f] || ''}
                          onChange={(e) => setMapping((prev) => ({ ...prev, [f]: e.target.value }))}
                          className={isMapped ? 'border-green-500' : ''}
                        >
                          <option value="">-- Seleccionar columna --</option>
                          {headers.map((h) => (
                            <option key={`${f}-${h}`} value={h}>
                              {h}
                            </option>
                          ))}
                        </Select>
                      </div>
                    );
                  })}
                </div>

                {/* Límite de registros para pruebas */}
                <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border-2 border-amber-200 dark:border-amber-800">
                  <div className="flex items-start gap-4">
                    <Icon icon="solar:test-tube-bold-duotone" className="w-6 h-6 text-amber-600 mt-0.5" />
                    <div className="flex-1">
                      <label htmlFor="import-limit" className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        Límite de registros (para pruebas)
                      </label>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 mb-3">
                        Deja vacío para importar todos los registros, o ingresa un número para importar solo esa cantidad.
                      </p>
                      <div className="flex items-center gap-3">
                        <select
                          id="import-limit"
                          value={importLimit}
                          onChange={(e) => setImportLimit(e.target.value)}
                          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                        >
                          <option value="">Todos los registros</option>
                          <option value="5">Solo 5 (prueba rápida)</option>
                          <option value="10">Solo 10</option>
                          <option value="25">Solo 25</option>
                          <option value="50">Solo 50</option>
                          <option value="100">Solo 100</option>
                          <option value="500">Solo 500</option>
                        </select>
                        {importLimit && (
                          <Badge color="warning" size="sm">
                            <Icon icon="solar:filter-bold" className="w-3 h-3 mr-1" />
                            Modo prueba: {importLimit} registros
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Opción de auto-crear entidades relacionadas */}
                {hasAutoCreateRelations && (
                  <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border-2 border-blue-200 dark:border-blue-800">
                    <div className="flex items-start gap-4">
                      <div className="flex items-center h-6">
                        <input
                          id="auto-create"
                          type="checkbox"
                          checked={autoCreate}
                          onChange={(e) => setAutoCreate(e.target.checked)}
                          className="w-5 h-5 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                        />
                      </div>
                      <div className="flex-1">
                        <label htmlFor="auto-create" className="text-sm font-semibold text-gray-900 dark:text-white cursor-pointer flex items-center gap-2">
                          <Icon icon="solar:magic-stick-3-bold-duotone" className="w-5 h-5 text-blue-600" />
                          Crear automáticamente entidades que no existan
                        </label>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          Si una aseguradora, ramo, cliente o vendedor no existe, se creará automáticamente con los datos del archivo.
                        </p>
                        {autoCreate && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {Object.entries(meta[entity]?.auto_create_relations || {}).map(([field, config]) => (
                              <Badge key={field} color="info" size="sm">
                                <Icon icon="solar:add-circle-bold" className="w-3 h-3 mr-1" />
                                {(config as any).display_name}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Mostrar errores de validación */}
                {errors.length > 0 && (
                  <Alert color="failure" className="mb-6">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon icon="solar:danger-triangle-bold" className="w-5 h-5" />
                      <span className="font-semibold">No se puede previsualizar</span>
                    </div>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {errors.map((e, i) => (
                        <li key={i}>{e.error || JSON.stringify(e)}</li>
                      ))}
                    </ul>
                  </Alert>
                )}

                {/* Resumen de mapeo */}
                <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Resumen del mapeo</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Campos mapeados:</span>
                      <span className="ml-2 font-semibold text-green-600">
                        {Object.keys(mapping).filter((k) => mapping[k]).length}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Campos requeridos:</span>
                      <span className="ml-2 font-semibold">
                        {getRequiredFields().length > 0 ? getRequiredFields().join(', ') : 'Ninguno'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between">
                  <Button color="gray" onClick={() => setStep(2)}>
                    <Icon icon="solar:arrow-left-linear" className="w-5 h-5 mr-2" />
                    Atrás
                  </Button>
                  <Button
                    onClick={runDry}
                    disabled={!file || Object.keys(mapping).filter((k) => mapping[k]).length === 0 || loading}
                    size="lg"
                  >
                    {loading ? (
                      <>
                        <Icon icon="solar:refresh-bold" className="w-5 h-5 mr-2 animate-spin" />
                        Validando...
                      </>
                    ) : (
                      <>
                        Previsualizar
                        <Icon icon="solar:eye-bold" className="w-5 h-5 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Paso 4: Previsualización y ejecución */}
          {step === 4 && (
            <Card>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <Icon icon="solar:check-read-bold-duotone" className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Paso 4: Revisa y confirma
                    </h2>
                    <p className="text-sm text-gray-500">
                      Verifica los datos antes de importar
                    </p>
                  </div>
                </div>

                {/* Alerta de modo prueba */}
                {importLimit && rowsToImport < totalRows && (
                  <Alert color="warning" className="mb-6">
                    <div className="flex items-center gap-2">
                      <Icon icon="solar:test-tube-bold" className="w-5 h-5" />
                      <span className="font-semibold">Modo prueba activo</span>
                    </div>
                    <p className="text-sm mt-1">
                      Se importarán solo <strong>{rowsToImport}</strong> de {totalRows} registros totales.
                    </p>
                  </Alert>
                )}

                {/* Resumen */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-center">
                    <Icon icon="solar:documents-bold-duotone" className="w-8 h-8 mx-auto text-blue-600 mb-2" />
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalRows}</p>
                    <p className="text-sm text-gray-500">Filas totales</p>
                  </div>
                  <div className={`p-4 rounded-xl text-center ${rowsToImport < totalRows ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>
                    <Icon icon="solar:upload-bold-duotone" className={`w-8 h-8 mx-auto mb-2 ${rowsToImport < totalRows ? 'text-amber-600' : 'text-green-600'}`} />
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{rowsToImport}</p>
                    <p className="text-sm text-gray-500">A importar</p>
                  </div>
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl text-center">
                    <Icon icon="solar:link-bold-duotone" className="w-8 h-8 mx-auto text-green-600 mb-2" />
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {Object.keys(mapping).filter((k) => mapping[k]).length}
                    </p>
                    <p className="text-sm text-gray-500">Campos mapeados</p>
                  </div>
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl text-center">
                    <Icon icon="solar:danger-triangle-bold-duotone" className="w-8 h-8 mx-auto text-red-600 mb-2" />
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{errors.length}</p>
                    <p className="text-sm text-gray-500">Advertencias</p>
                  </div>
                  <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl text-center">
                    <Icon icon={currentImportInfo?.icon || 'solar:database-bold-duotone'} className="w-8 h-8 mx-auto text-purple-600 mb-2" />
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{meta[entity]?.display_name}</p>
                    <p className="text-sm text-gray-500">Entidad</p>
                  </div>
                </div>

                {/* Errores/Advertencias detallados */}
                {errors.length > 0 && (
                  <div className="mb-6">
                    <Alert color={result ? 'failure' : 'warning'} className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon icon="solar:danger-triangle-bold" className="w-5 h-5" />
                        <span className="font-semibold">
                          {result ? `${errors.length} errores durante la importación` : `${errors.length} advertencias encontradas`}
                        </span>
                      </div>
                      <p className="text-sm opacity-80">
                        {result 
                          ? 'Los siguientes registros no pudieron ser importados:'
                          : 'Revisa estos problemas antes de importar:'}
                      </p>
                    </Alert>
                    
                    {/* Tabla de errores detallados */}
                    <div className="overflow-auto max-h-[300px] rounded-xl border border-red-200 dark:border-red-900">
                      <Table>
                        <Table.Head className="sticky top-0 z-10 bg-red-50 dark:bg-red-900/30">
                          <Table.HeadCell className="w-16">Fila</Table.HeadCell>
                          <Table.HeadCell className="w-32">Campo</Table.HeadCell>
                          <Table.HeadCell className="w-40">Valor</Table.HeadCell>
                          <Table.HeadCell>Error</Table.HeadCell>
                        </Table.Head>
                        <Table.Body className="divide-y">
                          {errors.slice(0, 20).map((er, idx) => (
                            <Table.Row key={idx} className="bg-white dark:bg-gray-900">
                              <Table.Cell className="font-medium text-red-600">
                                {er.row || '-'}
                              </Table.Cell>
                              <Table.Cell className="text-amber-600 font-mono text-xs">
                                {er.field || '-'}
                              </Table.Cell>
                              <Table.Cell className="text-gray-500 text-xs truncate max-w-[150px]" title={er.value || er.data?.[er.field]}>
                                {er.value || er.data?.[er.field] || '-'}
                              </Table.Cell>
                              <Table.Cell className="text-sm text-red-700 dark:text-red-400">
                                {er.error || JSON.stringify(er)}
                              </Table.Cell>
                            </Table.Row>
                          ))}
                        </Table.Body>
                      </Table>
                    </div>
                    {errors.length > 20 && (
                      <p className="text-sm text-gray-500 mt-2 text-center">
                        Mostrando 20 de {errors.length} errores
                      </p>
                    )}
                  </div>
                )}

                {/* Resultado de importación */}
                {result && (
                  <Alert color={result.failed > 0 ? 'warning' : 'success'} className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Icon icon={result.failed > 0 ? 'solar:shield-warning-bold' : 'solar:check-circle-bold'} className="w-6 h-6" />
                      <span className="font-semibold text-lg">
                        {result.failed > 0 ? 'Importación completada con errores' : '¡Importación completada exitosamente!'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-4">
                      <div className="flex items-center gap-2 bg-green-100 dark:bg-green-900/30 px-3 py-2 rounded-lg">
                        <Icon icon="solar:add-circle-bold" className="w-5 h-5 text-green-600" />
                        <span className="text-2xl font-bold text-green-700 dark:text-green-400">{result.inserted}</span>
                        <span className="text-green-600">insertados</span>
                      </div>
                      <div className="flex items-center gap-2 bg-blue-100 dark:bg-blue-900/30 px-3 py-2 rounded-lg">
                        <Icon icon="solar:refresh-circle-bold" className="w-5 h-5 text-blue-600" />
                        <span className="text-2xl font-bold text-blue-700 dark:text-blue-400">{result.updated}</span>
                        <span className="text-blue-600">actualizados</span>
                      </div>
                      {result.failed > 0 && (
                        <div className="flex items-center gap-2 bg-red-100 dark:bg-red-900/30 px-3 py-2 rounded-lg">
                          <Icon icon="solar:close-circle-bold" className="w-5 h-5 text-red-600" />
                          <span className="text-2xl font-bold text-red-700 dark:text-red-400">{result.failed}</span>
                          <span className="text-red-600">fallidos</span>
                        </div>
                      )}
                    </div>
                  </Alert>
                )}

                {/* Entidades auto-creadas */}
                {result?.auto_created && Object.keys(result.auto_created).length > 0 && (
                  <div className="mb-6 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
                    <div className="flex items-center gap-2 mb-3">
                      <Icon icon="solar:magic-stick-3-bold-duotone" className="w-5 h-5 text-purple-600" />
                      <span className="font-semibold text-purple-800 dark:text-purple-300">
                        Entidades creadas automáticamente
                      </span>
                    </div>
                    <div className="space-y-3">
                      {Object.entries(result.auto_created).map(([entityType, items]) => (
                        <div key={entityType}>
                          <span className="text-sm font-medium text-purple-700 dark:text-purple-400">
                            {entityType}:
                          </span>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {(items as string[]).slice(0, 10).map((item, idx) => (
                              <Badge key={idx} color="purple" size="sm">
                                {item}
                              </Badge>
                            ))}
                            {(items as string[]).length > 10 && (
                              <Badge color="gray" size="sm">
                                +{(items as string[]).length - 10} más
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tabla de previsualización */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      Previsualización (primeras 20 filas)
                    </h3>
                  </div>
                  <div className="overflow-auto max-h-[400px] rounded-xl border border-gray-200 dark:border-gray-700">
                    <Table>
                      <Table.Head className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800">
                        {fields.filter((f) => mapping[f]).map((f) => (
                          <Table.HeadCell key={f} className="whitespace-nowrap">
                            {f}
                          </Table.HeadCell>
                        ))}
                      </Table.Head>
                      <Table.Body className="divide-y">
                        {preview.map((row, i) => (
                          <Table.Row key={i} className="bg-white dark:bg-gray-900">
                            {fields.filter((f) => mapping[f]).map((f) => (
                              <Table.Cell key={`${i}-${f}`} className="whitespace-nowrap">
                                {row[f] || <span className="text-gray-400">-</span>}
                              </Table.Cell>
                            ))}
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table>
                  </div>
                </div>

                <div className="flex justify-between">
                  <Button color="gray" onClick={() => setStep(3)}>
                    <Icon icon="solar:arrow-left-linear" className="w-5 h-5 mr-2" />
                    Atrás
                  </Button>
                  {!result ? (
                    <Button
                      color="success"
                      onClick={runExecute}
                      disabled={loading}
                      size="lg"
                    >
                      {loading ? (
                        <>
                          <Icon icon="solar:refresh-bold" className="w-5 h-5 mr-2 animate-spin" />
                          Importando...
                        </>
                      ) : (
                        <>
                          <Icon icon="solar:upload-bold" className="w-5 h-5 mr-2" />
                          Importar {rowsToImport} registros{rowsToImport < totalRows ? ` (de ${totalRows})` : ''}
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button color="primary" onClick={resetImport} size="lg">
                      <Icon icon="solar:add-circle-bold" className="w-5 h-5 mr-2" />
                      Nueva importación
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Panel lateral de ayuda */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Icon icon="solar:question-circle-bold" className="w-5 h-5 text-primary" />
                Ayuda rápida
              </h3>
            </div>
            <div className="p-4 space-y-4">
              {step === 1 && (
                <>
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <h4 className="font-medium text-sm text-gray-900 dark:text-white mb-1">
                      ¿Por qué importar en orden?
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Las pólizas necesitan clientes, aseguradoras y ramos existentes. 
                      Importa primero los datos base para evitar errores.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Orden sugerido:</p>
                    {IMPORT_ORDER.map((item, idx) => (
                      <div key={item.key} className="flex items-center gap-2 text-sm">
                        <span className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-bold">
                          {idx + 1}
                        </span>
                        <span className="text-gray-600 dark:text-gray-400">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {step === 2 && (
                <>
                  <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <h4 className="font-medium text-sm text-gray-900 dark:text-white mb-1">
                      Formatos aceptados
                    </h4>
                    <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                      <li>• CSV (separado por comas o punto y coma)</li>
                      <li>• XLSX (Excel)</li>
                    </ul>
                  </div>
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                    <h4 className="font-medium text-sm text-gray-900 dark:text-white mb-1">
                      Consejos
                    </h4>
                    <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                      <li>• La primera fila debe contener los nombres de columnas</li>
                      <li>• Usa la plantilla para asegurar el formato correcto</li>
                      <li>• Máximo recomendado: 5,000 filas por archivo</li>
                    </ul>
                  </div>
                </>
              )}
              {step === 3 && (
                <>
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                    <h4 className="font-medium text-sm text-gray-900 dark:text-white mb-1">
                      Mapeo automático
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Usa el botón "Auto-mapear" para que el sistema intente relacionar 
                      automáticamente las columnas de tu archivo.
                    </p>
                  </div>
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <h4 className="font-medium text-sm text-gray-900 dark:text-white mb-1">
                      Campos requeridos
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                      Asegúrate de mapear todos los campos marcados como "Requerido":
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {getRequiredFields().map((r: string) => (
                        <Badge key={r} color="failure" size="xs">{r}</Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {step === 4 && (
                <>
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <h4 className="font-medium text-sm text-gray-900 dark:text-white mb-1">
                      Antes de importar
                    </h4>
                    <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                      <li>• Revisa la previsualización de datos</li>
                      <li>• Verifica que no haya advertencias críticas</li>
                      <li>• Los datos se guardarán permanentemente</li>
                    </ul>
                  </div>
                  {upsertKey && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <h4 className="font-medium text-sm text-gray-900 dark:text-white mb-1">
                        Modo actualización activo
                      </h4>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Los registros existentes con el mismo <strong>{upsertKey}</strong> serán actualizados.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Historial de importaciones */}
      {showHistory && (
        <Card className="mt-6">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Icon icon="solar:history-bold" className="w-5 h-5 text-primary" />
              Historial de importaciones
            </h3>
            <Button
              color="light"
              size="sm"
              onClick={() => loadJobs()}
            >
              <Icon icon="solar:refresh-bold" className="w-4 h-4 mr-2" />
              Actualizar
            </Button>
          </div>
          <div className="p-4">
            {jobs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Icon icon="solar:inbox-bold-duotone" className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Aún no hay importaciones registradas</p>
              </div>
            ) : (
              <div className="overflow-auto">
                <Table>
                  <Table.Head>
                    <Table.HeadCell>ID</Table.HeadCell>
                    <Table.HeadCell>Entidad</Table.HeadCell>
                    <Table.HeadCell>Archivo</Table.HeadCell>
                    <Table.HeadCell>Estado</Table.HeadCell>
                    <Table.HeadCell>Resultados</Table.HeadCell>
                    <Table.HeadCell>Fecha</Table.HeadCell>
                  </Table.Head>
                  <Table.Body className="divide-y">
                    {jobs.map((j) => (
                      <Table.Row key={j.id} className="bg-white dark:bg-gray-900">
                        <Table.Cell className="font-medium">#{j.id}</Table.Cell>
                        <Table.Cell>
                          <Badge color="gray">{j.entity?.replace('_', ' ')}</Badge>
                        </Table.Cell>
                        <Table.Cell className="max-w-[150px] truncate" title={j.filename}>
                          {j.filename || '-'}
                        </Table.Cell>
                        <Table.Cell>
                          <Badge
                            color={
                              j.status === 'completed' ? 'success' :
                              j.status === 'failed' ? 'failure' :
                              j.status === 'running' ? 'warning' : 'gray'
                            }
                          >
                            {j.status === 'completed' ? 'Completado' :
                             j.status === 'failed' ? 'Fallido' :
                             j.status === 'running' ? 'En proceso' : j.status}
                          </Badge>
                        </Table.Cell>
                        <Table.Cell>
                          <div className="flex gap-2 text-xs">
                            <span className="text-green-600">+{j.inserted || 0}</span>
                            <span className="text-blue-600">~{j.updated || 0}</span>
                            {j.failed > 0 && <span className="text-red-600">x{j.failed}</span>}
                          </div>
                        </Table.Cell>
                        <Table.Cell className="text-sm text-gray-500">
                          {j.finished_at ? new Date(j.finished_at).toLocaleString() : '-'}
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};

export default ImportacionMasiva;
