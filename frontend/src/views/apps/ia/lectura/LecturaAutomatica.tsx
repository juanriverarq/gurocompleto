import { useState, useRef, useCallback } from 'react';
import { Button, Card, Badge, Progress, Alert } from 'flowbite-react';
import { Icon } from '@iconify/react';
import BreadcrumbComp from 'src/layouts/full/shared/breadcrumb/BreadcrumbComp';

const BCrumb = [
  {
    to: "/",
    title: "Dashboard",
  },
  {
    to: "/apps/ia",
    title: "Inteligencia Artificial",
  },
  {
    title: "Lectura Automática",
  },
];

export interface DocumentoType {
  id: string;
  nombre: string;
  tipo: string;
  tamaño: string;
  estado: 'procesando' | 'completado' | 'error';
  progreso: number;
  tipoDetectado?: 'poliza' | 'siniestro' | 'cliente' | 'cotizacion' | 'documento_identidad' | 'recibo' | 'otro';
  confianza?: number;
  datosExtraidos?: any;
  fechaProcesamiento?: Date;
  errores?: string[];
}

const tiposDocumento = {
  poliza: {
    label: 'Póliza de Seguro',
    icon: 'solar:shield-check-bold-duotone',
    color: 'text-primary',
    bgColor: 'bg-primary/10'
  },
  siniestro: {
    label: 'Reporte de Siniestro',
    icon: 'solar:danger-bold-duotone',
    color: 'text-error',
    bgColor: 'bg-error/10'
  },
  cliente: {
    label: 'Información de Cliente',
    icon: 'solar:user-bold-duotone',
    color: 'text-info',
    bgColor: 'bg-info/10'
  },
  cotizacion: {
    label: 'Cotización',
    icon: 'solar:calculator-bold-duotone',
    color: 'text-warning',
    bgColor: 'bg-warning/10'
  },
  documento_identidad: {
    label: 'Documento de Identidad',
    icon: 'solar:card-bold-duotone',
    color: 'text-success',
    bgColor: 'bg-success/10'
  },
  recibo: {
    label: 'Recibo de Pago',
    icon: 'solar:bill-list-bold-duotone',
    color: 'text-purple-500',
    bgColor: 'bg-purple-100'
  },
  otro: {
    label: 'Otro Documento',
    icon: 'solar:document-text-bold-duotone',
    color: 'text-gray-500',
    bgColor: 'bg-gray-100'
  }
};

