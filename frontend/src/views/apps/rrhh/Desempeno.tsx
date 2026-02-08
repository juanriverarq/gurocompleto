import { Card, Button, Table, Badge, Progress, TextInput, Select, Modal, Label, Pagination } from 'flowbite-react';
import { Icon } from '@iconify/react';
import HeroButton from 'src/components/HeroButton';
import { useState } from 'react';

type Evaluacion = {
  id: string;
  ciclo: string;
  estado: 'En curso' | 'Planificado' | 'Cerrado';
  avance: number;
};

type OKR = {
  id: string;
  objetivo: string;
  avance: number;
};

export default function Desempeno() {
  const [evaluaciones] = useState<Evaluacion[]>([
    { id: 'EV-2025-01', ciclo: 'Q1 2025', estado: 'En curso', avance: 62 },
    { id: 'EV-2024-04', ciclo: 'Q4 2024', estado: 'Cerrado', avance: 100 },
    { id: 'EV-2024-03', ciclo: 'Q3 2024', estado: 'Cerrado', avance: 100 },
    { id: 'EV-2024-02', ciclo: 'Q2 2024', estado: 'Cerrado', avance: 100 },
    { id: 'EV-2024-01', ciclo: 'Q1 2024', estado: 'Cerrado', avance: 100 },
  ]);

  const [okrs, setOkrs] = useState<OKR[]>([
    { id: 'OKR-1', objetivo: 'Incrementar NPS interno', avance: 74 },
    { id: 'OKR-2', objetivo: 'Reducir tiempo de contratación', avance: 55 },
  ]);

  // Filtros y paginación para ciclos
  const [searchCiclos, setSearchCiclos] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | Evaluacion['estado']>('todos');
  const [page, setPage] = useState(1);
  const perPage = 4;

  // Modal nueva evaluación
  const [modalEvalOpen, setModalEvalOpen] = useState(false);

  // Edición inline de OKRs
  const [okrEditId, setOkrEditId] = useState<string | null>(null);
  const [tmpObjetivo, setTmpObjetivo] = useState('');
  const [tmpAvance, setTmpAvance] = useState<number>(0);

  return (
    <>
      <Card className="p-6 mb-6 bg-gradient-to-r from-warning/10 to-success/10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-dark dark:text-white mb-2">Desempeño</h1>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl">Evaluaciones, OKRs y metas, competencias, feedback e IPD.</p>
          </div>
          <div className="flex gap-2">
            <HeroButton icon="solar:document-add-bold" onClick={() => setModalEvalOpen(true)}>Nueva Evaluación</HeroButton>
            <HeroButton icon="solar:target-bold">Nuevo OKR</HeroButton>
          </div>
        </div>
      </Card>

      {/* Filtros de ciclos */}
      <Card className="p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2">
            <Label htmlFor="searchCiclos" value="Buscar ciclos" className="mb-1 block" />
            <TextInput id="searchCiclos" placeholder="Buscar por ID o ciclo" value={searchCiclos} onChange={(e) => setSearchCiclos(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="estadoCiclo" value="Estado" className="mb-1 block" />
            <Select id="estadoCiclo" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value as typeof filtroEstado)}>
              <option value="todos">Todos</option>
              <option value="Planificado">Planificado</option>
              <option value="En curso">En curso</option>
              <option value="Cerrado">Cerrado</option>
            </Select>
          </div>
          <div className="flex items-end">
            <Button color="light" onClick={() => { setSearchCiclos(''); setFiltroEstado('todos'); setPage(1); }}>Limpiar</Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-dark dark:text-white mb-3">Ciclos de Evaluación</h3>
          <div className="overflow-x-auto">
            <Table>
              <Table.Head>
                <Table.HeadCell>ID</Table.HeadCell>
                <Table.HeadCell>Ciclo</Table.HeadCell>
                <Table.HeadCell>Estado</Table.HeadCell>
                <Table.HeadCell>Avance</Table.HeadCell>
                <Table.HeadCell></Table.HeadCell>
              </Table.Head>
              <Table.Body className="divide-y">
                {evaluaciones
                  .filter((e: Evaluacion) => (filtroEstado === 'todos' ? true : e.estado === filtroEstado))
                  .filter((e: Evaluacion) => (searchCiclos ? (e.id.toLowerCase().includes(searchCiclos.toLowerCase()) || e.ciclo.toLowerCase().includes(searchCiclos.toLowerCase())) : true))
                  .slice((page - 1) * perPage, page * perPage)
                  .map((e: Evaluacion) => (
                  <Table.Row key={e.id} className="bg-white dark:border-gray-700 dark:bg-gray-800">
                    <Table.Cell className="whitespace-nowrap font-medium text-gray-900 dark:text-white">{e.id}</Table.Cell>
                    <Table.Cell>{e.ciclo}</Table.Cell>
                    <Table.Cell><Badge color={e.estado === 'Cerrado' ? 'success' : e.estado === 'En curso' ? 'warning' : 'info'}>{e.estado}</Badge></Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-2 min-w-[140px]">
                        <Progress progress={e.avance} color={e.avance === 100 ? 'success' : e.avance > 60 ? 'warning' : 'blue'} className="flex-1" />
                        <span className="text-sm font-medium">{e.avance}%</span>
                      </div>
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button size="xs" color="light"><Icon icon="solar:eye-bold" width={14} className="mr-1"/>Ver</Button>
                        <Button size="xs" color="primary"><Icon icon="solar:pen-bold" width={14} className="mr-1"/>Editar</Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
          <div className="pt-3 flex justify-end">
            <Pagination
              currentPage={page}
              onPageChange={setPage}
              totalPages={Math.max(1, Math.ceil(
                evaluaciones
                  .filter((e: Evaluacion) => (filtroEstado === 'todos' ? true : e.estado === filtroEstado))
                  .filter((e: Evaluacion) => (searchCiclos ? (e.id.toLowerCase().includes(searchCiclos.toLowerCase()) || e.ciclo.toLowerCase().includes(searchCiclos.toLowerCase())) : true))
                  .length / perPage
              ))}
            />
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-dark dark:text-white mb-3">OKRs y Metas</h3>
          <div className="space-y-3">
            {okrs.map((o) => (
              <Card key={o.id} className="p-4">
                {okrEditId === o.id ? (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor={`obj-${o.id}`} value="Objetivo" className="mb-1 block" />
                      <TextInput id={`obj-${o.id}`} value={tmpObjetivo} onChange={(e) => setTmpObjetivo(e.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor={`av-${o.id}`} value={`Avance: ${tmpAvance}%`} className="mb-1 block" />
                      <input id={`av-${o.id}`} type="range" min={0} max={100} value={tmpAvance} onChange={(e) => setTmpAvance(Number(e.target.value))} className="w-full" />
                      <Progress progress={tmpAvance} color={tmpAvance > 70 ? 'success' : 'warning'} />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button size="xs" color="light" onClick={() => setOkrEditId(null)}>Cancelar</Button>
                      <Button size="xs" color="primary" onClick={() => {
                        setOkrs((prev) => prev.map((k) => (k.id === o.id ? { ...k, objetivo: tmpObjetivo, avance: tmpAvance } : k)));
                        setOkrEditId(null);
                      }}>Guardar</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold">{o.objetivo}</h4>
                      <span className="text-sm font-medium">{o.avance}%</span>
                    </div>
                    <Progress progress={o.avance} color={o.avance > 70 ? 'success' : 'warning'} />
                    <div className="flex justify-end mt-3">
                      <Button size="xs" color="light" onClick={() => { setOkrEditId(o.id); setTmpObjetivo(o.objetivo); setTmpAvance(o.avance); }}>
                        <Icon icon="solar:pen-bold" width={14} className="mr-1" />Editar
                      </Button>
                    </div>
                  </>
                )}
              </Card>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1"><Icon icon="solar:stars-bold" width={18} /><h4 className="font-semibold">Competencias</h4></div>
          <p className="text-sm text-gray-600">Modelos por rol, niveles y evidencias.</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1"><Icon icon="solar:message-dots-bold" width={18} /><h4 className="font-semibold">Feedback</h4></div>
          <p className="text-sm text-gray-600">1:1, feedback continuo y reconocimientos.</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1"><Icon icon="solar:route-bold" width={18} /><h4 className="font-semibold">Plan Individual de Desarrollo</h4></div>
          <p className="text-sm text-gray-600">Objetivos de crecimiento y plan de acción.</p>
        </Card>
      </div>

      {/* Modal Nueva Evaluación */}
      <Modal show={modalEvalOpen} size="lg" onClose={() => setModalEvalOpen(false)} popup>
        <Modal.Header />
        <Modal.Body>
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Nueva Evaluación</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="ciclo" value="Ciclo" className="mb-1 block" />
                <TextInput id="ciclo" placeholder="Ej. Q2 2025" />
              </div>
              <div>
                <Label htmlFor="estado" value="Estado" className="mb-1 block" />
                <Select id="estado" defaultValue="Planificado">
                  <option>Planificado</option>
                  <option>En curso</option>
                  <option>Cerrado</option>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button color="light" onClick={() => setModalEvalOpen(false)}>Cancelar</Button>
              <Button color="primary" onClick={() => setModalEvalOpen(false)}>Crear</Button>
            </div>
          </div>
        </Modal.Body>
      </Modal>
    </>
  );
}
