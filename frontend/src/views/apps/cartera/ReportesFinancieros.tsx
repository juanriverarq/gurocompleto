import React, { useEffect, useMemo, useState } from 'react';
import { Card, Button, Spinner, Badge, Select, Tabs, Label, TextInput } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { polizaService } from '../../../services/polizaService';
import saasApi from 'src/services/saasApi';

interface ReporteFinanciero {
  periodo: string;
  totalPrimas: number;
  totalComisiones: number;
  comisionesPagadas: number;
  comisionesPendientes: number;
  recaudoOficina: number;
  recaudoOficinaPendiente: number;
  pagoAseguradora: number;
  pagoAseguradoraPendiente: number;
  anticipos: number;
  ajustes: number;
  margenBruto: number;
  crecimiento: number;
}

interface ReportePorAsesor {
  asesor: string;
  asesorId: string;
  comisionesGeneradas: number;
  comisionesPagadas: number;
  metaCumplida: number;
  porcentajeMeta: number;
  clientesActivos: number;
  polizasVendidas: number;
}

interface ReportePorAseguradora {
  aseguradora: string;
  aseguradoraId: string;
  primasTotal: number;
  comisiones: number;
  porcentajeParticipacion: number;
  polizasActivas: number;
  crecimientoMensual: number;
}

interface ReportePorRamo {
  ramo: string;
  ramoId: string;
  primasTotal: number;
  comisiones: number;
  porcentajeParticipacion: number;
  polizasActivas: number;
}

interface ReportePorCliente {
  cliente: string;
  clienteId: string;
  documento: string;
  primasTotal: number;
  comisiones: number;
  polizasActivas: number;
  ultimaPoliza: string;
}

