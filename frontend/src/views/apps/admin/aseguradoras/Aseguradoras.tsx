import React, { useState } from 'react';
import { Card, Button, Alert, Spinner, Table, Modal, TextInput, Label, Tabs, Badge, Checkbox } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { useAseguradoras } from 'src/hooks/useAdminCrudApi';
import type { Aseguradora as AseguradoraType, AseguradoraCreate } from 'src/types/admin';
import { COLOMBIA_INSURERS } from 'src/data/colombia_insurers';

const Aseguradoras = () => {
  const { aseguradoras, loading, error, createAseguradora, updateAseguradora, deleteAseguradora } = useAseguradoras();
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
    retencion_iva: 0
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formMessage, setFormMessage] = useState<string | null>(null);

  // Nuevo flujo: creación en blanco o por plantilla
  const [creationMode, setCreationMode] = useState<'blank' | 'template' | null>(null);
  const [templateSearch, setTemplateSearch] = useState('');
  const [selectedTemplates, setSelectedTemplates] = useState<Record<string, boolean>>({});
  const [isBulkCreating, setIsBulkCreating] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ success: number; failed: number; messages: string[] } | null>(null);

  const normalize = (s: string) =>
    (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

  const existingByName = new Set(aseguradoras.map(a => normalize(a.nombre)));
  const existingByCuit = new Set(aseguradoras.map(a => String(a.cuit || '').replace(/\D/g, '').trim()));

  const filteredTemplates = COLOMBIA_INSURERS
    .filter(t => {
      const q = normalize(templateSearch);
      return !q || normalize(t.nombre).includes(q) || String(t.cuit || '').includes(templateSearch.trim());
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  const selectable = (t: AseguradoraCreate) => {
    const nameExists = existingByName.has(normalize(t.nombre));
    const cuitNum = String(t.cuit || '').replace(/\D/g, '').trim();
    const cuitExists = cuitNum && existingByCuit.has(cuitNum);
    return !(nameExists || cuitExists);
  };

  const toggleSelect = (nombre: string, value?: boolean) => {
    setSelectedTemplates(prev => {
      const next = { ...prev };
      const v = value ?? !prev[nombre];
      if (v) next[nombre] = true; else delete next[nombre];
      return next;
    });
  };

  const selectAllVisible = () => {
    const next: Record<string, boolean> = {};
    filteredTemplates.forEach(t => {
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
    const items = COLOMBIA_INSURERS.filter(t => names.includes(t.nombre)).filter(t => selectable(t));
    const results = await Promise.allSettled(items.map(item => createAseguradora(item)));
    const success = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.length - success;
    const messages: string[] = [];
    if (failed > 0) messages.push(`${failed} no se pudieron crear (posibles duplicados o validación).`);
    setBulkResult({ success, failed, messages });
    setIsBulkCreating(false);
    if (success > 0) {
      // mantener seleccionado solo los fallidos
      const failedNames = results
        .map((r, idx) => ({ r, name: items[idx].nombre }))
        .filter(x => x.r.status === 'rejected')
        .map(x => x.name);
      const next: Record<string, boolean> = {};
      failedNames.forEach(n => { next[n] = true; });
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
      retencion_iva: 0
    });
    setShowModal(true);
  };

  const handleEdit = (item: AseguradoraType) => {
    setSelectedItem(item);
    setIsEditing(true);
    setCreationMode('blank');
    setFormData({
      nombre: item.nombre,
      cuit: item.cuit,
      email: item.email,
      direccion: item.direccion,
      telefono: item.telefono,
      cuenta_bancaria: item.cuenta_bancaria,
      link_pago: item.link_pago,
      codigo_intermediario: item.codigo_intermediario,
      retencion: item.retencion,
      iva: item.iva,
      retencion_iva: item.retencion_iva
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
      } catch (error) {
      }
    }
  };

  return (
    <>
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-dark dark:text-white mb-2">
              Gestión de Aseguradoras
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Administra las aseguradoras con las que trabajas.
            </p>
          </div>
          <Button onClick={handleCreate} className="flex items-center">
            <Icon icon="solar:shield-plus-bold" className="w-4 h-4 mr-2" />
            Nueva Aseguradora
          </Button>
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
            <Icon icon="solar:shield-check-bold-duotone" className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No hay aseguradoras definidas
            </h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Comienza agregando aseguradoras para trabajar con ellas.
            </p>
            <div className="flex justify-center">
              <Button onClick={handleCreate}>
                <Icon icon="solar:shield-plus-bold" className="w-4 h-4 mr-2" />
                Crear Primera Aseguradora
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table striped>
              <Table.Head>
                <Table.HeadCell>Aseguradora</Table.HeadCell>
              <Table.HeadCell>NIT</Table.HeadCell>
                <Table.HeadCell>Email</Table.HeadCell>
                <Table.HeadCell>Contactos</Table.HeadCell>
                <Table.HeadCell>Porcentajes</Table.HeadCell>
                <Table.HeadCell>Fecha de Creación</Table.HeadCell>
                <Table.HeadCell>Acciones</Table.HeadCell>
              </Table.Head>
              <Table.Body className="divide-y">
                {aseguradoras.map((item) => (
                  <Table.Row key={item.id} className="bg-white dark:border-gray-700 dark:bg-gray-800">
                    <Table.Cell className="whitespace-nowrap font-medium text-gray-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <Icon icon="solar:shield-check-bold" className="w-5 h-5 text-blue-600" />
                        <div>
                          <div className="font-medium">{item.nombre}</div>
                          <div className="text-xs text-gray-500">Código: {item.codigo_intermediario}</div>
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell className="text-gray-500 dark:text-gray-400">
                      {item.cuit}
                    </Table.Cell>
                    <Table.Cell className="text-gray-500 dark:text-gray-400">
                      {item.email}
                    </Table.Cell>
                    <Table.Cell className="text-gray-500 dark:text-gray-400">
                      <div className="text-sm">
                        <div>📞 {item.telefono}</div>
                        <div className="text-xs text-gray-400 mt-1 max-w-32 truncate">
                          📍 {item.direccion}
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="space-y-1">
                        <Badge color="green" size="sm">IVA: {item.iva}%</Badge>
                        <Badge color="blue" size="sm">Ret: {item.retencion}%</Badge>
                        <Badge color="purple" size="sm">Ret.IVA: {item.retencion_iva}%</Badge>
                      </div>
                    </Table.Cell>
                    <Table.Cell className="text-gray-500 dark:text-gray-400">
                      {new Date(item.created_at).toLocaleDateString()}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          color="gray"
                          onClick={() => handleEdit(item)}
                        >
                          <Icon icon="solar:pen-bold" className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          color="failure"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Icon icon="solar:trash-bin-trash-bold" className="w-4 h-4" />
                        </Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
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
              <Alert color="warning" className="mb-3">{formMessage}</Alert>
            )}

            {/* Paso 0: Elegir modo */}
            {!isEditing && creationMode === null && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <Card className="cursor-pointer hover:ring-2 hover:ring-blue-500" onClick={() => setCreationMode('blank')}>
                  <div className="flex items-center gap-3">
                    <Icon icon="solar:add-square-bold-duotone" className="w-8 h-8 text-blue-600" />
                    <div>
                      <h3 className="text-lg font-semibold">Crear en blanco</h3>
                      <p className="text-sm text-gray-500">Completa el formulario manualmente.</p>
                    </div>
                  </div>
                </Card>

                <Card className="cursor-pointer hover:ring-2 hover:ring-emerald-500" onClick={() => setCreationMode('template')}>
                  <div className="flex items-center gap-3">
                    <Icon icon="solar:documents-bold-duotone" className="w-8 h-8 text-emerald-600" />
                    <div>
                      <h3 className="text-lg font-semibold">Por plantilla</h3>
                      <p className="text-sm text-gray-500">Selecciona de la lista de aseguradoras de Colombia.</p>
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
                      {bulkResult.success} aseguradora(s) creadas. {bulkResult.failed > 0 ? `${bulkResult.failed} con error.` : ''}
                    </div>
                    <ul className="list-disc pl-5 text-sm">
                      {bulkResult.messages.map((m, i) => <li key={i}>{m}</li>)}
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
                    <Button color="light" size="sm" onClick={selectAllVisible} disabled={isBulkCreating}>
                      <Icon icon="solar:checklist-minimalistic-bold" className="w-4 h-4 mr-1" />
                      Seleccionar visibles
                    </Button>
                    <Button color="light" size="sm" onClick={clearSelection} disabled={isBulkCreating}>
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
                            {exists && (<Badge color="warning" size="sm">Ya existe</Badge>)}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            NIT: {t.cuit || '—'} {t.email ? `• ${t.email}` : ''} {t.telefono ? `• ${t.telefono}` : ''}
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

            {/* Modo en blanco o edición: formulario existente */}
            {(isEditing || creationMode === 'blank') && (
              <Tabs>
                <Tabs.Item active title="Datos de la aseguradora">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
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
                      {formErrors['nombre'] && (<div className="text-xs text-red-600 mt-1">{formErrors['nombre']}</div>)}
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
                      {formErrors['cuit'] && (<div className="text-xs text-red-600 mt-1">{formErrors['cuit']}</div>)}
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
                      {formErrors['email'] && (<div className="text-xs text-red-600 mt-1">{formErrors['email']}</div>)}
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
                      {formErrors['telefono'] && (<div className="text-xs text-red-600 mt-1">{formErrors['telefono']}</div>)}
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
                      {formErrors['direccion'] && (<div className="text-xs text-red-600 mt-1">{formErrors['direccion']}</div>)}
                    </div>
                  </div>
                </Tabs.Item>
                
                <Tabs.Item title="Contactos">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <Label htmlFor="cuenta_bancaria" value="Cuenta Bancaria" />
                      <TextInput
                        id="cuenta_bancaria"
                        type="text"
                        placeholder="Número de cuenta bancaria"
                        value={formData.cuenta_bancaria}
                        onChange={(e) => setFormData({ ...formData, cuenta_bancaria: e.target.value })}
                      />
                      {formErrors['cuenta_bancaria'] && (<div className="text-xs text-red-600 mt-1">{formErrors['cuenta_bancaria']}</div>)}
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
                      {formErrors['link_pago'] && (<div className="text-xs text-red-600 mt-1">{formErrors['link_pago']}</div>)}
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="codigo_intermediario" value="Código intermediario" />
                      <TextInput
                        id="codigo_intermediario"
                        type="text"
                        placeholder="Código intermediario"
                        value={formData.codigo_intermediario}
                        onChange={(e) => setFormData({ ...formData, codigo_intermediario: e.target.value })}
                      />
                      {formErrors['codigo_intermediario'] && (<div className="text-xs text-red-600 mt-1">{formErrors['codigo_intermediario']}</div>)}
                    </div>
                  </div>
                </Tabs.Item>

                <Tabs.Item title="Retenciones">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div>
                      <Label htmlFor="retencion" value="Retención *" />
                      <div className="relative">
                        <TextInput
                          id="retencion"
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          placeholder="Porcentaje de retención"
                          value={formData.retencion || ''}
                          onChange={(e) => setFormData({ ...formData, retencion: parseFloat(e.target.value) || 0 })}
                          required
                        />
                        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">%</span>
                      </div>
                      {formErrors['retencion'] && (<div className="text-xs text-red-600 mt-1">{formErrors['retencion']}</div>)}
                    </div>
                    <div>
                      <Label htmlFor="iva" value="IVA *" />
                      <div className="relative">
                        <TextInput
                          id="iva"
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          placeholder="Porcentaje de IVA"
                          value={formData.iva || ''}
                          onChange={(e) => setFormData({ ...formData, iva: parseFloat(e.target.value) || 0 })}
                          required
                        />
                        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">%</span>
                      </div>
                      {formErrors['iva'] && (<div className="text-xs text-red-600 mt-1">{formErrors['iva']}</div>)}
                    </div>
                    <div>
                      <Label htmlFor="retencion_iva" value="Retención IVA *" />
                      <div className="relative">
                        <TextInput
                          id="retencion_iva"
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          placeholder="Porcentaje de retención IVA"
                          value={formData.retencion_iva || ''}
                          onChange={(e) => setFormData({ ...formData, retencion_iva: parseFloat(e.target.value) || 0 })}
                          required
                        />
                        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">%</span>
                      </div>
                      {formErrors['retencion_iva'] && (<div className="text-xs text-red-600 mt-1">{formErrors['retencion_iva']}</div>)}
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

              {(isEditing || creationMode === 'blank') && (
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
                    isEditing ? 'Guardar' : 'Crear'
                  )}
                </Button>
              )}

              {!isEditing && creationMode === 'template' && (
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
              )}
            </div>
          </Modal.Footer>
        </form>
      </Modal>
    </>
  );
};

export default Aseguradoras; 