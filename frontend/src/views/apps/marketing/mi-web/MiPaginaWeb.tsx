import { useMemo, useState } from 'react';
import { Card, Badge, Button, Alert, Table, Checkbox } from 'flowbite-react';
import { Icon } from '@iconify/react';
import CTABanner from 'src/components/ui-components/Banner/CTABanner';

const MiPaginaWeb = () => {
  const [previewMode, setPreviewMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  const stats = useMemo(
    () => ({
      visitasHoy: 128,
      leadsHoy: 9,
      tasaConversion: 7.0,
      tiempoMedio: '02:13',
    }),
    []
  );

  const previewContainerClass = useMemo(() => {
    if (previewMode === 'mobile') return 'max-w-[390px] aspect-[9/16]';
    if (previewMode === 'tablet') return 'max-w-[834px] aspect-[3/4]';
    return 'w-full aspect-[16/9]';
  }, [previewMode]);

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark dark:text-white mb-1">Mi Página Web</h1>
          <p className="text-gray-600 dark:text-gray-400">Vista previa del sitio, información y métricas clave.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button color="light" size="sm">
            <Icon icon="solar:pen-2-bold" width={16} className="mr-2" />
            Editar Diseño
          </Button>
          <Button color="primary" size="sm">
            <Icon icon="solar:upload-minimalistic-bold" width={16} className="mr-2" />
            Publicar
          </Button>
        </div>
      </div>

      {/* Métricas rápidas */}
      <div className="mb-2">
        <h3 className="text-lg font-semibold text-dark dark:text-white">Métricas rápidas</h3>
        <p className="text-sm text-gray-500">Actividad de hoy en tu sitio</p>
      </div>
      <div className="grid grid-cols-12 gap-[30px] mb-6">
        <Card className="p-6 col-span-12 md:col-span-6 xl:col-span-3 min-h-[120px]">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Icon icon="solar:eye-bold" className="text-primary" width={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-dark dark:text-white">{stats.visitasHoy}</h3>
              <p className="text-sm text-gray-500">Visitas Hoy</p>
            </div>
          </div>
        </Card>
        <Card className="p-6 col-span-12 md:col-span-6 xl:col-span-3 min-h-[120px]">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-success/10 rounded-lg">
              <Icon icon="solar:users-group-rounded-bold-duotone" className="text-success" width={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-dark dark:text-white">{stats.leadsHoy}</h3>
              <p className="text-sm text-gray-500">Leads Captados</p>
            </div>
          </div>
        </Card>
        <Card className="p-6 col-span-12 md:col-span-6 xl:col-span-3 min-h-[120px]">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-warning/10 rounded-lg">
              <Icon icon="solar:chart-bold" className="text-warning" width={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-dark dark:text-white">{stats.tasaConversion}%</h3>
              <p className="text-sm text-gray-500">Tasa de Conversión</p>
            </div>
          </div>
        </Card>
        <Card className="p-6 col-span-12 md:col-span-6 xl:col-span-3 min-h-[120px]">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-info/10 rounded-lg">
              <Icon icon="solar:clock-circle-bold" className="text-info" width={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-dark dark:text-white">{stats.tiempoMedio}</h3>
              <p className="text-sm text-gray-500">Tiempo Medio en Página</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Vista previa + Info lateral */}
      <div className="grid grid-cols-12 gap-[30px] mb-6">
        <div className="col-span-12 lg:col-span-8">
          <Card>
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Icon icon="solar:globe-bold-duotone" className="text-primary" width={24} />
                  <h3 className="text-xl font-semibold text-dark dark:text-white">Vista Previa del Sitio</h3>
                  <Badge color="info" className="ml-2">Borrador</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button color={previewMode === 'desktop' ? 'primary' : 'light'} size="xs" onClick={() => setPreviewMode('desktop')}>
                    <Icon icon="solar:monitor-bold" width={16} className="mr-1" />
                    Desktop
                  </Button>
                  <Button color={previewMode === 'tablet' ? 'primary' : 'light'} size="xs" onClick={() => setPreviewMode('tablet')}>
                    <Icon icon="solar:tablet-bold" width={16} className="mr-1" />
                    Tablet
                  </Button>
                  <Button color={previewMode === 'mobile' ? 'primary' : 'light'} size="xs" onClick={() => setPreviewMode('mobile')}>
                    <Icon icon="solar:smartphone-bold" width={16} className="mr-1" />
                    Móvil
                  </Button>
                </div>
              </div>
              <p className="mt-2 text-sm text-gray-500">Visualiza cómo se verá tu sitio en diferentes dispositivos.</p>
            </div>
            <div className="p-6">
              <div className={`mx-auto bg-gray-50 dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 flex items-center justify-center ${previewContainerClass}`}>
                <div className="w-full h-full p-4 overflow-auto max-w-full">
                  {/* Mock estructura sitio */}
                  <div className="h-10 bg-white/70 dark:bg-darkgray/70 rounded-md mb-4 flex items-center px-4 gap-3">
                    <span className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
                    <span className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                    <span className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                    <span className="ms-auto h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                  </div>
                  <div className="h-40 bg-primary/10 rounded-lg mb-4 flex items-center justify-center">
                    <span className="text-primary">Hero / Cabecera</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                    <div className="h-24 bg-white/70 dark:bg-darkgray/70 rounded" />
                    <div className="h-24 bg-white/70 dark:bg-darkgray/70 rounded" />
                    <div className="h-24 bg-white/70 dark:bg-darkgray/70 rounded" />
                  </div>
                  <div className="h-28 bg-white/70 dark:bg-darkgray/70 rounded mb-4" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="h-24 bg-white/70 dark:bg-darkgray/70 rounded" />
                    <div className="h-24 bg-white/70 dark:bg-darkgray/70 rounded" />
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-4">
          <Card className="mb-6">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-semibold text-dark dark:text-white">Información del Sitio</h3>
              <p className="mt-1 text-sm text-gray-500">Datos principales de tu sitio y estado actual.</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">URL</span>
                <div className="flex items-center gap-2">
                  <code className="text-primary">https://mi-agencia.guro.app</code>
                  <Button size="xs" color="light" title="Copiar URL">
                    <Icon icon="solar:copy-bold" width={14} />
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Dominio</span>
                <span className="text-dark dark:text-white">miagencia.com</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Estado</span>
                <Badge color="warning">No publicado</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Última publicación</span>
                <span className="text-dark dark:text-white">—</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Plantilla</span>
                <span className="text-dark dark:text-white">Clásica</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Paleta</span>
                <div className="flex items-center gap-1">
                  <span className="h-4 w-4 rounded bg-primary" />
                  <span className="h-4 w-4 rounded bg-success" />
                  <span className="h-4 w-4 rounded bg-warning" />
                </div>
              </div>
            </div>
          </Card>

          <Card className="mb-6">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-semibold text-dark dark:text-white">Acciones Rápidas</h3>
              <p className="mt-1 text-sm text-gray-500">Atajos para configurar tu sitio más rápido.</p>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button color="light" className="justify-start">
                <Icon icon="solar:widget-add-bold-duotone" width={18} className="mr-2" />
                Añadir sección
              </Button>
              <Button color="light" className="justify-start">
                <Icon icon="solar:palette-bold-duotone" width={18} className="mr-2" />
                Cambiar colores
              </Button>
              <Button color="light" className="justify-start">
                <Icon icon="solar:search-bold-duotone" width={18} className="mr-2" />
                SEO básico
              </Button>
              <Button color="light" className="justify-start">
                <Icon icon="solar:link-bold-duotone" width={18} className="mr-2" />
                Conectar dominio
              </Button>
            </div>
          </Card>

          <Card>
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-semibold text-dark dark:text-white">Checklist SEO</h3>
              <p className="mt-1 text-sm text-gray-500">Tareas recomendadas para mejorar tu posicionamiento.</p>
            </div>
            <div className="p-6 space-y-3">
              <label className="flex items-center gap-3 text-sm">
                <Checkbox defaultChecked /> Título y meta descripción
              </label>
              <label className="flex items-center gap-3 text-sm">
                <Checkbox /> Imágenes con texto alternativo
              </label>
              <label className="flex items-center gap-3 text-sm">
                <Checkbox /> Enlaces internos configurados
              </label>
              <label className="flex items-center gap-3 text-sm">
                <Checkbox /> Sitemap generado
              </label>
            </div>
          </Card>
        </div>
      </div>

      {/* Secciones adicionales */}
      <div className="grid grid-cols-12 gap-[30px] mb-6">
        <div className="col-span-12 xl:col-span-8">
          <Card>
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
              <Icon icon="solar:chart-2-bold-duotone" className="text-primary" width={24} />
              <h3 className="text-xl font-semibold text-dark dark:text-white">Fuentes de Tráfico</h3>
              </div>
              <p className="mt-1 text-sm text-gray-500">Resumen de los orígenes de tus visitas y conversiones.</p>
            </div>
            <div className="p-6 overflow-x-auto">
              <Table>
                <Table.Head>
                  <Table.HeadCell>Fuente</Table.HeadCell>
                  <Table.HeadCell>Visitas</Table.HeadCell>
                  <Table.HeadCell>Leads</Table.HeadCell>
                  <Table.HeadCell>Conversión</Table.HeadCell>
                </Table.Head>
                <Table.Body className="divide-y">
                  {[{f:'Orgánico', v:72, l:5, c:'6.9%'}, {f:'Referidos', v:30, l:2, c:'6.7%'}, {f:'Redes', v:18, l:1, c:'5.6%'}].map((r) => (
                    <Table.Row key={r.f} className="bg-white dark:border-gray-700 dark:bg-darkgray">
                      <Table.Cell className="whitespace-nowrap text-dark dark:text-white">{r.f}</Table.Cell>
                      <Table.Cell>{r.v}</Table.Cell>
                      <Table.Cell>{r.l}</Table.Cell>
                      <Table.Cell>{r.c}</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </div>
          </Card>
        </div>

        <div className="col-span-12 xl:col-span-4">
          <Card>
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
              <Icon icon="solar:clock-circle-bold-duotone" className="text-info" width={24} />
              <h3 className="text-xl font-semibold text-dark dark:text-white">Estado de Publicación</h3>
              </div>
              <p className="mt-1 text-sm text-gray-500">Progreso para dejar tu sitio listo y publicado.</p>
            </div>
            <div className="p-6 space-y-3">
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-warning" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Borrador preparado</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-gray-300" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Pendiente conectar dominio</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-gray-300" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Optimizar SEO básico</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-[30px] mb-6">
        <div className="col-span-12 xl:col-span-8">
          <Card>
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
              <Icon icon="solar:users-group-rounded-bold-duotone" className="text-success" width={24} />
              <h3 className="text-xl font-semibold text-dark dark:text-white">Últimos Leads</h3>
              </div>
              <p className="mt-1 text-sm text-gray-500">Leads captados desde tu web recientemente.</p>
            </div>
            <div className="p-6 overflow-x-auto">
              <Table>
                <Table.Head>
                  <Table.HeadCell>Nombre</Table.HeadCell>
                  <Table.HeadCell>Email</Table.HeadCell>
                  <Table.HeadCell>Interés</Table.HeadCell>
                  <Table.HeadCell>Fecha</Table.HeadCell>
                </Table.Head>
                <Table.Body className="divide-y">
                  {[
                    {n:'María Gómez', e:'maria@example.com', i:'Autos', f:'Hoy'},
                    {n:'Carlos Pérez', e:'carlos@example.com', i:'Vida', f:'Ayer'},
                    {n:'Luisa Rojas', e:'luisa@example.com', i:'Hogar', f:'Hace 2 días'},
                  ].map((r) => (
                    <Table.Row key={r.e} className="bg-white dark:border-gray-700 dark:bg-darkgray">
                      <Table.Cell className="whitespace-nowrap text-dark dark:text-white">{r.n}</Table.Cell>
                      <Table.Cell>{r.e}</Table.Cell>
                      <Table.Cell>{r.i}</Table.Cell>
                      <Table.Cell>{r.f}</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </div>
          </Card>
        </div>
        <div className="col-span-12 xl:col-span-4">
          <CTABanner />
        </div>
      </div>

      <Alert color="info" className="mb-6">
        <Icon icon="solar:info-circle-bold" className="mr-2" width={16} />
        <span>
          Esta es una vista previa. Pronto podrás editar tu sitio con un editor visual y publicar cambios.
        </span>
      </Alert>
    </>
  );
};

export default MiPaginaWeb;


