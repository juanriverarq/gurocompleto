import React, { useState } from 'react';
import {
  Card,
  Button,
  Alert,
  Spinner,
  Table,
  Modal,
  TextInput,
  Label,
  Badge,
  Checkbox,
} from 'flowbite-react';
import { Icon } from '@iconify/react';
import HeroButton from 'src/components/HeroButton';
import { useAseguradoras } from 'src/hooks/useAdminCrudApi';
import type { Aseguradora as AseguradoraType, AseguradoraCreate } from 'src/types/admin';
import { COLOMBIA_INSURERS } from 'src/data/colombia_insurers';
import { PermissionGate } from 'src/components/PermissionGate';
import { useAutoTour } from 'src/components/GuroTour/useAutoTour';
import { TOUR_ASEGURADORAS } from 'src/components/GuroTour/tourConfigs';
import { saasApi } from 'src/services/saasApi';
import { Input } from 'src/components/shadcn-ui/Default-Ui/input';

const Aseguradoras = () => {
  useAutoTour(TOUR_ASEGURADORAS);
  const { aseguradoras, loading, error, createAseguradora, updateAseguradora, deleteAseguradora } =
    useAseguradoras();
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<AseguradoraType | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<AseguradoraCreate>({
    nombre: '',
    cuit: '',
    email: '',
    direccion: '',
    telefono: '',
    cuenta_bancaria: '',
    link_pago: '',
    codigo_intermediario: '',
    retencion: 0,
    iva: 0,
    retencion_iva: 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formMessage, setFormMessage] = useState<string | null>(null);

  // Nuevo flujo: creación en blanco o por plantilla
  const [creationMode, setCreationMode] = useState<'blank' | 'template' | null>(null);
  const [templateSearch, setTemplateSearch] = useState('');
  const [selectedTemplates, setSelectedTemplates] = useState<Record<string, boolean>>({});
  const [isBulkCreating, setIsBulkCreating] = useState(false);
  const [bulkResult, setBulkResult] = useState<{
    success: number;
    failed: number;
    messages: string[];
  } | null>(null);

  // Estado para selección masiva de eliminación
  const [selectedForDelete, setSelectedForDelete] = useState<Set<string>>(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkDeleteConfirmText, setBulkDeleteConfirmText] = useState('');
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const normalize = (s: string) =>
    (s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  const existingByName = new Set(aseguradoras.map((a) => normalize(a.nombre)));
  const existingByCuit = new Set(
    aseguradoras.map((a) =>
      String(a.cuit || '')
        .replace(/\D/g, '')
        .trim(),
    ),
  );

  const filteredTemplates = COLOMBIA_INSURERS.filter((t) => {
    const q = normalize(templateSearch);
    return (
      !q || normalize(t.nombre).includes(q) || String(t.cuit || '').includes(templateSearch.trim())
    );
  }).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  const selectable = (t: AseguradoraCreate) => {
    const nameExists = existingByName.has(normalize(t.nombre));
    const cuitNum = String(t.cuit || '')
      .replace(/\D/g, '')
      .trim();
    const cuitExists = cuitNum && existingByCuit.has(cuitNum);
    return !(nameExists || cuitExists);
  };

  const toggleSelect = (nombre: string, value?: boolean) => {
    setSelectedTemplates((prev) => {
      const next = { ...prev };
      const v = value ?? !prev[nombre];
      if (v) next[nombre] = true;
      else delete next[nombre];
      return next;
    });
  };

  const selectAllVisible = () => {
    const next: Record<string, boolean> = {};
    filteredTemplates.forEach((t) => {
      if (selectable(t)) next[t.nombre] = true;
    });
    setSelectedTemplates(next);
  };

  const clearSelection = () => setSelectedTemplates({});

  const handleBulkAddFromTemplates = async () => {
    const names = Object.keys(selectedTemplates);
    if (names.length === 0) return;
    setIsBulkCreating(true);
    setBulkResult(null);
    const items = COLOMBIA_INSURERS.filter((t) => names.includes(t.nombre)).filter((t) =>
      selectable(t),
    );
    const results = await Promise.allSettled(items.map((item) => createAseguradora(item)));
    const success = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - success;
    const messages: string[] = [];
    if (failed > 0)
      messages.push(`${failed} no se pudieron crear (posibles duplicados o validación).`);
    setBulkResult({ success, failed, messages });
    setIsBulkCreating(false);
    if (success > 0) {
      // mantener seleccionado solo los fallidos
      const failedNames = results
        .map((r, idx) => ({ r, name: items[idx].nombre }))
        .filter((x) => x.r.status === 'rejected')
        .map((x) => x.name);
      const next: Record<string, boolean> = {};
      failedNames.forEach((n) => {
        next[n] = true;
      });
      setSelectedTemplates(next);
    }
  };

  const handleCreate = () => {
    setSelectedItem(null);
    setIsEditing(false);
    setCreationMode(null);
    setTemplateSearch('');
    setSelectedTemplates({});
    setBulkResult(null);
    setIsBulkCreating(false);
    setFormData({
      nombre: '',
      cuit: '',
      email: '',
      direccion: '',
      telefono: '',
      cuenta_bancaria: '',
      link_pago: '',
      codigo_intermediario: '',
      retencion: 0,
      iva: 0,
      retencion_iva: 0,
    });
    setShowModal(true);
  };

  const handleEdit = (item: AseguradoraType) => {
    setSelectedItem(item);
    setIsEditing(true);
    setCreationMode('blank');
    setFormData({
      nombre: item.nombre || '',
      cuit: item.cuit || '',
      email: item.email || '',
      direccion: item.direccion || '',
      telefono: item.telefono || '',
      cuenta_bancaria: item.cuenta_bancaria || '',
      link_pago: item.link_pago || '',
      codigo_intermediario: item.codigo_intermediario || '',
      retencion: item.retencion || 0,
      iva: item.iva || 0,
      retencion_iva: item.retencion_iva || 0,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre.trim()) return;

    try {
      setIsSubmitting(true);
      setFormErrors({});
      setFormMessage(null);
      if (isEditing && selectedItem) {
        await updateAseguradora(selectedItem.id, formData);
      } else {
        await createAseguradora(formData);
      }
      setShowModal(false);
    } catch (error) {
      const err: any = error;
      if (err?.status === 422 && err?.errors) {
        const mapped: Record<string, string> = {};
        Object.entries(err.errors).forEach(([field, msgs]: any) => {
          mapped[field] = Array.isArray(msgs) ? msgs[0] : String(msgs);
        });
        setFormErrors(mapped);
        setFormMessage(err.message || 'Error de validación');
      } else {
        setFormMessage(err?.message || 'Error al guardar');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás seguro de que deseas eliminar esta aseguradora?')) {
      try {
        await deleteAseguradora(id);
      } catch (error) {}
    }
  };

  // Funciones para selección masiva
  const toggleSelectForDelete = (id: string) => {
    setSelectedForDelete((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllForDelete = () => {
    if (selectedForDelete.size === aseguradoras.length) {
      setSelectedForDelete(new Set());
    } else {
      setSelectedForDelete(new Set(aseguradoras.map((a) => a.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (bulkDeleteConfirmText !== 'ELIMINAR') return;
    
    try {
      setIsBulkDeleting(true);
      const ids = Array.from(selectedForDelete);
      const response = await saasApi.bulkDeleteAseguradoras({ ids });
      
      if (response.success) {
        alert(`Se eliminaron ${(response.data as any)?.deleted_count || ids.length} aseguradoras`);
        setShowBulkDeleteModal(false);
        setBulkDeleteConfirmText('');
        setSelectedForDelete(new Set());
        // Recargar la lista (el hook debería actualizarse automáticamente)
        window.location.reload();
      }
    } catch (error: any) {
      alert(error.message || 'Error al eliminar');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleBulkDeleteAll = async () => {
    if (bulkDeleteConfirmText !== 'ELIMINAR TODAS') return;
    
    try {
      setIsBulkDeleting(true);
      const response = await saasApi.bulkDeleteAseguradoras({ delete_all: true });
      
      if (response.success) {
        alert(`Se eliminaron ${(response.data as any)?.deleted_count || 0} aseguradoras`);
        setShowBulkDeleteModal(false);
        setBulkDeleteConfirmText('');
        setSelectedForDelete(new Set());
        window.location.reload();
      }
    } catch (error: any) {
      alert(error.message || 'Error al eliminar');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  return (
    <PermissionGate
      route="/apps/admin/aseguradoras"
      action="ver"
      fallback={
        <div className="flex justify-center items-center h-64">
          <Alert color="warning">No tienes permisos para ver Aseguradoras.</Alert>
        </div>
      }
    >
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 data-tour="aseguradoras-page-title" className="text-2xl font-bold text-dark dark:text-white mb-2">
              Gestión de Aseguradoras
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Administra las aseguradoras con las que trabajas.
            </p>
          </div>
          <div className="flex gap-2">
            {selectedForDelete.size > 0 && (
              <PermissionGate route="/apps/admin/aseguradoras" action="eliminar">
                <Button color="failure" onClick={() => setShowBulkDeleteModal(true)} className="flex items-center">
                  <Icon icon="solar:trash-bin-trash-bold" className="w-4 h-4 mr-2" />
                  Eliminar ({selectedForDelete.size})
                </Button>
              </PermissionGate>
            )}
            {aseguradoras.length > 0 && selectedForDelete.size === 0 && (
              <PermissionGate route="/apps/admin/aseguradoras" action="eliminar">
                <Button color="light" onClick={() => setShowBulkDeleteModal(true)} className="flex items-center">
                  <Icon icon="solar:trash-bin-trash-bold" className="w-4 h-4 mr-2" />
                  Eliminar Todas
                </Button>
              </PermissionGate>
            )}
            <PermissionGate route="/apps/admin/aseguradoras" action="crear">
              <span data-tour="aseguradoras-create-btn"><HeroButton icon="solar:shield-plus-bold" onClick={handleCreate}>Nueva Aseguradora</HeroButton></span>
            </PermissionGate>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      {error && (
        <Alert color="failure" className="mb-6">
          <Icon icon="solar:danger-circle-bold" className="w-4 h-4 mr-2" />
          {error}
        </Alert>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Spinner size="xl" />
        </div>
      ) : aseguradoras.length === 0 ? (
        <Card>
          <div className="text-center py-12 px-6">
            <Icon
              icon="solar:shield-check-bold-duotone"
              className="w-16 h-16 text-gray-400 mx-auto mb-4"
            />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No hay aseguradoras definidas
            </h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Comienza agregando aseguradoras para trabajar con ellas.
            </p>
            <div className="flex justify-center">
              <PermissionGate route="/apps/admin/aseguradoras" action="crear">
                <HeroButton icon="solar:shield-plus-bold" onClick={handleCreate} size="lg">Crear Primera Aseguradora</HeroButton>
              </PermissionGate>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="guro-table-wrap">
            <table className="guro-table">
              <thead>
                <tr>
                  <th className="w-10">
                    <Checkbox
                      checked={selectedForDelete.size === aseguradoras.length && aseguradoras.length > 0}
                      onChange={selectAllForDelete}
                    />
                  </th>
                  <th>Aseguradora</th>
                  <th>NIT</th>
                  <th>Email</th>
                  <th>Contactos</th>
                  <th>Porcentajes</th>
                  <th>Fecha de Creación</th>
                  <th className="sticky-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {aseguradoras.map((item) => (
                  <tr
                    key={item.id}
                    className={`group ${selectedForDelete.has(item.id) ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                  >
                    <td>
                      <Checkbox
                        checked={selectedForDelete.has(item.id)}
                        onChange={() => toggleSelectForDelete(item.id)}
                      />
                    </td>
                    <td className="whitespace-nowrap font-medium text-gray-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <Icon icon="solar:shield-check-bold" className="w-5 h-5 text-blue-600" />
                        <div>
                          <div className="font-medium">{item.nombre}</div>
                          <div className="text-xs text-gray-500">
                            Código: {item.codigo_intermediario}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="text-gray-500 dark:text-gray-400">
                      {item.cuit}
                    </td>
                    <td className="text-gray-500 dark:text-gray-400">
                      {item.email}
                    </td>
                    <td className="text-gray-500 dark:text-gray-400">
                      <div className="text-sm">
                        <div>📞 {item.telefono}</div>
                        <div className="text-xs text-gray-400 mt-1 max-w-32 truncate">
                          📍 {item.direccion}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="space-y-1">
                        <Badge color="green" size="sm">
                          IVA: {item.iva}%
                        </Badge>
                        <Badge color="blue" size="sm">
                          Ret: {item.retencion}%
                        </Badge>
                        <Badge color="purple" size="sm">
                          Ret.IVA: {item.retencion_iva}%
                        </Badge>
                      </div>
                    </td>
                    <td className="text-gray-500 dark:text-gray-400">
                      {new Date(item.created_at).toLocaleDateString()}
                    </td>
                    <td className="sticky-right">
                      <div className="flex items-center gap-2">
                        <PermissionGate route="/apps/admin/aseguradoras" action="editar">
                          <Button size="sm" color="gray" onClick={() => handleEdit(item)}>
                            <Icon icon="solar:pen-bold" className="w-4 h-4" />
                          </Button>
                        </PermissionGate>
                        <PermissionGate route="/apps/admin/aseguradoras" action="eliminar">
                          <Button size="sm" color="failure" onClick={() => handleDelete(item.id)}>
                            <Icon icon="solar:trash-bin-trash-bold" className="w-4 h-4" />
                          </Button>
                        </PermissionGate>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal de creación/edición con opción de plantilla */}
      <Modal show={showModal} onClose={() => setShowModal(false)} size="3xl">
        <Modal.Header>
          {isEditing
            ? 'Editar Aseguradora'
            : creationMode === 'template'
            ? 'Agregar aseguradoras por plantilla'
            : creationMode === 'blank'
            ? 'Crear aseguradora'
            : 'Nueva aseguradora'}
        </Modal.Header>
        <form onSubmit={handleSubmit}>
          <Modal.Body className="max-h-[70vh] overflow-y-auto">
            {formMessage && (
              <Alert color="warning" className="mb-3">
                {formMessage}
              </Alert>
            )}

            {/* Paso 0: Elegir modo */}
            {!isEditing && creationMode === null && (
              <div data-tour="aseguradoras-modal-template" className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <Card
                  className="cursor-pointer hover:ring-2 hover:ring-blue-500"
                  onClick={() => setCreationMode('blank')}
                >
                  <div className="flex items-center gap-3">
                    <Icon icon="solar:add-square-bold-duotone" className="w-8 h-8 text-blue-600" />
                    <div>
                      <h3 className="text-lg font-semibold">Crear en blanco</h3>
                      <p className="text-sm text-gray-500">Completa el formulario manualmente.</p>
                    </div>
                  </div>
                </Card>

                <Card
                  className="cursor-pointer hover:ring-2 hover:ring-emerald-500"
                  onClick={() => setCreationMode('template')}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      icon="solar:documents-bold-duotone"
                      className="w-8 h-8 text-emerald-600"
                    />
                    <div>
                      <h3 className="text-lg font-semibold">Por plantilla</h3>
                      <p className="text-sm text-gray-500">
                        Selecciona de la lista de aseguradoras de Colombia.
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* Modo plantilla */}
            {!isEditing && creationMode === 'template' && (
              <div className="space-y-3">
                {bulkResult && (
                  <Alert color={bulkResult.failed === 0 ? 'success' : 'warning'}>
                    <div className="font-medium mb-1">
                      {bulkResult.success} aseguradora(s) creadas.{' '}
                      {bulkResult.failed > 0 ? `${bulkResult.failed} con error.` : ''}
                    </div>
                    <ul className="list-disc pl-5 text-sm">
                      {bulkResult.messages.map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  </Alert>
                )}

                <div className="flex flex-col md:flex-row gap-2 md:items-center">
                  <div className="flex-1">
                    <TextInput
                      placeholder="Buscar por nombre o NIT"
                      value={templateSearch}
                      onChange={(e) => setTemplateSearch(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      color="light"
                      size="sm"
                      onClick={selectAllVisible}
                      disabled={isBulkCreating}
                    >
                      <Icon icon="solar:checklist-minimalistic-bold" className="w-4 h-4 mr-1" />
                      Seleccionar visibles
                    </Button>
                    <Button
                      color="light"
                      size="sm"
                      onClick={clearSelection}
                      disabled={isBulkCreating}
                    >
                      <Icon icon="solar:eraser-bold" className="w-4 h-4 mr-1" />
                      Limpiar
                    </Button>
                  </div>
                </div>

                <div className="text-xs text-gray-500">
                  <span>Total plantillas: {COLOMBIA_INSURERS.length}</span>
                  <span className="mx-2">•</span>
                  <span>Visibles: {filteredTemplates.length}</span>
                </div>

                <div className="max-h-[50vh] overflow-y-auto pr-1">
                  {filteredTemplates.map((t) => {
                    const exists = !selectable(t);
                    const checked = !!selectedTemplates[t.nombre];
                    return (
                      <div
                        key={t.nombre}
                        className="flex items-start gap-3 p-3 border rounded-md mb-2 bg-white dark:bg-gray-800"
                      >
                        <Checkbox
                          className="mt-1"
                          checked={checked}
                          disabled={exists || isBulkCreating}
                          onChange={() => toggleSelect(t.nombre)}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{t.nombre}</span>
                            {exists && (
                              <Badge color="warning" size="sm">
                                Ya existe
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            NIT: {t.cuit || '—'} {t.email ? `• ${t.email}` : ''}{' '}
                            {t.telefono ? `• ${t.telefono}` : ''}
                          </div>
                          {t.direccion && (
                            <div className="text-xs text-gray-500 truncate">Dir: {t.direccion}</div>
                          )}
                          {t.link_pago && (
                            <a
                              href={t.link_pago}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 underline truncate inline-block"
                              title={t.link_pago}
                            >
                              Pago: {t.link_pago}
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Modo en blanco o edición: formulario en lista única */}
            {(isEditing || creationMode === 'blank') && (
              <div className="space-y-6">
                {/* Datos de la aseguradora */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Icon icon="solar:shield-check-bold" className="w-5 h-5 text-blue-600" />
                    Datos de la aseguradora
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="nombre" value="Nombre *" />
                      <TextInput
                        id="nombre"
                        type="text"
                        placeholder="Nombre"
                        value={formData.nombre}
                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                        required
                      />
                      {formErrors['nombre'] && (
                        <div className="text-xs text-red-600 mt-1">{formErrors['nombre']}</div>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="cuit" value="NIT *" />
                      <TextInput
                        id="cuit"
                        type="text"
                        placeholder="NIT"
                        value={formData.cuit}
                        onChange={(e) => setFormData({ ...formData, cuit: e.target.value })}
                        required
                      />
                      {formErrors['cuit'] && (
                        <div className="text-xs text-red-600 mt-1">{formErrors['cuit']}</div>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="email" value="Email" />
                      <TextInput
                        id="email"
                        type="email"
                        placeholder="correo@ejemplo.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                      {formErrors['email'] && (
                        <div className="text-xs text-red-600 mt-1">{formErrors['email']}</div>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="telefono" value="Teléfono" />
                      <TextInput
                        id="telefono"
                        type="tel"
                        placeholder="Número de teléfono"
                        value={formData.telefono}
                        onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                      />
                      {formErrors['telefono'] && (
                        <div className="text-xs text-red-600 mt-1">{formErrors['telefono']}</div>
                      )}
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="direccion" value="Dirección" />
                      <TextInput
                        id="direccion"
                        type="text"
                        placeholder="Dirección"
                        value={formData.direccion}
                        onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                      />
                      {formErrors['direccion'] && (
                        <div className="text-xs text-red-600 mt-1">{formErrors['direccion']}</div>
                      )}
                    </div>
                  </div>
                </div>

                <hr className="border-gray-200 dark:border-gray-700" />

                {/* Información bancaria y código */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Icon icon="solar:wallet-bold" className="w-5 h-5 text-emerald-600" />
                    Información bancaria
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="cuenta_bancaria" value="Cuenta Bancaria" />
                      <TextInput
                        id="cuenta_bancaria"
                        type="text"
                        placeholder="Número de cuenta bancaria"
                        value={formData.cuenta_bancaria}
                        onChange={(e) =>
                          setFormData({ ...formData, cuenta_bancaria: e.target.value })
                        }
                      />
                      {formErrors['cuenta_bancaria'] && (
                        <div className="text-xs text-red-600 mt-1">
                          {formErrors['cuenta_bancaria']}
                        </div>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="link_pago" value="Link de pago" />
                      <TextInput
                        id="link_pago"
                        type="url"
                        placeholder="www.linkdepago.com"
                        value={formData.link_pago}
                        onChange={(e) => setFormData({ ...formData, link_pago: e.target.value })}
                      />
                      {formErrors['link_pago'] && (
                        <div className="text-xs text-red-600 mt-1">{formErrors['link_pago']}</div>
                      )}
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="codigo_intermediario" value="Código intermediario" />
                      <TextInput
                        id="codigo_intermediario"
                        type="text"
                        placeholder="Código intermediario"
                        value={formData.codigo_intermediario}
                        onChange={(e) =>
                          setFormData({ ...formData, codigo_intermediario: e.target.value })
                        }
                      />
                      {formErrors['codigo_intermediario'] && (
                        <div className="text-xs text-red-600 mt-1">
                          {formErrors['codigo_intermediario']}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <hr className="border-gray-200 dark:border-gray-700" />

                {/* Retenciones */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Icon icon="solar:calculator-bold" className="w-5 h-5 text-purple-600" />
                    Retenciones
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="retencion" value="Retención" />
                      <div className="relative">
                        <TextInput
                          id="retencion"
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          placeholder="0"
                          value={formData.retencion !== undefined && formData.retencion !== null ? formData.retencion : ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData({ ...formData, retencion: val === '' ? 0 : parseFloat(val) });
                          }}
                        />
                        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                          %
                        </span>
                      </div>
                      {formErrors['retencion'] && (
                        <div className="text-xs text-red-600 mt-1">{formErrors['retencion']}</div>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="iva" value="IVA" />
                      <div className="relative">
                        <TextInput
                          id="iva"
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          placeholder="0"
                          value={formData.iva !== undefined && formData.iva !== null ? formData.iva : ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData({ ...formData, iva: val === '' ? 0 : parseFloat(val) });
                          }}
                        />
                        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                          %
                        </span>
                      </div>
                      {formErrors['iva'] && (
                        <div className="text-xs text-red-600 mt-1">{formErrors['iva']}</div>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="retencion_iva" value="Retención IVA" />
                      <div className="relative">
                        <TextInput
                          id="retencion_iva"
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          placeholder="0"
                          value={formData.retencion_iva !== undefined && formData.retencion_iva !== null ? formData.retencion_iva : ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData({ ...formData, retencion_iva: val === '' ? 0 : parseFloat(val) });
                          }}
                        />
                        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                          %
                        </span>
                      </div>
                      {formErrors['retencion_iva'] && (
                        <div className="text-xs text-red-600 mt-1">
                          {formErrors['retencion_iva']}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Modal.Body>
          <Modal.Footer className="sticky bottom-0 bg-white dark:bg-gray-900 border-t pt-3">
            <div className="flex gap-2 ml-auto">
              <Button
                color="gray"
                onClick={() => setShowModal(false)}
                disabled={isSubmitting || isBulkCreating}
              >
                Cancelar
              </Button>

              {(isEditing || creationMode === 'blank') &&
                (isEditing ? (
                  <PermissionGate route="/apps/admin/aseguradoras" action="editar">
                    <Button
                      type="submit"
                      disabled={isSubmitting || !formData.nombre.trim() || !formData.cuit.trim()}
                    >
                      {isSubmitting ? (
                        <>
                          <Spinner size="sm" className="mr-2" />
                          Guardando...
                        </>
                      ) : (
                        'Guardar'
                      )}
                    </Button>
                  </PermissionGate>
                ) : (
                  <PermissionGate route="/apps/admin/aseguradoras" action="crear">
                    <Button
                      type="submit"
                      disabled={isSubmitting || !formData.nombre.trim() || !formData.cuit.trim()}
                    >
                      {isSubmitting ? (
                        <>
                          <Spinner size="sm" className="mr-2" />
                          Guardando...
                        </>
                      ) : (
                        'Crear'
                      )}
                    </Button>
                  </PermissionGate>
                ))}

              {!isEditing && creationMode === 'template' && (
                <PermissionGate route="/apps/admin/aseguradoras" action="crear">
                  <Button
                    type="button"
                    onClick={handleBulkAddFromTemplates}
                    disabled={isBulkCreating || Object.keys(selectedTemplates).length === 0}
                  >
                    {isBulkCreating ? (
                      <>
                        <Spinner size="sm" className="mr-2" />
                        Agregando...
                      </>
                    ) : (
                      <>
                        <Icon icon="solar:add-circle-bold" className="w-4 h-4 mr-2" />
                        Agregar seleccionadas ({Object.keys(selectedTemplates).length})
                      </>
                    )}
                  </Button>
                </PermissionGate>
              )}
            </div>
          </Modal.Footer>
        </form>
      </Modal>

      {/* Modal de confirmación de borrado masivo */}
      <Modal 
        show={showBulkDeleteModal} 
        onClose={() => {
          setShowBulkDeleteModal(false);
          setBulkDeleteConfirmText('');
        }} 
        size="md"
      >
        <Modal.Header>
          <div className="flex items-center gap-2 text-red-600">
            <Icon icon="solar:danger-triangle-bold" className="w-6 h-6" />
            {selectedForDelete.size > 0 
              ? `Eliminar ${selectedForDelete.size} aseguradora(s)` 
              : 'Eliminar TODAS las aseguradoras'}
          </div>
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-red-700 dark:text-red-400 font-medium">
                ⚠️ {selectedForDelete.size > 0 
                  ? `Se eliminarán ${selectedForDelete.size} aseguradora(s) seleccionada(s).`
                  : `Se eliminarán TODAS las ${aseguradoras.length} aseguradoras.`}
              </p>
              <p className="text-red-600 dark:text-red-500 text-sm mt-2">
                Esta acción NO se puede deshacer.
              </p>
            </div>
            
            <div>
              <Label className="text-gray-700 dark:text-gray-300">
                Para confirmar, escribe <strong>{selectedForDelete.size > 0 ? 'ELIMINAR' : 'ELIMINAR TODAS'}</strong>:
              </Label>
              <Input
                type="text"
                value={bulkDeleteConfirmText}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBulkDeleteConfirmText(e.target.value)}
                placeholder={selectedForDelete.size > 0 ? 'ELIMINAR' : 'ELIMINAR TODAS'}
                className="mt-2"
              />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button 
            color="failure" 
            onClick={selectedForDelete.size > 0 ? handleBulkDelete : handleBulkDeleteAll}
            disabled={
              (selectedForDelete.size > 0 && bulkDeleteConfirmText !== 'ELIMINAR') ||
              (selectedForDelete.size === 0 && bulkDeleteConfirmText !== 'ELIMINAR TODAS') ||
              isBulkDeleting
            }
          >
            {isBulkDeleting ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Eliminando...
              </>
            ) : (
              <>
                <Icon icon="solar:trash-bin-trash-bold" className="w-4 h-4 mr-2" />
                Confirmar eliminación
              </>
            )}
          </Button>
          <Button 
            color="gray" 
            onClick={() => {
              setShowBulkDeleteModal(false);
              setBulkDeleteConfirmText('');
            }}
          >
            Cancelar
          </Button>
        </Modal.Footer>
      </Modal>
    </PermissionGate>
  );
};

export default Aseguradoras;
