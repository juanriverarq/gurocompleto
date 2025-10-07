import React from 'react';
import { Card } from 'flowbite-react';
import BreadcrumbComp from '../../../layouts/full/shared/breadcrumb/BreadcrumbComp';

const BCrumb = [
  {
    to: '/',
    title: 'Inicio',
  },
  {
    title: 'IconListTypo',
  },
];

const IconListTypo: React.FC = () => {
  return (
    <>
      <BreadcrumbComp title="IconListTypo" items={BCrumb} />
      
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12">
          <Card>
            <div className="text-center p-8">
              <div className="text-6xl mb-4">⚠️</div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                IconListTypo
              </h2>
              <p className="text-gray-600 mb-4">
                Esta sección está temporalmente deshabilitada para completar el despliegue.
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800 text-sm">
                  La funcionalidad completa estará disponible después del despliegue.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
};

export default IconListTypo;
