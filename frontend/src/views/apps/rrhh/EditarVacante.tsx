import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, Button, Label, TextInput, Select, Textarea, ToggleSwitch, Alert } from 'flowbite-react';
import { Icon } from '@iconify/react';
import BreadcrumbComp from 'src/layouts/full/shared/breadcrumb/BreadcrumbComp';

const BCrumbBase = [
  { to: '/', title: 'Dashboard' },
  { to: '/apps/recursos-humanos', title: 'Recursos Humanos' },
];

export default function EditarVacante() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [saving, setSaving] = useState(false);

  // Datos simulados de la vacante (en producción, cargar desde API por id)
  const vacante = useMemo(
    () => ({
      id,
      cargo: 'Frontend Developer',
      area: 'Tecnología',
      seniority: 'Senior',
      modalidad: 'Remoto',
      ubicacion: 'LatAm',
      salarioMin: 3000,
      salarioMax: 6000,
      descripcion: 'Desarrollo de interfaces con React y TypeScript.',
      requisitos: 'React, TypeScript, Tailwind, Testing, CI/CD',
      remoto: true,
    }),
    [id]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    // TODO: Integración API (PUT /vacantes/:id)
    setTimeout(() => {
      setSaving(false);
      navigate('/apps/recursos-humanos');
    }, 800);
  };

  return (
    <>
      <BreadcrumbComp title={`Editar Vacante ${id ?? ''}`} items={[...BCrumbBase, { title: `Editar ${id}` }]} />

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cargo" value="Cargo" />
              <TextInput id="cargo" defaultValue={vacante.cargo} required />
            </div>
            <div>
              <Label htmlFor="area" value="Área" />
              <Select id="area" defaultValue={vacante.area} required>
                <option>Tecnología</option>
                <option>Ventas</option>
                <option>RR.HH.</option>
                <option>Marketing</option>
                <option>Operaciones</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="seniority" value="Seniority" />
              <Select id="seniority" defaultValue={vacante.seniority} required>
                <option>Junior</option>
                <option>Semi Senior</option>
                <option>Senior</option>
                <option>Lead</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="modalidad" value="Modalidad" />
              <Select id="modalidad" defaultValue={vacante.modalidad} required>
                <option>Remoto</option>
                <option>Híbrido</option>
                <option>Presencial</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="ubicacion" value="Ubicación" />
              <TextInput id="ubicacion" defaultValue={vacante.ubicacion} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="salarioMin" value="Salario mín." />
              <TextInput id="salarioMin" type="number" min={0} defaultValue={vacante.salarioMin} />
            </div>
            <div>
              <Label htmlFor="salarioMax" value="Salario máx." />
              <TextInput id="salarioMax" type="number" min={0} defaultValue={vacante.salarioMax} />
            </div>
          </div>

          <div>
            <Label htmlFor="descripcion" value="Descripción" />
            <Textarea id="descripcion" rows={4} defaultValue={vacante.descripcion} />
          </div>

          <div>
            <Label htmlFor="requisitos" value="Requisitos" />
            <Textarea id="requisitos" rows={4} defaultValue={vacante.requisitos} />
          </div>

          <div className="flex items-center gap-4">
            <ToggleSwitch checked={vacante.remoto} label="Permite trabajo remoto" onChange={() => {}} />
            <Alert color="warning" className="py-2">
              <Icon icon="solar:info-circle-bold" width={16} className="mr-1" /> Recuerda guardar los cambios.
            </Alert>
          </div>

          <div className="flex justify-end gap-2">
            <Button color="light" type="button" onClick={() => navigate(-1)} disabled={saving}>
              Cancelar
            </Button>
            <Button color="primary" type="submit" isProcessing={saving}>
              <Icon icon="solar:save-2-bold" className="mr-2" width={16} />
              Guardar Cambios
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}
