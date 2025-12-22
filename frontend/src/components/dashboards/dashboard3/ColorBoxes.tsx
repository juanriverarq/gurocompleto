import { Icon } from "@iconify/react";
import { Button } from "flowbite-react";
import { Link } from "react-router";
import CardBox from "src/components/shared/CardBox";
import { useDashboardData } from "../../../hooks/useDashboardData";

interface ColorBoxesProps {
  startDate?: string | null;
  endDate?: string | null;
}

const ColorBoxes = ({ startDate, endDate }: ColorBoxesProps) => {
  const { data, loading, error } = useDashboardData({ startDate, endDate });

  const getColorboxData = () => {
    if (!data) {
      return [
        {
          bg: "primary-gradient",
          icon: "solar:shield-check-linear",
          color: "bg-primary",
          title: "Pólizas Activas",
          price: "Cargando...",
          link: "/apps/seguros/polizas",
        },
        {
          bg: "warning-gradient",
          icon: "solar:document-text-linear",
          color: "bg-warning",
          title: "Siniestros Pendientes",
          price: "Cargando...",
          link: "/apps/seguros/siniestros",
        },
        {
          bg: "secondary-gradient",
          icon: "solar:users-group-rounded-linear",
          color: "bg-secondary",
          title: "Clientes Activos",
          price: "Cargando...",
          link: "/apps/seguros/clientes",
        },
        {
          bg: "error-gradient",
          icon: "solar:danger-triangle-linear",
          color: "bg-error",
          title: "Por Vencer",
          price: "Cargando...",
          link: "/apps/seguros/renovaciones",
        },
        {
          bg: "success-gradient",
          icon: "solar:dollar-minimalistic-linear",
          color: "bg-success",
          title: "Primas Cobradas",
          price: "Cargando...",
          link: "/apps/comisiones",
        },
      ];
    }

    // Formatear valores de recaudos
    const primasCobradas = data.recaudos?.primas_cobradas || 0;
    const comisionesCobradas = data.recaudos?.comisiones_cobradas || 0;
    const comisionesPendientes = data.recaudos?.comisiones_pendientes || 0;

    const formatMoney = (value: number) => {
      if (value >= 1000000) {
        return `$${(value / 1000000).toFixed(1)}M`;
      } else if (value >= 1000) {
        return `$${(value / 1000).toFixed(0)}K`;
      }
      return `$${value.toLocaleString()}`;
    };

    return [
      {
        bg: "primary-gradient",
        icon: "solar:shield-check-linear",
        color: "bg-primary",
        title: "Pólizas Activas",
        price: data.resumen_polizas.activas.toLocaleString(),
        link: "/apps/seguros/polizas",
      },
      {
        bg: "warning-gradient",
        icon: "solar:document-text-linear",
        color: "bg-warning",
        title: "Siniestros Pendientes",
        price: data.siniestros.pendientes.toLocaleString(),
        link: "/apps/seguros/siniestros",
      },
      {
        bg: "secondary-gradient",
        icon: "solar:users-group-rounded-linear",
        color: "bg-secondary",
        title: "Clientes Activos",
        price: data.clientes.activos.toLocaleString(),
        link: "/apps/seguros/clientes",
      },
      {
        bg: "error-gradient",
        icon: "solar:danger-triangle-linear",
        color: "bg-error",
        title: "Por Vencer",
        price: data.resumen_polizas.por_vencer.toLocaleString(),
        link: "/apps/seguros/renovaciones",
      },
      {
        bg: "success-gradient",
        icon: "solar:dollar-minimalistic-linear",
        color: "bg-success",
        title: "Primas Cobradas",
        price: formatMoney(primasCobradas),
        subtitle: `${data.recaudos?.polizas_recaudadas || 0} pólizas`,
        link: "/apps/cartera/clientes",
      },
      {
        bg: "indigo-gradient",
        icon: "solar:wallet-money-linear",
        color: "bg-indigo-500",
        title: "Comisiones Cobradas",
        price: formatMoney(comisionesCobradas),
        subtitle: `Pendiente: ${formatMoney(comisionesPendientes)}`,
        link: "/apps/cartera/clientes",
      },
    ];
  };

  const colorboxData = getColorboxData();

  if (error) {
    return (
      <CardBox>
        <div className="text-center py-10">
          <p className="text-red-500">Error al cargar datos del dashboard</p>
          <p className="text-sm text-gray-500 mt-2">{error}</p>
        </div>
      </CardBox>
    );
  }

  return (
    <>
      <CardBox>
        <div className="overflow-x-auto">
          <div className="flex gap-30 min-w-max">
            {colorboxData.map((item, index) => (
              <div className="lg:basis-1/6 md:basis-1/4 basis-full lg:shrink shrink-0" key={index}>
                <div
                  className={`text-center px-5 py-30 rounded-tw ${item.bg} h-full flex flex-col`}
                >
                  <span
                    className={`h-12 w-12 mx-auto flex items-center justify-center rounded-tw ${item.color}`}
                  >
                    <Icon
                      icon={item.icon}
                      className="text-white"
                      height={24}
                    />
                  </span>
                  <p className="text-ld font-normal mt-4 mb-2">
                    {item.title}
                  </p>
                  <h4 className="text-22">
                    {loading ? (
                      <span className="animate-pulse">...</span>
                    ) : (
                      item.price
                    )}
                  </h4>
                  <p className="text-xs text-gray-600 mt-1 h-4">{item.subtitle || ''}</p>
                  <div className="mt-auto pt-3">
                    <Button
                      as={Link}
                      to={item.link}
                      className="w-fit mx-auto bg-white hover:bg-dark text-ld font-semibold hover:text-white shadow-sm py-1 px-1 dark:bg-darkgray dark:hover:bg-dark"
                      size="xs"
                    >
                      Ver Detalles
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardBox>
    </>
  );
};

export default ColorBoxes;
