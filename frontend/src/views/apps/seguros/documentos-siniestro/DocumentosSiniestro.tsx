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
import { siniestroService, type Siniestro } from 'src/services/siniestroService';
import { siniestroDocumentsService } from 'src/services/siniestroDocumentsService';
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

const DocumentosSiniestro: React.FC = () => {
  const { hasPermission } = useUnifiedAuth();
  const canCreate = hasPermission('documentos_siniestro', 'crear');
  const canDelete = hasPermission('documentos_siniestro', 'eliminar');
  const [siniestros, setSiniestros] = useState<Siniestro[]>([]);
  const [loadingSiniestros, setLoadingSiniestros] = useState<boolean>(true);
  const [errorSiniestros, setErrorSiniestros] = useState<string | null>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState<boolean>(false);
  const [errorDocs, setErrorDocs] = useState<string | null>(null);

  const [search, setSearch] = useState<string>('');
  const [selectedSiniestroId, setSelectedSiniestroId] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');

  const [openingKey, setOpeningKey] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<any | null>(null);

  // Subida
  const [showUpload, setShowUpload] = useState(false);
  const [uploadSiniestroId, setUploadSiniestroId] = useState<string>('');
  const [docType, setDocType] = useState<string>('reporte');
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
        setLoadingSiniestros(true);
        setErrorSiniestros(null);
        const res = await siniestroService.getSiniestros({ per_page: 200, page: 1 });
        if (!mounted) return;

        // Manejar respuesta paginada o directa
        const payload: any = res?.data;
        const list: any[] = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
          ? payload.data
          : [];

        if (res && Array.isArray(list)) {
          setSiniestros(list as Siniestro[]);
        } else {
          setSiniestros([]);
          setErrorSiniestros('No se pudieron cargar los siniestros');
        }
      } catch (e) {
        if (mounted) setErrorSiniestros(e instanceof Error ? e.message : 'Error desconocido');
      } finally {
        if (mounted) setLoadingSiniestros(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const buildSiniestroLabel = useCallback((s: Siniestro): string => {
    return `${s.numero_siniestro || s.id} · ${s.tipo_siniestro || 'Sin tipo'}${
      s.numero_poliza ? ` · Póliza ${s.numero_poliza}` : ''
    }`;
  }, []);

  const loadAllDocs = useCallback(async () => {
    setLoadingDocs(true);
    setErrorDocs(null);
    try {
      const res = await siniestroDocumentsService.listarDocumentosGlobal({
        per_page: 1000,
        page: 1,
      });
      if (res?.success && Array.isArray(res.data)) {
        const docsWithLabels = res.data.map((d: any) => ({
          ...d,
          __siniestroId: String(d.siniestro_id),
          __siniestroLabel: `${d.numero_siniestro} · ${d.tipo_siniestro}${
            d.numero_poliza ? ` · Póliza ${d.numero_poliza}` : ''
          }`,
        }));
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
  }, []);

  useEffect(() => {
    loadAllDocs();
  }, [loadAllDocs]);

  const typesOptions = useMemo(() => {
    const present = new Set<string>(docs.map((d) => d.type || 'otro'));
    const base = ['reporte', 'evidencia', 'peritaje', 'factura', 'comprobante', 'dictamen', 'otro'];
    return [''].concat(Array.from(new Set([...base, ...Array.from(present)])));
  }, [docs]);

  const visibleDocs = useMemo(() => {
    const s = search.trim().toLowerCase();
    let list = docs.filter((d) => {
      const okSiniestro =
        !selectedSiniestroId || String(d.__siniestroId) === String(selectedSiniestroId);
      const okType = !typeFilter || (d.type || 'otro') === typeFilter;
      const okSearch =
        !s ||
        String(d.name || '')
          .toLowerCase()
          .includes(s) ||
        String(d.contentType || '')
          .toLowerCase()
          .includes(s);
      return okSiniestro && okType && okSearch;
    });
    return list;
  }, [docs, search, selectedSiniestroId, typeFilter]);

  // Reiniciar a la primera página cuando cambien filtros o tamaño de página
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedSiniestroId, typeFilter, pageSize]);

  // Total de páginas y documentos paginados
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
      setOpeningKey(`${row.__siniestroId}:${row.path}`);
      const url = await siniestroDocumentsService.getSignedUrl(String(row.__siniestroId), {
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
    await siniestroDocumentsService.eliminarDocumento(String(row.__siniestroId), {
      path: row.path,
    });
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
      route="/apps/seguros/documentos-siniestro"
      action="ver"
      fallback={
        <div className="p-6">
          <Badge color="warning">No tienes permisos para ver Documentos de Siniestros.</Badge>
        </div>
      }
    >
      <Card>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h5 className="text-xl font-semibold text-gray-900 dark:text-white">
              Documentos de Siniestros
            </h5>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Gestiona documentos de todos los siniestros
            </p>
          </div>
          <div className="flex gap-2">
            <Button color="gray" size="sm" onClick={() => loadAllDocs()} disabled={loadingDocs}>
              <IconRefresh className="w-4 h-4 mr-2" />
              Actualizar
            </Button>
            {canCreate && (
              <HeroButton icon="solar:cloud-upload-bold" onClick={() => {
                  setUploadSiniestroId(selectedSiniestroId || '');
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
              Siniestro
            </label>
            {loadingSiniestros ? (
              <div className="flex items-center justify-center h-10 text-gray-500">
                <Spinner size="sm" />
                <span className="ml-2 text-sm">Cargando...</span>
              </div>
            ) : (
              <Select
                value={selectedSiniestroId}
                onChange={(e) => setSelectedSiniestroId(e.target.value)}
              >
                <option value="">Todos los siniestros</option>
                {siniestros.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {buildSiniestroLabel(s)}
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
                setSelectedSiniestroId('');
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
                  {search || typeFilter || selectedSiniestroId
                    ? 'Intenta ajustar los filtros de búsqueda'
                    : 'Comienza subiendo documentos usando el botón "Subir archivos"'}
                </p>
              </div>
            ) : (
              <Table hoverable>
                <Table.Head>
                  <Table.HeadCell className="text-base font-semibold py-3">
                    Siniestro
                  </Table.HeadCell>
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
                    <Table.Row key={`${d.__siniestroId}:${d.path}:${idx}`}>
                      <Table.Cell className="font-medium text-gray-900 dark:text-white">
                        <div className="max-w-xs truncate" title={d.__siniestroLabel}>
                          {d.__siniestroLabel}
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
                            disabled={openingKey === `${d.__siniestroId}:${d.path}`}
                            onClick={() => onOpen(d)}
                          >
                            {openingKey === `${d.__siniestroId}:${d.path}` ? (
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
                  Siniestro destino
                </label>
                <Select
                  value={uploadSiniestroId}
                  onChange={(e) => setUploadSiniestroId(e.target.value)}
                >
                  <option value="">Seleccione un siniestro...</option>
                  {siniestros.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {buildSiniestroLabel(s)}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tipo de documento
                </label>
                <Select value={docType} onChange={(e) => setDocType(e.target.value)}>
                  <option value="reporte">Reporte inicial</option>
                  <option value="evidencia">Evidencia fotográfica</option>
                  <option value="peritaje">Peritaje</option>
                  <option value="factura">Factura/Cotización</option>
                  <option value="comprobante">Comprobante de pago</option>
                  <option value="dictamen">Dictamen médico</option>
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
              disabled={!uploadSiniestroId || selectedFiles.length === 0 || uploading}
              onClick={async () => {
                try {
                  if (!uploadSiniestroId || selectedFiles.length === 0) return;
                  setUploading(true);
                  setProgress({ percent: 0, text: 'Preparando subida...' });
                  await siniestroDocumentsService.subirDocumento(
                    uploadSiniestroId,
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

export default DocumentosSiniestro;
