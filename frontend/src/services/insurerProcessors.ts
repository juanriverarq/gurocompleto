// Procesadores específicos por aseguradora para máxima precisión
// Cada aseguradora tiene patrones y formatos únicos

export interface InsurerProcessor {
  name: string;
  patterns: InsurerPatterns;
  process(text: string): Promise<ExtractionResult>;
  validateSpecific(data: any): Promise<ValidationResult[]>;
}

export interface InsurerPatterns {
  numeroPoliza: RegExp[];
  fechas: RegExp[];
  montos: RegExp[];
  cliente: RegExp[];
  specific: Record<string, RegExp>;
}

export interface ExtractionResult {
  data: Record<string, any>;
  confidence: number;
  method: string;
  processingTime: number;
  errors: string[];
}

export interface ValidationResult {
  field: string;
  isValid: boolean;
  confidence: number;
  errors: string[];
}

// ===== PROCESADOR BASE =====

abstract class BaseInsurerProcessor implements InsurerProcessor {
  abstract name: string;
  abstract patterns: InsurerPatterns;

  async process(text: string): Promise<ExtractionResult> {
    const startTime = Date.now();
    const data: Record<string, any> = {};
    let fieldsFound = 0;

    try {
      // Extraer número de póliza
      for (const pattern of this.patterns.numeroPoliza) {
        const match = text.match(pattern);
        if (match) {
          data.numeroPoliza = this.cleanPolicyNumber(match[1] || match[0]);
          fieldsFound++;
          break;
        }
      }

      // Extraer fechas
      for (const pattern of this.patterns.fechas) {
        const matches = text.matchAll(new RegExp(pattern.source, 'gi'));
        for (const match of matches) {
          const dateStr = match[1] || match[0];
          const normalizedDate = this.normalizeDate(dateStr);
          if (normalizedDate) {
            if (!data.fechaExpedicion && this.isIssueDate(match[0], text)) {
              data.fechaExpedicion = normalizedDate;
              fieldsFound++;
            } else if (!data.fechaInicio && this.isStartDate(match[0], text)) {
              data.fechaInicio = normalizedDate;
              fieldsFound++;
            } else if (!data.fechaFin && this.isEndDate(match[0], text)) {
              data.fechaFin = normalizedDate;
              fieldsFound++;
            }
          }
        }
      }

      // Extraer montos
      for (const pattern of this.patterns.montos) {
        const matches = text.matchAll(new RegExp(pattern.source, 'gi'));
        for (const match of matches) {
          const amount = this.cleanAmount(match[1] || match[0]);
          if (amount) {
            if (!data.primaNeta && this.isPremiumAmount(match[0], text)) {
              data.primaNeta = amount;
              fieldsFound++;
            } else if (!data.iva && this.isIVAAmount(match[0], text)) {
              data.iva = amount;
              fieldsFound++;
            } else if (!data.total && this.isTotalAmount(match[0], text)) {
              data.total = amount;
              fieldsFound++;
            }
          }
        }
      }

      // Extraer datos del cliente
      for (const pattern of this.patterns.cliente) {
        const match = text.match(pattern);
        if (match) {
          if (!data.clienteNombre && this.isClientName(match[0], text)) {
            data.clienteNombre = this.cleanName(match[1] || match[0]);
            fieldsFound++;
          } else if (!data.clienteCedula && this.isClientDocument(match[0], text)) {
            data.clienteCedula = this.cleanDocument(match[1] || match[0]);
            fieldsFound++;
          }
        }
      }

      // Procesamiento específico de la aseguradora
      const specificData = await this.processSpecific(text);
      Object.assign(data, specificData);
      fieldsFound += Object.keys(specificData).length;

      const confidence = Math.min(95, (fieldsFound / 15) * 100);

      return {
        data,
        confidence,
        method: `insurer-${this.name.toLowerCase()}`,
        processingTime: Date.now() - startTime,
        errors: []
      };

    } catch (error) {
      return {
        data: {},
        confidence: 0,
        method: `insurer-${this.name.toLowerCase()}-error`,
        processingTime: Date.now() - startTime,
        errors: [(error as Error).message]
      };
    }
  }

