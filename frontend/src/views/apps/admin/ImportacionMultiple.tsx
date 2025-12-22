import React, { useEffect, useState, useMemo } from 'react';
import { Card, Button, Select, Badge, Alert, Progress, Checkbox, Label, Spinner } from 'flowbite-react';
import { Icon } from '@iconify/react';
import {
  getMeta,
  executeImport,
  ImportMetaResponse,
} from 'src/services/importService';

type Step = 1 | 2 | 3 | 4;

// Campos de plantilla por entidad (igual que ImportacionMasiva)
const TEMPLATE_COLUMNS: Record<string, string[]> = {
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
    'numero_poliza', 'numero_interno', 'tipo',
    'aseguradora', 'ramo', 'subramo', 'producto', 'descripcion',
    'cliente_documento', 'cliente_nombre', 'cliente_email',
    // Vendedor 1
    'vendedor_email', 'vendedor_nombre',
    // Vendedor 2 (opcional)
    'vendedor_2_email', 'vendedor_2_nombre',
    // Enlace externo
    'enlace_externo',
    'fecha_emision', 'fecha_inicio', 'fecha_fin', 'fecha_vencimiento_pago', 'fecha_renovacion', 'fecha_recepcion',
    'prima_neta', 'valor_asegurado', 'deducible', 'total',
    'porcentaje_comision', 'monto_comision', 'porcentaje_iva', 'monto_iva',
    'gastos_adicionales', 'gastos_adicionales_aplica_iva',
    'frecuencia_pago', 'medio_pago', 'banco', 'pago_semestral', 'numero_cuotas',
    'ultimos_4_tarjeta', 'numero_cheque', 'plazo_convenio', 'numero_cuenta_debito',
    'estado', 'estado_pago', 'notas_estado', 'motivo',
    'beneficiario_nombre', 'beneficiario_documento', 'beneficiario_parentesco', 'beneficiario_telefono',
    'tomador_nombre', 'tomador_documento',
    'asegurado_nombre', 'asegurado_documento',
    'placa_vehiculo',
    'es_renovable', 'dias_aviso_renovacion',
    'pri_a_pre', 'participacion', 'co_corretaje', 'comision_agencia',
    'porcentaje_retencion', 'porcentaje_reteiva', 'beneficiario_en_giro',
    'notas'
  ],
};

// Sinónimos para auto-mapeo
const FIELD_SYNONYMS: Record<string, string[]> = {
  nombre: ['name', 'razon_social', 'compania', 'aseguradora', 'cliente', 'full_name'],
  nit: ['cuit', 'rut', 'documento', 'identificacion', 'tax_id'],
  email: ['correo', 'correo_electronico', 'mail', 'e_mail'],
  telefono: ['phone', 'tel', 'fono'],
  celular: ['movil', 'mobile', 'whatsapp', 'cell'],
  direccion: ['address', 'domicilio', 'dir'],
  documento: ['cedula', 'cc', 'identificacion', 'dni', 'numero_documento', 'doc'],
  apellidos: ['apellido', 'last_name', 'surname'],
  nombres: ['nombre', 'first_name', 'name'],
  numero_poliza: ['poliza', 'policy', 'policy_number', 'num_poliza'],
  prima_neta: ['prima', 'premium', 'valor_prima'],
  fecha_emision: ['emision', 'issue_date', 'fecha_de_emision'],
  fecha_inicio: ['inicio', 'start_date', 'vigencia_desde'],
  fecha_fin: ['fin', 'end_date', 'vigencia_hasta', 'vencimiento'],
  aseguradora: ['compania', 'insurer', 'company'],
  ramo: ['tipo_seguro', 'linea', 'branch'],
  cliente_documento: ['documento_cliente', 'cedula_cliente', 'cliente_cedula'],
  vendedor_email: ['email_vendedor', 'correo_vendedor', 'asesor_email', 'vendedor_1_email', 'asesor_1_email'],
  vendedor_nombre: ['nombre_vendedor', 'asesor_nombre', 'vendedor_1_nombre', 'asesor_1_nombre'],
  vendedor_2_email: ['email_vendedor_2', 'correo_vendedor_2', 'asesor_2_email', 'segundo_vendedor_email'],
  vendedor_2_nombre: ['nombre_vendedor_2', 'asesor_2_nombre', 'segundo_vendedor_nombre'],
  enlace_externo: ['link_externo', 'url_externa', 'external_link', 'link', 'url'],
};

