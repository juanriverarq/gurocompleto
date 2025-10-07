// Servicio de procesamiento de PDFs para pólizas de seguros
// Arquitectura híbrida multicapa para máxima precisión

import * as pdfjsLib from 'pdfjs-dist';
import { PDF_CONFIG } from '../config/pdfConfig';
import { setupPdfJs } from '../utils/pdfSetup';

// Configurar PDF.js
setupPdfJs();

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
  confidence: number;
  method: string;
  errors: string[];
}

// Función para extraer texto directo del PDF
async function extractDirectText(file: File): Promise<string> {
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
    
    return fullText.trim();
  } catch (error) {
    throw error;
  }
}

// Función para procesar con DeepSeek
async function processWithDeepSeek(text: string): Promise<ProcessedPdfData> {
  const { pdfProcessingConfig } = await import('../config/env');
  
  if (!pdfProcessingConfig.deepseek.enabled) {
    throw new Error('DeepSeek API key not configured');
  }

  const prompt = `
Analiza este texto de una póliza de seguro colombiana y extrae la siguiente información en formato JSON:

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
  "clienteDireccion": ""
}

Instrucciones:
- Solo extrae información que esté claramente presente en el texto
- Para fechas usa formato YYYY-MM-DD
- Para valores monetarios usa solo números (sin símbolos)
- Si no encuentras un dato, deja el campo vacío ""
- Busca variaciones como "Póliza", "Número de póliza", "No. Póliza", etc.
- fechaExpedicion: fecha de expedición o emisión de la póliza

Texto a analizar:
${text}
`;

      try {
      const response = await fetch(pdfProcessingConfig.deepseek.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${pdfProcessingConfig.deepseek.apiKey}`,
        },
              body: JSON.stringify({
          model: pdfProcessingConfig.deepseek.model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Extraer JSON del contenido
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in DeepSeek response');
    }

    const extractedData = JSON.parse(jsonMatch[0]);
    
    // Calcular confianza basada en campos encontrados
    const filledFields = Object.values(extractedData).filter(value => value && value.toString().trim() !== '').length;
    const confidence = Math.round((filledFields / 14) * 100);
    
    return {
      ...extractedData,
      confidence,
      method: 'deepseek-ai',
      errors: []
    };
  } catch (error) {
    throw error;
  }
}

// Función para procesar con OpenAI
async function processWithOpenAI(text: string): Promise<ProcessedPdfData> {
  const { pdfProcessingConfig } = await import('../config/env');
  
  if (!pdfProcessingConfig.openai.enabled) {
    throw new Error('OpenAI API key not configured');
  }

  const prompt = `
Analiza este texto de una póliza de seguro colombiana y extrae la siguiente información en formato JSON:

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
  "clienteDireccion": ""
}

Instrucciones:
- Solo extrae información que esté claramente presente en el texto
- Para fechas usa formato YYYY-MM-DD
- Para valores monetarios usa solo números (sin símbolos)
- Si no encuentras un dato, deja el campo vacío ""
- Busca variaciones como "Póliza", "Número de póliza", "No. Póliza", etc.
- fechaExpedicion: fecha de expedición o emisión de la póliza

Texto a analizar:
${text}
`;

      try {
      const response = await fetch(pdfProcessingConfig.openai.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${pdfProcessingConfig.openai.apiKey}`,
        },
              body: JSON.stringify({
          model: pdfProcessingConfig.openai.model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Extraer JSON del contenido
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in OpenAI response');
    }

    const extractedData = JSON.parse(jsonMatch[0]);
    
    // Calcular confianza basada en campos encontrados
    const filledFields = Object.values(extractedData).filter(value => value && value.toString().trim() !== '').length;
    const confidence = Math.round((filledFields / 14) * 100);
    
    return {
      ...extractedData,
      confidence,
      method: 'openai-ai',
      errors: []
    };
  } catch (error) {
    throw error;
  }
}

