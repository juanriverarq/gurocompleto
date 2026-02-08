import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Card,
  Select,
  Spinner,
  TextInput,
  Button,
  Table,
  Badge,
  Modal,
  Pagination,
} from 'flowbite-react';
import HeroButton from 'src/components/HeroButton';
import { polizaService, type Poliza } from 'src/services/polizaService';
import {
  IconDotsVertical,
  IconEye,
  IconTrash,
  IconCloudUpload,
  IconRefresh,
  IconSearch,
  IconFilter,
} from '@tabler/icons-react';
import { useDropzone } from 'react-dropzone';
import PermissionGate from 'src/components/PermissionGate';
import { useUnifiedAuth } from 'src/context/UnifiedAuthContext';

const DocumentosPoliza: React.FC = () => {
  const { hasPermission } = useUnifiedAuth();
  const canCreate = hasPermission('documentos_poliza', 'crear');
  const canDelete = hasPermission('documentos_poliza', 'eliminar');
  const [polizas, setPolizas] = useState<Poliza[]>([]);
  const [loadingPolizas, setLoadingPolizas] = useState<boolean>(true);
  const [errorPolizas, setErrorPolizas] = useState<string | null>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState<boolean>(false);
  const [errorDocs, setErrorDocs] = useState<string | null>(null);

  const [search, setSearch] = useState<string>('');
  const [selectedPolizaId, setSelectedPolizaId] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');

  const [openingKey, setOpeningKey] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<any | null>(null);

  // Subida
  const [showUpload, setShowUpload] = useState(false);
  const [uploadPolizaId, setUploadPolizaId] = useState<string>('');
  const [docType, setDocType] = useState<string>('caratula');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ percent: number; text: string } | null>(null);

  // Paginación (10, 25, 50, 100) con 50 por defecto
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingPolizas(true);
        setErrorPolizas(null);
        const res = await polizaService.getPolizas({ per_page: 200, page: 1 });
        if (!mounted) return;
        const payload: any = res?.data;
        const list: any[] = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
          ? payload.data
          : [];
        if (res && Array.isArray(list)) {
          setPolizas(list as Poliza[]);
        } else {
          setPolizas([]);
          setErrorPolizas('No se pudieron cargar las pólizas');
        }
      } catch (e) {
        if (mounted) setErrorPolizas(e instanceof Error ? e.message : 'Error desconocido');
      } finally {
        if (mounted) setLoadingPolizas(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const buildPolizaLabel = useCallback((p: Poliza): string => {
    const clienteLabel = `${p.nombres_cliente || ''} ${p.apellidos_cliente || ''}`.trim();
    return `${p.numero_poliza} · ${p.aseguradora}${clienteLabel ? ` · ${clienteLabel}` : ''}`;
  }, []);

  const loadAllDocs = useCallback(async () => {
    if (!Array.isArray(polizas) || polizas.length === 0) {
      setDocs([]);
      return;
    }
    setLoadingDocs(true);
    setErrorDocs(null);
    try {
      const res = await polizaService.listarDocumentosGlobal({ per_page: 1000, page: 1 });
      if (res?.success && Array.isArray(res.data)) {
        const docsWithLabels = res.data.map((d: any) => {
          // Normalizar valores para evitar "null" y "[object Object]"
          const policyNumber = (d && (d.policy_number ?? d.numero_poliza)) || '-';

          let insuranceCompany: any =
            d?.insurance_company ?? d?.aseguradora ?? d?.aseguradora_nombre ?? '-';
          if (typeof insuranceCompany !== 'string') {
            insuranceCompany =
              (insuranceCompany && (insuranceCompany.nombre || insuranceCompany.name)) || '-';
          }

          const clientName =
            typeof d?.client_name === 'string'
              ? d.client_name
              : `${d?.nombres_cliente || ''} ${d?.apellidos_cliente || ''}`.trim();

          const label = `${policyNumber || '-'} · ${insuranceCompany || '-'}${
            clientName ? ` · ${clientName}` : ''
          }`;

          return {
            ...d,
            __polizaId: String(d.poliza_id ?? d.id ?? ''),
            __polizaLabel: label,
          };
        });
        setDocs(docsWithLabels);
      } else {
        setDocs([]);
        setErrorDocs(res?.message || 'No se pudieron cargar los documentos');
      }
    } catch (e) {
      setErrorDocs(e instanceof Error ? e.message : 'Error al cargar documentos');
      setDocs([]);
    } finally {
      setLoadingDocs(false);
    }
  }, [polizas]);

  useEffect(() => {
    if (!loadingPolizas && polizas.length > 0) {
      loadAllDocs();
    }
  }, [loadingPolizas, polizas, loadAllDocs]);

  const typesOptions = useMemo(() => {
    const present = new Set<string>(docs.map((d) => d.type || 'otro'));
    const base = [
      'caratula',
      'condiciones',
      'recibo',
      'soporte_pago',
      'endoso',
      'anexo',
      'cotizacion',
      'otro',
    ];
    return [''].concat(Array.from(new Set([...base, ...Array.from(present)])));
  }, [docs]);

  const visibleDocs = useMemo(() => {
    const s = search.trim().toLowerCase();
    let list = docs.filter((d) => {
      const okPoliza = !selectedPolizaId || String(d.__polizaId) === String(selectedPolizaId);
      const okType = !typeFilter || (d.type || 'otro') === typeFilter;
      const okSearch =
        !s ||
        String(d.name || '')
          .toLowerCase()
          .includes(s) ||
        String(d.contentType || '')
          .toLowerCase()
          .includes(s);
      return okPoliza && okType && okSearch;
    });
    return list;
  }, [docs, search, selectedPolizaId, typeFilter]);

  // Resetear a la primera página cuando cambian filtros o el tamaño de página
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedPolizaId, typeFilter, pageSize]);

  // Cálculo de páginas y rebanado de elementos visibles
  const totalPages = useMemo(() => {
    const total = Math.ceil(visibleDocs.length / pageSize);
    return total > 0 ? total : 1;
  }, [visibleDocs.length, pageSize]);

  const paginatedDocs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return visibleDocs.slice(start, end);
  }, [visibleDocs, currentPage, pageSize]);

  const formatSize = useCallback((bytes?: number): string => {
    if (!bytes && bytes !== 0) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let idx = 0;
    while (size >= 1024 && idx < units.length - 1) {
      size /= 1024;
      idx++;
    }
    return `${size.toFixed(size < 10 && idx > 0 ? 1 : 0)} ${units[idx]}`;
  }, []);

  const onOpen = async (row: any) => {
    try {
      setOpeningKey(`${row.__polizaId}:${row.path}`);
      const url = await polizaService.getSignedUrl(String(row.__polizaId), {
        path: row.path,
        name: row.name,
      });
      window.open(url, '_blank');
    } catch {
    } finally {
      setOpeningKey(null);
    }
  };

  const onDelete = async (row: any) => {
    await polizaService.eliminarDocumento(String(row.__polizaId), { path: row.path });
    await loadAllDocs();
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (!acceptedFiles || acceptedFiles.length === 0) return;
    setSelectedFiles(acceptedFiles);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/csv': ['.csv'],
    },
  });

  return (
    <PermissionGate
      route="/apps/seguros/documentos-poliza"
      action="ver"
      fallback={
        <div className="p-6">
          <Badge color="warning">No tienes permisos para ver Documentos de Pólizas.</Badge>
        </div>
      }
    >
      <Card>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h5 className="text-xl font-semibold text-gray-900 dark:text-white">
              Documentos de Pólizas
            </h5>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Gestiona documentos de todas las pólizas
            </p>
          </div>
          <div className="flex gap-2">
            <Button color="gray" size="sm" onClick={() => loadAllDocs()} disabled={loadingDocs}>
              <IconRefresh className="w-4 h-4 mr-2" />
              Actualizar
            </Button>
            {canCreate && (
              <HeroButton icon="solar:cloud-upload-bold" onClick={() => {
                  setUploadPolizaId(selectedPolizaId || '');
                  setSelectedFiles([]);
                  setShowUpload(true);
                }} size="sm">Subir archivos</HeroButton>
            )}
          </div>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Búsqueda
            </label>
            <TextInput
              placeholder="Buscar documentos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={IconSearch}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Póliza
            </label>
            {loadingPolizas ? (
              <div className="flex items-center justify-center h-10 text-gray-500">
                <Spinner size="sm" />
                <span className="ml-2 text-sm">Cargando...</span>
              </div>
            ) : (
              <Select
                value={selectedPolizaId}
                onChange={(e) => setSelectedPolizaId(e.target.value)}
              >
                <option value="">Todas las pólizas</option>
                {polizas.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {buildPolizaLabel(p)}
                  </option>
                ))}
              </Select>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tipo
            </label>
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              {typesOptions.map((t, i) => (
                <option key={i} value={t}>
                  {t ? t.replace('_', ' ') : 'Todos los tipos'}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              color="gray"
              size="sm"
              onClick={() => {
                setSearch('');
                setSelectedPolizaId('');
                setTypeFilter('');
              }}
              className="w-full"
            >
              <IconFilter className="w-4 h-4 mr-2" />
              Limpiar filtros
            </Button>
          </div>
        </div>

        {/* Tabla */}
        <div className="border rounded-md border-ld overflow-hidden">
          <div className="overflow-x-auto">
            {loadingDocs ? (
              <div className="p-8 flex items-center justify-center text-gray-600">
                <Spinner className="mr-3" />
                <span>Cargando documentos...</span>
              </div>
            ) : visibleDocs.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p className="text-lg mb-2">No hay documentos para mostrar</p>
                <p className="text-sm">
                  {search || typeFilter || selectedPolizaId
                    ? 'Intenta ajustar los filtros de búsqueda'
                    : 'Comienza subiendo documentos usando el botón "Subir archivos"'}
                </p>
              </div>
            ) : (
              <Table hoverable>
                <Table.Head>
                  <Table.HeadCell className="text-base font-semibold py-3">Póliza</Table.HeadCell>
                  <Table.HeadCell className="text-base font-semibold py-3">
                    Documento
                  </Table.HeadCell>
                  <Table.HeadCell className="text-base font-semibold py-3">Tipo</Table.HeadCell>
                  <Table.HeadCell className="text-base font-semibold py-3">Tamaño</Table.HeadCell>
                  <Table.HeadCell className="text-base font-semibold py-3">Fecha</Table.HeadCell>
                  <Table.HeadCell className="text-base font-semibold py-3">Acciones</Table.HeadCell>
                </Table.Head>
                <Table.Body>
                  {paginatedDocs.map((d, idx) => (
                    <Table.Row key={`${d.__polizaId}:${d.path}:${idx}`}>
                      <Table.Cell className="font-medium text-gray-900 dark:text-white">
                        <div className="max-w-xs truncate" title={d.__polizaLabel}>
                          {d.__polizaLabel}
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="max-w-xs truncate" title={d.name}>
                          {d.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {d.contentType || 'Sin tipo MIME'}
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge color="info" className="text-xs">
                          {(d.type || 'otro').replace('_', ' ')}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell className="text-sm text-gray-600">
                        {formatSize(d.size)}
                      </Table.Cell>
                      <Table.Cell className="text-sm text-gray-600">
                        {d.uploaded_at ? new Date(d.uploaded_at).toLocaleDateString() : '-'}
                      </Table.Cell>
                      <Table.Cell>
                        <div className="flex items-center gap-2">
                          <Button
                            color="blue"
                            size="xs"
                            disabled={openingKey === `${d.__polizaId}:${d.path}`}
                            onClick={() => onOpen(d)}
                          >
                            {openingKey === `${d.__polizaId}:${d.path}` ? (
                              <Spinner size="sm" />
                            ) : (
                              <IconEye className="w-4 h-4" />
                            )}
                          </Button>
                          {canDelete && (
                            <Button
                              color="red"
                              size="xs"
                              onClick={() => {
                                setDocToDelete(d);
                                setConfirmOpen(true);
                              }}
                            >
                              <IconTrash className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            )}
          </div>
        </div>

        {/* Footer con paginación */}
        <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Contador visible */}
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {(() => {
              const start = (currentPage - 1) * pageSize + 1;
              const end = Math.min(currentPage * pageSize, visibleDocs.length);
              return `Mostrando ${visibleDocs.length === 0 ? 0 : start}-${end} de ${
                visibleDocs.length
              } documentos filtrados`;
            })()}
            <span className="ml-2 text-xs text-gray-500">(Total cargados: {docs.length})</span>
          </div>

          {/* Selección de tamaño de página */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Elementos por página:</span>
            <Select
              value={String(pageSize)}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="w-28"
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </Select>
          </div>

          {/* Controles de paginación */}
          <div className="flex justify-end">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={(p) => setCurrentPage(p)}
              showIcons
            />
          </div>
        </div>
      </Card>

      {/* Modal de confirmación de eliminación */}
      <Modal show={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <Modal.Header>Eliminar documento</Modal.Header>
        <Modal.Body>
          <p>
            ¿Estás seguro de eliminar <strong>"{docToDelete?.name}"</strong>?
          </p>
          <p className="text-sm text-gray-500 mt-2">Esta acción no se puede deshacer.</p>
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setConfirmOpen(false)}>
            Cancelar
          </Button>
          {canDelete && (
            <Button
              color="red"
              onClick={async () => {
                if (!docToDelete) return;
                await onDelete(docToDelete);
                setConfirmOpen(false);
                setDocToDelete(null);
              }}
            >
              Eliminar
            </Button>
          )}
        </Modal.Footer>
      </Modal>

      {/* Modal de subida */}
      <Modal show={showUpload} onClose={() => setShowUpload(false)} size="lg">
        <Modal.Header>Subir documentos</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Póliza destino
                </label>
                <Select value={uploadPolizaId} onChange={(e) => setUploadPolizaId(e.target.value)}>
                  <option value="">Seleccione una póliza...</option>
                  {polizas.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {buildPolizaLabel(p)}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tipo de documento
                </label>
                <Select value={docType} onChange={(e) => setDocType(e.target.value)}>
                  <option value="caratula">Carátula</option>
                  <option value="condiciones">Condiciones</option>
                  <option value="recibo">Recibo</option>
                  <option value="soporte_pago">Soporte de pago</option>
                  <option value="endoso">Endoso</option>
                  <option value="anexo">Anexo</option>
                  <option value="cotizacion">Cotización</option>
                  <option value="poliza">Póliza</option>
                  <option value="soat">SOAT</option>
                  <option value="factura">Factura</option>
                  <option value="cedula">Cédula</option>
                  <option value="matricula">Matrícula</option>
                  <option value="rut">RUT</option>
                  <option value="camara_comercio">Cámara de Comercio</option>
                  <option value="estados_financieros">Estados Financieros</option>
                  <option value="sarlaft">SARLAFT</option>
                  <option value="carta_estadia">Carta de Estadía</option>
                  <option value="carta_no_siniestro">Carta de No Siniestro</option>
                  <option value="otro">Otro</option>
                </Select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Seleccionar archivos
              </label>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <input {...getInputProps()} />
                <IconCloudUpload className="mx-auto mb-2 w-8 h-8 text-gray-400" />
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {isDragActive
                    ? 'Suelta los archivos aquí'
                    : 'Arrastra archivos o haz clic para seleccionar'}
                </p>
                <p className="text-xs text-gray-500 mt-1">PDF, imágenes, Office, CSV • Máx 20MB</p>
              </div>
              {selectedFiles.length > 0 && (
                <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm font-medium mb-2">
                    {selectedFiles.length} archivo(s) seleccionado(s):
                  </p>
                  <div className="space-y-1 max-h-24 overflow-auto">
                    {selectedFiles.map((f, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="truncate max-w-[200px]" title={f.name}>
                          {f.name}
                        </span>
                        <span className="text-gray-500">{formatSize(f.size)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setShowUpload(false)}>
            Cancelar
          </Button>
          {canCreate && (
            <Button
              color="blue"
              disabled={!uploadPolizaId || selectedFiles.length === 0 || uploading}
              onClick={async () => {
                try {
                  if (!uploadPolizaId || selectedFiles.length === 0) return;
                  setUploading(true);
                  setProgress({ percent: 0, text: 'Preparando subida...' });
                  await polizaService.subirDocumento(
                    uploadPolizaId,
                    selectedFiles,
                    { type: docType },
                    ({ percent, index, count, file }) => {
                      const label = count && count > 1 ? `(${index}/${count})` : '';
                      setProgress({
                        percent,
                        text: `Subiendo ${file?.name || ''} ${label} - ${percent}%`,
                      });
                    },
                  );
                  setSelectedFiles([]);
                  await loadAllDocs();
                } finally {
                  setUploading(false);
                  setProgress(null);
                  setShowUpload(false);
                }
              }}
            >
              {uploading ? (
                <div className="flex items-center">
                  <Spinner size="sm" className="mr-2" />
                  {progress ? progress.text : 'Subiendo...'}
                </div>
              ) : (
                <>
                  <IconCloudUpload className="w-4 h-4 mr-2" />
                  Subir
                </>
              )}
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </PermissionGate>
  );
};

export default DocumentosPoliza;
