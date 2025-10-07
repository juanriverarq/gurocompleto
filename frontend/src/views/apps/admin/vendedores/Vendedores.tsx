import React, { useState } from 'react';
import { Card, Button, Alert, Spinner, Table, Modal, TextInput, Label, Tabs, Radio, ToggleSwitch, Badge } from 'flowbite-react';
import { Checkbox } from 'src/components/shadcn-ui/Default-Ui/checkbox';
import { Icon } from '@iconify/react';
import { useVendedores } from 'src/hooks/useAdminCrudApi';
import type { Vendedor as VendedorType, VendedorCreate } from 'src/types/admin';

const tiposDocumento = [
  { value: 'CC', label: 'Cédula de Ciudadanía' },
  { value: 'CE', label: 'Cédula de Extranjería' },
  { value: 'NIT', label: 'NIT' },
  { value: 'PASAPORTE', label: 'Pasaporte' },
  { value: 'RUT', label: 'RUT' },
];

const Vendedores = () => {
  const { vendedores, loading, error, createVendedor, updateVendedor, deleteVendedor } = useVendedores();
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<VendedorType | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<VendedorCreate>({ 
    nombres: '',
    tipo_documento: 'CC',
    numero_documento: '',
    telefono: '',
    celular: '',
    email: '',
    cuenta_bancaria: '',
    tipo_persona: 'natural',
    es_agencia: false,
    porcentaje_comision: 0,
    calcular_comision_sobre: 'agencia',
    porcentaje_retencion: 0,
    porcentaje_retencion_ica: 0,
    porcentaje_iva: 0,
    comisiones_diferentes_por_ano: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = () => {
    setSelectedItem(null);
    setIsEditing(false);
    setFormData({ 
      nombres: '',
      tipo_documento: 'CC',
      numero_documento: '',
      telefono: '',
      celular: '',
      email: '',
      cuenta_bancaria: '',
      tipo_persona: 'natural',
      es_agencia: false,
      porcentaje_comision: 0,
      calcular_comision_sobre: 'agencia',
      porcentaje_retencion: 0,
      porcentaje_retencion_ica: 0,
      porcentaje_iva: 0,
      comisiones_diferentes_por_ano: false
    });
    setShowModal(true);
  };

  const handleEdit = (item: VendedorType) => {
    setSelectedItem(item);
    setIsEditing(true);
    setFormData({ 
      nombres: item.nombres,
      tipo_documento: item.tipo_documento,
      numero_documento: item.numero_documento,
      telefono: item.telefono,
      celular: item.celular,
      email: item.email,
      cuenta_bancaria: item.cuenta_bancaria,
      tipo_persona: item.tipo_persona,
      es_agencia: item.es_agencia,
      porcentaje_comision: item.porcentaje_comision,
      calcular_comision_sobre: item.calcular_comision_sobre,
      porcentaje_retencion: item.porcentaje_retencion,
      porcentaje_retencion_ica: item.porcentaje_retencion_ica,
      porcentaje_iva: item.porcentaje_iva,
      comisiones_diferentes_por_ano: item.comisiones_diferentes_por_ano
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombres.trim()) return;

    try {
      setIsSubmitting(true);
      if (isEditing && selectedItem) {
        await updateVendedor(selectedItem.id, formData);
      } else {
        await createVendedor(formData);
      }
      setShowModal(false);
    } catch (error) {
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás seguro de que deseas eliminar este vendedor?')) {
      try {
        await deleteVendedor(id);
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
              Gestión de Vendedores
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Administra el equipo de vendedores de tu agencia.
            </p>
          </div>
          <Button onClick={handleCreate} className="flex items-center">
            <Icon icon="solar:user-plus-bold" className="w-4 h-4 mr-2" />
            Nuevo Vendedor
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
      ) : vendedores.length === 0 ? (
        <Card>
          <div className="text-center py-12 px-6">
            <Icon icon="solar:user-id-bold-duotone" className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No hay vendedores definidos
            </h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Comienza agregando vendedores a tu equipo comercial.
            </p>
            <div className="flex justify-center">
              <Button onClick={handleCreate}>
                <Icon icon="solar:user-plus-bold" className="w-4 h-4 mr-2" />
                Crear Primer Vendedor
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table striped>
              <Table.Head>
                <Table.HeadCell>Vendedor</Table.HeadCell>
                <Table.HeadCell>Documento</Table.HeadCell>
                <Table.HeadCell>Contacto</Table.HeadCell>
                <Table.HeadCell>Tipo</Table.HeadCell>
                <Table.HeadCell>Comisión</Table.HeadCell>
                <Table.HeadCell>Retenciones</Table.HeadCell>
                <Table.HeadCell>Fecha de Creación</Table.HeadCell>
                <Table.HeadCell>Acciones</Table.HeadCell>
              </Table.Head>
              <Table.Body className="divide-y">
                {vendedores.map((item) => (
                  <Table.Row key={item.id} className="bg-white dark:border-gray-700 dark:bg-gray-800">
                    <Table.Cell className="whitespace-nowrap font-medium text-gray-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <Icon 
                          icon={item.es_agencia ? "solar:buildings-bold" : "solar:user-bold"} 
                          className="w-5 h-5 text-blue-600" 
                        />
                        <div>
                          <div className="font-medium">{item.nombres}</div>
                          <div className="text-xs text-gray-500">{item.email}</div>
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell className="text-gray-500 dark:text-gray-400">
                      <div>
                        <span className="font-medium">{item.tipo_documento}:</span> {item.numero_documento}
                      </div>
                    </Table.Cell>
                    <Table.Cell className="text-gray-500 dark:text-gray-400">
                      <div className="text-sm">
                        <div>📞 {item.telefono}</div>
                        <div>📱 {item.celular}</div>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="space-y-1">
                        <Badge color={item.tipo_persona === 'natural' ? 'green' : 'blue'} size="sm">
                          {item.tipo_persona === 'natural' ? 'Natural' : 'Jurídica'}
                        </Badge>
                        {item.es_agencia && (
                          <Badge color="purple" size="sm">Agencia</Badge>
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="space-y-1">
                        <Badge color="green" size="sm">{item.porcentaje_comision}%</Badge>
                        <div className="text-xs text-gray-400">
                          {item.calcular_comision_sobre === 'agencia' ? 'Sobre agencia' : 'Prima neta'}
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="space-y-1">
                        <Badge color="orange" size="sm">Ret: {item.porcentaje_retencion}%</Badge>
                        <Badge color="red" size="sm">ICA: {item.porcentaje_retencion_ica}%</Badge>
                        <Badge color="purple" size="sm">IVA: {item.porcentaje_iva}%</Badge>
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

      {/* Modal de formulario extenso con tabs */}
      <Modal show={showModal} onClose={() => setShowModal(false)} size="4xl">
        <Modal.Header>
          {isEditing ? 'Editar Vendedor' : 'Datos del Vendedor'}
        </Modal.Header>
        <form onSubmit={handleSubmit}>
          <Modal.Body>
            <Tabs>
              <Tabs.Item active title="Datos principales">
                <div className="space-y-6 mt-4">
                  {/* Información Personal */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Datos principales</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="md:col-span-2">
                        <Label htmlFor="nombres" value="Nombres *" />
                        <TextInput
                          id="nombres"
                          type="text"
                          placeholder="Nombres"
                          value={formData.nombres}
                          onChange={(e) => setFormData({ ...formData, nombres: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="tipo_documento" value="Tipo documento" />
                        <select
                          id="tipo_documento"
                          value={formData.tipo_documento}
                          onChange={(e) => setFormData({ ...formData, tipo_documento: e.target.value })}
                          className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
                        >
                          {tiposDocumento.map((tipo) => (
                            <option key={tipo.value} value={tipo.value}>
                              {tipo.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="numero_documento" value="Número de documento" />
                        <TextInput
                          id="numero_documento"
                          type="text"
                          placeholder="Número de documento"
                          value={formData.numero_documento}
                          onChange={(e) => setFormData({ ...formData, numero_documento: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="telefono" value="Teléfono" />
                        <TextInput
                          id="telefono"
                          type="tel"
                          placeholder="Teléfono"
                          value={formData.telefono}
                          onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="celular" value="Celular" />
                        <TextInput
                          id="celular"
                          type="tel"
                          placeholder="Celular"
                          value={formData.celular}
                          onChange={(e) => setFormData({ ...formData, celular: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="email" value="Email" />
                        <TextInput
                          id="email"
                          type="email"
                          placeholder="Email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label htmlFor="cuenta_bancaria" value="Cuenta Bancaria" />
                        <TextInput
                          id="cuenta_bancaria"
                          type="text"
                          placeholder="Cuenta Bancaria"
                          value={formData.cuenta_bancaria}
                          onChange={(e) => setFormData({ ...formData, cuenta_bancaria: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Tipo de Persona */}
                  <div>
                    <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">Tipo persona</h4>
                    <div className="flex gap-6">
                      <div className="flex items-center gap-2">
                        <Radio
                          id="natural"
                          name="tipo_persona"
                          value="natural"
                          checked={formData.tipo_persona === 'natural'}
                          onChange={(e) => setFormData({ ...formData, tipo_persona: e.target.value as 'natural' | 'juridica' })}
                        />
                        <Label htmlFor="natural">Natural</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Radio
                          id="juridica"
                          name="tipo_persona"
                          value="juridica"
                          checked={formData.tipo_persona === 'juridica'}
                          onChange={(e) => setFormData({ ...formData, tipo_persona: e.target.value as 'natural' | 'juridica' })}
                        />
                        <Label htmlFor="juridica">Jurídica</Label>
                      </div>
                    </div>
                  </div>

                  {/* Es Agencia */}
                  <div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="es_agencia"
                        checked={formData.es_agencia}
                        onCheckedChange={(checked) => setFormData({ ...formData, es_agencia: !!checked })}
                      />
                      <Label htmlFor="es_agencia">Es Agencia</Label>
                    </div>
                  </div>
                </div>
              </Tabs.Item>

              <Tabs.Item title="Comisiones">
                <div className="space-y-6 mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="porcentaje_comision" value="% Comisión *" />
                      <div className="relative">
                        <TextInput
                          id="porcentaje_comision"
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          placeholder="Porcentaje de comisión"
                          value={formData.porcentaje_comision || ''}
                          onChange={(e) => setFormData({ ...formData, porcentaje_comision: parseFloat(e.target.value) || 0 })}
                          required
                        />
                        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">%</span>
                      </div>
                    </div>

                    <div>
                      <Label value="Calcular comisión sobre" />
                      <div className="mt-2 space-y-2">
                        <div className="flex items-center gap-2">
                          <Radio
                            id="agencia"
                            name="calcular_comision_sobre"
                            value="agencia"
                            checked={formData.calcular_comision_sobre === 'agencia'}
                            onChange={(e) => setFormData({ ...formData, calcular_comision_sobre: e.target.value as 'agencia' | 'prima_neta' })}
                          />
                          <Label htmlFor="agencia">Agencia</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Radio
                            id="prima_neta"
                            name="calcular_comision_sobre"
                            value="prima_neta"
                            checked={formData.calcular_comision_sobre === 'prima_neta'}
                            onChange={(e) => setFormData({ ...formData, calcular_comision_sobre: e.target.value as 'agencia' | 'prima_neta' })}
                          />
                          <Label htmlFor="prima_neta">Prima neta</Label>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="porcentaje_retencion" value="% Retención" />
                      <div className="relative">
                        <TextInput
                          id="porcentaje_retencion"
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          placeholder="% Retención"
                          value={formData.porcentaje_retencion || ''}
                          onChange={(e) => setFormData({ ...formData, porcentaje_retencion: parseFloat(e.target.value) || 0 })}
                        />
                        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">%</span>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="porcentaje_retencion_ica" value="% Retención ICA" />
                      <div className="relative">
                        <TextInput
                          id="porcentaje_retencion_ica"
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          placeholder="% Retención ICA"
                          value={formData.porcentaje_retencion_ica || ''}
                          onChange={(e) => setFormData({ ...formData, porcentaje_retencion_ica: parseFloat(e.target.value) || 0 })}
                        />
                        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">%</span>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="porcentaje_iva" value="% IVA" />
                      <div className="relative">
                        <TextInput
                          id="porcentaje_iva"
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          placeholder="% IVA"
                          value={formData.porcentaje_iva || ''}
                          onChange={(e) => setFormData({ ...formData, porcentaje_iva: parseFloat(e.target.value) || 0 })}
                        />
                        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">%</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <ToggleSwitch
                      checked={formData.comisiones_diferentes_por_ano}
                      label="Comisiones diferentes por año"
                      onChange={(checked) => setFormData({ ...formData, comisiones_diferentes_por_ano: checked })}
                    />
                  </div>
                </div>
              </Tabs.Item>
            </Tabs>
          </Modal.Body>
          <Modal.Footer>
            <div className="flex gap-2 ml-auto">
              <Button
                color="gray"
                onClick={() => setShowModal(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !formData.nombres.trim()}
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
            </div>
          </Modal.Footer>
        </form>
      </Modal>
    </>
  );
};

export default Vendedores; 