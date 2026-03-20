import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Alert,
  Spinner,
  Table,
  Modal,
  TextInput,
  Label,
  Tabs,
  Select,
  ToggleSwitch,
  Badge,
  Checkbox as FlowbiteCheckbox,
} from 'flowbite-react';
import { Checkbox } from 'src/components/shadcn-ui/Default-Ui/checkbox';
import { Icon } from '@iconify/react';
import HeroButton from 'src/components/HeroButton';
import { useRamos, useAseguradoras } from 'src/hooks/useAdminCrudApi';
import type {
  Ramo as RamoType,
  RamoCreate,
  Aseguradora,
  ComisionAseguradora,
} from 'src/types/admin';
import { COLOMBIA_RAMOS } from 'src/data/colombia_ramos';
import { PermissionGate } from 'src/components/PermissionGate';
import { useAutoTour } from 'src/components/GuroTour/useAutoTour';
import { TOUR_RAMOS } from 'src/components/GuroTour/tourConfigs';
import { saasApi } from 'src/services/saasApi';
import { Input } from 'src/components/shadcn-ui/Default-Ui/input';

const Ramos = () => {
  useAutoTour(TOUR_RAMOS);
  const { ramos, loading, error, createRamo, updateRamo, deleteRamo, getRamoPolizasCount } = useRamos();
  const { aseguradoras } = useAseguradoras();
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<RamoType | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<RamoCreate>({
    nombre: '',
    subramo: [],
    calcular_iva_pri_a_pre: false,
    vista_mapa_oportunidad: false,
    comisiones_aseguradoras: [],
  });
  const [subramoInput, setSubramoInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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

  // Estado para eliminación individual con reemplazo
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [ramoToDelete, setRamoToDelete] = useState<RamoType | null>(null);
  const [deletePolizasCount, setDeletePolizasCount] = useState(0);
  const [replacementRamoId, setReplacementRamoId] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

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
  const makeKey = (nombre: string, subramo: string | string[]) => {
    const sub = Array.isArray(subramo) ? subramo.join(',') : (subramo || '');
    return `${normalize(nombre)}|${normalize(sub)}`;
  };

  const existingKeys = new Set(ramos.map((r) => makeKey(r.nombre, r.subramo)));

  const filteredTemplates = COLOMBIA_RAMOS.filter((t) => {
    const q = normalize(templateSearch);
    return (
      !q ||
      makeKey(t.nombre, t.subramo).includes(q) ||
      normalize(t.nombre).includes(q) ||
      normalize(t.subramo).includes(q)
    );
  }).sort(
    (a, b) => a.nombre.localeCompare(b.nombre, 'es') || a.subramo.localeCompare(b.subramo, 'es'),
  );

  const selectable = (t: { nombre: string; subramo: string }) =>
    !existingKeys.has(makeKey(t.nombre, t.subramo));

  const toggleSelect = (key: string, value?: boolean) => {
    setSelectedTemplates((prev) => {
      const next = { ...prev };
      const v = value ?? !prev[key];
      if (v) next[key] = true;
      else delete next[key];
      return next;
    });
  };

  const selectAllVisible = () => {
    const next: Record<string, boolean> = {};
    filteredTemplates.forEach((t) => {
      const key = makeKey(t.nombre, t.subramo);
      if (selectable(t)) next[key] = true;
    });
    setSelectedTemplates(next);
  };

  const clearSelection = () => setSelectedTemplates({});

  const handleBulkAddFromTemplates = async () => {
    const keys = Object.keys(selectedTemplates);
    if (keys.length === 0) return;
    setIsBulkCreating(true);
    setBulkResult(null);
    // Map templates by key for quick lookup
    const mapByKey = new Map(COLOMBIA_RAMOS.map((t) => [makeKey(t.nombre, t.subramo), t]));
    const items = keys
      .map((k) => mapByKey.get(k))
      .filter(Boolean)
      .filter((t: any) => selectable(t as any)) as { nombre: string; subramo: string }[];

    const baseComisiones = (aseguradoras || []).map((aseg) => ({
      aseguradora_id: aseg.id,
      porcentaje_iva: 0,
      porcentaje_comision: 0,
      pri_a_pre_por_defecto: 0,
    }));

    const payloads: RamoCreate[] = items.map((t) => ({
      nombre: t.nombre,
      subramo: t.subramo ? [t.subramo] : [],
      calcular_iva_pri_a_pre: false,
      vista_mapa_oportunidad: false,
      comisiones_aseguradoras: baseComisiones,
    }));

    const results = await Promise.allSettled(payloads.map((p) => createRamo(p)));
    const success = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - success;
    const messages: string[] = [];
    if (failed > 0)
      messages.push(`${failed} no se pudieron crear (posibles duplicados o validación).`);
    setBulkResult({ success, failed, messages });
    setIsBulkCreating(false);

    // Mantener seleccionados solo los que fallaron (si desea reintentar)
    if (failed > 0) {
      const failedKeys = results
        .map((r, idx) => ({ r, key: makeKey(items[idx].nombre, items[idx].subramo) }))
        .filter((x) => x.r.status === 'rejected')
        .map((x) => x.key);
      const next: Record<string, boolean> = {};
      failedKeys.forEach((k) => {
        next[k] = true;
      });
      setSelectedTemplates(next);
    } else {
      setSelectedTemplates({});
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
    setSubramoInput('');
    setFormError(null);
    setFormData({
      nombre: '',
      subramo: [],
      calcular_iva_pri_a_pre: false,
      vista_mapa_oportunidad: false,
      comisiones_aseguradoras: (aseguradoras || []).map((aseg) => ({
        aseguradora_id: aseg.id,
        porcentaje_iva: 0,
        porcentaje_comision: 0,
        pri_a_pre_por_defecto: 0,
      })),
    });
    setShowModal(true);
  };

  const handleEdit = (item: RamoType) => {
    setSelectedItem(item);
    setIsEditing(true);
    setCreationMode('blank');
    setSubramoInput('');
    setFormError(null);
    const sub = Array.isArray(item.subramo) ? item.subramo : (item.subramo ? [item.subramo as any] : []);
    setFormData({
      nombre: item.nombre || '',
      subramo: sub,
      calcular_iva_pri_a_pre: item.calcular_iva_pri_a_pre ?? false,
      vista_mapa_oportunidad: item.vista_mapa_oportunidad ?? false,
      comisiones_aseguradoras: (item.comisiones_aseguradoras || []).map((comision) => ({
        aseguradora_id: comision.aseguradora_id,
        porcentaje_iva: comision.porcentaje_iva,
        porcentaje_comision: comision.porcentaje_comision,
        pri_a_pre_por_defecto: comision.pri_a_pre_por_defecto,
      })),
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!(formData.nombre || '').trim()) {
      setFormError('El nombre del ramo es obligatorio.');
      return;
    }

    try {
      setIsSubmitting(true);
      if (isEditing && selectedItem) {
        await updateRamo(selectedItem.id, formData);
      } else {
        await createRamo(formData);
      }
      setShowModal(false);
    } catch (error: any) {
      const msg =
        error?.errors
          ? Object.values(error.errors).flat().join('. ')
          : error?.message || 'Error al guardar el ramo.';
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (item: RamoType) => {
    setRamoToDelete(item);
    setReplacementRamoId('');
    setDeletePolizasCount(0);
    setDeleteLoading(true);
    setShowDeleteModal(true);
    try {
      const res = await getRamoPolizasCount(item.id);
      setDeletePolizasCount(res.count || 0);
    } catch {
      setDeletePolizasCount(0);
    } finally {
      setDeleteLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!ramoToDelete) return;
    if (deletePolizasCount > 0 && !replacementRamoId) return;
    setIsDeleting(true);
    try {
      await deleteRamo(ramoToDelete.id, replacementRamoId || undefined);
      setShowDeleteModal(false);
      setRamoToDelete(null);
    } catch (error: any) {
      setFormError(error?.message || 'Error al eliminar el ramo.');
    } finally {
      setIsDeleting(false);
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
    if (selectedForDelete.size === ramos.length) {
      setSelectedForDelete(new Set());
    } else {
      setSelectedForDelete(new Set(ramos.map((r) => r.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (bulkDeleteConfirmText !== 'ELIMINAR') return;
    
    try {
      setIsBulkDeleting(true);
      const ids = Array.from(selectedForDelete);
      const response = await saasApi.bulkDeleteRamos({ ids });
      
      if (response.success) {
        alert(`Se eliminaron ${(response.data as any)?.deleted_count || ids.length} ramos`);
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

  const handleBulkDeleteAll = async () => {
    if (bulkDeleteConfirmText !== 'ELIMINAR TODOS') return;
    
    try {
      setIsBulkDeleting(true);
      const response = await saasApi.bulkDeleteRamos({ delete_all: true });
      
      if (response.success) {
        alert(`Se eliminaron ${(response.data as any)?.deleted_count || 0} ramos`);
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

  const updateComisionAseguradora = (
    aseguradoraId: string,
    field: keyof Omit<ComisionAseguradora, 'aseguradora_id' | 'aseguradora_nombre'>,
    value: number,
  ) => {
    const nuevasComisiones = formData.comisiones_aseguradoras.map((comision) =>
      comision.aseguradora_id === aseguradoraId ? { ...comision, [field]: value } : comision,
    );
    setFormData({ ...formData, comisiones_aseguradoras: nuevasComisiones });
  };

  const agregarAseguradora = () => {
    if (formData.comisiones_aseguradoras.length < aseguradoras.length) {
      const aseguradorasYaAgregadas = formData.comisiones_aseguradoras.map((c) => c.aseguradora_id);
      const aseguradoraDisponible = aseguradoras.find(
        (a) => !aseguradorasYaAgregadas.includes(a.id),
      );

      if (aseguradoraDisponible) {
        setFormData({
          ...formData,
          comisiones_aseguradoras: [
            ...formData.comisiones_aseguradoras,
            {
              aseguradora_id: aseguradoraDisponible.id,
              porcentaje_iva: 0,
              porcentaje_comision: 0,
              pri_a_pre_por_defecto: 0,
            },
          ],
        });
      }
    }
  };

  const removerAseguradora = (aseguradoraId: string) => {
    setFormData({
      ...formData,
      comisiones_aseguradoras: formData.comisiones_aseguradoras.filter(
        (c) => c.aseguradora_id !== aseguradoraId,
      ),
    });
  };

  return (
    <PermissionGate
      route="/apps/admin/ramos"
      action="ver"
      fallback={
        <div className="flex justify-center items-center h-64">
          <Alert color="warning">No tienes permisos para ver Ramos.</Alert>
        </div>
      }
    >
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 data-tour="ramos-page-title" className="text-2xl font-bold text-dark dark:text-white mb-2">Gestión de Ramos</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Administra los ramos de seguros disponibles.
            </p>
          </div>
          <div className="flex gap-2">
            {selectedForDelete.size > 0 && (
              <PermissionGate route="/apps/admin/ramos" action="eliminar">
                <Button color="failure" onClick={() => setShowBulkDeleteModal(true)} className="flex items-center">
                  <Icon icon="solar:trash-bin-trash-bold" className="w-4 h-4 mr-2" />
                  Eliminar ({selectedForDelete.size})
                </Button>
              </PermissionGate>
            )}
            {ramos.length > 0 && selectedForDelete.size === 0 && (
              <PermissionGate route="/apps/admin/ramos" action="eliminar">
                <Button color="light" onClick={() => setShowBulkDeleteModal(true)} className="flex items-center">
                  <Icon icon="solar:trash-bin-trash-bold" className="w-4 h-4 mr-2" />
                  Eliminar Todos
                </Button>
              </PermissionGate>
            )}
            <PermissionGate route="/apps/admin/ramos" action="crear">
              <span data-tour="ramos-create-btn"><HeroButton icon="solar:document-add-bold" onClick={handleCreate}>Nuevo Ramo</HeroButton></span>
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
      ) : ramos.length === 0 ? (
        <Card>
          <div className="text-center py-12 px-6">
            <Icon
              icon="solar:document-bold-duotone"
              className="w-16 h-16 text-gray-400 mx-auto mb-4"
            />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No hay ramos definidos
            </h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Comienza creando ramos para organizar tu portafolio de seguros.
            </p>
            <div className="flex justify-center">
              <PermissionGate route="/apps/admin/ramos" action="crear">
                <HeroButton icon="solar:document-add-bold" onClick={handleCreate} size="lg">Crear Primer Ramo</HeroButton>
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
                    <FlowbiteCheckbox
                      checked={selectedForDelete.size === ramos.length && ramos.length > 0}
                      onChange={selectAllForDelete}
                    />
                  </th>
                  <th>Ramo</th>
                  <th>Subramos</th>
                  <th>Características</th>
                  <th>Aseguradoras</th>
                  <th>Fecha de Creación</th>
                  <th className="sticky-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ramos.map((item) => (
                  <tr
                    key={item.id}
                    className={`group ${selectedForDelete.has(item.id) ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                  >
                    <td>
                      <FlowbiteCheckbox
                        checked={selectedForDelete.has(item.id)}
                        onChange={() => toggleSelectForDelete(item.id)}
                      />
                    </td>
                    <td className="whitespace-nowrap font-medium text-gray-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <Icon icon="solar:document-bold" className="w-5 h-5 text-blue-600" />
                        <span className="font-medium">{item.nombre}</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {(Array.isArray(item.subramo) ? item.subramo : (item.subramo ? [item.subramo] : [])).length > 0
                          ? (Array.isArray(item.subramo) ? item.subramo : [item.subramo]).map((s: string, i: number) => (
                              <Badge key={i} color="indigo" size="xs">{s}</Badge>
                            ))
                          : <span className="text-xs text-gray-400">—</span>
                        }
                      </div>
                    </td>
                    <td>
                      <div className="space-y-1">
                        {item.calcular_iva_pri_a_pre && (
                          <Badge color="green" size="sm">
                            Calcular IVA Pri a Pre
                          </Badge>
                        )}
                        {item.vista_mapa_oportunidad && (
                          <Badge color="blue" size="sm">
                            Vista mapa de oportunidad
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="text-sm text-gray-500">
                        {item.comisiones_aseguradoras.length} aseguradoras configuradas
                      </div>
                    </td>
                    <td className="text-gray-500 dark:text-gray-400">
                      {new Date(item.created_at).toLocaleDateString()}
                    </td>
                    <td className="sticky-right">
                      <div className="flex items-center gap-2">
                        <PermissionGate route="/apps/admin/ramos" action="editar">
                          <Button size="sm" color="gray" onClick={() => handleEdit(item)}>
                            <Icon icon="solar:pen-bold" className="w-4 h-4" />
                          </Button>
                        </PermissionGate>
                        <PermissionGate route="/apps/admin/ramos" action="eliminar">
                          <Button size="sm" color="failure" onClick={() => handleDelete(item)}>
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

      {/* Modal con opción de plantilla o en blanco */}
      <Modal show={showModal} onClose={() => setShowModal(false)} size="5xl">
        <Modal.Header>
          {isEditing
            ? 'Editar Ramo'
            : creationMode === 'template'
            ? 'Agregar ramos por plantilla'
            : creationMode === 'blank'
            ? 'Crear ramo'
            : 'Nuevo ramo'}
        </Modal.Header>
        <form onSubmit={handleSubmit}>
          <Modal.Body className="max-h-[70vh] overflow-y-auto">
            {/* Paso 0: Elegir modo */}
            {!isEditing && creationMode === null && (
              <div data-tour="ramos-modal-template" className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
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
                      <p className="text-sm text-gray-500">Selecciona ramos comunes de Colombia.</p>
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
                      {bulkResult.success} ramo(s) creados.{' '}
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
                      placeholder="Buscar por ramo o subramo"
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
                  <span>Total plantillas: {COLOMBIA_RAMOS.length}</span>
                  <span className="mx-2">•</span>
                  <span>Visibles: {filteredTemplates.length}</span>
                </div>

                <div className="max-h-[50vh] overflow-y-auto pr-1">
                  {filteredTemplates.map((t) => {
                    const exists = !selectable(t);
                    const key = makeKey(t.nombre, t.subramo);
                    const checked = !!selectedTemplates[key];
                    return (
                      <div
                        key={key}
                        className="flex items-start gap-3 p-3 border rounded-md mb-2 bg-white dark:bg-gray-800"
                      >
                        <Checkbox
                          className="mt-1"
                          checked={checked}
                          disabled={exists || isBulkCreating}
                          onCheckedChange={(v) => toggleSelect(key, !!v)}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{t.nombre}</span>
                            <span className="text-xs text-gray-500">• {t.subramo}</span>
                            {exists && (
                              <Badge color="warning" size="sm">
                                Ya existe
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Modo en blanco o edición: formulario existente */}
            {formError && (
              <Alert color="failure" className="mb-4">
                <Icon icon="solar:danger-circle-bold" className="w-4 h-4 inline mr-2" />
                {formError}
              </Alert>
            )}
            {(isEditing || creationMode === 'blank') && (
              <Tabs>
                <Tabs.Item active title="Datos principales">
                  <div className="space-y-6 mt-4">
                    <div>
                      <Label htmlFor="nombre" value="Ramo *" />
                      <TextInput
                        id="nombre"
                        type="text"
                        placeholder="Ej: Autos, Hogar, Salud..."
                        value={formData.nombre}
                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                        required
                      />
                      {isEditing && selectedItem && formData.nombre.trim() !== selectedItem.nombre && formData.nombre.trim() !== '' && (
                        <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                          <p className="text-amber-700 dark:text-amber-400 text-sm flex items-center gap-2">
                            <Icon icon="solar:danger-triangle-bold" className="w-4 h-4 flex-shrink-0" />
                            <span>Al cambiar el nombre del ramo, se actualizará en <strong>todo el sistema</strong>, incluyendo todas las pólizas que tienen este ramo asignado.</span>
                          </p>
                        </div>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="subramo" value="Subramos (opcional)" />
                      <div className="flex gap-2 mt-1">
                        <TextInput
                          id="subramo"
                          type="text"
                          placeholder="Escribir subramo y presionar Enter"
                          value={subramoInput}
                          onChange={(e) => setSubramoInput(e.target.value)}
                          onKeyDown={(e) => {
                            if ((e.key === 'Enter' || e.key === ',') && subramoInput.trim()) {
                              e.preventDefault();
                              if (!formData.subramo.includes(subramoInput.trim())) {
                                setFormData({ ...formData, subramo: [...formData.subramo, subramoInput.trim()] });
                              }
                              setSubramoInput('');
                            }
                          }}
                          className="flex-1"
                        />
                        <Button type="button" size="sm" color="light" onClick={() => {
                          if (subramoInput.trim() && !formData.subramo.includes(subramoInput.trim())) {
                            setFormData({ ...formData, subramo: [...formData.subramo, subramoInput.trim()] });
                          }
                          setSubramoInput('');
                        }}>
                          <Icon icon="solar:add-circle-bold" width={18} />
                        </Button>
                      </div>
                      {formData.subramo.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {formData.subramo.map((s, i) => (
                            <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium rounded-lg border border-blue-200 dark:border-blue-800">
                              {s}
                              <button type="button" onClick={() => setFormData({ ...formData, subramo: formData.subramo.filter((_, idx) => idx !== i) })} className="ml-0.5 hover:text-red-500 transition-colors">
                                <Icon icon="solar:close-circle-bold" width={16} />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-gray-400 mt-1.5">Presiona Enter o coma para agregar. Puedes agregar varios subramos.</p>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="calcular_iva_pri_a_pre"
                          checked={formData.calcular_iva_pri_a_pre}
                          onCheckedChange={(checked) =>
                            setFormData({ ...formData, calcular_iva_pri_a_pre: !!checked })
                          }
                        />
                        <Label htmlFor="calcular_iva_pri_a_pre">Calcular IVA a Pri a Pre</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="vista_mapa_oportunidad"
                          checked={formData.vista_mapa_oportunidad}
                          onCheckedChange={(checked) =>
                            setFormData({ ...formData, vista_mapa_oportunidad: !!checked })
                          }
                        />
                        <Label htmlFor="vista_mapa_oportunidad">Vista mapa de oportunidad</Label>
                      </div>
                    </div>
                  </div>
                </Tabs.Item>

                <Tabs.Item title="Comisiones por aseguradora">
                  <div className="space-y-4 mt-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Comisiones por aseguradora (0)
                      </h3>
                      <Button
                        type="button"
                        size="sm"
                        onClick={agregarAseguradora}
                        disabled={formData.comisiones_aseguradoras.length >= aseguradoras.length}
                      >
                        <Icon icon="solar:add-circle-bold" className="w-4 h-4 mr-2" />
                        Agregar aseguradora
                      </Button>
                    </div>

                    <div className="max-h-[50vh] overflow-y-auto pr-2">
                      {formData.comisiones_aseguradoras.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <Icon
                            icon="solar:shield-warning-bold-duotone"
                            className="w-12 h-12 mx-auto mb-2"
                          />
                          <p>No hay datos</p>
                        </div>
                      ) : (
                        <div className="guro-table-wrap">
                          <table className="guro-table">
                            <thead>
                              <tr>
                                <th>Aseguradora</th>
                                <th>Porcentaje de IVA</th>
                                <th>Porcentaje de comisión</th>
                                <th>(Pri a Pre) por defecto</th>
                                <th>Acciones</th>
                              </tr>
                            </thead>
                            <tbody>
                              {formData.comisiones_aseguradoras.map((comision) => {
                                return (
                                  <tr key={comision.aseguradora_id} className="group">
                                    <td className="font-medium">
                                      <select
                                        value={comision.aseguradora_id}
                                        onChange={(e) => {
                                          const nuevasComisiones =
                                            formData.comisiones_aseguradoras.map((c) =>
                                              c.aseguradora_id === comision.aseguradora_id
                                                ? { ...c, aseguradora_id: e.target.value }
                                                : c,
                                            );
                                          setFormData({
                                            ...formData,
                                            comisiones_aseguradoras: nuevasComisiones,
                                          });
                                        }}
                                        className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600"
                                      >
                                        {aseguradoras.map((aseg) => (
                                          <option key={aseg.id} value={aseg.id}>
                                            {aseg.nombre}
                                          </option>
                                        ))}
                                      </select>
                                    </td>
                                    <td>
                                      <div className="relative">
                                        <TextInput
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          max="100"
                                          value={comision.porcentaje_iva ?? ''}
                                          onChange={(e) =>
                                            updateComisionAseguradora(
                                              comision.aseguradora_id,
                                              'porcentaje_iva',
                                              e.target.value === '' ? 0 : parseFloat(e.target.value),
                                            )
                                          }
                                          className="w-24"
                                        />
                                        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                                          %
                                        </span>
                                      </div>
                                    </td>
                                    <td>
                                      <div className="relative">
                                        <TextInput
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          max="100"
                                          value={comision.porcentaje_comision ?? ''}
                                          onChange={(e) =>
                                            updateComisionAseguradora(
                                              comision.aseguradora_id,
                                              'porcentaje_comision',
                                              e.target.value === '' ? 0 : parseFloat(e.target.value),
                                            )
                                          }
                                          className="w-24"
                                        />
                                        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                                          %
                                        </span>
                                      </div>
                                    </td>
                                    <td>
                                      <div className="relative">
                                        <TextInput
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          max="100"
                                          value={comision.pri_a_pre_por_defecto ?? ''}
                                          onChange={(e) =>
                                            updateComisionAseguradora(
                                              comision.aseguradora_id,
                                              'pri_a_pre_por_defecto',
                                              e.target.value === '' ? 0 : parseFloat(e.target.value),
                                            )
                                          }
                                          className="w-24"
                                        />
                                        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                                          %
                                        </span>
                                      </div>
                                    </td>
                                    <td>
                                      <Button
                                        type="button"
                                        size="sm"
                                        color="failure"
                                        onClick={() => removerAseguradora(comision.aseguradora_id)}
                                      >
                                        <Icon
                                          icon="solar:trash-bin-trash-bold"
                                          className="w-4 h-4"
                                        />
                                      </Button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </Tabs.Item>
              </Tabs>
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
                  <PermissionGate route="/apps/admin/ramos" action="editar">
                    <Button
                      type="submit"
                      disabled={isSubmitting || !(formData.nombre || '').trim()}
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
                  <PermissionGate route="/apps/admin/ramos" action="crear">
                    <Button
                      type="submit"
                      disabled={isSubmitting || !(formData.nombre || '').trim()}
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
                <PermissionGate route="/apps/admin/ramos" action="crear">
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
                        Agregar seleccionados ({Object.keys(selectedTemplates).length})
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
              ? `Eliminar ${selectedForDelete.size} ramo(s)` 
              : 'Eliminar TODOS los ramos'}
          </div>
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-red-700 dark:text-red-400 font-medium">
                ⚠️ {selectedForDelete.size > 0 
                  ? `Se eliminarán ${selectedForDelete.size} ramo(s) seleccionado(s).`
                  : `Se eliminarán TODOS los ${ramos.length} ramos.`}
              </p>
              <p className="text-red-600 dark:text-red-500 text-sm mt-2">
                Esta acción NO se puede deshacer.
              </p>
            </div>
            
            <div>
              <Label className="text-gray-700 dark:text-gray-300">
                Para confirmar, escribe <strong>{selectedForDelete.size > 0 ? 'ELIMINAR' : 'ELIMINAR TODOS'}</strong>:
              </Label>
              <Input
                type="text"
                value={bulkDeleteConfirmText}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBulkDeleteConfirmText(e.target.value)}
                placeholder={selectedForDelete.size > 0 ? 'ELIMINAR' : 'ELIMINAR TODOS'}
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
              (selectedForDelete.size === 0 && bulkDeleteConfirmText !== 'ELIMINAR TODOS') ||
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

      {/* Modal de eliminación individual con reemplazo */}
      <Modal show={showDeleteModal} onClose={() => setShowDeleteModal(false)} size="md">
        <Modal.Header>
          <div className="flex items-center gap-2 text-red-600">
            <Icon icon="solar:danger-triangle-bold" className="w-6 h-6" />
            Eliminar ramo
          </div>
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            {deleteLoading ? (
              <div className="flex justify-center py-4"><Spinner size="lg" /></div>
            ) : (
              <>
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-red-700 dark:text-red-400 text-sm flex items-center gap-2">
                    <Icon icon="solar:danger-triangle-bold" className="w-4 h-4 flex-shrink-0" />
                    <span>Eliminar el ramo <strong>{ramoToDelete?.nombre}</strong> lo removerá de <strong>todo el sistema</strong>. Esta acción no se puede deshacer.</span>
                  </p>
                </div>
                {deletePolizasCount > 0 ? (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                    <p className="text-amber-700 dark:text-amber-400 font-medium flex items-center gap-2">
                      <Icon icon="solar:danger-triangle-bold" className="w-5 h-5" />
                      Este ramo tiene {deletePolizasCount} póliza(s) asociada(s).
                    </p>
                    <p className="text-amber-600 dark:text-amber-500 text-sm mt-2">
                      Selecciona un ramo de reemplazo para reasignar las pólizas antes de eliminar.
                    </p>
                    <div className="mt-3">
                      <Label value="Ramo de reemplazo *" className="mb-1" />
                      <select
                        value={replacementRamoId}
                        onChange={(e) => setReplacementRamoId(e.target.value)}
                        className="w-full border rounded-md p-2 text-sm dark:bg-gray-700 dark:border-gray-600"
                      >
                        <option value="">Seleccionar ramo de reemplazo...</option>
                        {ramos.filter(r => r.id !== ramoToDelete?.id).map(r => (
                          <option key={r.id} value={r.id}>{r.nombre}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                      Este ramo no tiene pólizas asociadas. Se puede eliminar directamente.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button
            color="failure"
            onClick={confirmDelete}
            disabled={isDeleting || deleteLoading || (deletePolizasCount > 0 && !replacementRamoId)}
          >
            {isDeleting ? (
              <><Spinner size="sm" className="mr-2" /> Eliminando...</>
            ) : (
              <><Icon icon="solar:trash-bin-trash-bold" className="w-4 h-4 mr-2" /> Eliminar</>
            )}
          </Button>
          <Button color="gray" onClick={() => setShowDeleteModal(false)}>Cancelar</Button>
        </Modal.Footer>
      </Modal>
    </PermissionGate>
  );
};

export default Ramos;
