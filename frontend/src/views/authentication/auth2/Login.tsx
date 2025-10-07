import Logo from 'src/layouts/full/shared/logo/Logo';
import LeftSidebarPart from '../LeftSidebarPart';
import EmpleadoLogin from '../authforms/EmpleadoLogin';
import { useUnifiedAuth } from 'src/context/UnifiedAuthContext';
import { useMemo } from 'react';

const Login = () => {
  const { tenant } = useUnifiedAuth();
  const branding = useMemo(() => {
    const defaults = {
      primary_color: '#635BFF',
      secondary_color: '#16CDC7',
      logo_url: undefined as string | undefined,
      name: undefined as string | undefined,
    };
    const b = (tenant as any)?.branding || {};
    return {
      ...defaults,
      ...b,
      logo_url: b.logo_url || (tenant as any)?.logo_url || defaults.logo_url,
      name: (tenant as any)?.name || defaults.name,
    };
  }, [tenant]);

  return (
    <>
      <div className="relative overflow-hidden h-screen">
        <div className="grid grid-cols-12 gap-3 h-screen bg-white dark:bg-darkgray">
          <div className="xl:col-span-4 lg:col-span-6 col-span-12 sm:px-12 px-4">
            <div className="flex h-screen items-center px-3 lg:justify-start justify-center">
              <div className="max-w-md w-full mx-auto">
                <div className="flex items-center gap-3 mb-2">
                  {branding.logo_url ? (
                    <img src={branding.logo_url} alt="logo" className="h-10 w-auto" />
                  ) : (
                    <Logo />
                  )}
                  {branding.name && (
                    <span className="text-sm text-gray-600">{branding.name}</span>
                  )}
                </div>
                <h3 className="text-2xl font-bold my-3 mt-5">Acceso para Empleados</h3>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  Usa tus credenciales de empleado para ingresar
                </p>
                <EmpleadoLogin />
              </div>
            </div>
          </div>
          <div className="xl:col-span-8 lg:col-span-6 col-span-12 bg-[#0A2540] dark:bg-dark lg:block hidden relative overflow-hidden">
            <LeftSidebarPart />
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;


