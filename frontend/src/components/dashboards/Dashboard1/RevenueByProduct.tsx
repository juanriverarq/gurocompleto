
import  { useState } from "react";
import CardBox from "../../shared/CardBox";
import { Badge, Select, Table } from "flowbite-react";
import { Icon } from "@iconify/react";
import React from "react";
import { useDashboardData } from "../../../hooks/useDashboardData";




const RevenueByProduct = () => {
  const { data, loading, error } = useDashboardData();
  const dropdownItems = ["Sep 2024", "Oct 2024", "Nov 2024"];
  
  // Custom Tab
  const [activeTab, setActiveTab] = useState("autos");
  const handleTabClick = (tab: React.SetStateAction<string>) => {
    setActiveTab(tab);
  };

  // Mapeo de tipos de seguro
  const insuranceTypes = {
    "autos": {
      label: "Vehículos",
      icon: "solar:car-linear",
      bgColor: "bg-lightprimary"
    },
    "hogar": {
      label: "Hogar", 
      icon: "solar:home-2-linear",
      bgColor: "bg-lightsecondary"
    },
    "salud": {
      label: "Salud",
      icon: "solar:heart-pulse-linear", 
      bgColor: "bg-lightwarning"
    },
    "vida": {
      label: "Vida",
      icon: "solar:briefcase-linear",
      bgColor: "bg-lightsuccess"
    }
  };

  const getStatusInfo = (status: string) => {
    const statusMap: { [key: string]: { color: string, textColor: string, text: string } } = {
      'active': { color: 'lightsuccess', textColor: 'text-success', text: 'Activa' },
      'expired': { color: 'lighterror', textColor: 'text-error', text: 'Vencida' },
      'pending': { color: 'lightwarning', textColor: 'text-warning', text: 'Pendiente' },
      'cancelled': { color: 'lightdark', textColor: 'text-dark', text: 'Cancelada' }
    };
    return statusMap[status] || { color: 'lightprimary', textColor: 'text-primary', text: 'Vigente' };
  };

  const formatPremium = (premium: string | number) => {
    const amount = typeof premium === 'string' ? parseFloat(premium) : premium;
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
    return `$${amount.toLocaleString()}`;
  };

  const getPolizasByType = (type: string) => {
    if (!data?.polizas_detalladas) return [];
    return data.polizas_detalladas[type] || [];
  };

  if (loading) {
    return (
      <CardBox className="pb-3">
        <div className="sm:flex justify-between align-baseline">
          <div>
            <h5 className="card-title">Rendimiento por Tipo de Seguro</h5>
          </div>
        </div>
        <div className="h-64 flex items-center justify-center">
          <p className="text-gray-500">Cargando datos por tipo de seguro...</p>
        </div>
      </CardBox>
    );
  }

  if (error) {
    return (
      <CardBox className="pb-3">
        <div className="sm:flex justify-between align-baseline">
          <div>
            <h5 className="card-title">Rendimiento por Tipo de Seguro</h5>
          </div>
        </div>
        <div className="h-64 flex items-center justify-center">
          <p className="text-red-500">Error al cargar datos</p>
        </div>
      </CardBox>
    );
  }

  return (
    <>
      <CardBox className="pb-3">
        <div className="sm:flex justify-between align-baseline">
          <div>
            <h5 className="card-title">Rendimiento por Tipo de Seguro</h5>
          </div>
          <Select required className="form-control select-md w-fit sm:my-0 my-4">
            {dropdownItems.map((items, index) => {
              return <option key={index}>{items}</option>;
            })}
          </Select>
        </div>
        {/* Tabs */}
        <div className="overflow-x-auto">
          <div className="flex gap-4 min-w-max">
            {Object.entries(insuranceTypes).map(([key, type]) => (
              <div
                key={key}
                onClick={() => handleTabClick(key)}
                className={`py-3 px-6 rounded-tw cursor-pointer text-dark text-sm font-semibold text-center flex gap-2 items-center bg-muted dark:bg-dark hover:bg-lightprimary dark:hover:bg-lightprimary ${
                  activeTab === key
                    ? "text-white bg-primary dark:bg-primary hover:bg-primaryemphasis dark:hover:bg-primaryemphasis"
                    : "dark:text-white"
                }`}
              >
                <Icon
                  icon={type.icon}
                  className={`${
                    activeTab === key ? "opacity-100" : "opacity-50"
                  }`}
                  height={16}
                />
                {type.label}
                {data?.polizas_por_tipo && Array.isArray(data.polizas_por_tipo) && data.polizas_por_tipo.find(p => p.type === key) && (
                  <span className="ml-1 px-2 py-1 bg-white bg-opacity-20 rounded text-xs">
                    {data.polizas_por_tipo.find(p => p.type === key)?.total || 0}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Contenido dinámico basado en datos reales */}
        <div className="overflow-x-auto mt-6">
          <Table>
            <Table.Head className="border-b border-bordergray dark:border-darkborder">
              <Table.HeadCell className="py-2 px-3 ps-0 text-ld font-normal">
                Cliente
              </Table.HeadCell>
              <Table.HeadCell className="text-ld font-normal">
                Aseguradora
              </Table.HeadCell>
              <Table.HeadCell className="text-ld font-normal">
                Estado
              </Table.HeadCell>
              <Table.HeadCell className="text-ld font-normal">
                Prima
              </Table.HeadCell>
            </Table.Head>
            <Table.Body className="divide-y divide-bordergray dark:divide-darkborder">
              {getPolizasByType(activeTab).length > 0 ? (
                getPolizasByType(activeTab).map((poliza, index) => {
                  const statusInfo = getStatusInfo(poliza.status);
                  return (
                    <Table.Row key={index}>
                      <Table.Cell className="whitespace-nowrap ps-0">
                        <div className="flex gap-3 items-center">
                          <div className={`h-12 w-12 rounded-tw ${insuranceTypes[activeTab as keyof typeof insuranceTypes]?.bgColor} flex items-center justify-center`}>
                            <Icon
                              icon={insuranceTypes[activeTab as keyof typeof insuranceTypes]?.icon}
                              className="text-primary"
                              height={20}
                            />
                          </div>
                          <div className="truncate line-clamp-2 sm:text-wrap max-w-56">
                            <h6 className="text-sm font-medium">{poliza.client_name}</h6>
                            <p className="text-xs text-gray-600">
                              {insuranceTypes[activeTab as keyof typeof insuranceTypes]?.label}
                            </p>
                          </div>
                        </div>
                      </Table.Cell>
                      <Table.Cell className="whitespace-nowrap">
                        <p className="text-sm">{poliza.insurance_company || 'No especificado'}</p>
                      </Table.Cell>
                      <Table.Cell className="whitespace-nowrap">
                        <Badge
                          color={statusInfo.color}
                          className={statusInfo.textColor}
                        >
                          {statusInfo.text}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell className="whitespace-nowrap">
                        <p className="text-ld font-medium">{formatPremium(poliza.premium_amount)}</p>
                      </Table.Cell>
                    </Table.Row>
                  );
                })
              ) : (
                <Table.Row>
                  <Table.Cell colSpan={4} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <Icon
                        icon={insuranceTypes[activeTab as keyof typeof insuranceTypes]?.icon}
                        className="text-gray-400"
                        height={32}
                      />
                      <p className="text-gray-500">
                        No hay pólizas de {insuranceTypes[activeTab as keyof typeof insuranceTypes]?.label.toLowerCase()} registradas
                      </p>
                    </div>
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table>
        </div>

        {/* Resumen por tipo */}
        {data && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gray-50 dark:bg-dark rounded-lg">
              <h6 className="text-sm font-medium text-gray-600">Total Pólizas</h6>
              <p className="text-2xl font-bold text-primary">
                {data.polizas_por_tipo && Array.isArray(data.polizas_por_tipo) 
                  ? data.polizas_por_tipo.find(p => p.type === activeTab)?.total || 0
                  : 0
                }
              </p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-dark rounded-lg">
              <h6 className="text-sm font-medium text-gray-600">Prima Promedio</h6>
              <p className="text-2xl font-bold text-success">
                {getPolizasByType(activeTab).length > 0 
                  ? formatPremium(
                      getPolizasByType(activeTab).reduce((sum, p) => sum + parseFloat(p.premium_amount), 0) / 
                      getPolizasByType(activeTab).length
                    )
                  : '$0'
                }
              </p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-dark rounded-lg">
              <h6 className="text-sm font-medium text-gray-600">Total Prima</h6>
              <p className="text-2xl font-bold text-warning">
                {formatPremium(
                  getPolizasByType(activeTab).reduce((sum, p) => sum + parseFloat(p.premium_amount), 0)
                )}
              </p>
            </div>
          </div>
        )}
      </CardBox>
    </>
  );
};

export default RevenueByProduct;
