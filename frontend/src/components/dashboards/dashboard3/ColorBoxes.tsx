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
        price: `$${(parseFloat(data.finanzas.valor_primas_numero) / 1000000).toFixed(1)}M`,
        link: "/apps/comisiones",
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
              <div className="lg:basis-1/5 md:basis-1/4 basis-full lg:shrink shrink-0" key={index}>
                <div
                  className={`text-center px-5 py-30 rounded-tw ${item.bg}`}
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
                  <Button
                    as={Link}
                    to={item.link}
                    className="w-fit mx-auto mt-5 bg-white hover:bg-dark text-ld font-semibold hover:text-white shadow-sm py-1 px-1 dark:bg-darkgray dark:hover:bg-dark"
                    size="xs"
                  >
                    Ver Detalles
                  </Button>
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