  abstract validateSpecific(data: any): Promise<ValidationResult[]>;
  abstract processSpecific(text: string): Promise<Record<string, any>>;

  // Métodos auxiliares
  protected cleanPolicyNumber(value: string): string {
    return value.trim().replace(/[^\w\-]/g, '');
  }

  protected cleanAmount(value: string): string {
    return value.replace(/[^\d.,]/g, '').replace(/,/g, '');
  }

  protected cleanName(value: string): string {
    return value.trim().replace(/\s+/g, ' ').toUpperCase();
  }

  protected cleanDocument(value: string): string {
    return value.replace(/[^\d]/g, '');
  }

  protected normalizeDate(dateStr: string): string | null {
    // Intentar diferentes formatos de fecha
    const formats = [
      /(\d{2})\/(\d{2})\/(\d{4})/, // DD/MM/YYYY
      /(\d{2})-(\d{2})-(\d{4})/, // DD-MM-YYYY
      /(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
    ];

    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        if (format === formats[2]) {
          // Ya está en formato YYYY-MM-DD
          return match[0];
        } else {
          // Convertir DD/MM/YYYY o DD-MM-YYYY a YYYY-MM-DD
          return `${match[3]}-${match[2]}-${match[1]}`;
        }
      }
    }

    return null;
  }

  protected isIssueDate(context: string, fullText: string): boolean {
    const keywords = ['expedición', 'expedicion', 'emisión', 'emision', 'emitida', 'expedida'];
    return keywords.some(keyword => context.toLowerCase().includes(keyword));
  }

  protected isStartDate(context: string, fullText: string): boolean {
    const keywords = ['inicio', 'vigencia desde', 'desde', 'inicia', 'comienza'];
    return keywords.some(keyword => context.toLowerCase().includes(keyword));
  }

  protected isEndDate(context: string, fullText: string): boolean {
    const keywords = ['fin', 'vigencia hasta', 'hasta', 'vence', 'vencimiento', 'termina'];
    return keywords.some(keyword => context.toLowerCase().includes(keyword));
  }

  protected isPremiumAmount(context: string, fullText: string): boolean {
    const keywords = ['prima neta', 'prima', 'valor prima', 'costo prima'];
    return keywords.some(keyword => context.toLowerCase().includes(keyword));
  }

  protected isIVAAmount(context: string, fullText: string): boolean {
    const keywords = ['iva', 'impuesto', 'tax'];
    return keywords.some(keyword => context.toLowerCase().includes(keyword));
  }

  protected isTotalAmount(context: string, fullText: string): boolean {
    const keywords = ['total', 'valor total', 'monto total', 'suma total'];
    return keywords.some(keyword => context.toLowerCase().includes(keyword));
  }

  protected isClientName(context: string, fullText: string): boolean {
    const keywords = ['asegurado', 'cliente', 'nombre', 'tomador'];
    return keywords.some(keyword => context.toLowerCase().includes(keyword));
  }

  protected isClientDocument(context: string, fullText: string): boolean {
    const keywords = ['cédula', 'cedula', 'cc', 'documento', 'identificación'];
    return keywords.some(keyword => context.toLowerCase().includes(keyword));
  }
}

// ===== PROCESADORES ESPECÍFICOS =====

class SuraProcessor extends BaseInsurerProcessor {
  name = 'SURA';
  
  patterns: InsurerPatterns = {
    numeroPoliza: [
      /póliza\s*n[oº°]?\s*:?\s*(\d{10,15})/i,
      /número\s*de\s*póliza\s*:?\s*(\d{10,15})/i,
      /policy\s*number\s*:?\s*(\d{10,15})/i
    ],
    fechas: [
      /(\d{2}\/\d{2}\/\d{4})/g,
      /(\d{2}-\d{2}-\d{4})/g
    ],
    montos: [
      /\$\s*([\d,\.]+)/g,
      /([\d,\.]+)\s*pesos/gi
    ],
    cliente: [
      /asegurado\s*:?\s*([A-ZÁÉÍÓÚÑ\s]+)/i,
      /tomador\s*:?\s*([A-ZÁÉÍÓÚÑ\s]+)/i,
      /cc\s*:?\s*(\d{6,12})/i
    ],
    specific: {
      codigoSucursal: /sucursal\s*:?\s*(\d+)/i,
      agente: /agente\s*:?\s*([A-ZÁÉÍÓÚÑ\s]+)/i
    }
  };

  async processSpecific(text: string): Promise<Record<string, any>> {
    const data: Record<string, any> = {};
    
    // Lógica específica para SURA
    const aseguradoraMatch = text.match(/SURA|SURAMERICANA|SEGUROS SURA/i);
    if (aseguradoraMatch) {
      data.aseguradora = 'SURA';
    }

    // Detectar ramo específico de SURA
    if (text.includes('TODO RIESGO')) {
      data.ramo = 'VEHICULOS';
    } else if (text.includes('VIDA INDIVIDUAL')) {
      data.ramo = 'VIDA';
    }

    return data;
  }

  async validateSpecific(data: any): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    // Validaciones específicas para SURA
    if (data.numeroPoliza) {
      const isValidSuraFormat = /^\d{10,15}$/.test(data.numeroPoliza);
      results.push({
        field: 'numeroPoliza',
        isValid: isValidSuraFormat,
        confidence: isValidSuraFormat ? 0.95 : 0.3,
        errors: isValidSuraFormat ? [] : ['Formato de póliza SURA inválido (debe ser 10-15 dígitos)']
      });
    }

    return results;
  }
}

class BolivarProcessor extends BaseInsurerProcessor {
  name = 'BOLIVAR';
  
  patterns: InsurerPatterns = {
    numeroPoliza: [
      /póliza\s*:?\s*([A-Z]{2}\d{8,12})/i,
      /no\.\s*póliza\s*:?\s*([A-Z]{2}\d{8,12})/i
    ],
    fechas: [
      /(\d{2}\/\d{2}\/\d{4})/g
    ],
    montos: [
      /\$\s*([\d,\.]+)/g
    ],
    cliente: [
      /asegurado\s*:?\s*([A-ZÁÉÍÓÚÑ\s]+)/i,
      /documento\s*:?\s*(\d{6,12})/i
    ],
    specific: {
      certificado: /certificado\s*:?\s*(\d+)/i
    }
  };

  async processSpecific(text: string): Promise<Record<string, any>> {
    const data: Record<string, any> = {};
    
    const aseguradoraMatch = text.match(/BOLIVAR|SEGUROS BOLIVAR/i);
    if (aseguradoraMatch) {
      data.aseguradora = 'BOLIVAR';
    }

    return data;
  }

  async validateSpecific(data: any): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    if (data.numeroPoliza) {
      const isValidBolivarFormat = /^[A-Z]{2}\d{8,12}$/.test(data.numeroPoliza);
      results.push({
        field: 'numeroPoliza',
        isValid: isValidBolivarFormat,
        confidence: isValidBolivarFormat ? 0.95 : 0.3,
        errors: isValidBolivarFormat ? [] : ['Formato de póliza Bolívar inválido (debe ser 2 letras + 8-12 dígitos)']
      });
    }

    return results;
  }
}

class MapfreProcessor extends BaseInsurerProcessor {
  name = 'MAPFRE';
  
  patterns: InsurerPatterns = {
    numeroPoliza: [
      /póliza\s*:?\s*(\d{4}-\d{6,8})/i,
      /policy\s*:?\s*(\d{4}-\d{6,8})/i
    ],
    fechas: [
      /(\d{2}\/\d{2}\/\d{4})/g
    ],
    montos: [
      /\$\s*([\d,\.]+)/g
    ],
    cliente: [
      /asegurado\s*:?\s*([A-ZÁÉÍÓÚÑ\s]+)/i,
      /nit\/cc\s*:?\s*(\d{6,12})/i
    ],
    specific: {
      sucursal: /sucursal\s*:?\s*(\d+)/i
    }
  };

  async processSpecific(text: string): Promise<Record<string, any>> {
    const data: Record<string, any> = {};
    
    const aseguradoraMatch = text.match(/MAPFRE|SEGUROS MAPFRE/i);
    if (aseguradoraMatch) {
      data.aseguradora = 'MAPFRE';
    }

    return data;
  }

  async validateSpecific(data: any): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    if (data.numeroPoliza) {
      const isValidMapfreFormat = /^\d{4}-\d{6,8}$/.test(data.numeroPoliza);
      results.push({
        field: 'numeroPoliza',
        isValid: isValidMapfreFormat,
        confidence: isValidMapfreFormat ? 0.95 : 0.3,
        errors: isValidMapfreFormat ? [] : ['Formato de póliza MAPFRE inválido (debe ser XXXX-XXXXXXXX)']
      });
    }

    return results;
  }
}

class LibertyProcessor extends BaseInsurerProcessor {
  name = 'LIBERTY';
  
  patterns: InsurerPatterns = {
    numeroPoliza: [
      /póliza\s*:?\s*([A-Z]\d{9,12})/i,
      /liberty\s*:?\s*([A-Z]\d{9,12})/i
    ],
    fechas: [
      /(\d{2}\/\d{2}\/\d{4})/g
    ],
    montos: [
      /\$\s*([\d,\.]+)/g
    ],
    cliente: [
      /asegurado\s*:?\s*([A-ZÁÉÍÓÚÑ\s]+)/i,
      /documento\s*:?\s*(\d{6,12})/i
    ],
    specific: {}
  };

  async processSpecific(text: string): Promise<Record<string, any>> {
    const data: Record<string, any> = {};
    
    const aseguradoraMatch = text.match(/LIBERTY|SEGUROS LIBERTY/i);
    if (aseguradoraMatch) {
      data.aseguradora = 'LIBERTY';
    }

    return data;
  }

  async validateSpecific(data: any): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    if (data.numeroPoliza) {
      const isValidLibertyFormat = /^[A-Z]\d{9,12}$/.test(data.numeroPoliza);
      results.push({
        field: 'numeroPoliza',
        isValid: isValidLibertyFormat,
        confidence: isValidLibertyFormat ? 0.95 : 0.3,
        errors: isValidLibertyFormat ? [] : ['Formato de póliza Liberty inválido (debe ser 1 letra + 9-12 dígitos)']
      });
    }

    return results;
  }
}

class GenericProcessor extends BaseInsurerProcessor {
  name = 'GENERIC';
  
  patterns: InsurerPatterns = {
    numeroPoliza: [
      /(?:póliza|poliza|número|no\.?|nro\.?|policy)\s*:?\s*([a-zA-Z0-9\-_]{3,50})/i
    ],
    fechas: [
      /(\d{1,2}\/\d{1,2}\/\d{4})/g,
      /(\d{1,2}-\d{1,2}-\d{4})/g,
      /(\d{4}-\d{2}-\d{2})/g
    ],
    montos: [
      /\$\s*([\d,\.]+)/g,
      /([\d,\.]+)\s*pesos/gi
    ],
    cliente: [
      /(?:asegurado|cliente|nombre)\s*:?\s*([A-ZÁÉÍÓÚÑ\s]+)/i,
      /(?:cédula|cedula|cc|documento)\s*:?\s*(\d{6,12})/i,
      /(?:teléfono|telefono|celular)\s*:?\s*([\d\-\s\+]+)/i,
      /(?:email|correo)\s*:?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i
    ],
    specific: {}
  };