// Definición de entidades disponibles para importación múltiple
const ENTITIES_CONFIG = [
  {
    key: 'clientes',
    label: 'Clientes',
    icon: 'solar:user-id-bold-duotone',
    color: 'bg-amber-500',
    description: 'Tomadores y asegurados',
    identifierFields: ['documento', 'email', 'celular'],
  },
  {
    key: 'vendedores',
    label: 'Vendedores',
    icon: 'solar:users-group-rounded-bold-duotone',
    color: 'bg-green-500',
    description: 'Equipo de ventas',
    identifierFields: ['email', 'numero_documento'],
  },
  {
    key: 'aseguradoras',
    label: 'Aseguradoras',
    icon: 'solar:buildings-2-bold-duotone',
    color: 'bg-blue-500',
    description: 'Compañías de seguros',
    identifierFields: ['nombre', 'nit'],
  },
  {
    key: 'ramos',
    label: 'Ramos',
    icon: 'solar:layers-bold-duotone',
    color: 'bg-purple-500',
    description: 'Tipos de seguros',
    identifierFields: ['nombre'],
  },
  {
    key: 'polizas',
    label: 'Pólizas',
    icon: 'solar:document-text-bold-duotone',
    color: 'bg-red-500',
    description: 'Contratos de seguros',
    identifierFields: ['numero_poliza'],
    relations: [
      { targetEntity: 'clientes', label: 'Cliente', fieldInPoliza: 'cliente_documento' },
      { targetEntity: 'vendedores', label: 'Vendedor 1', fieldInPoliza: 'vendedor_email' },
      { targetEntity: 'vendedores', label: 'Vendedor 2 (Opcional)', fieldInPoliza: 'vendedor_2_email', optional: true },
      { targetEntity: 'aseguradoras', label: 'Aseguradora', fieldInPoliza: 'aseguradora' },
      { targetEntity: 'ramos', label: 'Ramo', fieldInPoliza: 'ramo' },
    ],
  },
];

interface EntityFileConfig {
  enabled: boolean;
  file: File | null;
  headers: string[];
  identifierColumn: string; // Columna del CSV que es el identificador
  mapping: Record<string, string>;
  upsertKey: string;
  // Para pólizas: mapeo de relaciones
  relationMappings?: Record<string, { 
    targetEntityKey: string;
    columnInThisFile: string; // Columna en el CSV de pólizas
    columnInTargetFile: string; // Columna en el CSV de la entidad relacionada
  }>;
}

interface ImportResult {
  entity: string;
  inserted: number;
  updated: number;
  failed: number;
  errors: any[];
}

