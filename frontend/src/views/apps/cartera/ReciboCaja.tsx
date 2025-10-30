import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Spinner, Badge } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { polizaService } from '../../../services/polizaService';
import { useToast } from 'src/hooks/use-toast';

interface ReciboCajaData {
  id: string;
  numeroPoliza: string;
  cliente: string;
  documento: string;
  aseguradora: string;
  ramo: string;
  primaNeta: number;
  iva: number;
  total: number;
  fechaRecaudo: string;
  metodoPago: string;
  referenciaPago: string;
  observaciones: string;
  montoRecibido: number;
  numeroRecibo: string;
}

const ReciboCaja = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [recibo, setRecibo] = useState<ReciboCajaData | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    cargarRecibo();
  }, [id]);

  const cargarRecibo = async () => {
    try {
      setLoading(true);
      const response = await polizaService.getPoliza(id!);
      
      if (response.success && response.data) {
        const poliza: any = response.data;
        
        // Calcular el monto recibido (puede ser recaudo oficina o pago aseguradora)
        const montoRecibido = (poliza.recaudo_oficina?.recaudado || 0) > 0
          ? poliza.recaudo_oficina?.recaudado
          : poliza.recaudo_aseguradora?.pagado || poliza.total || 0;
        
        setRecibo({
          id: poliza.id || '',
          numeroPoliza: poliza.numero_poliza || '',
          cliente: poliza.cliente_nombre || poliza.cliente?.nombre || '',
          documento: poliza.cliente_documento || poliza.cliente?.documento || '',
          aseguradora: poliza.aseguradora_nombre || poliza.aseguradora || '',
          ramo: poliza.ramo_nombre || poliza.ramo || '',
          primaNeta: poliza.prima_neta || 0,
          iva: poliza.iva || 0,
          total: poliza.total || 0,
          fechaRecaudo: new Date().toISOString(),
          metodoPago: 'Transferencia',
          referenciaPago: poliza.numero_poliza || '',
          observaciones: '',
          montoRecibido,
          numeroRecibo: `RC-${poliza.numero_poliza}-${new Date().getFullYear()}`,
        });
      }
    } catch (error) {
      console.error('Error cargando recibo:', error);
      toast({
        title: 'Error',
        description: 'No se pudo cargar la información del recibo',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return '-';
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    toast({
      title: 'Generando PDF',
      description: 'El PDF se descargará en breve',
    });
    // Aquí se implementaría la lógica para generar el PDF
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spinner size="xl" />
        <span className="ml-3">Cargando recibo...</span>
      </div>
    );
  }

  if (!recibo) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Icon icon="solar:document-text-bold-duotone" className="w-24 h-24 text-gray-300 mb-4" />
        <p className="text-gray-500 text-lg">No se encontró el recibo</p>
        <Button color="blue" onClick={() => navigate('/apps/cartera/clientes')} className="mt-4">
          Volver a Cartera
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Botones de Acción - No se imprimen */}
      <div className="flex justify-between items-center print:hidden">
        <Button color="gray" onClick={() => navigate('/apps/cartera/clientes')}>
          <Icon icon="solar:alt-arrow-left-bold-duotone" className="w-4 h-4 mr-2" />
          Volver
        </Button>
        <div className="flex gap-2">
          <Button color="blue" onClick={handlePrint}>
            <Icon icon="solar:printer-bold-duotone" className="w-4 h-4 mr-2" />
            Imprimir
          </Button>
          <Button color="green" onClick={handleDownloadPDF}>
            <Icon icon="solar:download-bold-duotone" className="w-4 h-4 mr-2" />
            Descargar PDF
          </Button>
        </div>
      </div>

      {/* Recibo de Caja - Formato Imprimible */}
      <div ref={printRef} className="bg-white p-8 rounded-lg shadow-lg max-w-4xl mx-auto">
        {/* Encabezado */}
        <div className="border-b-2 border-blue-600 pb-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-blue-600 mb-2">RECIBO DE CAJA</h1>
              <p className="text-gray-600">Comprobante de Pago</p>
            </div>
            <div className="text-right">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Número de Recibo</p>
                <p className="text-2xl font-bold text-blue-600">{recibo.numeroRecibo}</p>
              </div>
              <p className="text-sm text-gray-600 mt-2">Fecha: {formatDate(recibo.fechaRecaudo)}</p>
            </div>
          </div>
        </div>

        {/* Información del Cliente */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
            <Icon icon="solar:user-bold-duotone" className="w-5 h-5 mr-2 text-blue-600" />
            Información del Cliente
          </h2>
          <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
            <div>
              <p className="text-sm text-gray-600">Cliente</p>
              <p className="font-semibold text-gray-900">{recibo.cliente}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Documento</p>
              <p className="font-semibold text-gray-900">{recibo.documento}</p>
            </div>
          </div>
        </div>

        {/* Información de la Póliza */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
            <Icon icon="solar:shield-check-bold-duotone" className="w-5 h-5 mr-2 text-blue-600" />
            Información de la Póliza
          </h2>
          <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
            <div>
              <p className="text-sm text-gray-600">Número de Póliza</p>
              <p className="font-semibold text-gray-900">{recibo.numeroPoliza}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Aseguradora</p>
              <p className="font-semibold text-gray-900">{recibo.aseguradora}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Ramo</p>
              <p className="font-semibold text-gray-900">{recibo.ramo}</p>
            </div>
          </div>
        </div>

        {/* Detalle del Pago */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
            <Icon icon="solar:dollar-minimalistic-bold-duotone" className="w-5 h-5 mr-2 text-blue-600" />
            Detalle del Pago
          </h2>
          <div className="bg-gray-50 p-4 rounded-lg">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-300">
                  <th className="text-left py-2 text-sm text-gray-600">Concepto</th>
                  <th className="text-right py-2 text-sm text-gray-600">Valor</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-200">
                  <td className="py-3 text-gray-700">Prima Neta</td>
                  <td className="py-3 text-right font-semibold">{formatCurrency(recibo.primaNeta)}</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="py-3 text-gray-700">IVA</td>
                  <td className="py-3 text-right font-semibold">{formatCurrency(recibo.iva)}</td>
                </tr>
                <tr className="border-b-2 border-gray-300">
                  <td className="py-3 text-gray-700 font-semibold">Total Póliza</td>
                  <td className="py-3 text-right font-bold text-lg">{formatCurrency(recibo.total)}</td>
                </tr>
                <tr className="bg-green-50 border-t-2 border-gray-300">
                  <td className="py-3 text-green-800 font-bold">Monto Recibido</td>
                  <td className="py-3 text-right font-bold text-green-600 text-xl">
                    {formatCurrency(recibo.montoRecibido)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Información del Pago */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
            <Icon icon="solar:card-transfer-bold-duotone" className="w-5 h-5 mr-2 text-blue-600" />
            Información del Pago
          </h2>
          <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
            <div>
              <p className="text-sm text-gray-600">Método de Pago</p>
              <p className="font-semibold text-gray-900">{recibo.metodoPago}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Referencia</p>
              <p className="font-semibold text-gray-900">{recibo.referenciaPago}</p>
            </div>
          </div>
        </div>

        {/* Observaciones */}
        {recibo.observaciones && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
              <Icon icon="solar:notes-bold-duotone" className="w-5 h-5 mr-2 text-blue-600" />
              Observaciones
            </h2>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-gray-700">{recibo.observaciones}</p>
            </div>
          </div>
        )}

        {/* Pie de Página */}
        <div className="border-t-2 border-gray-300 pt-6 mt-8">
          <div className="grid grid-cols-2 gap-8">
            <div className="text-center">
              <div className="border-t-2 border-gray-400 pt-2 mt-16">
                <p className="text-sm text-gray-600">Firma del Cliente</p>
              </div>
            </div>
            <div className="text-center">
              <div className="border-t-2 border-gray-400 pt-2 mt-16">
                <p className="text-sm text-gray-600">Firma Autorizada</p>
              </div>
            </div>
          </div>
          <div className="text-center mt-8 text-xs text-gray-500">
            <p>Este documento es un comprobante de pago válido</p>
            <p>Generado el {formatDate(new Date().toISOString())}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReciboCaja;