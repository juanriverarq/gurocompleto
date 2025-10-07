
import Bgimg from "/src/assets/images/logos/Logo.svg";
import { Button } from "flowbite-react";
import { Link } from "react-router";
import { useUnifiedAuth } from "src/context/UnifiedAuthContext";
import { useMemo } from "react";

const LeftSidebarPart = () => {
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

  const hexToRgba = (hex: string, alpha: number) => {
    const cleaned = hex.replace('#','');
    const bigint = parseInt(cleaned.length === 3 ? cleaned.split('').map((c)=>c+c).join('') : cleaned, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const bgGradient = useMemo(() => {
    const a = hexToRgba(branding.primary_color || '#635BFF', 0.15);
    const b = hexToRgba(branding.secondary_color || '#16CDC7', 0.15);
    return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
  }, [branding]);

  return (
    <>
      <div className="circle-top"></div>
      <div>
        <img src={Bgimg} alt="Guro" className="circle-bottom opacity-20" />
      </div>
      <div className="flex xl:justify-start justify-center xl:ps-80 h-screen items-center z-10 relative"
           style={{ background: bgGradient }}>
        <div className="max-w-md">
          <h2 className="text-white text-[40px] font-bold leading-[normal]">
            Bienvenido a
            <br></br>
            Guro
          </h2>
          <p className="opacity-75 text-white my-4 text-base font-medium">
            La plataforma de gestión de seguros más avanzada, potenciada por inteligencia artificial para transformar tu negocio.
          </p>
          <Button as={Link} to="/frontend-pages/homepage" className="mt-6" color={"primary"}>
            Conocer Más
          </Button>
        </div>
      </div>
    </>
  );
};

export default LeftSidebarPart;