// Función para procesar con patrones RegEx
function processWithPatterns(text: string): ProcessedPdfData {
  const data: ProcessedPdfData = {
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
    confidence: 0,
    method: 'patterns-fallback',
    errors: []
  };

  let fieldsFound = 0;

  // Buscar número de póliza
  const polizaMatch = text.match(PDF_CONFIG.patterns.numeroPoliza);
  if (polizaMatch) {
    data.numeroPoliza = polizaMatch[1] || polizaMatch[0];
    fieldsFound++;
  }

  // Buscar aseguradora
  const aseguradoraMatch = text.match(PDF_CONFIG.patterns.aseguradora);
  if (aseguradoraMatch) {
    data.aseguradora = aseguradoraMatch[0];
    fieldsFound++;
  }

  // Buscar ramo
  const ramoMatch = text.match(PDF_CONFIG.patterns.ramo);
  if (ramoMatch) {
    data.ramo = ramoMatch[0];
    fieldsFound++;
  }

  // Buscar valores monetarios
  const primaMatch = text.match(PDF_CONFIG.patterns.primaNeta);
  if (primaMatch) {
    data.primaNeta = primaMatch[1]?.replace(/[^\d]/g, '') || '';
    fieldsFound++;
  }

  const ivaMatch = text.match(PDF_CONFIG.patterns.iva);
  if (ivaMatch) {
    data.iva = ivaMatch[1]?.replace(/[^\d]/g, '') || '';
    fieldsFound++;
  }

  const totalMatch = text.match(PDF_CONFIG.patterns.total);
  if (totalMatch) {
    data.total = totalMatch[1]?.replace(/[^\d]/g, '') || '';
    fieldsFound++;
  }

  // Buscar fechas
  const fechaExpedicionMatch = text.match(PDF_CONFIG.patterns.fechaExpedicion);
  if (fechaExpedicionMatch) {
    data.fechaExpedicion = fechaExpedicionMatch[1] || fechaExpedicionMatch[0];
    fieldsFound++;
  }

  const fechaInicioMatch = text.match(PDF_CONFIG.patterns.fechaInicio);
  if (fechaInicioMatch) {
    data.fechaInicio = fechaInicioMatch[1] || fechaInicioMatch[0];
    fieldsFound++;
  }

  const fechaFinMatch = text.match(PDF_CONFIG.patterns.fechaFin);
  if (fechaFinMatch) {
    data.fechaFin = fechaFinMatch[1] || fechaFinMatch[0];
    fieldsFound++;
  }

  // Buscar datos del cliente
  const nombreMatch = text.match(PDF_CONFIG.patterns.clienteNombre);
  if (nombreMatch) {
    data.clienteNombre = nombreMatch[1] || nombreMatch[0];
    fieldsFound++;
  }

  const cedulaMatch = text.match(PDF_CONFIG.patterns.clienteCedula);
  if (cedulaMatch) {
    data.clienteCedula = cedulaMatch[1] || cedulaMatch[0];
    fieldsFound++;
  }

  const telefonoMatch = text.match(PDF_CONFIG.patterns.clienteTelefono);
  if (telefonoMatch) {
    data.clienteTelefono = telefonoMatch[1] || telefonoMatch[0];
    fieldsFound++;
  }

  const emailMatch = text.match(PDF_CONFIG.patterns.clienteEmail);
  if (emailMatch) {
    data.clienteEmail = emailMatch[1] || emailMatch[0];
    fieldsFound++;
  }

  // Calcular confianza basada en campos encontrados
  data.confidence = Math.round((fieldsFound / 14) * 100);

  return data;
}

// Función principal de procesamiento
export async function processPdf(file: File): Promise<ProcessedPdfData> {
  const errors: string[] = [];
  
  try {
    // Extraer texto del PDF
    const text = await extractDirectText(file);
    
    if (!text.trim()) {
      errors.push('No se pudo extraer texto del PDF');
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
        confidence: 0,
        method: 'empty-result',
        errors: ['No se pudo extraer texto del PDF']
      };
    }

    // Intentar con DeepSeek primero
    const { pdfProcessingConfig } = await import('../config/env');
    
    if (pdfProcessingConfig.deepseek.enabled) {
      try {
        return await processWithDeepSeek(text);
      } catch (error) {
        errors.push('Error con DeepSeek: ' + (error as Error).message);
      }
    }

    // Intentar con OpenAI
    if (pdfProcessingConfig.openai.enabled) {
      try {
        return await processWithOpenAI(text);
      } catch (error) {
        errors.push('Error con OpenAI: ' + (error as Error).message);
      }
    }

    // Usar patrones como último recurso
    const result = processWithPatterns(text);
    result.errors = errors;
    
    if (result.confidence === 0) {
      result.errors.push('No se pudieron extraer datos del PDF');
    }
    
    return result;
    
  } catch (error) {
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
      confidence: 0,
      method: 'empty-result',
      errors: ['Error fatal en el procesamiento: ' + (error as Error).message]
    };
  }
} 