  async processSpecific(text: string): Promise<Record<string, any>> {
    const data: Record<string, any> = {};
    
    // Detectar aseguradora genérica
    const insurers = [
      'AXA COLPATRIA', 'COLPATRIA', 'ALLIANZ', 'QBE', 'MUNDIAL', 
      'EQUIDAD', 'PREVISORA', 'GENERALI', 'HDI', 'ZURICH'
    ];
    
    for (const insurer of insurers) {
      if (text.toUpperCase().includes(insurer)) {
        data.aseguradora = insurer;
        break;
      }
    }

    // Detectar ramo genérico
    const branches = [
      { keywords: ['vida', 'life'], ramo: 'VIDA' },
      { keywords: ['auto', 'vehiculo', 'carro'], ramo: 'VEHICULOS' },
      { keywords: ['hogar', 'casa', 'vivienda'], ramo: 'HOGAR' },
      { keywords: ['salud', 'medicina', 'eps'], ramo: 'SALUD' },
      { keywords: ['empresarial', 'comercial', 'pyme'], ramo: 'EMPRESARIAL' }
    ];

    for (const branch of branches) {
      if (branch.keywords.some(keyword => text.toLowerCase().includes(keyword))) {
        data.ramo = branch.ramo;
        break;
      }
    }

    return data;
  }

  async validateSpecific(data: any): Promise<ValidationResult[]> {
    // Validaciones genéricas básicas
    return [];
  }
}

// ===== FACTORY DE PROCESADORES =====

export class InsurerProcessorFactory {
  private processors: Map<string, InsurerProcessor>;

  constructor() {
    this.processors = new Map([
      ['SURA', new SuraProcessor()],
      ['SURAMERICANA', new SuraProcessor()],
      ['SEGUROS SURA', new SuraProcessor()],
      ['BOLIVAR', new BolivarProcessor()],
      ['SEGUROS BOLIVAR', new BolivarProcessor()],
      ['MAPFRE', new MapfreProcessor()],
      ['SEGUROS MAPFRE', new MapfreProcessor()],
      ['LIBERTY', new LibertyProcessor()],
      ['SEGUROS LIBERTY', new LibertyProcessor()],
      ['GENERIC', new GenericProcessor()]
    ]);
  }

  getProcessor(insurerName: string): InsurerProcessor {
    const normalizedName = insurerName.toUpperCase().trim();
    
    // Buscar coincidencia exacta
    if (this.processors.has(normalizedName)) {
      return this.processors.get(normalizedName)!;
    }

    // Buscar coincidencia parcial
    for (const [key, processor] of this.processors.entries()) {
      if (normalizedName.includes(key) || key.includes(normalizedName)) {
        return processor;
      }
    }

    // Retornar procesador genérico
    return this.processors.get('GENERIC')!;
  }

  async processWithBestProcessor(text: string, detectedInsurer?: string): Promise<ExtractionResult> {
    let processor: InsurerProcessor;

    if (detectedInsurer) {
      processor = this.getProcessor(detectedInsurer);
    } else {
      // Detectar aseguradora del texto
      const detected = await this.detectInsurerFromText(text);
      processor = this.getProcessor(detected);
    }

    return processor.process(text);
  }

  private async detectInsurerFromText(text: string): Promise<string> {
    const upperText = text.toUpperCase();
    
    const insurers = [
      'SURA', 'SURAMERICANA', 'BOLIVAR', 'MAPFRE', 'LIBERTY',
      'AXA COLPATRIA', 'COLPATRIA', 'ALLIANZ', 'QBE', 'MUNDIAL',
      'EQUIDAD', 'PREVISORA', 'GENERALI', 'HDI', 'ZURICH'
    ];

    for (const insurer of insurers) {
      if (upperText.includes(insurer)) {
        return insurer;
      }
    }

    return 'GENERIC';
  }

  listAvailableProcessors(): string[] {
    return Array.from(this.processors.keys()).filter(key => key !== 'GENERIC');
  }
}

// Instancia singleton
export const insurerProcessorFactory = new InsurerProcessorFactory();