const LecturaAutomatica = () => {
  const [documentos, setDocumentos] = useState<DocumentoType[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Simular detección de tipo de documento
  const detectarTipoDocumento = (nombreArchivo: string): { tipo: keyof typeof tiposDocumento; confianza: number; datos: any } => {
    const nombre = nombreArchivo.toLowerCase();
    
    if (nombre.includes('poliza') || nombre.includes('policy') || nombre.includes('seguro')) {
      return {
        tipo: 'poliza',
        confianza: 95,
        datos: {
          numeroPoliza: 'POL-2024-' + Math.floor(Math.random() * 1000),
          asegurado: 'María González Pérez',
          tipoSeguro: 'Automóvil',
          vigencia: '2024-12-31',
          prima: '$2,400,000'
        }
      };
    }
    
    if (nombre.includes('siniestro') || nombre.includes('claim') || nombre.includes('accidente')) {
      return {
        tipo: 'siniestro',
        confianza: 92,
        datos: {
          numeroSiniestro: 'SIN-2024-' + Math.floor(Math.random() * 1000),
          fechaSiniestro: '2024-01-15',
          tipoSiniestro: 'Accidente de Tránsito',
          montoReclamado: '$8,500,000',
          estado: 'Pendiente'
        }
      };
    }
    
    if (nombre.includes('cedula') || nombre.includes('id') || nombre.includes('identidad') || nombre.includes('dni')) {
      return {
        tipo: 'documento_identidad',
        confianza: 98,
        datos: {
          tipoDocumento: 'Cédula de Ciudadanía',
          numero: '1.234.567.890',
          nombres: 'JUAN CARLOS PÉREZ GARCÍA',
          fechaNacimiento: '1985-03-15',
          lugarExpedicion: 'BOGOTÁ'
        }
      };
    }
    
    if (nombre.includes('cotizacion') || nombre.includes('quote') || nombre.includes('presupuesto')) {
      return {
        tipo: 'cotizacion',
        confianza: 88,
        datos: {
          numeroCotizacion: 'COT-2024-' + Math.floor(Math.random() * 1000),
          cliente: 'Ana Rodríguez López',
          tipoSeguro: 'Hogar',
          prima: '$1,200,000',
          vigencia: '1 año'
        }
      };
    }
    
    if (nombre.includes('recibo') || nombre.includes('pago') || nombre.includes('factura')) {
      return {
        tipo: 'recibo',
        confianza: 90,
        datos: {
          numeroRecibo: 'REC-2024-' + Math.floor(Math.random() * 1000),
          monto: '$300,000',
          fechaPago: '2024-01-20',
          concepto: 'Prima Mensual Seguro Auto',
          metodoPago: 'Transferencia Bancaria'
        }
      };
    }
    
    // Documento genérico
    return {
      tipo: 'otro',
      confianza: 60,
      datos: {
        tipoDocumento: 'Documento General',
        fechaProcesamiento: new Date().toISOString(),
        paginas: Math.floor(Math.random() * 5) + 1
      }
    };
  };

  const procesarArchivo = useCallback((archivo: File) => {
    const nuevoDocumento: DocumentoType = {
      id: Date.now().toString() + Math.random(),
      nombre: archivo.name,
      tipo: archivo.type,
      tamaño: `${(archivo.size / 1024 / 1024).toFixed(2)} MB`,
      estado: 'procesando',
      progreso: 0,
      fechaProcesamiento: new Date()
    };

    setDocumentos(prev => [...prev, nuevoDocumento]);

    // Simular procesamiento
    const intervalo = setInterval(() => {
      setDocumentos(prev => prev.map(doc => {
        if (doc.id === nuevoDocumento.id) {
          const nuevoProgreso = doc.progreso + Math.random() * 20;
          
          if (nuevoProgreso >= 100) {
            clearInterval(intervalo);
            const { tipo, confianza, datos } = detectarTipoDocumento(archivo.name);
            
            return {
              ...doc,
              progreso: 100,
              estado: 'completado',
              tipoDetectado: tipo,
              confianza: confianza,
              datosExtraidos: datos
            };
          }
          
          return {
            ...doc,
            progreso: Math.min(nuevoProgreso, 95)
          };
        }
        return doc;
      }));
    }, 500);

  }, []);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const archivos = event.target.files;
    if (archivos) {
      Array.from(archivos).forEach(procesarArchivo);
    }
  };

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
    
    const archivos = event.dataTransfer.files;
    Array.from(archivos).forEach(procesarArchivo);
  }, [procesarArchivo]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
  }, []);

  const eliminarDocumento = (id: string) => {
    setDocumentos(prev => prev.filter(doc => doc.id !== id));
  };

  const descargarResultados = (documento: DocumentoType) => {
    const datos = {
      documento: documento.nombre,
      tipoDetectado: documento.tipoDetectado,
      confianza: documento.confianza,
      datosExtraidos: documento.datosExtraidos,
      fechaProcesamiento: documento.fechaProcesamiento
    };
    
    const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `resultados-${documento.nombre}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Estadísticas
  const totalDocumentos = documentos.length;
  const documentosCompletados = documentos.filter(d => d.estado === 'completado').length;
  const documentosProcesando = documentos.filter(d => d.estado === 'procesando').length;
  const confianzaPromedio = documentos
    .filter(d => d.confianza)
    .reduce((acc, d) => acc + (d.confianza || 0), 0) / documentosCompletados || 0;

  return (
    <>
      <BreadcrumbComp title="Lectura Automática" items={BCrumb} />
      
      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Icon icon="solar:document-text-bold" className="text-primary" width={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-dark dark:text-white">{totalDocumentos}</h3>
              <p className="text-sm text-gray-500">Total Documentos</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-success/10 rounded-lg">
              <Icon icon="solar:check-circle-bold" className="text-success" width={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-dark dark:text-white">{documentosCompletados}</h3>
              <p className="text-sm text-gray-500">Procesados</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-warning/10 rounded-lg">
              <Icon icon="solar:clock-circle-bold" className="text-warning" width={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-dark dark:text-white">{documentosProcesando}</h3>
              <p className="text-sm text-gray-500">En Proceso</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-info/10 rounded-lg">
              <Icon icon="solar:chart-bold" className="text-info" width={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-dark dark:text-white">{confianzaPromedio.toFixed(1)}%</h3>
              <p className="text-sm text-gray-500">Confianza Promedio</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Área de carga */}
      <Card className="mb-6">
        <div
          className={`p-8 border-2 border-dashed rounded-lg text-center transition-colors ${
            isDragOver 
              ? 'border-primary bg-primary/5' 
              : 'border-gray-300 dark:border-gray-600'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <Icon 
            icon="solar:cloud-upload-bold-duotone" 
            className="mx-auto mb-4 text-gray-400" 
            width={64} 
          />
          <h3 className="text-lg font-semibold text-dark dark:text-white mb-2">
            Arrastra documentos aquí o haz clic para seleccionar
          </h3>
          <p className="text-gray-500 mb-4">
            Soporta PDF, JPG, PNG, DOCX. Máximo 10MB por archivo.
          </p>
          <Button
            color="primary"
            onClick={() => fileInputRef.current?.click()}
          >
            <Icon icon="solar:add-circle-bold" className="mr-2" width={16} />
            Seleccionar Archivos
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.docx"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </Card>

      {/* Información sobre IA */}
      <Alert color="info" className="mb-6">
        <Icon icon="solar:info-circle-bold" className="mr-2" width={16} />
        <span>
          <strong>IA Avanzada:</strong> Nuestro sistema utiliza reconocimiento óptico de caracteres (OCR) 
          y procesamiento de lenguaje natural para identificar automáticamente el tipo de documento y 
          extraer información relevante con alta precisión.
        </span>
      </Alert>

      {/* Lista de documentos */}
      {documentos.length > 0 && (
        <Card className="p-6">
          <h3 className="text-xl font-semibold text-dark dark:text-white mb-4">
            Documentos Procesados
          </h3>
          
          <div className="space-y-4">
            {documentos.map((documento) => {
              const tipoInfo = documento.tipoDetectado ? tiposDocumento[documento.tipoDetectado] : null;
              
              return (
                <div key={documento.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {tipoInfo && (
                        <div className={`p-2 rounded-lg ${tipoInfo.bgColor}`}>
                          <Icon icon={tipoInfo.icon} className={tipoInfo.color} width={24} />
                        </div>
                      )}
                      <div>
                        <h4 className="font-semibold text-dark dark:text-white">{documento.nombre}</h4>
                        <p className="text-sm text-gray-500">{documento.tamaño}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {documento.estado === 'completado' && (
                        <>
                          <Badge color="success">
                            <Icon icon="solar:check-circle-bold" className="mr-1" width={12} />
                            Completado
                          </Badge>
                          {documento.confianza && (
                            <Badge color="info">
                              {documento.confianza}% confianza
                            </Badge>
                          )}
                        </>
                      )}
                      {documento.estado === 'procesando' && (
                        <Badge color="warning">
                          <Icon icon="solar:clock-circle-bold" className="mr-1" width={12} />
                          Procesando
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  {documento.estado === 'procesando' && (
                    <div className="mb-3">
                      <Progress progress={documento.progreso} color="blue" />
                      <p className="text-sm text-gray-500 mt-1">
                        Procesando... {documento.progreso.toFixed(0)}%
                      </p>
                    </div>
                  )}
                  
                  {documento.tipoDetectado && tipoInfo && (
                    <div className="mb-3">
                      <p className="text-sm font-medium text-dark dark:text-white mb-2">
                        Tipo detectado: {tipoInfo.label}
                      </p>
                      
                      {documento.datosExtraidos && (
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                          <p className="text-sm font-medium text-dark dark:text-white mb-2">
                            Datos extraídos:
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                            {Object.entries(documento.datosExtraidos).map(([key, value]) => (
                              <div key={key}>
                                <span className="text-gray-500 capitalize">
                                  {key.replace(/([A-Z])/g, ' $1').toLowerCase()}:
                                </span>
                                <span className="ml-2 text-dark dark:text-white font-medium">
                                  {String(value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    {documento.estado === 'completado' && (
                      <>
                        <Button size="xs" color="primary" onClick={() => descargarResultados(documento)}>
                          <Icon icon="solar:download-minimalistic-bold" className="mr-1" width={12} />
                          Descargar Resultados
                        </Button>
                        <Button size="xs" color="success">
                          <Icon icon="solar:database-bold" className="mr-1" width={12} />
                          Guardar en Sistema
                        </Button>
                      </>
                    )}
                    <Button size="xs" color="light" onClick={() => eliminarDocumento(documento.id)}>
                      <Icon icon="solar:trash-bin-minimalistic-bold" className="mr-1" width={12} />
                      Eliminar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </>
  );
};

export default LecturaAutomatica; 