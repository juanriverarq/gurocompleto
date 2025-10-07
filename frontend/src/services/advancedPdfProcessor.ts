// Sistema avanzado de procesamiento de PDFs para pólizas de seguros
// Arquitectura híbrida multicapa con IA, OCR y aprendizaje adaptativo

import * as pdfjsLib from 'pdfjs-dist';
import { PDF_CONFIG } from '../config/pdfConfig';
import { setupPdfJs } from '../utils/pdfSetup';

// Configurar PDF.js
setupPdfJs();

// ===== INTERFACES Y TIPOS =====

export interface ProcessedPdfData {
  numeroPoliza: string;
  aseguradora: string;
  ramo: string;
  primaNeta: string;
  iva: string;
  total: string;
  fechaExpedicion: string;
  fechaInicio: string;
  fechaFin: string;
  clienteNombre: string;
  clienteApellido: string;
  clienteCedula: string;
  clienteTelefono: string;
  clienteEmail: string;
  clienteDireccion: string;
  // Nuevos campos extraídos
  estado: string;
  riesgo: string;
  placas: string[];
  tomadorNombre: string;
  tomadorDocumento: string;
  aseguradoNombre: string;
  aseguradoDocumento: string;
  valorAsegurado: string;
  // Cliente encontrado automáticamente
  clienteEncontrado?: {
    id: string;
    nombre: string;
    documento: string;
    telefono?: string;
    email?: string;
  };
  confidence: ConfidenceMetrics;
  method: string;
  errors: string[];
  metadata?: DocumentMetadata;
}

export interface ConfidenceMetrics {
  extraction: number;
  validation: number;
  consistency: number;
  historical: number;
  overall: number;
}

export interface DocumentMetadata {
  fileName: string;
  fileSize: number;
  pageCount: number;
  hasSelectableText: boolean;
  detectedInsurer: string;
  documentType: 'policy' | 'certificate' | 'endorsement' | 'unknown';
  quality: 'high' | 'medium' | 'low';
  language: string;
  processingTime: number;
}

export interface ExtractionResult {
  data: Partial<ProcessedPdfData>;
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
  suggestions?: string[];
}

// ===== CLASE PRINCIPAL =====

export class AdvancedPdfProcessor {
  async processPdf(file: File): Promise<ProcessedPdfData> {
    const startTime = Date.now();
    
    try {
      // 1. Análisis inicial del documento
      const metadata = await this.analyzeDocument(file);
      
      // 2. Extracción multicapa
      const extractionResults = await this.performMultiLayerExtraction(file, metadata);
      
      // 3. Validación cruzada
      const validationResults = await this.performCrossValidation(extractionResults);
      
      // 4. Fusión inteligente de resultados
      const fusedData = await this.fuseResults(extractionResults, validationResults);
      
      // 5. Cálculo de confianza
      const confidence = this.calculateConfidence(extractionResults, validationResults);
      
      // 6. Buscar cliente automáticamente por documento
      const clienteEncontrado = await this.buscarClientePorDocumento(
        fusedData.clienteCedula || fusedData.tomadorDocumento || ''
      );

      // 7. Preparar resultado final
      const result: ProcessedPdfData = {
        numeroPoliza: fusedData.numeroPoliza || '',
        aseguradora: fusedData.aseguradora || '',
        ramo: fusedData.ramo || '',
        primaNeta: fusedData.primaNeta || '',
        iva: fusedData.iva || '',
        total: fusedData.total || '',
        fechaExpedicion: fusedData.fechaExpedicion || '',
        fechaInicio: fusedData.fechaInicio || '',
        fechaFin: fusedData.fechaFin || '',
        clienteNombre: fusedData.clienteNombre || '',
        clienteApellido: fusedData.clienteApellido || '',
        clienteCedula: fusedData.clienteCedula || '',
        clienteTelefono: fusedData.clienteTelefono || '',
        clienteEmail: fusedData.clienteEmail || '',
        clienteDireccion: fusedData.clienteDireccion || '',
        // Nuevos campos
        estado: fusedData.estado || 'ACTIVA', // Por defecto activo
        riesgo: fusedData.riesgo || '',
        placas: fusedData.placas || [],
        tomadorNombre: fusedData.tomadorNombre || fusedData.clienteNombre || '',
        tomadorDocumento: fusedData.tomadorDocumento || fusedData.clienteCedula || '',
        aseguradoNombre: fusedData.aseguradoNombre || fusedData.clienteNombre || '',
        aseguradoDocumento: fusedData.aseguradoDocumento || fusedData.clienteCedula || '',
        valorAsegurado: fusedData.valorAsegurado || '',
        clienteEncontrado,
        confidence,
        method: 'advanced-hybrid',
        errors: [],
        metadata: {
          ...metadata,
          processingTime: Date.now() - startTime
        }
      };

      return result;

    } catch (error) {
      return this.createErrorResult(error as Error, Date.now() - startTime);
    }
  }

