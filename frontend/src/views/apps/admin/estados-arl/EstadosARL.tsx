import { Card } from 'flowbite-react';
import { Icon } from '@iconify/react';
import BreadcrumbComp from 'src/layouts/full/shared/breadcrumb/BreadcrumbComp';

const BCrumb = [
  {
    to: "/",
    title: "Dashboard",
  },
  {
    to: "/apps/admin",
    title: "Administración",
  },
  {
    title: "Configuración Agencia",
  },
  {
    title: "Estados ARL",
  },
];

const EstadosARL = () => {
  return (
    <>
      <BreadcrumbComp title="Estados ARL" items={BCrumb} />
      
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark dark:text-white mb-2">Estados ARL</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Configura los estados disponibles para ARL.
        </p>
      </div>

      <Card>
        <div className="p-6 text-center">
          <Icon icon="solar:health-bold-duotone" className="text-gray-400 mx-auto mb-4" width={64} />
          <h3 className="text-lg font-semibold text-dark dark:text-white mb-2">
            Módulo en Desarrollo
          </h3>
          <p className="text-gray-500">
            La gestión de estados ARL estará disponible próximamente.
          </p>
        </div>
      </Card>
    </>
  );
};

export default EstadosARL; 