const ImportacionMultiple: React.FC = () => {
  const [step, setStep] = useState<Step>(1);
  const [meta, setMeta] = useState<ImportMetaResponse['entities']>({} as any);
  const [loading, setLoading] = useState(false);
  
  // Configuración de cada entidad
  const [entityConfigs, setEntityConfigs] = useState<Record<string, EntityFileConfig>>({});
  
  // Límite de registros para pruebas
  const [importLimit, setImportLimit] = useState<string>('');
  
  // Resultados de importación
  const [results, setResults] = useState<ImportResult[]>([]);
  const [currentImporting, setCurrentImporting] = useState<string>('');
  const [importProgress, setImportProgress] = useState(0);

  // Cargar metadata
  useEffect(() => {
    getMeta().then((res) => {
      setMeta(res.entities);
      // Inicializar configuraciones
      const configs: Record<string, EntityFileConfig> = {};
      ENTITIES_CONFIG.forEach((e) => {
        configs[e.key] = {
          enabled: false,
          file: null,
          headers: [],
          identifierColumn: '',
          mapping: {},
          upsertKey: res.entities[e.key]?.unique_keys?.[0] || '',
          relationMappings: {},
        };
      });
      setEntityConfigs(configs);
    });
  }, []);

  // Helpers
  const normalize = (s?: string) =>
    (s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

  const enabledEntities = useMemo(() => 
    ENTITIES_CONFIG.filter(e => entityConfigs[e.key]?.enabled),
    [entityConfigs]
  );

  // Función para encontrar columna CSV que coincida con un campo del sistema
  const findCsvColumnForField = (field: string, csvHeaders: string[]): string | null => {
    const normalizedField = normalize(field);
    
    // Primero buscar coincidencia exacta
    const exactMatch = csvHeaders.find(h => normalize(h) === normalizedField);
    if (exactMatch) return exactMatch;
    
    // Buscar por sinónimos del campo
    const synonyms = FIELD_SYNONYMS[field] || [];
    for (const syn of synonyms) {
      const synMatch = csvHeaders.find(h => normalize(h) === normalize(syn));
      if (synMatch) return synMatch;
    }
    
    // Buscar coincidencia parcial
    const partialMatch = csvHeaders.find(h => 
      normalize(h).includes(normalizedField) || normalizedField.includes(normalize(h))
    );
    if (partialMatch) return partialMatch;
    
    return null;
  };

  // Manejar archivo para una entidad
  const handleFileChange = async (entityKey: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    
    // Leer headers del CSV
    const text = await f.text();
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length > 0) {
      const headerLine = lines[0];
      const cols = headerLine.split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      
      // Usar campos de plantilla si están definidos, sino usar los del backend
      const entityFields = TEMPLATE_COLUMNS[entityKey] || meta[entityKey]?.fields || [];
      
      // Auto-detectar mapeo: campo_sistema -> columna_csv
      const mapping: Record<string, string> = {};
      entityFields.forEach((field: string) => {
        const matchedCol = findCsvColumnForField(field, cols);
        if (matchedCol) {
          mapping[field] = matchedCol;
        }
      });
      
      setEntityConfigs(prev => ({
        ...prev,
        [entityKey]: {
          ...prev[entityKey],
          file: f,
          headers: cols,
          mapping,
        },
      }));
    }
  };

  const toggleEntity = (entityKey: string) => {
    setEntityConfigs(prev => ({
      ...prev,
      [entityKey]: {
        ...prev[entityKey],
        enabled: !prev[entityKey]?.enabled,
      },
    }));
  };

  const updateEntityConfig = (entityKey: string, field: keyof EntityFileConfig, value: any) => {
    setEntityConfigs(prev => ({
      ...prev,
      [entityKey]: {
        ...prev[entityKey],
        [field]: value,
      },
    }));
  };

  const updateRelationMapping = (
    entityKey: string, 
    relationKey: string, 
    columnInThisFile: string,
    columnInTargetFile: string,
    targetEntityKey: string
  ) => {
    setEntityConfigs(prev => {
      const newConfig = {
        ...prev[entityKey],
        relationMappings: {
          ...prev[entityKey].relationMappings,
          [relationKey]: {
            targetEntityKey,
            columnInThisFile,
            columnInTargetFile,
          },
        },
      };
      
      // IMPORTANTE: También agregar al mapping principal para que el backend reciba el campo
      // relationKey es el campo del sistema (ej: cliente_documento, vendedor_email)
      // columnInThisFile es la columna del CSV que contiene ese dato
      if (columnInThisFile) {
        newConfig.mapping = {
          ...newConfig.mapping,
          [relationKey]: columnInThisFile,
        };
      }
      
      return {
        ...prev,
        [entityKey]: newConfig,
      };
    });
  };

  // Actualizar mapeo: campo_sistema -> columna_csv
  const updateEntityMapping = (entityKey: string, systemField: string, csvColumn: string) => {
    setEntityConfigs(prev => ({
      ...prev,
      [entityKey]: {
        ...prev[entityKey],
        mapping: {
          ...prev[entityKey].mapping,
          [systemField]: csvColumn,
        },
      },
    }));
  };

  // Ejecutar importación múltiple
  const executeMultipleImport = async () => {
    if (enabledEntities.length === 0) return;
    
    setLoading(true);
    setResults([]);
    setImportProgress(0);
    setStep(4);
    
    // Ordenar: primero las que no tienen relaciones (clientes, vendedores, etc), luego pólizas
    const orderedEntities = [...enabledEntities].sort((a, b) => {
      const aHasRelations = (a as any).relations?.length > 0;
      const bHasRelations = (b as any).relations?.length > 0;
      if (aHasRelations && !bHasRelations) return 1;
      if (!aHasRelations && bHasRelations) return -1;
      return 0;
    });
    
    const totalEntities = orderedEntities.length;
    const newResults: ImportResult[] = [];
    
    // Índice de entidades importadas: { entityKey: { valorColumna: idEnBD } }
    // Se construye al importar cada entidad y se usa para relacionar pólizas
    const importedIndex: Record<string, Record<string, number>> = {};
    
    for (let i = 0; i < orderedEntities.length; i++) {
      const entityConfig = orderedEntities[i];
      const config = entityConfigs[entityConfig.key];
      
      if (!config.file) {
        newResults.push({
          entity: entityConfig.label,
          inserted: 0,
          updated: 0,
          failed: 0,
          errors: [{ error: 'No se seleccionó archivo' }],
        });
        continue;
      }
      
      setCurrentImporting(entityConfig.label);
      setImportProgress(Math.round((i / totalEntities) * 100));
      
      try {
        // Ejecutar importación para esta entidad
        const result = await executeImport({
          entity: entityConfig.key,
          file: config.file,
          mapping: config.mapping,
          upsert_key: config.upsertKey,
          auto_create: true,
          limit: importLimit ? parseInt(importLimit) : undefined,
          // Enviar relation_mappings para pólizas (indica cómo buscar clientes/vendedores)
          relation_mappings: config.relationMappings,
          // Enviar índice de entidades ya importadas para relacionar por columnas temporales
          imported_index: importedIndex,
        });
        
        // Si el backend devuelve un índice de IDs creados, guardarlo para las siguientes entidades
        if (result.created_index) {
          importedIndex[entityConfig.key] = {
            ...importedIndex[entityConfig.key],
            ...result.created_index,
          };
        }
        
        newResults.push({
          entity: entityConfig.label,
          inserted: result.inserted || 0,
          updated: result.updated || 0,
          failed: result.failed || 0,
          errors: result.errors || [],
        });
      } catch (error: any) {
        newResults.push({
          entity: entityConfig.label,
          inserted: 0,
          updated: 0,
          failed: 1,
          errors: [{ error: error.message || 'Error desconocido' }],
        });
      }
    }
    
    setResults(newResults);
    setImportProgress(100);
    setCurrentImporting('');
    setLoading(false);
  };

  const reset = () => {
    setStep(1);
    setResults([]);
    setImportProgress(0);
    setImportLimit('');
    // Reset entity configs
    const configs: Record<string, EntityFileConfig> = {};
    ENTITIES_CONFIG.forEach((e) => {
      configs[e.key] = {
        enabled: false,
        file: null,
        headers: [],
        identifierColumn: '',
        mapping: {},
        upsertKey: meta[e.key]?.unique_keys?.[0] || '',
        relationMappings: {},
      };
    });
    setEntityConfigs(configs);
  };

  // Verificar si se puede continuar
  const canProceedToStep2 = enabledEntities.length > 0;
  const canProceedToStep3 = enabledEntities.every(e => entityConfigs[e.key]?.file);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Icon icon="solar:layers-minimalistic-bold-duotone" className="w-8 h-8 text-indigo-500" />
            Importación Múltiple
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Importa múltiples tipos de datos con archivos separados, conectándolos automáticamente
          </p>
        </div>
        {step > 1 && (
          <Button color="gray" onClick={reset}>
            <Icon icon="solar:restart-bold" className="w-4 h-4 mr-2" />
            Reiniciar
          </Button>
        )}
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {[1, 2, 3, 4].map((s) => (
          <React.Fragment key={s}>
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
                step >= s
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-200 text-gray-500 dark:bg-gray-700'
              }`}
            >
              {s}
            </div>
            {s < 4 && (
              <div
                className={`w-12 h-1 ${
                  step > s ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step 1: Seleccionar Entidades */}
      {step === 1 && (
        <Card>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Icon icon="solar:checklist-bold-duotone" className="w-6 h-6 text-indigo-500" />
            Paso 1: Selecciona qué datos importar
          </h2>
          <p className="text-gray-500 mb-4">
            Elige las entidades que deseas importar. Cada una tendrá su propio archivo CSV.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ENTITIES_CONFIG.map((entity) => (
              <div
                key={entity.key}
                onClick={() => toggleEntity(entity.key)}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  entityConfigs[entity.key]?.enabled
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${entity.color}`}>
                    <Icon icon={entity.icon} className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {entity.label}
                      </h3>
                      <Checkbox
                        checked={entityConfigs[entity.key]?.enabled || false}
                        onChange={() => toggleEntity(entity.key)}
                      />
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{entity.description}</p>
                    {(entity as any).relations && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-400">Se relaciona con:</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(entity as any).relations.map((rel: any) => (
                            <Badge key={rel.targetEntity} color="gray" size="xs">
                              {rel.label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end mt-6">
            <Button
              color="primary"
              disabled={!canProceedToStep2}
              onClick={() => setStep(2)}
            >
              Continuar
              <Icon icon="solar:arrow-right-linear" className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </Card>
      )}

      {/* Step 2: Subir Archivos */}
      {step === 2 && (
        <Card>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Icon icon="solar:upload-bold-duotone" className="w-6 h-6 text-indigo-500" />
            Paso 2: Sube un archivo para cada entidad
          </h2>
          
          <div className="space-y-4">
            {enabledEntities.map((entity) => {
              const config = entityConfigs[entity.key];
              return (
                <div key={entity.key} className="border rounded-xl p-4 dark:border-gray-700">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`p-2 rounded-lg ${entity.color}`}>
                      <Icon icon={entity.icon} className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {entity.label}
                      </h3>
                      {config.file && (
                        <p className="text-sm text-green-600">
                          ✓ {config.file.name} ({config.headers.length} columnas)
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div
                    className={`border-2 border-dashed rounded-lg p-4 text-center transition-all ${
                      config.file ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    <input
                      type="file"
                      accept=".csv,.txt,.xlsx,.xls"
                      onChange={(e) => handleFileChange(entity.key, e)}
                      className="hidden"
                      id={`file-${entity.key}`}
                    />
                    <label htmlFor={`file-${entity.key}`} className="cursor-pointer">
                      {config.file ? (
                        <div className="flex items-center justify-center gap-2">
                          <Icon icon="solar:file-check-bold-duotone" className="w-8 h-8 text-green-500" />
                          <span className="text-green-700 dark:text-green-400">Cambiar archivo</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <Icon icon="solar:cloud-upload-bold-duotone" className="w-8 h-8 text-gray-400" />
                          <span className="text-gray-600 dark:text-gray-400">Seleccionar archivo CSV</span>
                        </div>
                      )}
                    </label>
                  </div>
                  
                  {config.headers.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-gray-500 mb-1">Columnas detectadas:</p>
                      <div className="flex flex-wrap gap-1">
                        {config.headers.slice(0, 10).map((h) => (
                          <Badge key={h} color="gray" size="xs">{h}</Badge>
                        ))}
                        {config.headers.length > 10 && (
                          <Badge color="gray" size="xs">+{config.headers.length - 10} más</Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex justify-between mt-6">
            <Button color="gray" onClick={() => setStep(1)}>
              <Icon icon="solar:arrow-left-linear" className="w-4 h-4 mr-2" />
              Atrás
            </Button>
            <Button
              color="primary"
              disabled={!canProceedToStep3}
              onClick={() => setStep(3)}
            >
              Continuar
              <Icon icon="solar:arrow-right-linear" className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </Card>
      )}

      {/* Step 3: Configurar Relaciones */}
      {step === 3 && (
        <Card>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Icon icon="solar:link-bold-duotone" className="w-6 h-6 text-indigo-500" />
            Paso 3: Configura las relaciones entre archivos
          </h2>
          
          <Alert color="info" className="mb-4">
            <div className="flex items-start gap-2">
              <Icon icon="solar:info-circle-bold" className="w-5 h-5 mt-0.5" />
              <div>
                <p className="font-medium">¿Cómo funcionan las relaciones?</p>
                <p className="text-sm mt-1">
                  Selecciona qué columna de cada archivo sirve como identificador para conectar los datos.
                  Por ejemplo: la columna "email" en Vendedores se relaciona con "vendedor_email" en Pólizas.
                </p>
              </div>
            </div>
          </Alert>
          
          <div className="space-y-6">
            {enabledEntities.map((entity) => {
              const config = entityConfigs[entity.key];
              const entityMeta = meta[entity.key];
              const entityDef = ENTITIES_CONFIG.find(e => e.key === entity.key);
              
              return (
                <div key={entity.key} className="border rounded-xl p-4 dark:border-gray-700">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-2 rounded-lg ${entity.color}`}>
                      <Icon icon={entity.icon} className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {entity.label}
                      </h3>
                      <p className="text-sm text-gray-500">{config.file?.name}</p>
                    </div>
                  </div>

                  {/* Identificador principal */}
                  <div className="mb-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                    <Label className="text-indigo-700 dark:text-indigo-300 font-medium">
                      <Icon icon="solar:key-bold" className="w-4 h-4 inline mr-1" />
                      Columna identificadora (para actualizar registros existentes)
                    </Label>
                    <Select
                      value={config.identifierColumn}
                      onChange={(e) => updateEntityConfig(entity.key, 'identifierColumn', e.target.value)}
                      className="mt-1"
                    >
                      <option value="">-- Seleccionar columna --</option>
                      {config.headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </Select>
                  </div>

                  {/* Relaciones (solo para pólizas u otras con relaciones) */}
                  {(entityDef as any)?.relations && (
                    <div className="space-y-3">
                      <Label className="font-medium text-gray-700 dark:text-gray-300">
                        <Icon icon="solar:link-bold" className="w-4 h-4 inline mr-1" />
                        Relaciones con otras entidades
                      </Label>
                      
                      {(entityDef as any).relations.map((relation: any) => {
                        const targetConfig = entityConfigs[relation.targetEntity];
                        const isTargetEnabled = targetConfig?.enabled && targetConfig?.file;
                        
                        return (
                          <div 
                            key={relation.targetEntity} 
                            className={`p-3 rounded-lg border ${
                              isTargetEnabled 
                                ? 'border-gray-200 dark:border-gray-600' 
                                : 'border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <Badge color={isTargetEnabled ? 'success' : 'gray'}>
                                {relation.label}
                              </Badge>
                              {!isTargetEnabled && (
                                <span className="text-xs text-gray-400">
                                  (No hay archivo de {relation.label})
                                </span>
                              )}
                            </div>
                            
                            {isTargetEnabled && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                  <Label className="text-xs text-gray-500">
                                    Columna en {entity.label}:
                                  </Label>
                                  <Select
                                    sizing="sm"
                                    value={config.relationMappings?.[relation.fieldInPoliza]?.columnInThisFile || ''}
                                    onChange={(e) => updateRelationMapping(
                                      entity.key,
                                      relation.fieldInPoliza,
                                      e.target.value,
                                      config.relationMappings?.[relation.fieldInPoliza]?.columnInTargetFile || '',
                                      relation.targetEntity
                                    )}
                                  >
                                    <option value="">-- Seleccionar --</option>
                                    {config.headers.map((h) => (
                                      <option key={h} value={h}>{h}</option>
                                    ))}
                                  </Select>
                                </div>
                                <div>
                                  <Label className="text-xs text-gray-500">
                                    Se relaciona con columna en {relation.label}:
                                  </Label>
                                  <Select
                                    sizing="sm"
                                    value={config.relationMappings?.[relation.fieldInPoliza]?.columnInTargetFile || ''}
                                    onChange={(e) => updateRelationMapping(
                                      entity.key,
                                      relation.fieldInPoliza,
                                      config.relationMappings?.[relation.fieldInPoliza]?.columnInThisFile || '',
                                      e.target.value,
                                      relation.targetEntity
                                    )}
                                  >
                                    <option value="">-- Seleccionar --</option>
                                    {targetConfig.headers.map((h) => (
                                      <option key={h} value={h}>{h}</option>
                                    ))}
                                  </Select>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Mapeo de campos: Campo del sistema → Columna CSV */}
                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800">
                      <Icon icon="solar:settings-bold" className="w-4 h-4 inline mr-1" />
                      Mapeo de campos ({Object.keys(config.mapping).filter(k => config.mapping[k]).length} mapeados)
                    </summary>
                    <div className="mt-3 space-y-2 max-h-64 overflow-y-auto p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      {/* Campos del sistema (destino) */}
                      {(TEMPLATE_COLUMNS[entity.key] || entityMeta?.fields || []).map((systemField: string) => {
                        const isMapped = !!config.mapping[systemField];
                        return (
                          <div 
                            key={systemField} 
                            className={`flex items-center gap-2 p-2 rounded-lg border ${
                              isMapped 
                                ? 'border-green-300 bg-green-50 dark:bg-green-900/20' 
                                : 'border-gray-200 dark:border-gray-700'
                            }`}
                          >
                            <div className="flex items-center gap-2 w-1/3">
                              {isMapped && (
                                <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-green-500 flex-shrink-0" />
                              )}
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate" title={systemField}>
                                {systemField}
                              </span>
                            </div>
                            <Icon icon="solar:arrow-left-linear" className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <Select
                              sizing="sm"
                              value={config.mapping[systemField] || ''}
                              onChange={(e) => updateEntityMapping(entity.key, systemField, e.target.value)}
                              className="flex-1"
                            >
                              <option value="">-- Seleccionar columna CSV --</option>
                              {config.headers.map((h) => (
                                <option key={h} value={h}>{h}</option>
                              ))}
                            </Select>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                </div>
              );
            })}
          </div>

          {/* Límite de registros para pruebas */}
          <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border-2 border-amber-200 dark:border-amber-800">
            <div className="flex items-start gap-4">
              <Icon icon="solar:test-tube-bold-duotone" className="w-6 h-6 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <label htmlFor="import-limit-multi" className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  Límite de registros por entidad (para pruebas)
                </label>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 mb-3">
                  Deja vacío para importar todos los registros, o selecciona una cantidad para probar primero.
                </p>
                <div className="flex items-center gap-3">
                  <select
                    id="import-limit-multi"
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
                  </select>
                  {importLimit && (
                    <Badge color="warning" size="sm">
                      <Icon icon="solar:filter-bold" className="w-3 h-3 mr-1" />
                      Modo prueba: {importLimit} registros por entidad
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between mt-6">
            <Button color="gray" onClick={() => setStep(2)}>
              <Icon icon="solar:arrow-left-linear" className="w-4 h-4 mr-2" />
              Atrás
            </Button>
            <Button color="primary" onClick={executeMultipleImport} disabled={loading}>
              {loading ? (
                <Spinner size="sm" className="mr-2" />
              ) : (
                <Icon icon="solar:play-bold" className="w-4 h-4 mr-2" />
              )}
              {importLimit ? `Ejecutar (${importLimit} por entidad)` : 'Ejecutar Importación'}
            </Button>
          </div>
        </Card>
      )}

      {/* Step 4: Resultados */}
      {step === 4 && (
        <Card>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Icon icon="solar:chart-2-bold-duotone" className="w-6 h-6 text-indigo-500" />
            Resultados de la Importación
          </h2>

          {loading && (
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <Spinner size="sm" />
                <span className="font-medium">Importando: {currentImporting}</span>
              </div>
              <Progress progress={importProgress} color="indigo" />
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="space-y-4">
              {results.map((result, i) => (
                <div
                  key={i}
                  className={`p-4 rounded-xl border ${
                    result.failed > 0
                      ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                      : 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {result.entity}
                    </h3>
                    <div className="flex gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">{result.inserted}</p>
                        <p className="text-xs text-gray-500">Insertados</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-blue-600">{result.updated}</p>
                        <p className="text-xs text-gray-500">Actualizados</p>
                      </div>
                      {result.failed > 0 && (
                        <div className="text-center">
                          <p className="text-2xl font-bold text-red-600">{result.failed}</p>
                          <p className="text-xs text-gray-500">Fallidos</p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {result.errors.length > 0 && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm text-red-600">
                        Ver {result.errors.length} error(es)
                      </summary>
                      <div className="mt-2 max-h-32 overflow-y-auto text-sm">
                        {result.errors.slice(0, 10).map((err, j) => (
                          <p key={j} className="text-red-600 dark:text-red-400">
                            {err.row ? `Fila ${err.row}: ` : ''}{err.error}
                          </p>
                        ))}
                        {result.errors.length > 10 && (
                          <p className="text-gray-500">
                            ... y {result.errors.length - 10} errores más
                          </p>
                        )}
                      </div>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}

          {!loading && (
            <div className="flex justify-center mt-6">
              <Button color="primary" onClick={reset}>
                <Icon icon="solar:restart-bold" className="w-4 h-4 mr-2" />
                Nueva Importación
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default ImportacionMultiple;