  private async analyzeDocument(file: File): Promise<DocumentMetadata> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    // Detectar si tiene texto seleccionable
    const hasSelectableText = await this.detectSelectableText(pdf);
    
    // Detectar aseguradora
    const detectedInsurer = await this.detectInsurer(file);
    
    // Evaluar calidad del documento
    const quality = await this.assessDocumentQuality(pdf);
    
    return {
      fileName: file.name,
      fileSize: file.size,
      pageCount: pdf.numPages,
      hasSelectableText,
      detectedInsurer,
      documentType: await this.detectDocumentType(pdf),
      quality,
      language: 'es',
      processingTime: 0
    };
  }

  private async performMultiLayerExtraction(
    file: File, 
    metadata: DocumentMetadata
  ): Promise<ExtractionResult[]> {
    const results: ExtractionResult[] = [];

    // Capa 1: Extracción directa de texto
    if (metadata.hasSelectableText) {
      try {
        const directResult = await this.extractDirectText(file);
        results.push(directResult);
      } catch (error) {
        console.warn('Error en extracción directa:', error);
      }
    }

    // Capa 2: Procesamiento con IA
    try {
      const aiResult = await this.processWithAI(file, metadata);
      results.push(aiResult);
    } catch (error) {
      console.warn('Error en procesamiento IA:', error);
    }

    return results.filter(result => result.confidence > 0);
  }

  private async extractDirectText(file: File): Promise<ExtractionResult> {
    const startTime = Date.now();
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += pageText + ' ';
      }
      
      const extractedData = this.extractWithPatterns(fullText.trim());
      
      return {
        data: extractedData,
        confidence: this.calculatePatternConfidence(extractedData),
        method: 'direct-text',
        processingTime: Date.now() - startTime,
        errors: []
      };
    } catch (error) {
      return {
        data: {},
        confidence: 0,
        method: 'direct-text',
        processingTime: Date.now() - startTime,
        errors: [(error as Error).message]
      };
    }
  }

  private async processWithAI(file: File, metadata: DocumentMetadata): Promise<ExtractionResult> {
    const startTime = Date.now();
    
    try {
      const text = await this.extractTextForAI(file);
      
      // Intentar con DeepSeek primero
      try {
        return await this.processWithDeepSeek(text, metadata);
      } catch (error) {
        console.warn('Error con DeepSeek:', error);
      }

      // Intentar con OpenAI
      try {
        return await this.processWithOpenAI(text, metadata);
      } catch (error) {
        console.warn('Error con OpenAI:', error);
      }

      throw new Error('Todos los modelos de IA fallaron');
    } catch (error) {
      return {
        data: {},
        confidence: 0,
        method: 'ai-error',
        processingTime: Date.now() - startTime,
        errors: [(error as Error).message]
      };
    }
  }

  private async processWithDeepSeek(text: string, metadata: DocumentMetadata): Promise<ExtractionResult> {
    const { pdfProcessingConfig } = await import('../config/env');
    
    if (!pdfProcessingConfig.deepseek.enabled) {
      throw new Error('DeepSeek no configurado');
    }

    const prompt = this.buildEnhancedPrompt(text, metadata);
    
    const response = await fetch(pdfProcessingConfig.deepseek.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${pdfProcessingConfig.deepseek.apiKey}`,
      },
      body: JSON.stringify({
        model: pdfProcessingConfig.deepseek.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 1500
      })
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    return this.parseAIResponse(content, 'deepseek');
  }

  private async processWithOpenAI(text: string, metadata: DocumentMetadata): Promise<ExtractionResult> {
    const { pdfProcessingConfig } = await import('../config/env');
    
    if (!pdfProcessingConfig.openai.enabled) {
      throw new Error('OpenAI no configurado');
    }

    const prompt = this.buildEnhancedPrompt(text, metadata);
    
    const response = await fetch(pdfProcessingConfig.openai.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${pdfProcessingConfig.openai.apiKey}`,
      },
      body: JSON.stringify({
        model: pdfProcessingConfig.openai.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 1500
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    return this.parseAIResponse(content, 'openai');
  }

  private buildEnhancedPrompt(text: string, metadata: DocumentMetadata): string {
    return `
Eres un experto en extracción de datos de pólizas de seguros colombianas. 

CONTEXTO DEL DOCUMENTO:
- Aseguradora detectada: ${metadata.detectedInsurer}
- Tipo de documento: ${metadata.documentType}
  

- Calidad: ${metadata.quality}
- Páginas: ${metadata.pageCount}

INSTRUCCIONES:
1. Extrae ÚNICAMENTE información que esté claramente presente
2. Para fechas usa formato YYYY-MM-DD
3. Para valores monetarios en COP usa solo números enteros (sin decimales .00, sin símbolos ni separadores)
4. Si encuentras montos como $1.234.567,00 o $1,234,567.00 convierte a 1234567
5. Para documentos remueve guiones, espacios y puntos (12.345.678-9 → 123456789)
6. Si no encuentras un dato, usa cadena vacía ""
7. Para placas usa formato ABC123 (sin espacios ni guiones)
8. El estado por defecto debe ser "ACTIVA"

FORMATO DE RESPUESTA (JSON estricto):
{
  "numeroPoliza": "",
  "aseguradora": "",
  "ramo": "",
  "primaNeta": "",
  "iva": "",
  "total": "",
  "fechaExpedicion": "",
  "fechaInicio": "",
  "fechaFin": "",
  "clienteNombre": "",
  "clienteApellido": "",
  "clienteCedula": "",
  "clienteTelefono": "",
  "clienteEmail": "",
  "clienteDireccion": "",
  "estado": "ACTIVA",
  "riesgo": "",
  "placas": [],
  "tomadorNombre": "",
  "tomadorDocumento": "",
  "aseguradoNombre": "",
  "aseguradoDocumento": "",
  "valorAsegurado": "",
  "confidence": 0.0
}

TEXTO A ANALIZAR:
${text}

RESPUESTA:`;
  }

  private parseAIResponse(content: string, method: string): ExtractionResult {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No se encontró JSON en la respuesta');
      }

      const extractedData = JSON.parse(jsonMatch[0]);
      const confidence = extractedData.confidence || this.calculatePatternConfidence(extractedData);
      
      // Remover el campo confidence del data
      delete extractedData.confidence;
      
      return {
        data: extractedData,
        confidence: confidence * 100,
        method,
        processingTime: 0,
        errors: []
      };
    } catch (error) {
      return {
        data: {},
        confidence: 0,
        method,
        processingTime: 0,
        errors: [(error as Error).message]
      };
    }
  }

  private extractWithPatterns(text: string): Partial<ProcessedPdfData> {
    const data: Partial<ProcessedPdfData> = {};

    // Usar los patrones existentes de PDF_CONFIG
    const polizaMatch = text.match(PDF_CONFIG.patterns.numeroPoliza);
    if (polizaMatch) data.numeroPoliza = polizaMatch[1] || polizaMatch[0];

    const aseguradoraMatch = text.match(PDF_CONFIG.patterns.aseguradora);
    if (aseguradoraMatch) data.aseguradora = aseguradoraMatch[0];

    const ramoMatch = text.match(PDF_CONFIG.patterns.ramo);
    if (ramoMatch) data.ramo = ramoMatch[0];

    const primaMatch = text.match(PDF_CONFIG.patterns.primaNeta);
    if (primaMatch) data.primaNeta = this.normalizeAmount(primaMatch[1] || primaMatch[0]);

    const ivaMatch = text.match(PDF_CONFIG.patterns.iva);
    if (ivaMatch) data.iva = this.normalizeAmount(ivaMatch[1] || ivaMatch[0]);

    const totalMatch = text.match(PDF_CONFIG.patterns.total);
    if (totalMatch) data.total = this.normalizeAmount(totalMatch[1] || totalMatch[0]);

    const fechaExpedicionMatch = text.match(PDF_CONFIG.patterns.fechaExpedicion);
    if (fechaExpedicionMatch) data.fechaExpedicion = fechaExpedicionMatch[1] || fechaExpedicionMatch[0];

    const fechaInicioMatch = text.match(PDF_CONFIG.patterns.fechaInicio);
    if (fechaInicioMatch) data.fechaInicio = fechaInicioMatch[1] || fechaInicioMatch[0];

    const fechaFinMatch = text.match(PDF_CONFIG.patterns.fechaFin);
    if (fechaFinMatch) data.fechaFin = fechaFinMatch[1] || fechaFinMatch[0];

    const nombreMatch = text.match(PDF_CONFIG.patterns.clienteNombre);
    if (nombreMatch) data.clienteNombre = nombreMatch[1] || nombreMatch[0];

    const cedulaMatch = text.match(PDF_CONFIG.patterns.clienteCedula);
    if (cedulaMatch) data.clienteCedula = this.normalizeDocument(cedulaMatch[1] || cedulaMatch[0]);

    const telefonoMatch = text.match(PDF_CONFIG.patterns.clienteTelefono);
    if (telefonoMatch) data.clienteTelefono = telefonoMatch[1] || telefonoMatch[0];

    const emailMatch = text.match(PDF_CONFIG.patterns.clienteEmail);
    if (emailMatch) data.clienteEmail = emailMatch[1] || emailMatch[0];

    // NUEVOS PATRONES DE EXTRACCIÓN

    // Estado de la póliza
    data.estado = 'ACTIVA'; // Por defecto activo como solicitado

    // Riesgo asegurado
    const riesgoPatterns = [
      /(?:riesgo|objeto)\s*:?\s*([A-ZÁÉÍÓÚÑ0-9\s,\.\-]{10,100})/i,
      /(?:descripción|descripcion)\s*:?\s*([A-ZÁÉÍÓÚÑ0-9\s,\.\-]{10,100})/i,
      /(?:bien\s*asegurado|objeto\s*asegurado)\s*:?\s*([A-ZÁÉÍÓÚÑ0-9\s,\.\-]{10,100})/i
    ];
    for (const pattern of riesgoPatterns) {
      const match = text.match(pattern);
      if (match) {
        data.riesgo = match[1].trim();
        break;
      }
    }

    // Placas de vehículos
    const placasPatterns = [
      /(?:placa|placas)\s*:?\s*([A-Z]{3}\d{3}|[A-Z]{3}-?\d{3})/gi,
      /([A-Z]{3}\s*\d{3})/g,
      /([A-Z]{3}-\d{3})/g
    ];
    const placasEncontradas: string[] = [];
    for (const pattern of placasPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        const placa = match[1].replace(/[\s\-]/g, '').toUpperCase();
        if (placa.length === 6 && /^[A-Z]{3}\d{3}$/.test(placa) && !placasEncontradas.includes(placa)) {
          placasEncontradas.push(placa);
        }
      }
    }
    data.placas = placasEncontradas;

    // Tomador (puede ser diferente al asegurado)
    const tomadorPatterns = [
      /(?:tomador|contratante)\s*:?\s*([A-ZÁÉÍÓÚÑ\s]{5,50})/i,
      /(?:tomador|contratante)\s*:?\s*([A-ZÁÉÍÓÚÑ\s]{5,50})\s*(?:cc|cédula|cedula)\s*:?\s*(\d{6,12})/i
    ];
    for (const pattern of tomadorPatterns) {
      const match = text.match(pattern);
      if (match) {
        data.tomadorNombre = match[1].trim();
        if (match[2]) data.tomadorDocumento = this.normalizeDocument(match[2]);
        break;
      }
    }

    // Asegurado
    const aseguradoPatterns = [
      /(?:asegurado|beneficiario)\s*:?\s*([A-ZÁÉÍÓÚÑ\s]{5,50})/i,
      /(?:asegurado|beneficiario)\s*:?\s*([A-ZÁÉÍÓÚÑ\s]{5,50})\s*(?:cc|cédula|cedula)\s*:?\s*(\d{6,12})/i
    ];
    for (const pattern of aseguradoPatterns) {
      const match = text.match(pattern);
      if (match) {
        data.aseguradoNombre = match[1].trim();
        if (match[2]) data.aseguradoDocumento = this.normalizeDocument(match[2]);
        break;
      }
    }

    // Valor asegurado
    const valorAseguradoPatterns = [
      /(?:valor\s*asegurado|suma\s*asegurada)\s*:?\s*\$?\s*([\d,\.]+)/i,
      /(?:cobertura|límite)\s*:?\s*\$?\s*([\d,\.]+)/i
    ];
    for (const pattern of valorAseguradoPatterns) {
      const match = text.match(pattern);
      if (match) {
        data.valorAsegurado = this.normalizeAmount(match[1]);
        break;
      }
    }

    return data;
  }

  private calculatePatternConfidence(data: Partial<ProcessedPdfData>): number {
    const totalFields = 20; // Aumentado por los nuevos campos
    const filledFields = Object.values(data).filter(value => 
      value && value.toString().trim() !== ''
    ).length;
    
    return Math.round((filledFields / totalFields) * 100);
  }

  private async performCrossValidation(results: ExtractionResult[]): Promise<ValidationResult[]> {
    const validationResults: ValidationResult[] = [];
    
    if (results.length === 0) return validationResults;

    // Tomar el resultado con mayor confianza como base
    const bestResult = results.sort((a, b) => b.confidence - a.confidence)[0];
    
    for (const [field, value] of Object.entries(bestResult.data)) {
      if (value) {
        const validation = await this.validateField(field, value as string, bestResult.data);
        validationResults.push(validation);
      }
    }

    return validationResults;
  }

  private async validateField(field: string, value: string, context: any): Promise<ValidationResult> {
    // Validación básica por ahora
    return {
      field,
      isValid: true,
      confidence: 0.8,
      errors: []
    };
  }

  private async fuseResults(
    extractionResults: ExtractionResult[], 
    validationResults: ValidationResult[]
  ): Promise<Partial<ProcessedPdfData>> {
    const fusedData: any = {};
    const fields = [
      'numeroPoliza', 'aseguradora', 'ramo', 'primaNeta', 'iva', 'total',
      'fechaExpedicion', 'fechaInicio', 'fechaFin', 'clienteNombre', 
      'clienteApellido', 'clienteCedula', 'clienteTelefono', 'clienteEmail', 'clienteDireccion',
      'estado', 'riesgo', 'placas', 'tomadorNombre', 'tomadorDocumento', 
      'aseguradoNombre', 'aseguradoDocumento', 'valorAsegurado'
    ];

    for (const field of fields) {
      // Recopilar todos los valores para este campo
      const values = extractionResults
        .map(result => (result.data as any)[field])
        .filter(value => value && value.toString().trim() !== '');

      if (values.length === 0) {
        fusedData[field] = field === 'estado' ? 'ACTIVA' : (field === 'placas' ? [] : '');
        continue;
      }

      // Si hay consenso, usar ese valor
      const consensus = this.findConsensus(values);
      if (consensus) {
        fusedData[field] = consensus;
        continue;
      }

      // Si no hay consenso, usar el valor del resultado con mayor confianza
      const bestResult = extractionResults
        .filter(result => (result.data as any)[field])
        .sort((a, b) => b.confidence - a.confidence)[0];
      
      fusedData[field] = bestResult ? (bestResult.data as any)[field] || '' : '';
    }

    return fusedData as Partial<ProcessedPdfData>;
  }

  private findConsensus(values: any[]): any | null {
    if (values.length < 2) return values[0] || null;
    
    const counts = new Map();
    for (const value of values) {
      const normalizedValue = value?.toString().trim().toLowerCase();
      counts.set(normalizedValue, (counts.get(normalizedValue) || 0) + 1);
    }

    const maxCount = Math.max(...counts.values());
    if (maxCount >= Math.ceil(values.length / 2)) {
      for (const [normalized, count] of counts.entries()) {
        if (count === maxCount) {
          return values.find(v => v?.toString().trim().toLowerCase() === normalized);
        }
      }
    }

    return null;
  }

  private calculateConfidence(
    extractionResults: ExtractionResult[],
    validationResults: ValidationResult[]
  ): ConfidenceMetrics {
    const extraction = extractionResults.length > 0 
      ? extractionResults.reduce((sum, result) => sum + result.confidence, 0) / extractionResults.length
      : 0;
    
    const validation = validationResults.length > 0
      ? (validationResults.filter(r => r.isValid).length / validationResults.length) * 100
      : 50;

    const consistency = extractionResults.length > 1 ? 80 : 100;
    const historical = 70; // Valor por defecto

    const overall = (extraction * 0.4 + validation * 0.3 + consistency * 0.2 + historical * 0.1);
    
    return {
      extraction,
      validation,
      consistency,
      historical,
      overall
    };
  }

  // Método para normalizar documentos (remover guiones, espacios, puntos)
  private normalizeDocument(documento: string): string {
    return documento.replace(/[\s\-\.]/g, '').trim();
  }

  

  // Método para buscar cliente por documento
  private async buscarClientePorDocumento(documento: string): Promise<any | null> {
    if (!documento || documento.length < 6) return null;

    try {
      // Normalizar el documento extraído del PDF
      const documentoNormalizado = this.normalizeDocument(documento);
      
      // Importar el servicio de API SaaS
      const saasApi = (await import('../services/saasApi')).default;
      
      // Buscar cliente por documento (usar documento original y normalizado)
      const response = await saasApi.getClientes({ 
        search: documento, 
        per_page: 10 
      });
      
      const clientes = Array.isArray(response.data) 
        ? response.data 
        : (response.data?.data || []);

      // Buscar coincidencia exacta por documento (normalizado)
      for (const cliente of clientes) {
        const clienteDoc = cliente.persona?.documento || cliente.empresa?.nit || cliente.cuit || '';
        const clienteDocNormalizado = this.normalizeDocument(clienteDoc);
        
        // Comparar tanto el documento original como el normalizado
        if (clienteDoc === documento || clienteDocNormalizado === documentoNormalizado) {
          const tipo = cliente.tipo;
          const nombre = tipo === 'EMPRESA' 
            ? (cliente.empresa?.razon_social || cliente.empresa?.nombre_comercial || 'Empresa')
            : `${cliente.persona?.nombres || cliente.nombre || ''} ${cliente.persona?.apellidos || cliente.apellidos || ''}`.trim();
          
          return {
            id: String(cliente.id),
            nombre,
            documento: clienteDoc, // Mantener formato original de la BD
            telefono: cliente.celular || cliente.celular_principal || '',
            email: cliente.email || cliente.email_principal || ''
          };
        }
      }

      // Si no encuentra coincidencia exacta, buscar por documento normalizado en una segunda búsqueda
      if (documentoNormalizado !== documento) {
        const response2 = await saasApi.getClientes({ 
          search: documentoNormalizado, 
          per_page: 10 
        });
        
        const clientes2 = Array.isArray(response2.data) 
          ? response2.data 
          : (response2.data?.data || []);

        for (const cliente of clientes2) {
          const clienteDoc = cliente.persona?.documento || cliente.empresa?.nit || cliente.cuit || '';
          const clienteDocNormalizado = this.normalizeDocument(clienteDoc);
          
          if (clienteDocNormalizado === documentoNormalizado) {
            const tipo = cliente.tipo;
            const nombre = tipo === 'EMPRESA' 
              ? (cliente.empresa?.razon_social || cliente.empresa?.nombre_comercial || 'Empresa')
              : `${cliente.persona?.nombres || cliente.nombre || ''} ${cliente.persona?.apellidos || cliente.apellidos || ''}`.trim();
            
            return {
              id: String(cliente.id),
              nombre,
              documento: clienteDoc, // Mantener formato original de la BD
              telefono: cliente.celular || cliente.celular_principal || '',
              email: cliente.email || cliente.email_principal || ''
            };
          }
        }
      }

      return null;
    } catch (error) {
      console.warn('Error buscando cliente:', error);
      return null;
    }
  }

  private createErrorResult(error: Error, processingTime: number): ProcessedPdfData {
    return {
      numeroPoliza: '',
      aseguradora: '',
      ramo: '',
      primaNeta: '',
      iva: '',
      total: '',
      fechaExpedicion: '',
      fechaInicio: '',
      fechaFin: '',
      clienteNombre: '',
      clienteApellido: '',
      clienteCedula: '',
      clienteTelefono: '',
      clienteEmail: '',
      clienteDireccion: '',
      estado: 'ACTIVA',
      riesgo: '',
      placas: [],
      tomadorNombre: '',
      tomadorDocumento: '',
      aseguradoNombre: '',
      aseguradoDocumento: '',
      valorAsegurado: '',
      confidence: {
        extraction: 0,
        validation: 0,
        consistency: 0,
        historical: 0,
        overall: 0
      },
      method: 'error',
      errors: [error.message],
      metadata: {
        fileName: 'unknown.pdf',
        fileSize: 0,
        pageCount: 0,
        hasSelectableText: false,
        detectedInsurer: 'unknown',
        documentType: 'unknown',
        quality: 'low',
        language: 'es',
        processingTime
      }
    };
  }

  // Métodos auxiliares
  private async detectSelectableText(pdf: any): Promise<boolean> {
    try {
      const page = await pdf.getPage(1);
      const textContent = await page.getTextContent();
      return textContent.items.length > 0;
    } catch {
      return false;
    }
  }

  private async detectInsurer(file: File): Promise<string> {
    try {
      const text = await this.extractTextForAI(file);
      const insurers = PDF_CONFIG.patterns.aseguradoras;
      
      for (const insurer of insurers) {
        if (text.toLowerCase().includes(insurer.toLowerCase())) {
          return insurer;
        }
      }
      
      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private async detectDocumentType(pdf: any): Promise<DocumentMetadata['documentType']> {
    return 'policy';
  }

  private async assessDocumentQuality(pdf: any): Promise<DocumentMetadata['quality']> {
    try {
      const page = await pdf.getPage(1);
      const textContent = await page.getTextContent();
      
      if (textContent.items.length > 100) return 'high';
      if (textContent.items.length > 20) return 'medium';
      return 'low';
    } catch {
      return 'low';
    }
  }

  private async extractTextForAI(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    
    for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + ' ';
    }
    
    return fullText.trim();
  }
}

// ===== FUNCIÓN PRINCIPAL EXPORTADA =====

export async function processPdf(file: File): Promise<ProcessedPdfData> {
  const processor = new AdvancedPdfProcessor();
  return processor.processPdf(file);
}