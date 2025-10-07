import Logo from "src/layouts/full/shared/logo/Logo"
import { Link } from "react-router"
import AuthLogin from "../authforms/AuthLogin"
import SocialButtons from "../authforms/SocialButtons"
import LeftSidebarPart from "../LeftSidebarPart"
import { useUnifiedAuth } from "src/context/UnifiedAuthContext"
import { useMemo } from "react"


const Login = () => {
  const { tenant } = useUnifiedAuth();
  const branding = useMemo(() => {
    const defaults = {
      primary_color: '#635BFF',
      secondary_color: '#16CDC7',
    };
    const b = (tenant as any)?.branding || {};
    return {
      ...defaults,
      ...b,
    } as { primary_color: string; secondary_color: string };
  }, [tenant]);

  return (
    <>
      <div className="relative overflow-hidden h-screen">
        <div className="grid grid-cols-12 gap-3 h-screen bg-white dark:bg-darkgray">
          <div className="xl:col-span-4 lg:col-span-6 col-span-12 sm:px-12 px-4">
            <div className="flex h-screen items-center px-3 lg:justify-start justify-center">
              <div className="max-w-md w-full mx-auto">
                <Logo />
                <h3 className="text-2xl font-bold my-3 mt-5">Accede a Guro</h3>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  El futuro de la gestión de seguros, potenciado por IA
                </p>
                <SocialButtons title="o inicia sesión con" />
                <AuthLogin />
                <div className="flex gap-2 text-base dark:text-white font-medium mt-6 items-center justify-center">
                  <p>¿Nuevo en Guro?</p>
                  <Link
                    to={"/auth/auth1/register"}
                    className="text-primary text-sm font-medium hover:underline"
                  >
                    Crea tu cuenta
                  </Link>
                </div>
              </div>
            </div>
          </div>
          <div className="xl:col-span-8 lg:col-span-6 col-span-12 bg-[#0A2540] dark:bg-dark lg:block hidden relative overflow-hidden">
            <LeftSidebarPart />
          </div>
        </div>
      </div>
    </>
  )
}

export default Login