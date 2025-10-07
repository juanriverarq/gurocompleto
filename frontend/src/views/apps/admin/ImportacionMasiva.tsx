import React, { useEffect, useMemo, useState } from 'react';
import { Card, Button, Select, FileInput, Badge, Table, Alert } from 'flowbite-react';
import { Icon } from '@iconify/react';
import {
  getMeta,
  dryRunImport,
  executeImport,
  ImportMetaResponse,
  getJobs,
} from 'src/services/importService';

type Step = 1 | 2 | 3 | 4;

const ImportacionMasiva: React.FC = () => {
  const [step, setStep] = useState<Step>(1);
  const [meta, setMeta] = useState<ImportMetaResponse['entities']>({} as any);
  const [entity, setEntity] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [upsertKey, setUpsertKey] = useState<string>('');
  const [preview, setPreview] = useState<any[]>([]);
  const [totalRows, setTotalRows] = useState<number>(0);
  const [errors, setErrors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    inserted: number;
    updated: number;
    failed: number;
  } | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);

  // Plantillas recomendadas por entidad
  const templateColumns: Record<string, string[]> = {
    aseguradora: ['nombre', 'nit', 'email', 'telefono', 'direccion', 'ciudad'],
    ramos: ['codigo', 'nombre'],
    clientes: [
      'tipo_persona',
      'tipo_documento',
      'numero_documento',
      'nombres',
      'apellidos',
      'email',
      'telefono',
      'direccion',
      'ciudad',
      'departamento',
    ],
    polizas: [
      'numero',
      'aseguradora',
      'ramo',
      'tomador',
      'fecha_emision',
      'vigencia_desde',
      'vigencia_hasta',
      'prima',
      'estado',
    ],
    anexos: ['poliza', 'archivo', 'descripcion'],
  };

  const templateSamples: Record<string, string[][]> = {
    aseguradora: [
      [
        'Seguros Ejemplo S.A.',
        '900123456',
        'contacto@segurosejemplo.com',
        '3001234567',
        'Cra 7 # 123-45',
        'Bogotá',
      ],
      [
        'Aseguradora ACME',
        '800987654',
        'soporte@acme.com',
        '6011234567',
        'Av. Siempre Viva 742',
        'Medellín',
      ],
    ],
    ramos: [
      ['AUT', 'Automóviles'],
      ['HOG', 'Hogar'],
    ],
    clientes: [
      [
        'natural',
        'CC',
        '1012345678',
        'María',
        'García',
        'maria.garcia@mail.com',
        '3205557788',
        'Calle 10 # 20-30',
        'Bogotá',
        'Cundinamarca',
      ],
      [
        'juridica',
        'NIT',
        '900123456',
        'Comercial XYZ',
        '',
        'ventas@xyz.com',
        '6017778899',
        'Calle 80 # 50-60',
        'Bogotá',
        'Cundinamarca',
      ],
    ],
    polizas: [
      [
        'POL-2025-0001',
        'Seguros Ejemplo S.A.',
        'Automóviles',
        'María García',
        '2025-01-15',
        '2025-01-15',
        '2026-01-14',
        '1200000',
        'activa',
      ],
      [
        'POL-2025-0002',
        'Aseguradora ACME',
        'Hogar',
        'Comercial XYZ',
        '2025-02-01',
        '2025-02-01',
        '2026-01-31',
        '3500000',
        'activa',
      ],
    ],
    anexos: [
      ['POL-2025-0001', 'https://ejemplo.com/docs/pol-2025-0001.pdf', 'Póliza firmada'],
      ['POL-2025-0001', 'https://ejemplo.com/docs/recibo-pol-2025-0001.pdf', 'Recibo de pago'],
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

    const findHeader = (targetNorm: string, fieldKey: string): string | null => {
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
      const header = findHeader(fNorm, f);
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

  // Validación de campos obligatorios por entidad
  const requiredByEntity: Record<string, string[]> = {
    aseguradora: ['nombre'],
    ramos: ['nombre'],
    clientes: ['numero_documento', 'nombres'],
    polizas: ['numero', 'aseguradora', 'ramo', 'vigencia_desde', 'vigencia_hasta'],
    anexos: ['archivo'],
  };

  const validateRequired = (): { ok: boolean; missing: string[] } => {
    const ent = normalize(entity);
    const required = requiredByEntity[ent] || [];
    if (!required.length) return { ok: true, missing: [] };
    const mappedNorm = fields.filter((f) => mapping[f]).map((f) => normalize(f));
    const missing = required.filter((r) => !mappedNorm.includes(normalize(r)));
    return { ok: missing.length === 0, missing };
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
      const jobsRes = await getJobs(10);
      if (jobsRes?.success) setJobs(jobsRes.data || []);
    })();
  }, []);

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

  const fetchHeaders = async () => {
    // Llamada en modo dry-run sin mapping para traer headers del archivo
    if (!file || !entity) return;
    setLoading(true);
    try {
      // Notar que el backend acepta mapping como objeto vacío para devolver solo headers
      const res = await dryRunImport({
        entity,
        file,
        mapping: {},
        upsert_key: upsertKey || undefined,
      });
      if (res?.success) {
        const hdrs = Array.isArray(res.headers) ? res.headers.filter(Boolean) : [];
        setHeaders(hdrs);
      }
    } catch (e: any) {
      // silencioso; se mostrará al intentar previsualizar
      console.warn('Error obteniendo headers:', e?.message);
    } finally {
      setLoading(false);
    }
  };

  const runDry = async () => {
    if (!file || !entity) return;
    setLoading(true);
    try {
      const req = validateRequired();
      if (!req.ok) {
        setErrors(req.missing.map((m) => ({ error: `Falta mapear campo obligatorio: ${m}` })));
        setLoading(false);
        return;
      }
      const res = await dryRunImport({ entity, file, mapping, upsert_key: upsertKey || undefined });
      if (res?.success) {
        setHeaders(res.headers || []);
        setPreview(res.preview || []);
        setTotalRows(res.total_rows || 0);
        setErrors(res.errors || []);
        setStep(4);
      }
    } catch (e: any) {
      setErrors([{ error: e.message }]);
    } finally {
      setLoading(false);
    }
  };

  const runExecute = async () => {
    if (!file || !entity) return;
    setLoading(true);
    try {
      const req = validateRequired();
      if (!req.ok) {
        setErrors(req.missing.map((m) => ({ error: `Falta mapear campo obligatorio: ${m}` })));
        setLoading(false);
        return;
      }
      const res = await executeImport({
        entity,
        file,
        mapping,
        upsert_key: upsertKey || undefined,
      });
      if (res?.success) {
        setResult(res.summary || null);
      }
    } catch (e: any) {
      setErrors([{ error: e.message }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Importación Masiva</h2>
              <p className="text-gray-600">
                Carga datos de diferentes módulos vía CSV con mapeo de columnas y previsualización.
              </p>
            </div>
            <div className="flex gap-2">
              <Badge color="info">Paso {step} de 4</Badge>
            </div>
          </div>
        </Card>
      </div>

      {/* Paso 1: Selección de entidad */}
      <div className="col-span-12">
        <Card className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Entidad a importar</label>
              <Select value={entity} onChange={(e) => setEntity(e.target.value)}>
                <option value="">Selecciona</option>
                {Object.entries(meta)
                  .sort(([a], [b]) => {
                    const order = ['aseguradora', 'ramos', 'clientes', 'polizas', 'anexos'];
                    const ia = order.indexOf(a);
                    const ib = order.indexOf(b);
                    if (ia === -1 && ib === -1) return a.localeCompare(b);
                    if (ia === -1) return 1;
                    if (ib === -1) return -1;
                    return ia - ib;
                  })
                  .map(([key, val]) => (
                    <option key={key} value={key}>
                      {val.display_name}
                    </option>
                  ))}
              </Select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Accesos rápidos</label>
              <div className="flex flex-wrap gap-2">
                {['aseguradora', 'ramos', 'clientes', 'polizas', 'anexos']
                  .filter((k) => meta[k])
                  .map((k) => (
                    <Button
                      key={k}
                      color={entity === k ? 'primary' : 'light'}
                      size="xs"
                      onClick={() => setEntity(k)}
                    >
                      {meta[k]?.display_name || k}
                    </Button>
                  ))}
              </div>
            </div>
            {entity && (
              <div>
                <label className="block text-sm font-medium mb-1">
                  Clave para actualizar (opcional)
                </label>
                <Select value={upsertKey} onChange={(e) => setUpsertKey(e.target.value)}>
                  <option value="">(sin actualización, solo inserta)</option>
                  {uniqueKeys.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <div className="flex items-end">
              <Button onClick={() => setStep(2)} disabled={!entity}>
                Siguiente
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Paso 2: Subida de archivo */}
      {step >= 2 && (
        <div className="col-span-12">
          <Card className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Archivo CSV</label>
                <FileInput
                  accept=".csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx"
                  onChange={(e: any) => handleFile(e.target.files?.[0])}
                />
                <div className="text-xs text-gray-500 mt-2 space-y-2">
                  <div>
                    ¿Necesitas una plantilla del backend?{' '}
                    <a
                      className="text-primary underline"
                      href={`${
                        import.meta.env.VITE_API_URL || 'http://localhost:8081/api'
                      }/saas/imports/template?entity=${entity || ''}&format=xlsx`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      XLSX
                    </a>{' '}
                    |{' '}
                    <a
                      className="text-primary underline"
                      href={`${
                        import.meta.env.VITE_API_URL || 'http://localhost:8081/api'
                      }/saas/imports/template?entity=${entity || ''}&format=csv`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      CSV
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>O usa plantilla recomendada:</span>
                    <Button
                      size="xs"
                      color="light"
                      onClick={() => downloadCsvTemplate(entity)}
                      disabled={!entity}
                    >
                      Descargar CSV local
                    </Button>
                  </div>
                  {entity && (
                    <div className="text-[11px] text-gray-500">
                      Columnas ideales:{' '}
                      {(templateColumns[normalize(entity)] || []).join(', ') || '-'}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-end gap-2">
                <Button
                  onClick={async () => {
                    await fetchHeaders();
                    setStep(3);
                  }}
                  disabled={!file || !entity}
                >
                  Configurar mapeo
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Paso 3: Mapeo de columnas */}
      {step >= 3 && (
        <div className="col-span-12">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-gray-600">
                Mapeados {Object.keys(mapping).filter((k) => mapping[k]).length} de {fields.length}
              </div>
              <div className="flex gap-2">
                <Button color="light" size="sm" onClick={() => setMapping({})}>
                  Limpiar mapeo
                </Button>
                <Button
                  size="sm"
                  onClick={() => setMapping(suggestMapping({ fields, headers, ent: entity }))}
                >
                  <Icon icon="solar:magic-stick-2-bold" className="w-4 h-4 mr-2" />
                  Auto-mapear
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {fields.map((f) => (
                <div key={f}>
                  <label className="block text-sm font-medium mb-1">{f}</label>
                  <Select
                    value={mapping[f] || ''}
                    onChange={(e) => setMapping((prev) => ({ ...prev, [f]: e.target.value }))}
                  >
                    <option value="">(sin asignar)</option>
                    {headers.map((h) => (
                      <option key={`${f}-${h}`} value={h}>
                        {h}
                      </option>
                    ))}
                  </Select>
                  <div
                    className={`mt-1 text-xs ${mapping[f] ? 'text-green-600' : 'text-amber-600'}`}
                  >
                    {mapping[f] ? 'Mapeado' : 'Sin asignar'}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Button color="gray" onClick={() => setStep(2)}>
                Atrás
              </Button>
              <Button
                onClick={runDry}
                disabled={!file || !entity || Object.keys(mapping).length === 0}
              >
                {loading ? (
                  <>
                    <Icon icon="solar:refresh-bold" className="w-4 h-4 mr-2 animate-spin" />
                    Procesando…
                  </>
                ) : (
                  'Previsualizar'
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Paso 4: Previsualización y ejecución */}
      {step >= 4 && (
        <div className="col-span-12">
          <Card className="p-6">
            {!!errors.length && (
              <Alert color="warning" className="mb-4">
                <div className="font-semibold mb-1">Advertencias</div>
                <ul className="list-disc ml-5 text-sm">
                  {errors.slice(0, 5).map((er, idx) => (
                    <li key={idx}>
                      {er.field ? `${er.field}: ` : ''}
                      {er.error || JSON.stringify(er)}
                    </li>
                  ))}
                  {errors.length > 5 && <li>+{errors.length - 5} más…</li>}
                </ul>
              </Alert>
            )}
            <div className="mb-3 text-sm text-gray-600">
              Se muestran las primeras 20 filas de previsualización. Total filas: {totalRows}.
            </div>
            <div className="overflow-auto max-h-[60vh] rounded-b-[10px]">
              <Table>
                <Table.Head className="sticky top-0 z-10 bg-gray-50 shadow-sm">
                  {fields.map((f) => (
                    <Table.HeadCell key={f}>{f}</Table.HeadCell>
                  ))}
                </Table.Head>
                <Table.Body>
                  {preview.map((row, i) => (
                    <Table.Row key={i}>
                      {fields.map((f) => (
                        <Table.Cell key={`${i}-${f}`}>{row[f]}</Table.Cell>
                      ))}
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Button color="gray" onClick={() => setStep(3)}>
                Atrás
              </Button>
              <Button color="primary" onClick={runExecute} disabled={loading}>
                {loading ? (
                  <>
                    <Icon icon="solar:refresh-bold" className="w-4 h-4 mr-2 animate-spin" />
                    Importando…
                  </>
                ) : (
                  'Importar ahora'
                )}
              </Button>
              {result && (
                <div className="ml-4 text-sm">
                  <Badge color="success" className="mr-1">
                    Insertados: {result.inserted}
                  </Badge>
                  <Badge color="info" className="mr-1">
                    Actualizados: {result.updated}
                  </Badge>
                  <Badge color="failure">Fallidos: {result.failed}</Badge>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Historial reciente */}
      <div className="col-span-12">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">Historial reciente</h3>
            <Button
              color="gray"
              size="sm"
              onClick={async () => {
                const jobsRes = await getJobs(10);
                if (jobsRes?.success) setJobs(jobsRes.data || []);
              }}
            >
              <Icon icon="solar:refresh-bold" className="w-4 h-4 mr-2" />
              Actualizar
            </Button>
          </div>
          {jobs.length === 0 ? (
            <div className="text-sm text-gray-500">Aún no hay importaciones registradas.</div>
          ) : (
            <div className="overflow-auto max-h-[60vh] rounded-b-[10px]">
              <Table>
                <Table.Head className="sticky top-0 z-10 bg-gray-50 shadow-sm">
                  <Table.HeadCell>ID</Table.HeadCell>
                  <Table.HeadCell>Entidad</Table.HeadCell>
                  <Table.HeadCell>Archivo</Table.HeadCell>
                  <Table.HeadCell>Estado</Table.HeadCell>
                  <Table.HeadCell>Insertados</Table.HeadCell>
                  <Table.HeadCell>Actualizados</Table.HeadCell>
                  <Table.HeadCell>Fallidos</Table.HeadCell>
                  <Table.HeadCell>Fecha</Table.HeadCell>
                </Table.Head>
                <Table.Body>
                  {jobs.map((j) => (
                    <Table.Row key={j.id}>
                      <Table.Cell>#{j.id}</Table.Cell>
                      <Table.Cell className="capitalize">{j.entity?.replace('_', ' ')}</Table.Cell>
                      <Table.Cell className="truncate max-w-[200px]" title={j.filename}>
                        {j.filename || '-'}
                      </Table.Cell>
                      <Table.Cell>
                        <Badge
                          color={
                            j.status === 'completed'
                              ? 'success'
                              : j.status === 'failed'
                              ? 'failure'
                              : 'warning'
                          }
                        >
                          {j.status}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell>{j.inserted}</Table.Cell>
                      <Table.Cell>{j.updated}</Table.Cell>
                      <Table.Cell>{j.failed}</Table.Cell>
                      <Table.Cell>
                        {j.finished_at ? new Date(j.finished_at).toLocaleString() : '-'}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ImportacionMasiva;
