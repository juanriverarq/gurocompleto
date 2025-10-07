/**
 * Plantillas de ramos comunes en Colombia.
 * Solo definen nombre y subramo. En la creación se complementan flags y comisiones por aseguradora.
 */
export interface RamoTemplate {
  nombre: string;
  subramo: string;
}

export const COLOMBIA_RAMOS: RamoTemplate[] = [
  // Autos y movilidad
  { nombre: 'Automóviles', subramo: 'Particulares' },
  { nombre: 'Automóviles', subramo: 'Empresarial' },
  { nombre: 'SOAT', subramo: 'Vehículos' },
  { nombre: 'Motos', subramo: 'Particulares' },
  { nombre: 'Motos', subramo: 'Empresarial' },
  { nombre: 'Transporte', subramo: 'Mercancías' },
  { nombre: 'RC Extracontractual', subramo: 'Vehículos' },

  // Personas
  { nombre: 'Vida', subramo: 'Individual' },
  { nombre: 'Vida', subramo: 'Grupo' },
  { nombre: 'Accidentes Personales', subramo: 'Individual' },
  { nombre: 'Accidentes Personales', subramo: 'Colectivo' },
  { nombre: 'Salud', subramo: 'Plan Complementario' },
  { nombre: 'Salud', subramo: 'Medicina Prepagada' },
  { nombre: 'Viaje', subramo: 'Asistencia' },

  // Hogar y patrimoniales
  { nombre: 'Hogar', subramo: 'Integral' },
  { nombre: 'Hogar', subramo: 'Arrendamiento' },
  { nombre: 'Incendio y Terremoto', subramo: 'Comercial' },
  { nombre: 'Incendio y Terremoto', subramo: 'Residencial' },
  { nombre: 'Multiriesgo', subramo: 'Pyme' },
  { nombre: 'Equipo Electrónico', subramo: 'Todo Riesgo' },
  { nombre: 'Rotura de Maquinaria', subramo: 'Industrial' },
  { nombre: 'Lucro Cesante', subramo: 'Por Incendio' },

  // Responsabilidades y garantías
  { nombre: 'Responsabilidad Civil', subramo: 'Profesional' },
  { nombre: 'Responsabilidad Civil', subramo: 'Directores y Administradores (D&O)' },
  { nombre: 'Cumplimiento', subramo: 'Contratos Estatales' },
  { nombre: 'Cumplimiento', subramo: 'Particulares' },
  { nombre: 'Manejo Global', subramo: 'Fidelidad' },

  // Ingeniería
  { nombre: 'Todo Riesgo Construcción (TRC)', subramo: 'Obra Civil' },
  { nombre: 'Montaje', subramo: 'Equipos e Instalaciones' },

  // Otros
  { nombre: 'Educativo', subramo: 'Colectivo Estudiantil' },
  { nombre: 'Mascotas', subramo: 'Caninos y Felinos' }
];