const ReportesFinancieros = () => {
  const [loading, setLoading] = useState(false);
  const [fechaInicio, setFechaInicio] = useState<string>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
  );
  const [fechaFin, setFechaFin] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  
  // Estados para filtros
  const [aseguradoraSeleccionada, setAseguradoraSeleccionada] = useState<string>('');
  const [ramoSeleccionado, setRamoSeleccionado] = useState<string>('');
  const [vendedorSeleccionado, setVendedorSeleccionado] = useState<string>('');
  const [sedeSeleccionada, setSedeSeleccionada] = useState<string>('');
  const [clienteSeleccionado, setClienteSeleccionado] = useState<string>('');
  const [busquedaCliente, setBusquedaCliente] = useState<string>('');
  const [estadoSeleccionado, setEstadoSeleccionado] = useState<string>('');
  const [topNClientes, setTopNClientes] = useState<number>(0);
  
  // Estados para datos de pólizas
  const [polizasRaw, setPolizasRaw] = useState<any[]>([]);
  
  // Estados para catálogos
  const [aseguradoras, setAseguradoras] = useState<any[]>([]);
  const [ramos, setRamos] = useState<any[]>([]);
  const [vendedores, setVendedores] = useState<any[]>([]);
  const [sedes, setSedes] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const [y, m, d] = dateStr.split('T')[0].split('-');
      return `${d}/${m}/${y}`;
    } catch {
      return '-';
    }
  };

  // Cargar catálogos al montar el componente
  useEffect(() => {
    const loadCatalogos = async () => {
      try {
        console.log('🔄 Cargando catálogos...');
        const [asegRes, ramosRes, vendRes, sedesRes, clientesRes] = await Promise.all([
          saasApi.getAseguradoras(),
          saasApi.getRamos(),
          saasApi.getVendedores(),
          saasApi.getSedes(),
          saasApi.getClientesAll(),
        ]);

        console.log('📋 Aseguradoras:', asegRes);
        console.log('📋 Ramos:', ramosRes);
        console.log('📋 Vendedores:', vendRes);
        console.log('📋 Sedes:', sedesRes);
        console.log('📋 Clientes:', clientesRes);

        if (asegRes.success && asegRes.data?.data) {
          console.log('✅ Aseguradoras cargadas:', asegRes.data.data.length);
          setAseguradoras(asegRes.data.data);
        }
        if (ramosRes.success && ramosRes.data?.data) {
          console.log('✅ Ramos cargados:', ramosRes.data.data.length);
          setRamos(ramosRes.data.data);
        }
        if (vendRes.success && vendRes.data?.data) {
          console.log('✅ Vendedores cargados:', vendRes.data.data.length);
          setVendedores(vendRes.data.data);
        }
        if (sedesRes.success && sedesRes.data?.data) {
          console.log('✅ Sedes cargadas:', sedesRes.data.data.length);
          setSedes(sedesRes.data.data);
        }
        if (clientesRes.success && clientesRes.data) {
          console.log('✅ Clientes cargados:', clientesRes.data.length);
          setClientes(clientesRes.data);
        }
      } catch (e) {
        console.error('❌ Error cargando catálogos:', e);
      }
    };
    loadCatalogos();
  }, []);

  // Cargar pólizas cuando cambian los filtros
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const carteraRes = await polizaService.getCarteraPolizas();
        
        if (carteraRes.success && carteraRes.data) {
          const polizasData = Array.isArray(carteraRes.data) ? carteraRes.data : [];
          console.log('📊 Pólizas cargadas:', polizasData.length);
          console.log('📊 Ejemplo de póliza:', polizasData[0]);
          setPolizasRaw(polizasData);
        } else {
          setPolizasRaw([]);
        }
      } catch (e) {
        console.error('Error cargando pólizas:', e);
        setPolizasRaw([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Filtrar pólizas según criterios
  const polizasFiltradas = useMemo(() => {
    let resultado = [...polizasRaw];

    // Normalizar fechas y rango
    const inRange = (dateStr?: string) => {
      if (!dateStr) return true;
      const f = String(dateStr).includes('T') ? String(dateStr).split('T')[0] : String(dateStr);
      return (!fechaInicio || f >= fechaInicio) && (!fechaFin || f <= fechaFin);
    };

    // Filtrar por rango de fechas (inicio, expedición, o fin)
    resultado = resultado.filter((p: any) => {
      const fechaPoliza = p.fecha_inicio || p.fecha_expedicion || p.fecha_fin || p.fecha_vencimiento;
      return inRange(fechaPoliza);
    });

    // Búsqueda libre por cliente / documento / póliza / empresa
    if (busquedaCliente && busquedaCliente.trim().length > 0) {
      const q = busquedaCliente.trim().toLowerCase();
      resultado = resultado.filter((p: any) => {
        const cols = [
          p.cliente,
          p.nombres_cliente && p.apellidos_cliente ? `${p.nombres_cliente} ${p.apellidos_cliente}` : '',
          p.documento || p.dni_cliente || p.numero_documento,
          p.company_legal_name,
          p.numero_poliza,
          p.aseguradora,
          p.ramo || p.ramo_principal || p.ramo_nombre,
        ]
          .filter(Boolean)
          .map((v: any) => String(v).toLowerCase());
        return cols.some((v: string) => v.includes(q));
      });
    }

    // Filtrar por aseguradora
    if (aseguradoraSeleccionada) {
      resultado = resultado.filter((p: any) => {
        const pid = p.aseguradora_id ?? p.aseguradoraId ?? p.aseguradoraID ?? null;
        if (String(pid || '') === aseguradoraSeleccionada) return true;
        const selected = aseguradoras.find(a => String(a.id) === aseguradoraSeleccionada);
        const pName = p.aseguradora || p.aseguradora_nombre || p.aseguradoraName || '';
        const sName = selected ? (selected.nombre || selected.name) : '';
        return sName && pName && String(pName).toLowerCase() === String(sName).toLowerCase();
      });
    }

    // Filtrar por ramo
    if (ramoSeleccionado) {
      resultado = resultado.filter((p: any) => {
        const rid = p.ramo_id ?? p.ramoId ?? null;
        if (String(rid || '') === ramoSeleccionado) return true;
        const selected = ramos.find(r => String(r.id) === ramoSeleccionado);
        const pName = p.ramo || p.ramo_principal || p.ramo_nombre || '';
        const sName = selected ? (selected.nombre || selected.name) : '';
        return sName && pName && String(pName).toLowerCase() === String(sName).toLowerCase();
      });
    }

    // Filtrar por vendedor
    if (vendedorSeleccionado) {
      resultado = resultado.filter((p: any) => {
        const vid = p.vendedor_id ?? p.asesor_id ?? p.assigned_to ?? p.usuario_id ?? null;
        if (String(vid || '') === vendedorSeleccionado) return true;
        const selected = vendedores.find(v => String(v.id) === vendedorSeleccionado);
        const pName = p.vendedor || p.asesor || p.vendedor_nombre || p.usuario_nombre || p.created_by_name || '';
        const sName = selected ? (selected.nombre || selected.name || `${selected.first_name || ''} ${selected.last_name || ''}`.trim()) : '';
        return sName && pName && String(pName).toLowerCase() === String(sName).toLowerCase();
      });
    }

    // Filtrar por sede
    if (sedeSeleccionada) {
      resultado = resultado.filter((p: any) => {
        const sid = p.sede_id ?? p.branch_id ?? null;
        if (String(sid || '') === sedeSeleccionada) return true;
        const selected = sedes.find(s => String(s.id) === sedeSeleccionada);
        const pName = p.sede || p.sede_nombre || p.branch_name || '';
        const sName = selected ? (selected.nombre || selected.name) : '';
        return sName && pName && String(pName).toLowerCase() === String(sName).toLowerCase();
      });
    }

    // Filtrar por cliente específico
    if (clienteSeleccionado) {
      resultado = resultado.filter((p: any) => String(p.cliente_id ?? p.client_id ?? p.clienteId ?? '') === clienteSeleccionado);
    }

    // Filtrar por estado
    if (estadoSeleccionado) {
      resultado = resultado.filter((p: any) => {
        const est = (p.estado || p.status || '').toString().toUpperCase();
        return est === estadoSeleccionado.toUpperCase();
      });
    }

    // Limitar a Top N clientes por primas
    if (topNClientes && topNClientes > 0) {
      const sumByClient = new Map<string, number>();
      for (const p of resultado) {
        const cid = String((p as any).cliente_id ?? (p as any).client_id ?? (p as any).clienteId ?? (p as any).documento ?? (p as any).dni_cliente ?? (p as any).cliente ?? '0');
        const prima = Number((p as any).prima_neta) || 0;
        sumByClient.set(cid, (sumByClient.get(cid) || 0) + prima);
      }
      const topIds = [...sumByClient.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, topNClientes)
        .map(([id]) => id);
      const topSet = new Set(topIds);
      resultado = resultado.filter((p: any) => topSet.has(String(p.cliente_id ?? p.client_id ?? p.clienteId ?? p.documento ?? p.dni_cliente ?? p.cliente ?? '0')));
    }

    return resultado;
  }, [polizasRaw, fechaInicio, fechaFin, aseguradoraSeleccionada, ramoSeleccionado, vendedorSeleccionado, sedeSeleccionada, clienteSeleccionado, busquedaCliente, estadoSeleccionado, topNClientes, aseguradoras, ramos, vendedores, sedes]);

  // Calcular reportes desde las pólizas filtradas
  const reporteActual = useMemo(() => {
    if (polizasFiltradas.length === 0) return null;

    const totalPrimas = polizasFiltradas.reduce((sum, p) => sum + (Number(p.prima_neta) || 0), 0);
    
    // Calcular comisiones: si no viene, calcular como porcentaje de prima
    const totalComisiones = polizasFiltradas.reduce((sum, p) => {
      let comision = Number(p.comision) || 0;
      
      // Si no hay comisión, calcular basado en porcentaje (15% por defecto)
      if (comision === 0) {
        const primaNeta = Number(p.prima_neta) || 0;
        const porcentaje = Number(p.porcentaje_comision) || Number(p.comision_agencia) || 15;
        comision = (primaNeta * porcentaje) / 100;
      }
      
      return sum + comision;
    }, 0);
    
    const comisionesPagadas = polizasFiltradas.reduce((sum, p) => sum + (Number(p.cobro_comision?.cobrada) || 0), 0);
    
    // Calcular comisiones pendientes
    const comisionesPendientes = polizasFiltradas.reduce((sum, p) => {
      let comision = Number(p.comision) || 0;
      
      // Si no hay comisión, calcular basado en porcentaje
      if (comision === 0) {
        const primaNeta = Number(p.prima_neta) || 0;
        const porcentaje = Number(p.porcentaje_comision) || Number(p.comision_agencia) || 15;
        comision = (primaNeta * porcentaje) / 100;
      }
      
      const cobrada = Number(p.cobro_comision?.cobrada) || 0;
      const pendiente = Number(p.cobro_comision?.pendiente) || 0;
      
      // Si hay pendiente explícito, usarlo; si no, calcular como comision - cobrada
      return sum + (pendiente > 0 ? pendiente : Math.max(0, comision - cobrada));
    }, 0);
    
    console.log('💰 Reporte calculado:', {
      totalPrimas,
      totalComisiones,
      comisionesPagadas,
      comisionesPendientes,
      polizas: polizasFiltradas.length
    });
    
    // Calcular recaudos
    const recaudoOficina = polizasFiltradas.reduce((sum, p) => sum + (Number(p.recaudo_oficina?.recaudado) || 0), 0);
    const recaudoOficinaPendiente = polizasFiltradas.reduce((sum, p) => sum + (Number(p.recaudo_oficina?.pendiente) || 0), 0);
    const pagoAseguradora = polizasFiltradas.reduce((sum, p) => sum + (Number(p.recaudo_aseguradora?.pagado) || 0), 0);
    const pagoAseguradoraPendiente = polizasFiltradas.reduce((sum, p) => sum + (Number(p.recaudo_aseguradora?.pendiente) || 0), 0);
    
    const anticipos = 0; // Calcular si hay datos de anticipos
    const ajustes = 0; // Calcular si hay datos de ajustes
    const margenBruto = totalPrimas > 0 ? (totalComisiones / totalPrimas) * 100 : 0;

    return {
      periodo: `${fechaInicio} - ${fechaFin}`,
      totalPrimas,
      totalComisiones,
      comisionesPagadas,
      comisionesPendientes,
      recaudoOficina,
      recaudoOficinaPendiente,
      pagoAseguradora,
      pagoAseguradoraPendiente,
      anticipos,
      ajustes,
      margenBruto,
      crecimiento: 0,
    };
  }, [polizasFiltradas, fechaInicio, fechaFin]);

  // Reporte por asesor
  const byAdvisor = useMemo(() => {
    const agrupado = polizasFiltradas.reduce((acc, p) => {
      const vendedor = p.vendedor || 'Sin asignar';
      const vendedorId = String(p.vendedor_id || '0');
      
      if (!acc[vendedorId]) {
        acc[vendedorId] = {
          asesor: vendedor,
          asesorId: vendedorId,
          comisionesGeneradas: 0,
          comisionesPagadas: 0,
          metaCumplida: 0,
          porcentajeMeta: 0,
          clientesActivos: new Set(),
          polizasVendidas: 0,
        };
      }
      
      // Calcular comisión si no viene
      let comision = Number(p.comision) || 0;
      if (comision === 0) {
        const primaNeta = Number(p.prima_neta) || 0;
        const porcentaje = Number(p.porcentaje_comision) || Number(p.comision_agencia) || 15;
        comision = (primaNeta * porcentaje) / 100;
      }
      
      acc[vendedorId].comisionesGeneradas += comision;
      acc[vendedorId].comisionesPagadas += Number(p.cobro_comision?.cobrada) || 0;
      acc[vendedorId].polizasVendidas++;
      if (p.cliente_id) acc[vendedorId].clientesActivos.add(p.cliente_id);
      
      return acc;
    }, {} as Record<string, any>);

    return Object.values(agrupado).map((a: any) => ({
      ...a,
      clientesActivos: a.clientesActivos.size,
      porcentajeMeta: 85, // Calcular basado en metas si están disponibles
    })) as ReportePorAsesor[];
  }, [polizasFiltradas]);

  // Reporte por aseguradora
  const byInsurer = useMemo(() => {
    const agrupado = polizasFiltradas.reduce((acc, p) => {
      const aseguradora = p.aseguradora || 'Sin aseguradora';
      const aseguradoraId = String(p.aseguradora_id || '0');
      
      if (!acc[aseguradoraId]) {
        acc[aseguradoraId] = {
          aseguradora,
          aseguradoraId,
          primasTotal: 0,
          comisiones: 0,
          polizasActivas: 0,
        };
      }
      
      const primaNeta = Number(p.prima_neta) || 0;
      let comision = Number(p.comision) || 0;
      
      // Calcular comisión si no viene
      if (comision === 0) {
        const porcentaje = Number(p.porcentaje_comision) || Number(p.comision_agencia) || 15;
        comision = (primaNeta * porcentaje) / 100;
      }
      
      acc[aseguradoraId].primasTotal += primaNeta;
      acc[aseguradoraId].comisiones += comision;
      acc[aseguradoraId].polizasActivas++;
      
      return acc;
    }, {} as Record<string, any>);

    const total = Object.values(agrupado).reduce((sum: number, a: any) => sum + a.primasTotal, 0);
    
    return Object.values(agrupado).map((a: any) => ({
      ...a,
      porcentajeParticipacion: total > 0 ? (a.primasTotal / total) * 100 : 0,
      crecimientoMensual: 0, // Calcular comparando con período anterior
    })) as ReportePorAseguradora[];
  }, [polizasFiltradas]);

  // Reporte por ramo
  const byRamo = useMemo(() => {
    const agrupado = polizasFiltradas.reduce((acc, p) => {
      const ramo = p.ramo || 'Sin ramo';
      const ramoId = String(p.ramo_id || '0');
      
      if (!acc[ramoId]) {
        acc[ramoId] = {
          ramo,
          ramoId,
          primasTotal: 0,
          comisiones: 0,
          polizasActivas: 0,
        };
      }
      
      const primaNeta = Number(p.prima_neta) || 0;
      let comision = Number(p.comision) || 0;
      
      // Calcular comisión si no viene
      if (comision === 0) {
        const porcentaje = Number(p.porcentaje_comision) || Number(p.comision_agencia) || 15;
        comision = (primaNeta * porcentaje) / 100;
      }
      
      acc[ramoId].primasTotal += primaNeta;
      acc[ramoId].comisiones += comision;
      acc[ramoId].polizasActivas++;
      
      return acc;
    }, {} as Record<string, any>);

    const total = Object.values(agrupado).reduce((sum: number, a: any) => sum + a.primasTotal, 0);
    
    return Object.values(agrupado).map((a: any) => ({
      ...a,
      porcentajeParticipacion: total > 0 ? (a.primasTotal / total) * 100 : 0,
    })) as ReportePorRamo[];
  }, [polizasFiltradas]);

  // Reporte por cliente
  const byCliente = useMemo(() => {
    const agrupado = polizasFiltradas.reduce((acc, p) => {
      const clienteId = String(p.cliente_id || '0');
      const cliente = p.cliente || 'Sin cliente';
      const documento = p.documento || '';
      
      if (!acc[clienteId]) {
        acc[clienteId] = {
          cliente,
          clienteId,
          documento,
          primasTotal: 0,
          comisiones: 0,
          polizasActivas: 0,
          ultimaPoliza: p.fecha_inicio || '',
        };
      }
      
      const primaNeta = Number(p.prima_neta) || 0;
      let comision = Number(p.comision) || 0;
      
      // Calcular comisión si no viene
      if (comision === 0) {
        const porcentaje = Number(p.porcentaje_comision) || Number(p.comision_agencia) || 15;
        comision = (primaNeta * porcentaje) / 100;
      }
      
      acc[clienteId].primasTotal += primaNeta;
      acc[clienteId].comisiones += comision;
      acc[clienteId].polizasActivas++;
      
      // Actualizar última póliza si es más reciente
      if (p.fecha_inicio && p.fecha_inicio > acc[clienteId].ultimaPoliza) {
        acc[clienteId].ultimaPoliza = p.fecha_inicio;
      }
      
      return acc;
    }, {} as Record<string, any>);

    return Object.values(agrupado).map((c: any) => ({
      ...c,
      ultimaPoliza: formatDate(c.ultimaPoliza),
    })) as ReportePorCliente[];
  }, [polizasFiltradas]);

  // Top clientes (ordenados por primas totales)
  const topClientes = useMemo(() => {
    return [...byCliente]
      .sort((a, b) => b.primasTotal - a.primasTotal)
      .slice(0, 10);
  }, [byCliente]);

  const limpiarFiltros = () => {
    setFechaInicio(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
    setFechaFin(new Date().toISOString().slice(0, 10));
    setAseguradoraSeleccionada('');
    setRamoSeleccionado('');
    setVendedorSeleccionado('');
    setSedeSeleccionada('');
    setClienteSeleccionado('');
    setBusquedaCliente('');
    setEstadoSeleccionado('');
    setTopNClientes(0);
  };

  const exportarPDF = async () => {
    try {
      setLoading(true);
      
      // Crear contenido HTML para el PDF
      const filtrosActivos = [];
      filtrosActivos.push(`Período: ${formatDate(fechaInicio)} - ${formatDate(fechaFin)}`);
      
      if (aseguradoraSeleccionada) {
        const aseg = aseguradoras.find(a => String(a.id) === aseguradoraSeleccionada);
        filtrosActivos.push(`Aseguradora: ${aseg?.nombre || aseg?.name}`);
      }
      if (ramoSeleccionado) {
        const ramo = ramos.find(r => String(r.id) === ramoSeleccionado);
        filtrosActivos.push(`Ramo: ${ramo?.nombre || ramo?.name}`);
      }
      if (vendedorSeleccionado) {
        const vend = vendedores.find(v => String(v.id) === vendedorSeleccionado);
        filtrosActivos.push(`Vendedor: ${vend?.nombre || vend?.name}`);
      }
      if (sedeSeleccionada) {
        const sede = sedes.find(s => String(s.id) === sedeSeleccionada);
        filtrosActivos.push(`Sede: ${sede?.nombre || sede?.name}`);
      }
      
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Reporte Financiero - ${formatDate(fechaInicio)} a ${formatDate(fechaFin)}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #1f2937; text-align: center; }
            h2 { color: #374151; margin-top: 30px; }
            .filtros { background: #f3f4f6; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
            .filtros p { margin: 5px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th { background: #1f2937; color: white; padding: 12px; text-align: left; }
            td { padding: 10px; border-bottom: 1px solid #e5e7eb; }
            tr:nth-child(even) { background: #f9fafb; }
            .total { font-weight: bold; color: #059669; }
            .footer { margin-top: 30px; text-align: center; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <h1>Reporte Financiero</h1>
          <div class="filtros">
            ${filtrosActivos.map(f => `<p>${f}</p>`).join('')}
            <p><strong>Fecha de generación:</strong> ${new Date().toLocaleString('es-CO')}</p>
          </div>
          
          ${reporteActual ? `
          <h2>Resumen Ejecutivo</h2>
          <table>
            <tr>
              <th>Concepto</th>
              <th>Valor</th>
            </tr>
            <tr>
              <td>Total Primas</td>
              <td class="total">${formatCurrency(reporteActual.totalPrimas)}</td>
            </tr>
            <tr>
              <td>Recaudo por Oficina</td>
              <td class="total">${formatCurrency(reporteActual.recaudoOficina)}</td>
            </tr>
            <tr>
              <td>Recaudo Oficina Pendiente</td>
              <td>${formatCurrency(reporteActual.recaudoOficinaPendiente)}</td>
            </tr>
            <tr>
              <td>Pago a Aseguradoras</td>
              <td class="total">${formatCurrency(reporteActual.pagoAseguradora)}</td>
            </tr>
            <tr>
              <td>Pago Aseguradora Pendiente</td>
              <td>${formatCurrency(reporteActual.pagoAseguradoraPendiente)}</td>
            </tr>
            <tr>
              <td>Comisiones Generadas</td>
              <td class="total">${formatCurrency(reporteActual.totalComisiones)}</td>
            </tr>
            <tr>
              <td>Comisiones Cobradas</td>
              <td>${formatCurrency(reporteActual.comisionesPagadas)}</td>
            </tr>
            <tr>
              <td>Comisiones Pendientes</td>
              <td>${formatCurrency(reporteActual.comisionesPendientes)}</td>
            </tr>
            <tr>
              <td>Margen Bruto</td>
              <td>${formatPercentage(reporteActual.margenBruto)}</td>
            </tr>
          </table>
          ` : ''}
          
          ${byInsurer.length > 0 ? `
          <h2>Por Aseguradora</h2>
          <table>
            <tr>
              <th>Aseguradora</th>
              <th>Primas</th>
              <th>Comisiones</th>
              <th>Pólizas</th>
            </tr>
            ${byInsurer.map(r => `
            <tr>
              <td>${r.aseguradora}</td>
              <td>${formatCurrency(r.primasTotal)}</td>
              <td class="total">${formatCurrency(r.comisiones)}</td>
              <td>${r.polizasActivas}</td>
            </tr>
            `).join('')}
          </table>
          ` : ''}
          
          ${byAdvisor.length > 0 ? `
          <h2>Por Asesor</h2>
          <table>
            <tr>
              <th>Asesor</th>
              <th>Comisiones Generadas</th>
              <th>Clientes</th>
              <th>Pólizas</th>
            </tr>
            ${byAdvisor.map(r => `
            <tr>
              <td>${r.asesor}</td>
              <td class="total">${formatCurrency(r.comisionesGeneradas)}</td>
              <td>${r.clientesActivos}</td>
              <td>${r.polizasVendidas}</td>
            </tr>
            `).join('')}
          </table>
          ` : ''}
          
          ${byRamo.length > 0 ? `
          <h2>Por Ramo</h2>
          <table>
            <tr>
              <th>Ramo</th>
              <th>Primas</th>
              <th>Comisiones</th>
              <th>Pólizas</th>
            </tr>
            ${byRamo.map(r => `
            <tr>
              <td>${r.ramo}</td>
              <td>${formatCurrency(r.primasTotal)}</td>
              <td class="total">${formatCurrency(r.comisiones)}</td>
              <td>${r.polizasActivas}</td>
            </tr>
            `).join('')}
          </table>
          ` : ''}
          
          ${topClientes.length > 0 ? `
          <h2>Top 10 Clientes</h2>
          <table>
            <tr>
              <th>#</th>
              <th>Cliente</th>
              <th>Primas</th>
              <th>Comisiones</th>
              <th>Pólizas</th>
            </tr>
            ${topClientes.map((c, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${c.cliente}</td>
              <td>${formatCurrency(c.primasTotal)}</td>
              <td class="total">${formatCurrency(c.comisiones)}</td>
              <td>${c.polizasActivas}</td>
            </tr>
            `).join('')}
          </table>
          ` : ''}
          
          <div class="footer">
            <p>Reporte generado automáticamente por el sistema de gestión</p>
          </div>
        </body>
        </html>
      `;
      
      // Crear blob y descargar
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `reporte-financiero-${fechaInicio}-${fechaFin}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      alert('Reporte HTML generado. Puedes abrirlo en tu navegador y usar "Imprimir > Guardar como PDF"');
    } catch (error) {
      console.error('Error al exportar PDF:', error);
      alert('Error al generar el reporte');
    } finally {
      setLoading(false);
    }
  };

  const exportarExcel = () => {
    try {
      // Crear contenido CSV
      let csv = 'Reporte Financiero\n';
      csv += `Período: ${formatDate(fechaInicio)} - ${formatDate(fechaFin)}\n`;
      csv += `Fecha: ${new Date().toLocaleString('es-CO')}\n\n`;
      
      if (reporteActual) {
        csv += 'RESUMEN EJECUTIVO\n';
        csv += 'Concepto,Valor\n';
        csv += `Total Primas,${reporteActual.totalPrimas}\n`;
        csv += `Recaudo por Oficina,${reporteActual.recaudoOficina}\n`;
        csv += `Recaudo Oficina Pendiente,${reporteActual.recaudoOficinaPendiente}\n`;
        csv += `Pago a Aseguradoras,${reporteActual.pagoAseguradora}\n`;
        csv += `Pago Aseguradora Pendiente,${reporteActual.pagoAseguradoraPendiente}\n`;
        csv += `Comisiones Generadas,${reporteActual.totalComisiones}\n`;
        csv += `Comisiones Cobradas,${reporteActual.comisionesPagadas}\n`;
        csv += `Comisiones Pendientes,${reporteActual.comisionesPendientes}\n`;
        csv += `Margen Bruto,${reporteActual.margenBruto}\n`;
        csv += `Balance Flujo Neto,${reporteActual.recaudoOficina - reporteActual.pagoAseguradora}\n\n`;
      }
      
      if (byInsurer.length > 0) {
        csv += 'POR ASEGURADORA\n';
        csv += 'Aseguradora,Primas Total,Comisiones,% Participación,Pólizas Activas\n';
        byInsurer.forEach(r => {
          csv += `${r.aseguradora},${r.primasTotal},${r.comisiones},${r.porcentajeParticipacion},${r.polizasActivas}\n`;
        });
        csv += '\n';
      }
      
      if (byAdvisor.length > 0) {
        csv += 'POR ASESOR\n';
        csv += 'Asesor,Comisiones Generadas,Comisiones Pagadas,% Meta,Clientes,Pólizas\n';
        byAdvisor.forEach(r => {
          csv += `${r.asesor},${r.comisionesGeneradas},${r.comisionesPagadas},${r.porcentajeMeta},${r.clientesActivos},${r.polizasVendidas}\n`;
        });
        csv += '\n';
      }
      
      if (byRamo.length > 0) {
        csv += 'POR RAMO\n';
        csv += 'Ramo,Primas Total,Comisiones,% Participación,Pólizas Activas\n';
        byRamo.forEach(r => {
          csv += `${r.ramo},${r.primasTotal},${r.comisiones},${r.porcentajeParticipacion},${r.polizasActivas}\n`;
        });
        csv += '\n';
      }
      
      if (topClientes.length > 0) {
        csv += 'TOP CLIENTES\n';
        csv += 'Posición,Cliente,Documento,Primas Total,Comisiones,Pólizas Activas\n';
        topClientes.forEach((c, i) => {
          csv += `${i + 1},${c.cliente},${c.documento},${c.primasTotal},${c.comisiones},${c.polizasActivas}\n`;
        });
      }
      
      // Crear blob y descargar
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `reporte-financiero-${fechaInicio}-${fechaFin}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error al exportar Excel:', error);
      alert('Error al generar el archivo CSV');
    }
  };

  // Filtrar clientes por búsqueda
  const clientesFiltrados = useMemo(() => {
    if (!busquedaCliente) return clientes;
    const busqueda = busquedaCliente.toLowerCase();
    return clientes.filter(c => 
      c.first_name?.toLowerCase().includes(busqueda) ||
      c.last_name?.toLowerCase().includes(busqueda) ||
      c.document_number?.toLowerCase().includes(busqueda) ||
      c.company_legal_name?.toLowerCase().includes(busqueda)
    );
  }, [clientes, busquedaCliente]);

  if (loading && polizasRaw.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="xl" />
        <span className="ml-3">Cargando reportes financieros...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-12 gap-6">
        {/* Filtros */}
        <div className="col-span-12">
          <Card>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Filtros de Reporte</h3>
                <Button color="light" size="sm" onClick={limpiarFiltros}>
                  <Icon icon="solar:refresh-bold-duotone" className="mr-2 h-4 w-4" />
                  Limpiar Filtros
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <div>
                  <Label htmlFor="fechaInicio" value="Fecha Inicio" />
                  <TextInput
                    id="fechaInicio"
                    type="date"
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="fechaFin" value="Fecha Fin" />
                  <TextInput
                    id="fechaFin"
                    type="date"
                    value={fechaFin}
                    onChange={(e) => setFechaFin(e.target.value)}
                    min={fechaInicio}
                  />
                </div>

                <div>
                  <Label htmlFor="aseguradora" value={`Aseguradora (${aseguradoras.length})`} />
                  <Select
                    id="aseguradora"
                    value={aseguradoraSeleccionada}
                    onChange={(e) => setAseguradoraSeleccionada(e.target.value)}
                  >
                    <option value="">Todas las aseguradoras</option>
                    {aseguradoras.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nombre || a.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <Label htmlFor="ramo" value={`Ramo (${ramos.length})`} />
                  <Select
                    id="ramo"
                    value={ramoSeleccionado}
                    onChange={(e) => setRamoSeleccionado(e.target.value)}
                  >
                    <option value="">Todos los ramos</option>
                    {ramos.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nombre || r.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <Label htmlFor="vendedor" value={`Vendedor (${vendedores.length})`} />
                  <Select
                    id="vendedor"
                    value={vendedorSeleccionado}
                    onChange={(e) => setVendedorSeleccionado(e.target.value)}
                  >
                    <option value="">Todos los vendedores</option>
                    {vendedores.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.nombre || v.name || `${v.first_name || ''} ${v.last_name || ''}`.trim() || `Vendedor ${v.id}`}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <Label htmlFor="sede" value={`Sede (${sedes.length})`} />
                  <Select
                    id="sede"
                    value={sedeSeleccionada}
                    onChange={(e) => setSedeSeleccionada(e.target.value)}
                  >
                    <option value="">Todas las sedes</option>
                    {sedes.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre || s.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="estado" value="Estado de Póliza" />
                  <Select
                    id="estado"
                    value={estadoSeleccionado}
                    onChange={(e) => setEstadoSeleccionado(e.target.value)}
                  >
                    <option value="">Todos los estados</option>
                    <option value="ACTIVA">Activa</option>
                    <option value="VENCIDA">Vencida</option>
                    <option value="CANCELADA">Cancelada</option>
                    <option value="SUSPENDIDA">Suspendida</option>
                  </Select>
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="busquedaCliente" value="Buscar Cliente" />
                  <TextInput
                    id="busquedaCliente"
                    placeholder="Nombre, documento o razón social..."
                    value={busquedaCliente}
                    onChange={(e) => setBusquedaCliente(e.target.value)}
                    icon={() => <Icon icon="solar:magnifer-bold-duotone" />}
                  />
                </div>

                <div>
                  <Label htmlFor="cliente" value="Cliente Específico" />
                  <Select
                    id="cliente"
                    value={clienteSeleccionado}
                    onChange={(e) => setClienteSeleccionado(e.target.value)}
                    disabled={clientesFiltrados.length === 0}
                  >
                    <option value="">Todos los clientes</option>
                    {clientesFiltrados.slice(0, 100).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.first_name && c.last_name
                          ? `${c.first_name} ${c.last_name}`
                          : c.company_legal_name || c.document_number}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="topClientes" value="Top Clientes (por primas)" />
                  <Select
                    id="topClientes"
                    value={String(topNClientes)}
                    onChange={(e) => setTopNClientes(Number(e.target.value))}
                  >
                    <option value="0">Todos</option>
                    <option value="5">Top 5</option>
                    <option value="10">Top 10</option>
                    <option value="20">Top 20</option>
                    <option value="50">Top 50</option>
                  </Select>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t">
                <div className="text-sm text-gray-600">
                  <Icon icon="solar:document-text-bold-duotone" className="inline mr-2" />
                  {polizasFiltradas.length} pólizas encontradas
                </div>
                <div className="flex space-x-2">
                  <Button color="light" onClick={exportarPDF} disabled={loading}>
                    <Icon icon="solar:export-bold-duotone" className="mr-2 h-4 w-4" />
                    Exportar PDF
                  </Button>
                  <Button color="light" onClick={exportarExcel} disabled={loading}>
                    <Icon icon="solar:document-bold-duotone" className="mr-2 h-4 w-4" />
                    Exportar Excel
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Indicadores Principales */}
        {reporteActual && (
          <div className="col-span-12">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Total Primas</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(reporteActual.totalPrimas)}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {polizasFiltradas.length} pólizas
                    </p>
                  </div>
                  <Icon
                    icon="solar:dollar-minimalistic-bold-duotone"
                    className="h-8 w-8 text-green-500"
                  />
                </div>
              </Card>

              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Recaudo Oficina</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(reporteActual.recaudoOficina)}
                    </p>
                    <p className="text-xs text-orange-600 mt-1">
                      Pendiente: {formatCurrency(reporteActual.recaudoOficinaPendiente)}
                    </p>
                  </div>
                  <Icon
                    icon="solar:wallet-money-bold-duotone"
                    className="h-8 w-8 text-blue-500"
                  />
                </div>
              </Card>

              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Pago Aseguradora</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(reporteActual.pagoAseguradora)}
                    </p>
                    <p className="text-xs text-orange-600 mt-1">
                      Pendiente: {formatCurrency(reporteActual.pagoAseguradoraPendiente)}
                    </p>
                  </div>
                  <Icon
                    icon="solar:card-transfer-bold-duotone"
                    className="h-8 w-8 text-purple-500"
                  />
                </div>
              </Card>

              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Comisiones</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(reporteActual.totalComisiones)}
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                      Cobradas: {formatCurrency(reporteActual.comisionesPagadas)}
                    </p>
                  </div>
                  <Icon
                    icon="solar:money-bag-bold-duotone"
                    className="h-8 w-8 text-green-500"
                  />
                </div>
              </Card>
            </div>

            {/* Segunda fila de indicadores */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Comisiones Pendientes</p>
                    <p className="text-2xl font-bold text-yellow-600">
                      {formatCurrency(reporteActual.comisionesPendientes)}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {reporteActual.totalComisiones > 0
                        ? formatPercentage((reporteActual.comisionesPendientes / reporteActual.totalComisiones) * 100)
                        : '0%'}{' '}
                      del total
                    </p>
                  </div>
                  <Icon
                    icon="solar:clock-circle-bold-duotone"
                    className="h-8 w-8 text-yellow-500"
                  />
                </div>
              </Card>

              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Margen Bruto</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatPercentage(reporteActual.margenBruto)}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      Comisión / Prima
                    </p>
                  </div>
                  <Icon
                    icon="solar:chart-square-bold-duotone"
                    className="h-8 w-8 text-indigo-500"
                  />
                </div>
              </Card>

              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Tasa de Recaudo</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {reporteActual.totalPrimas > 0
                        ? formatPercentage(((reporteActual.recaudoOficina + reporteActual.pagoAseguradora) / reporteActual.totalPrimas) * 100)
                        : '0%'}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      Efectividad de cobro
                    </p>
                  </div>
                  <Icon
                    icon="solar:graph-up-bold-duotone"
                    className="h-8 w-8 text-green-500"
                  />
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Tabs de Reportes */}
        <div className="col-span-12">
          <Card>
            <Tabs aria-label="Reportes financieros">
              <Tabs.Item active title="Resumen Ejecutivo" icon={() => <Icon icon="solar:chart-bold-duotone" />}>
                <div className="space-y-6">
                  {/* Resumen General */}
                  {reporteActual && (
                    <Card>
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">Resumen del Período</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                            <tr>
                              <th className="px-6 py-3">Concepto</th>
                              <th className="px-6 py-3 text-right">Valor</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="bg-white border-b">
                              <td className="px-6 py-4 font-medium">Total Primas</td>
                              <td className="px-6 py-4 text-right font-bold text-blue-600">
                                {formatCurrency(reporteActual.totalPrimas)}
                              </td>
                            </tr>
                            <tr className="bg-white border-b">
                              <td className="px-6 py-4 font-medium">Recaudo por Oficina</td>
                              <td className="px-6 py-4 text-right font-bold text-blue-600">
                                {formatCurrency(reporteActual.recaudoOficina)}
                              </td>
                            </tr>
                            <tr className="bg-white border-b">
                              <td className="px-6 py-4 font-medium">Recaudo Oficina Pendiente</td>
                              <td className="px-6 py-4 text-right font-semibold text-orange-600">
                                {formatCurrency(reporteActual.recaudoOficinaPendiente)}
                              </td>
                            </tr>
                            <tr className="bg-white border-b">
                              <td className="px-6 py-4 font-medium">Pago a Aseguradoras</td>
                              <td className="px-6 py-4 text-right font-bold text-purple-600">
                                {formatCurrency(reporteActual.pagoAseguradora)}
                              </td>
                            </tr>
                            <tr className="bg-white border-b">
                              <td className="px-6 py-4 font-medium">Pago Aseguradora Pendiente</td>
                              <td className="px-6 py-4 text-right font-semibold text-orange-600">
                                {formatCurrency(reporteActual.pagoAseguradoraPendiente)}
                              </td>
                            </tr>
                            <tr className="bg-white border-b">
                              <td className="px-6 py-4 font-medium">Comisiones Generadas</td>
                              <td className="px-6 py-4 text-right font-bold text-green-600">
                                {formatCurrency(reporteActual.totalComisiones)}
                              </td>
                            </tr>
                            <tr className="bg-white border-b">
                              <td className="px-6 py-4 font-medium">Comisiones Cobradas</td>
                              <td className="px-6 py-4 text-right font-semibold text-green-600">
                                {formatCurrency(reporteActual.comisionesPagadas)}
                              </td>
                            </tr>
                            <tr className="bg-white border-b">
                              <td className="px-6 py-4 font-medium">Comisiones Pendientes</td>
                              <td className="px-6 py-4 text-right font-semibold text-yellow-600">
                                {formatCurrency(reporteActual.comisionesPendientes)}
                              </td>
                            </tr>
                            <tr className="bg-white border-b">
                              <td className="px-6 py-4 font-medium">Margen Bruto</td>
                              <td className="px-6 py-4 text-right font-semibold">
                                {formatPercentage(reporteActual.margenBruto)}
                              </td>
                            </tr>
                            <tr className="bg-white border-b">
                              <td className="px-6 py-4 font-medium">Pólizas Analizadas</td>
                              <td className="px-6 py-4 text-right font-semibold">
                                {polizasFiltradas.length}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  )}

                  {/* Análisis de Flujo de Caja */}
                  {reporteActual && (
                    <Card>
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">
                        Análisis de Flujo de Caja
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <h5 className="font-semibold text-blue-800 mb-2">Recaudo Oficina</h5>
                          <p className="text-2xl font-bold text-blue-600">
                            {formatCurrency(reporteActual.recaudoOficina)}
                          </p>
                          <p className="text-sm text-blue-700">Cobrado en oficina</p>
                          <p className="text-xs text-orange-600 mt-1">
                            Pend: {formatCurrency(reporteActual.recaudoOficinaPendiente)}
                          </p>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-lg">
                          <h5 className="font-semibold text-purple-800 mb-2">Pago Aseguradora</h5>
                          <p className="text-2xl font-bold text-purple-600">
                            {formatCurrency(reporteActual.pagoAseguradora)}
                          </p>
                          <p className="text-sm text-purple-700">Pagado a aseguradoras</p>
                          <p className="text-xs text-orange-600 mt-1">
                            Pend: {formatCurrency(reporteActual.pagoAseguradoraPendiente)}
                          </p>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg">
                          <h5 className="font-semibold text-green-800 mb-2">Comisiones Cobradas</h5>
                          <p className="text-2xl font-bold text-green-600">
                            {formatCurrency(reporteActual.comisionesPagadas)}
                          </p>
                          <p className="text-sm text-green-700">Ingresos por comisiones</p>
                          <p className="text-xs text-orange-600 mt-1">
                            Pend: {formatCurrency(reporteActual.comisionesPendientes)}
                          </p>
                        </div>
                        <div className="bg-indigo-50 p-4 rounded-lg">
                          <h5 className="font-semibold text-indigo-800 mb-2">Balance</h5>
                          <p className="text-2xl font-bold text-indigo-600">
                            {formatCurrency(reporteActual.recaudoOficina - reporteActual.pagoAseguradora)}
                          </p>
                          <p className="text-sm text-indigo-700">Flujo neto</p>
                          <p className="text-xs text-gray-600 mt-1">
                            Recaudo - Pagos
                          </p>
                        </div>
                      </div>
                    </Card>
                  )}
                </div>
              </Tabs.Item>

              <Tabs.Item title="Por Asesor" icon={() => <Icon icon="solar:user-bold-duotone" />}>
                <Card>
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">
                    Rendimiento por Asesor
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                        <tr>
                          <th className="px-6 py-3">Asesor</th>
                          <th className="px-6 py-3 text-right">Comisiones Generadas</th>
                          <th className="px-6 py-3 text-right">Comisiones Pagadas</th>
                          <th className="px-6 py-3 text-center">% Meta</th>
                          <th className="px-6 py-3 text-center">Clientes</th>
                          <th className="px-6 py-3 text-center">Pólizas</th>
                          <th className="px-6 py-3 text-right">Promedio por Póliza</th>
                        </tr>
                      </thead>
                      <tbody>
                        {byAdvisor.map((reporte) => (
                          <tr key={reporte.asesorId} className="bg-white border-b">
                            <td className="px-6 py-4 font-medium">{reporte.asesor}</td>
                            <td className="px-6 py-4 text-right text-green-600 font-semibold">
                              {formatCurrency(reporte.comisionesGeneradas)}
                            </td>
                            <td className="px-6 py-4 text-right">
                              {formatCurrency(reporte.comisionesPagadas)}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <Badge color={reporte.porcentajeMeta >= 100 ? 'success' : 'warning'}>
                                {formatPercentage(reporte.porcentajeMeta)}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 text-center">{reporte.clientesActivos}</td>
                            <td className="px-6 py-4 text-center">{reporte.polizasVendidas}</td>
                            <td className="px-6 py-4 text-right font-semibold">
                              {reporte.polizasVendidas > 0 
                                ? formatCurrency(reporte.comisionesGeneradas / reporte.polizasVendidas)
                                : '$0'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {byAdvisor.length === 0 && (
                    <div className="text-center py-12">
                      <Icon icon="solar:inbox-bold-duotone" className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">No hay datos de asesores para el período seleccionado</p>
                    </div>
                  )}
                </Card>
              </Tabs.Item>

              <Tabs.Item title="Por Aseguradora" icon={() => <Icon icon="solar:shield-bold-duotone" />}>
                <Card>
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">
                    Participación por Aseguradora
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                        <tr>
                          <th className="px-6 py-3">Aseguradora</th>
                          <th className="px-6 py-3 text-right">Primas Total</th>
                          <th className="px-6 py-3 text-right">Comisiones</th>
                          <th className="px-6 py-3">% Participación</th>
                          <th className="px-6 py-3 text-center">Pólizas Activas</th>
                          <th className="px-6 py-3 text-right">Prima Promedio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {byInsurer.map((reporte) => (
                          <tr key={reporte.aseguradoraId} className="bg-white border-b">
                            <td className="px-6 py-4 font-medium">{reporte.aseguradora}</td>
                            <td className="px-6 py-4 text-right font-semibold">
                              {formatCurrency(reporte.primasTotal)}
                            </td>
                            <td className="px-6 py-4 text-right text-green-600 font-semibold">
                              {formatCurrency(reporte.comisiones)}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center">
                                <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                                  <div
                                    className="bg-primary h-2 rounded-full"
                                    style={{ width: `${Math.min(100, reporte.porcentajeParticipacion)}%` }}
                                  ></div>
                                </div>
                                <span className="text-sm font-medium">
                                  {formatPercentage(reporte.porcentajeParticipacion)}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">{reporte.polizasActivas}</td>
                            <td className="px-6 py-4 text-right font-semibold">
                              {reporte.polizasActivas > 0 
                                ? formatCurrency(reporte.primasTotal / reporte.polizasActivas)
                                : '$0'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {byInsurer.length === 0 && (
                    <div className="text-center py-12">
                      <Icon icon="solar:inbox-bold-duotone" className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">No hay datos de aseguradoras para el período seleccionado</p>
                    </div>
                  )}
                </Card>
              </Tabs.Item>

              <Tabs.Item title="Por Ramo" icon={() => <Icon icon="solar:document-text-bold-duotone" />}>
                <Card>
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">
                    Distribución por Ramo
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                        <tr>
                          <th className="px-6 py-3">Ramo</th>
                          <th className="px-6 py-3 text-right">Primas Total</th>
                          <th className="px-6 py-3 text-right">Comisiones</th>
                          <th className="px-6 py-3">% Participación</th>
                          <th className="px-6 py-3 text-center">Pólizas Activas</th>
                          <th className="px-6 py-3 text-right">Prima Promedio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {byRamo.map((reporte) => (
                          <tr key={reporte.ramoId} className="bg-white border-b">
                            <td className="px-6 py-4 font-medium">{reporte.ramo}</td>
                            <td className="px-6 py-4 text-right font-semibold">
                              {formatCurrency(reporte.primasTotal)}
                            </td>
                            <td className="px-6 py-4 text-right text-green-600 font-semibold">
                              {formatCurrency(reporte.comisiones)}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center">
                                <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                                  <div
                                    className="bg-purple-600 h-2 rounded-full"
                                    style={{ width: `${Math.min(100, reporte.porcentajeParticipacion)}%` }}
                                  ></div>
                                </div>
                                <span className="text-sm font-medium">
                                  {formatPercentage(reporte.porcentajeParticipacion)}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">{reporte.polizasActivas}</td>
                            <td className="px-6 py-4 text-right font-semibold">
                              {reporte.polizasActivas > 0 
                                ? formatCurrency(reporte.primasTotal / reporte.polizasActivas)
                                : '$0'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {byRamo.length === 0 && (
                    <div className="text-center py-12">
                      <Icon icon="solar:inbox-bold-duotone" className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">No hay datos de ramos para el período seleccionado</p>
                    </div>
                  )}
                </Card>
              </Tabs.Item>

              <Tabs.Item title="Top Clientes" icon={() => <Icon icon="solar:star-bold-duotone" />}>
                <Card>
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">
                    Clientes con Mayor Cartera
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                        <tr>
                          <th className="px-6 py-3">#</th>
                          <th className="px-6 py-3">Cliente</th>
                          <th className="px-6 py-3">Documento</th>
                          <th className="px-6 py-3 text-right">Primas Total</th>
                          <th className="px-6 py-3 text-right">Comisiones</th>
                          <th className="px-6 py-3 text-center">Pólizas Activas</th>
                          <th className="px-6 py-3">Última Póliza</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topClientes.map((cliente, index) => (
                          <tr key={cliente.clienteId} className="bg-white border-b">
                            <td className="px-6 py-4">
                              <Badge color={index < 3 ? 'warning' : 'gray'}>
                                {index + 1}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 font-medium">{cliente.cliente}</td>
                            <td className="px-6 py-4">{cliente.documento}</td>
                            <td className="px-6 py-4 text-right font-semibold text-blue-600">
                              {formatCurrency(cliente.primasTotal)}
                            </td>
                            <td className="px-6 py-4 text-right text-green-600 font-semibold">
                              {formatCurrency(cliente.comisiones)}
                            </td>
                            <td className="px-6 py-4 text-center">{cliente.polizasActivas}</td>
                            <td className="px-6 py-4">{cliente.ultimaPoliza}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {topClientes.length === 0 && (
                    <div className="text-center py-12">
                      <Icon icon="solar:inbox-bold-duotone" className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">No hay datos de clientes para el período seleccionado</p>
                    </div>
                  )}
                </Card>
              </Tabs.Item>

              <Tabs.Item title="Por Cliente" icon={() => <Icon icon="solar:users-group-rounded-bold-duotone" />}>
                <Card>
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">
                    Reporte Detallado por Cliente
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                        <tr>
                          <th className="px-6 py-3">Cliente</th>
                          <th className="px-6 py-3">Documento</th>
                          <th className="px-6 py-3 text-right">Primas Total</th>
                          <th className="px-6 py-3 text-right">Comisiones</th>
                          <th className="px-6 py-3 text-center">Pólizas Activas</th>
                          <th className="px-6 py-3">Última Póliza</th>
                        </tr>
                      </thead>
                      <tbody>
                        {byCliente.map((cliente) => (
                          <tr key={cliente.clienteId} className="bg-white border-b">
                            <td className="px-6 py-4 font-medium">{cliente.cliente}</td>
                            <td className="px-6 py-4">{cliente.documento}</td>
                            <td className="px-6 py-4 text-right font-semibold">
                              {formatCurrency(cliente.primasTotal)}
                            </td>
                            <td className="px-6 py-4 text-right text-green-600 font-semibold">
                              {formatCurrency(cliente.comisiones)}
                            </td>
                            <td className="px-6 py-4 text-center">{cliente.polizasActivas}</td>
                            <td className="px-6 py-4">{cliente.ultimaPoliza}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {byCliente.length === 0 && (
                    <div className="text-center py-12">
                      <Icon icon="solar:inbox-bold-duotone" className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">No hay datos de clientes para el período seleccionado</p>
                    </div>
                  )}
                </Card>
              </Tabs.Item>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ReportesFinancieros;
