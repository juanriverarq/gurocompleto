import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, Button, Spinner, Badge, Modal, Select, Table, TextInput } from 'flowbite-react';
import { IconEye, IconTrash, IconCloudUpload, IconRefresh } from '@tabler/icons-react';
import HeroButton from 'src/components/HeroButton';
import { useDropzone } from 'react-dropzone';
import { siniestroDocumentsService } from 'src/services/siniestroDocumentsService';

type Props = { siniestroId: string };

const formatSize = (bytes?: number): string => {
  if (!bytes && bytes !== 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let idx = 0;
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx++;
  }
  return `${size.toFixed(size < 10 && idx > 0 ? 1 : 0)} ${units[idx]}`;
};

const ArchivosSiniestro: React.FC<Props> = ({ siniestroId }) => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [docType, setDocType] = useState<string>('reporte');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<{ percent: number; text: string } | null>(null);
  const [openingPath, setOpeningPath] = useState<string | null>(null);
  
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<any | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const res = await siniestroDocumentsService.listarDocumentos(siniestroId);
      if (res.success) {
        setItems(res.data || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siniestroId]);

  const onDropZone = useCallback(async (acceptedFiles: File[]) => {
    if (!acceptedFiles || acceptedFiles.length === 0) return;
    setSelectedFiles(acceptedFiles);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onDropZone,
    multiple: true,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/csv': ['.csv']
    }
  });

  const onDelete = async (doc: any) => {
    try {
      await siniestroDocumentsService.eliminarDocumento(siniestroId, { path: doc.path });
      await load();
    } catch {}
  };

  const visibleItems = useMemo(() => {
    const s = search.trim().toLowerCase();
    let list = items.filter((d) => {
      const matchesSearch = !s || (d.name?.toLowerCase().includes(s) || d.contentType?.toLowerCase().includes(s));
      const matchesType = !typeFilter || (d.type || 'otro') === typeFilter;
      return matchesSearch && matchesType;
    });
    return list;
  }, [items, search, typeFilter]);

  const typesOptions = useMemo(() => {
    const base = ['reporte', 'evidencia', 'peritaje', 'factura', 'comprobante', 'dictamen', 'otro'];
    const present = new Set<string>(items.map((d) => (d.type || 'otro')));
    return [''].concat(Array.from(new Set([...base, ...present])));
  }, [items]);

  return (
    <Card>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h5 className="text-lg font-semibold text-gray-900 dark:text-white">
            Documentos del Siniestro
          </h5>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Archivos adjuntos y evidencias
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            color="gray" 
            size="sm" 
            onClick={() => load()}
            disabled={loading}
          >
            <IconRefresh className="w-4 h-4 mr-2" />
            Actualizar
          </Button>
          <HeroButton icon="solar:cloud-upload-bold" onClick={() => { setSelectedFiles([]); setShowModal(true); }} size="sm">Subir archivos</HeroButton>
        </div>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <TextInput
            placeholder="Buscar archivos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div>
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            {typesOptions.map((t, i) => (
              <option key={i} value={t}>{t ? t.replace('_', ' ') : 'Todos los tipos'}</option>
            ))}
          </Select>
        </div>
        <div>
          <Button 
            color="gray" 
            size="sm" 
            onClick={() => { setSearch(''); setTypeFilter(''); }}
            className="w-full"
          >
            Limpiar filtros
          </Button>
        </div>
      </div>

      {/* Tabla */}
      <div className="border rounded-md border-ld overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 flex items-center justify-center text-gray-600">
              <Spinner className="mr-3" />
              <span>Cargando documentos...</span>
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p className="text-lg mb-2">No hay documentos adjuntos</p>
              <p className="text-sm">Comienza subiendo evidencias o documentos del siniestro</p>
            </div>
          ) : (
            <Table hoverable>
              <Table.Head>
                <Table.HeadCell className="text-base font-semibold py-3">Nombre</Table.HeadCell>
                <Table.HeadCell className="text-base font-semibold py-3">Tipo</Table.HeadCell>
                <Table.HeadCell className="text-base font-semibold py-3">Tamaño</Table.HeadCell>
                <Table.HeadCell className="text-base font-semibold py-3">Fecha</Table.HeadCell>
                <Table.HeadCell className="text-base font-semibold py-3">Acciones</Table.HeadCell>
              </Table.Head>
              <Table.Body>
                {visibleItems.map((doc, idx) => (
                  <Table.Row key={idx}>
                    <Table.Cell>
                      <div className="max-w-xs truncate" title={doc.name}>
                        {doc.name}
                      </div>
                      <div className="text-xs text-gray-500">{doc.contentType || 'Sin tipo MIME'}</div>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge color="info" className="text-xs">
                        {(doc.type || 'otro').replace('_', ' ')}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell className="text-sm text-gray-600">
                      {formatSize(doc.size)}
                    </Table.Cell>
                    <Table.Cell className="text-sm text-gray-600">
                      {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : '-'}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-2">
                        <Button
                          color="blue"
                          size="xs"
                          disabled={openingPath === doc.path}
                          onClick={async () => {
                            try {
                              setOpeningPath(doc.path);
                              const url = await siniestroDocumentsService.getSignedUrl(siniestroId, { path: doc.path, name: doc.name });
                              window.open(url, '_blank');
                            } catch {}
                            finally {
                              setOpeningPath(null);
                            }
                          }}
                        >
                          {openingPath === doc.path ? (
                            <Spinner size="sm" />
                          ) : (
                            <IconEye className="w-4 h-4" />
                          )}
                        </Button>
                        <Button color="red" size="xs" onClick={() => { setDocToDelete(doc); setConfirmOpen(true); }}>
                          <IconTrash className="w-4 h-4" />
                        </Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
        {visibleItems.length} archivo(s)
      </div>

      {/* Modal de confirmación */}
      <Modal show={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <Modal.Header>Eliminar documento</Modal.Header>
        <Modal.Body>
          <p>¿Estás seguro de eliminar <strong>"{docToDelete?.name}"</strong>?</p>
          <p className="text-sm text-gray-500 mt-2">Esta acción no se puede deshacer.</p>
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
          <Button color="red" onClick={async () => {
            if (!docToDelete) return;
            await onDelete(docToDelete);
            setConfirmOpen(false);
            setDocToDelete(null);
          }}>Eliminar</Button>
        </Modal.Footer>
      </Modal>

      {/* Modal para subir archivo */}
      <Modal show={showModal} onClose={() => setShowModal(false)}>
        <Modal.Header>Subir documento</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Tipo de documento</label>
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
            <div>
              <label className="block text-sm font-medium mb-2">Seleccionar archivo(s)</label>
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
                  {isDragActive ? 'Suelta los archivos aquí' : 'Arrastra archivos o haz clic para seleccionar'}
                </p>
                <p className="text-xs text-gray-500 mt-1">PDF, imágenes, Office, CSV • Máx 20MB</p>
              </div>
              {selectedFiles.length > 0 && (
                <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm font-medium mb-2">{selectedFiles.length} archivo(s) seleccionado(s):</p>
                  <div className="space-y-1 max-h-24 overflow-auto">
                    {selectedFiles.map((f, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="truncate max-w-[200px]" title={f.name}>{f.name}</span>
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
          <Button color="gray" onClick={() => setShowModal(false)}>Cancelar</Button>
          <Button
            color="blue"
            disabled={selectedFiles.length === 0 || uploading}
            onClick={async () => {
              try {
                if (selectedFiles.length === 0) return;
                setUploading(true);
                setProgress({ percent: 0, text: 'Preparando subida...' });
                await siniestroDocumentsService.subirDocumento(
                  siniestroId,
                  selectedFiles,
                  { type: docType },
                  ({ percent, index, count, file }) => {
                    const label = count && count > 1 ? `(${index}/${count})` : '';
                    setProgress({ percent, text: `Subiendo ${file?.name || ''} ${label} - ${percent}%` });
                  }
                );
                setSelectedFiles([]);
                await load();
              } finally {
                setUploading(false);
                setProgress(null);
                setShowModal(false);
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
        </Modal.Footer>
      </Modal>
    </Card>
  );
};

export default ArchivosSiniestro;
