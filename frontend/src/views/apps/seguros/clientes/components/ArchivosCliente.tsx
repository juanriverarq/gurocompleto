import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Card, Button, Spinner, Badge, Tooltip, Modal, Select, Table, TextInput, Dropdown } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { useDropzone } from 'react-dropzone';
import { clienteDocumentsService } from 'src/services/clienteDocumentsService';

type Props = { clienteId: string };

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

const ArchivosCliente: React.FC<Props> = ({ clienteId }) => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [docType, setDocType] = useState<string>('documento_identidad');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<{ percent: number; text: string } | null>(null);
  const [openingPath, setOpeningPath] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'fecha' | 'nombre' | 'tamaño'>('fecha');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<any | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const res = await clienteDocumentsService.listarDocumentos(clienteId);
      if (res.success) setItems(res.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [clienteId]);

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
      'text/csv': ['.csv']
    }
  });

  const onDelete = async (doc: any) => {
    await clienteDocumentsService.eliminarDocumento(clienteId, { path: doc.path });
    await load();
  };

  const visibleItems = useMemo(() => {
    const s = search.trim().toLowerCase();
    let list = items.filter((d) => {
      const matchesSearch = !s || (d.name?.toLowerCase().includes(s) || d.contentType?.toLowerCase().includes(s));
      const matchesType = !typeFilter || (d.type || 'otro') === typeFilter;
      return matchesSearch && matchesType;
    });
    list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'fecha') {
        const da = a.uploaded_at ? new Date(a.uploaded_at).getTime() : 0;
        const db = b.uploaded_at ? new Date(b.uploaded_at).getTime() : 0;
        cmp = da - db;
      } else if (sortBy === 'nombre') {
        cmp = (a.name || '').localeCompare(b.name || '');
      } else {
        cmp = (a.size || 0) - (b.size || 0);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [items, search, typeFilter, sortBy, sortDir]);

  const typesOptions = useMemo(() => {
    const base = ['documento_identidad', 'soporte_ingresos', 'contrato', 'consentimiento', 'cancelacion', 'otros'];
    const present = new Set<string>(items.map((d) => (d.type || 'otro')));
    return [''].concat(Array.from(new Set([...base, ...present])));
  }, [items]);

  return (
    <Card>
      <div className="p-4 space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-[240px] flex-1">
            <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre o tipo MIME" />
          </div>
          <div className="flex items-center gap-2">
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              {typesOptions.map((t, i) => (
                <option key={i} value={t}>{t ? t.replace('_', ' ') : 'Todos los tipos'}</option>
              ))}
            </Select>
            <Dropdown label={`Orden: ${sortBy} · ${sortDir === 'asc' ? '↑' : '↓'}`} inline>
              <Dropdown.Item onClick={() => setSortBy('fecha')}>Por fecha</Dropdown.Item>
              <Dropdown.Item onClick={() => setSortBy('nombre')}>Por nombre</Dropdown.Item>
              <Dropdown.Item onClick={() => setSortBy('tamaño')}>Por tamaño</Dropdown.Item>
              <Dropdown.Divider />
              <Dropdown.Item onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}>Dirección: {sortDir === 'asc' ? 'Ascendente' : 'Descendente'}</Dropdown.Item>
            </Dropdown>
            <Tooltip content="Actualizar">
              <Button color="light" size="sm" onClick={() => load()} aria-label="Actualizar">
                <Icon icon="solar:refresh-bold" className="w-5 h-5" />
              </Button>
            </Tooltip>
            <Button color="primary" onClick={() => { setSelectedFiles([]); setShowModal(true); }}>
              <span className="flex items-center gap-1">
                <Icon icon="solar:cloud-upload-bold" className="w-4 h-4" />
                <span>Subir archivos</span>
              </span>
            </Button>
          </div>
        </div>

        <div className="text-xs text-gray-500">{visibleItems.length} archivo(s)</div>

        {loading ? (
          <div className="flex items-center py-6 text-gray-500">
            <Spinner />
            <span className="ml-2">Cargando...</span>
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="text-sm text-gray-500 py-4">No hay archivos adjuntos aún.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table hoverable>
              <Table.Head>
                <Table.HeadCell>Nombre</Table.HeadCell>
                <Table.HeadCell>Tipo</Table.HeadCell>
                <Table.HeadCell>Tamaño</Table.HeadCell>
                <Table.HeadCell>Contenido</Table.HeadCell>
                <Table.HeadCell>Fecha</Table.HeadCell>
                <Table.HeadCell>Acciones</Table.HeadCell>
              </Table.Head>
              <Table.Body>
                {visibleItems.map((doc, idx) => (
                  <Table.Row key={idx}>
                    <Table.Cell className="max-w-[260px] truncate" title={doc.name}>{doc.name}</Table.Cell>
                    <Table.Cell>
                      <Badge color="info" className="rounded-[6px]">{(doc.type || 'otro').toString()}</Badge>
                    </Table.Cell>
                    <Table.Cell>{formatSize(doc.size)}</Table.Cell>
                    <Table.Cell>{doc.contentType || '-'}</Table.Cell>
                    <Table.Cell>{doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : '-'}</Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-2">
                        <Button
                          color="primary"
                          size="xs"
                          disabled={openingPath === doc.path}
                          onClick={async () => {
                            try {
                              setOpeningPath(doc.path);
                              const url = await clienteDocumentsService.getSignedUrl(clienteId, { path: doc.path, name: doc.name });
                              window.open(url, '_blank');
                            } catch {}
                            finally {
                              setOpeningPath(null);
                            }
                          }}
                        >
                          {openingPath === doc.path ? (
                            <span className="flex items-center">
                              <Spinner size="sm" />
                              <span className="ml-1">Abriendo...</span>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <Icon icon="solar:eye-bold" className="w-4 h-4" />
                              <span>Ver</span>
                            </span>
                          )}
                        </Button>
                        <Button color="failure" size="xs" onClick={() => { setDocToDelete(doc); setConfirmOpen(true); }}>
                          <span className="flex items-center gap-1">
                            <Icon icon="solar:trash-bin-trash-bold" className="w-4 h-4" />
                            <span>Eliminar</span>
                          </span>
                        </Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
        )}
      </div>

      <Modal show={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <Modal.Header>Eliminar documento</Modal.Header>
        <Modal.Body>
          <div className="text-sm">¿Estás seguro de eliminar "{docToDelete?.name}"? Esta acción no se puede deshacer.</div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="light" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
          <Button color="failure" onClick={async () => { if (!docToDelete) return; await onDelete(docToDelete); setConfirmOpen(false); setDocToDelete(null); }}>Eliminar</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showModal} onClose={() => setShowModal(false)}>
        <Modal.Header>Subir documento</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Tipo de documento</label>
              <Select value={docType} onChange={(e) => setDocType(e.target.value)}>
                <option value="documento_identidad">Documento de identidad</option>
                <option value="cedula">Cédula</option>
                <option value="rut">RUT</option>
                <option value="camara_comercio">Cámara de Comercio</option>
                <option value="estados_financieros">Estados Financieros</option>
                <option value="sarlaft">SARLAFT</option>
                <option value="matricula">Matrícula</option>
                <option value="factura">Factura</option>
                <option value="soat">SOAT</option>
                <option value="poliza">Póliza</option>
                <option value="carta_estadia">Carta de Estadía</option>
                <option value="carta_no_siniestro">Carta de No Siniestro</option>
                <option value="soporte_ingresos">Soporte de ingresos</option>
                <option value="contrato">Contrato</option>
                <option value="consentimiento">Consentimiento</option>
                <option value="cancelacion">Cancelación</option>
                <option value="otros">Otros</option>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Seleccionar archivo(s)</label>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all duration-300 ${
                  isDragActive ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-gray-300 hover:border-primary hover:bg-gray-50'
                }`}
              >
                <input {...getInputProps()} />
                <Icon icon="solar:cloud-upload-bold-duotone" className="mx-auto mb-2 w-8 h-8 text-gray-400" />
                <p className="text-sm font-medium text-gray-900">{isDragActive ? 'Suelta los archivos aquí' : 'Arrastra archivos aquí'}</p>
                <p className="text-xs text-gray-500 mt-1">o haz clic para seleccionar</p>
                <p className="text-[10px] text-gray-400 mt-1">PDF, imágenes, Office, CSV • Máx 20MB</p>
              </div>
              {selectedFiles.length > 0 && (
                <div className="mt-3">
                  <div className="font-medium text-sm mb-2">Archivos seleccionados:</div>
                  <ul className="space-y-1 max-h-40 overflow-auto">
                    {selectedFiles.map((f, i) => (
                      <li key={i} className="text-xs text-gray-700 flex justify-between">
                        <span className="truncate max-w-[280px]" title={f.name}>{f.name}</span>
                        <span className="text-gray-500">{formatSize(f.size)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="light" onClick={() => setShowModal(false)}>Cancelar</Button>
          <Button
            disabled={selectedFiles.length === 0 || uploading}
            onClick={async () => {
              try {
                if (selectedFiles.length === 0) return;
                setUploading(true);
                setProgress({ percent: 0, text: 'Preparando subida...' });
                await clienteDocumentsService.subirDocumento(
                  clienteId,
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
            {uploading ? (progress ? progress.text : 'Subiendo...') : 'Subir'}
          </Button>
        </Modal.Footer>
      </Modal>
    </Card>
  );
};

export default ArchivosCliente;


