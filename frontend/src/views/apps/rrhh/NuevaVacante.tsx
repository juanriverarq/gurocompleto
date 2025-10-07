import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Label, TextInput, Select, Textarea, ToggleSwitch, Alert } from 'flowbite-react';
import { Icon } from '@iconify/react';
import BreadcrumbComp from 'src/layouts/full/shared/breadcrumb/BreadcrumbComp';

const BCrumb = [
  { to: '/', title: 'Dashboard' },
  { to: '/apps/recursos-humanos', title: 'Recursos Humanos' },
  { title: 'Nueva Vacante' },
];

export default function NuevaVacante() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [remote, setRemote] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    // TODO: Integración API
    setTimeout(() => {
      setSaving(false);
      navigate('/apps/recursos-humanos');
    }, 800);
  };

  return (
    <>
      <BreadcrumbComp title="Nueva Vacante" items={BCrumb} />

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cargo" value="Cargo" />
              <TextInput id="cargo" required placeholder="Ej. Frontend Developer" />
            </div>
            <div>
              <Label htmlFor="area" value="Área" />
              <Select id="area" required>
                <option value="">Selecciona un área</option>
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
              <Select id="seniority" required>
                <option>Junior</option>
                <option>Semi Senior</option>
                <option>Senior</option>
                <option>Lead</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="modalidad" value="Modalidad" />
              <Select id="modalidad" required defaultValue={remote ? 'Remoto' : 'Híbrido'}>
                <option>Remoto</option>
                <option>Híbrido</option>
                <option>Presencial</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="ubicacion" value="Ubicación" />
              <TextInput id="ubicacion" placeholder="Ciudad / País" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="salarioMin" value="Salario mín." />
              <TextInput id="salarioMin" type="number" min={0} placeholder="Ej. 3000" />
            </div>
            <div>
              <Label htmlFor="salarioMax" value="Salario máx." />
              <TextInput id="salarioMax" type="number" min={0} placeholder="Ej. 5000" />
            </div>
          </div>

          <div>
            <Label htmlFor="descripcion" value="Descripción" />
            <Textarea id="descripcion" rows={4} placeholder="Resumen del rol, responsabilidades y stack" />
          </div>

          <div>
            <Label htmlFor="requisitos" value="Requisitos" />
            <Textarea id="requisitos" rows={4} placeholder="Lista de requisitos y habilidades" />
          </div>

          <div className="flex items-center gap-4">
            <ToggleSwitch checked={remote} label="Permite trabajo remoto" onChange={setRemote} />
            <Alert color="info" className="py-2">
              <Icon icon="solar:info-circle-bold" width={16} className="mr-1" /> Esta información puede editarse luego.
            </Alert>
          </div>

          <div className="flex justify-end gap-2">
            <Button color="light" type="button" onClick={() => navigate(-1)} disabled={saving}>
              Cancelar
            </Button>
            <Button color="primary" type="submit" isProcessing={saving}>
              <Icon icon="solar:save-2-bold" className="mr-2" width={16} />
              Guardar Vacante
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}
