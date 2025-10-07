import { Card, Button, Table, Badge, Progress, Alert, TextInput, Select, Modal, Label, Checkbox, Pagination } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { useState } from 'react';

type Colaborador = {
  id: string;
  nombre: string;
  cargo: string;
  area: string;
  estado: 'Activo' | 'Vacaciones' | 'Incapacidad' | 'Inactivo';
};

export default function Personas() {
  const [colaboradores] = useState<Colaborador[]>([
    { id: 'EMP-101', nombre: 'Ana Torres', cargo: 'PM', area: 'Producto', estado: 'Activo' },
    { id: 'EMP-102', nombre: 'Luis Pérez', cargo: 'Frontend Dev', area: 'Tecnología', estado: 'Vacaciones' },
    { id: 'EMP-103', nombre: 'María Gómez', cargo: 'RR.HH.', area: 'Personas', estado: 'Incapacidad' },
    { id: 'EMP-104', nombre: 'Carlos Ríos', cargo: 'Backend Dev', area: 'Tecnología', estado: 'Activo' },
    { id: 'EMP-105', nombre: 'Sofía Díaz', cargo: 'UX Designer', area: 'Producto', estado: 'Activo' },
    { id: 'EMP-106', nombre: 'Jorge Luna', cargo: 'Ventas', area: 'Comercial', estado: 'Inactivo' },
  ]);

  const programas = [
    { id: 'onb-1', nombre: 'Onboarding', progreso: 82 },
    { id: 'hs-1', nombre: 'Salud & Bienestar', progreso: 55 },
    { id: 'ldr-1', nombre: 'Liderazgo', progreso: 40 },
  ];

  // Toolbar: filtros, búsqueda y acciones
  const [search, setSearch] = useState('');
  const [filtroArea, setFiltroArea] = useState<'todas' | string>('todas');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | Colaborador['estado']>('todos');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [loading] = useState(false);

  // Paginación y ordenamiento
  const [page, setPage] = useState(1);
  const perPage = 5;
  const [sortKey, setSortKey] = useState<'nombre' | 'cargo' | 'area' | 'estado'>('nombre');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Modales
  const [modalAltaOpen, setModalAltaOpen] = useState(false);
  const [modalEditOpen, setModalEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<Colaborador | null>(null);

  // Derivados: filtros, orden y paginación
  const filtered: Colaborador[] = colaboradores
    .filter((c: Colaborador) => (filtroArea === 'todas' ? true : c.area === filtroArea))
    .filter((c: Colaborador) => (filtroEstado === 'todos' ? true : c.estado === filtroEstado))
    .filter((c: Colaborador) => (search ? (
      c.nombre.toLowerCase().includes(search.toLowerCase()) ||
      c.cargo.toLowerCase().includes(search.toLowerCase()) ||
      c.id.toLowerCase().includes(search.toLowerCase())
    ) : true));

  const sorted: Colaborador[] = [...filtered].sort((a: Colaborador, b: Colaborador) => {
    const A = String(a[sortKey]).toLowerCase();
    const B = String(b[sortKey]).toLowerCase();
    if (A < B) return sortDir === 'asc' ? -1 : 1;
    if (A > B) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const paginated: Colaborador[] = sorted.slice((page - 1) * perPage, page * perPage);

  return (
    <>
      <Card className="p-6 mb-6 bg-gradient-to-r from-primary/10 to-indigo-500/10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-dark dark:text-white mb-2">Gestión de Personas</h1>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl">Onboarding, colaboradores, ausencias y documentos del equipo.</p>
          </div>
          <div className="flex gap-2">
            <Button color="primary" onClick={() => setModalAltaOpen(true)}><Icon icon="solar:user-plus-bold" className="mr-2" width={18} />Alta Colaborador</Button>
            <Button color="light"><Icon icon="solar:download-minimalistic-bold" className="mr-2" width={18} />Exportar</Button>
          </div>
        </div>
      </Card>

      {/* Toolbar de filtros y búsqueda */}
      <Card className="p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2">
            <Label htmlFor="search" value="Buscar" className="mb-1 block" />
            <TextInput id="search" placeholder="Buscar por nombre, cargo o ID" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="area" value="Área" className="mb-1 block" />
            <Select id="area" value={filtroArea} onChange={(e) => { setFiltroArea(e.target.value as typeof filtroArea); setPage(1); }}>
              <option value="todas">Todas</option>
              <option>Producto</option>
              <option>Tecnología</option>
              <option>Personas</option>
              <option>Comercial</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="estado" value="Estado" className="mb-1 block" />
            <Select id="estado" value={filtroEstado} onChange={(e) => { setFiltroEstado(e.target.value as typeof filtroEstado); setPage(1); }}>
              <option value="todos">Todos</option>
              <option value="Activo">Activo</option>
              <option value="Vacaciones">Vacaciones</option>
              <option value="Incapacidad">Incapacidad</option>
              <option value="Inactivo">Inactivo</option>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Button color="light" onClick={() => { setSearch(''); setFiltroArea('todas'); setFiltroEstado('todos'); setPage(1); }}>Limpiar</Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-2">Programas</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {programas.map(p => (
              <Card key={p.id} className="p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">{p.nombre}</p>
                  <span className="text-xs font-medium">{p.progreso}%</span>
                </div>
                <Progress progress={p.progreso} color={p.progreso > 70 ? 'success' : p.progreso > 40 ? 'warning' : 'blue'} className="mt-2" />
              </Card>
            ))}
          </div>
        </Card>
        <Card className="p-4 lg:col-span-2">
          <h3 className="text-sm font-semibold mb-3">Onboarding / Offboarding</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card className="p-3">
              <div className="flex items-center gap-2 mb-1"><Icon icon="solar:login-3-bold" width={18} /><h4 className="font-semibold text-sm">Onboarding</h4></div>
              <p className="text-xs text-gray-600">Checklists, tareas y aprobaciones.</p>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2 mb-1"><Icon icon="solar:logout-3-bold" width={18} /><h4 className="font-semibold text-sm">Offboarding</h4></div>
              <p className="text-xs text-gray-600">Devolución de activos y desvinculación segura.</p>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2 mb-1"><Icon icon="solar:structure-bold" width={18} /><h4 className="font-semibold text-sm">Organigrama y directorio</h4></div>
              <p className="text-xs text-gray-600">Estructura y contactos de la organización.</p>
            </Card>
          </div>
        </Card>
      </div>

      <Card className="p-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-dark dark:text-white">Colaboradores</h3>
          <div className="flex gap-2">
            <Button size="xs" color="light" disabled={selected.size === 0}><Icon icon="solar:bolt-bold" width={14} className="mr-1"/>Acciones</Button>
            <Button size="xs" color="light"><Icon icon="solar:download-minimalistic-bold" width={14} className="mr-1"/>Exportar</Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <Table.Head>
              <Table.HeadCell className="w-10">
                <Checkbox checked={selectAll} onChange={(e) => {
                  const checked = e.target.checked;
                  setSelectAll(checked);
                  if (checked) {
                    const allIds = filtered.map((c) => c.id);
                    setSelected(new Set(allIds));
                  } else {
                    setSelected(new Set());
                  }
                }} />
              </Table.HeadCell>
              <Table.HeadCell onClick={() => { setSortKey('nombre'); setSortDir(sortKey === 'nombre' && sortDir === 'asc' ? 'desc' : 'asc'); }} className="cursor-pointer">Nombre</Table.HeadCell>
              <Table.HeadCell onClick={() => { setSortKey('cargo'); setSortDir(sortKey === 'cargo' && sortDir === 'asc' ? 'desc' : 'asc'); }} className="cursor-pointer">Cargo</Table.HeadCell>
              <Table.HeadCell onClick={() => { setSortKey('area'); setSortDir(sortKey === 'area' && sortDir === 'asc' ? 'desc' : 'asc'); }} className="cursor-pointer">Área</Table.HeadCell>
              <Table.HeadCell onClick={() => { setSortKey('estado'); setSortDir(sortKey === 'estado' && sortDir === 'asc' ? 'desc' : 'asc'); }} className="cursor-pointer">Estado</Table.HeadCell>
              <Table.HeadCell></Table.HeadCell>
            </Table.Head>
            <Table.Body className="divide-y">
              {loading && (
                <Table.Row>
                  <Table.Cell colSpan={6}>
                    <div className="animate-pulse h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
                    <div className="animate-pulse h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                  </Table.Cell>
                </Table.Row>
              )}
              {!loading && paginated.length === 0 && (
                <Table.Row>
                  <Table.Cell colSpan={6}>
                    <div className="text-center text-sm text-gray-500">No hay colaboradores para los filtros aplicados.</div>
                  </Table.Cell>
                </Table.Row>
              )}
              {!loading && paginated.map((c) => (
                <Table.Row key={c.id} className="bg-white dark:border-gray-700 dark:bg-gray-800">
                  <Table.Cell className="w-10">
                    <Checkbox checked={selected.has(c.id)} onChange={(e) => {
                      const s = new Set(selected);
                      if (e.target.checked) s.add(c.id); else s.delete(c.id);
                      setSelected(s);
                    }} />
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap font-medium text-gray-900 dark:text-white">{c.nombre} <span className="block text-xs text-gray-500">{c.id}</span></Table.Cell>
                  <Table.Cell>{c.cargo}</Table.Cell>
                  <Table.Cell>{c.area}</Table.Cell>
                  <Table.Cell>
                    <Badge color={c.estado === 'Activo' ? 'success' : c.estado === 'Vacaciones' ? 'warning' : c.estado === 'Incapacidad' ? 'purple' : 'gray'} className="capitalize">{c.estado}</Badge>
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button size="xs" color="light"><Icon icon="solar:eye-bold" width={14} className="mr-1"/>Ver</Button>
                      <Button size="xs" color="primary" onClick={() => { setEditItem(c); setModalEditOpen(true); }}><Icon icon="solar:pen-bold" width={14} className="mr-1"/>Editar</Button>
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
        <div className="pt-3 flex justify-between items-center text-sm text-gray-500">
          <div>
            {selected.size > 0 ? `${selected.size} seleccionados` : ''}
          </div>
          <Pagination currentPage={page} onPageChange={setPage} totalPages={Math.max(1, Math.ceil(filtered.length / perPage))} />
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-dark dark:text-white mb-3">Ausencias</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card className="p-3"><div className="flex items-center gap-2 mb-1"><Icon icon="solar:calendar-bold" width={18} /><h4 className="font-semibold text-sm">Vacaciones</h4></div><p className="text-xs text-gray-600">Solicitudes y aprobaciones.</p></Card>
            <Card className="p-3"><div className="flex items-center gap-2 mb-1"><Icon icon="solar:heart-pulse-2-bold" width={18} /><h4 className="font-semibold text-sm">Incapacidades</h4></div><p className="text-xs text-gray-600">Registro y seguimiento.</p></Card>
          </div>
        </Card>
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-dark dark:text-white mb-3">Documentos</h3>
          <Alert color="info"><Icon icon="solar:folder-with-files-bold" className="mr-2" width={18}/> Sube contratos, certificaciones y anexos. Soporta firma digital.</Alert>
        </Card>
      </div>

      {/* Modal Alta */}
      <Modal show={modalAltaOpen} size="lg" onClose={() => setModalAltaOpen(false)} popup>
        <Modal.Header />
        <Modal.Body>
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Alta de Colaborador</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="nombre" value="Nombre" className="mb-1 block" />
                <TextInput id="nombre" placeholder="Nombre completo" />
              </div>
              <div>
                <Label htmlFor="cargo" value="Cargo" className="mb-1 block" />
                <TextInput id="cargo" placeholder="Cargo" />
              </div>
              <div>
                <Label htmlFor="area" value="Área" className="mb-1 block" />
                <Select id="area">
                  <option>Producto</option>
                  <option>Tecnología</option>
                  <option>Personas</option>
                  <option>Comercial</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="estadoCol" value="Estado" className="mb-1 block" />
                <Select id="estadoCol" defaultValue="Activo">
                  <option>Activo</option>
                  <option>Vacaciones</option>
                  <option>Incapacidad</option>
                  <option>Inactivo</option>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button color="light" onClick={() => setModalAltaOpen(false)}>Cancelar</Button>
              <Button color="primary" onClick={() => setModalAltaOpen(false)}>Crear</Button>
            </div>
          </div>
        </Modal.Body>
      </Modal>

      {/* Modal Edición */}
      <Modal show={modalEditOpen} size="lg" onClose={() => setModalEditOpen(false)} popup>
        <Modal.Header />
        <Modal.Body>
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Editar Colaborador</h3>
            {editItem && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="nombreEdit" value="Nombre" className="mb-1 block" />
                  <TextInput id="nombreEdit" defaultValue={editItem.nombre} />
                </div>
                <div>
                  <Label htmlFor="cargoEdit" value="Cargo" className="mb-1 block" />
                  <TextInput id="cargoEdit" defaultValue={editItem.cargo} />
                </div>
                <div>
                  <Label htmlFor="areaEdit" value="Área" className="mb-1 block" />
                  <Select id="areaEdit" defaultValue={editItem.area}>
                    <option>Producto</option>
                    <option>Tecnología</option>
                    <option>Personas</option>
                    <option>Comercial</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="estadoEdit" value="Estado" className="mb-1 block" />
                  <Select id="estadoEdit" defaultValue={editItem.estado}>
                    <option>Activo</option>
                    <option>Vacaciones</option>
                    <option>Incapacidad</option>
                    <option>Inactivo</option>
                  </Select>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button color="light" onClick={() => setModalEditOpen(false)}>Cancelar</Button>
              <Button color="primary" onClick={() => setModalEditOpen(false)}>Guardar</Button>
            </div>
          </div>
        </Modal.Body>
      </Modal>
    </>
  );
}
