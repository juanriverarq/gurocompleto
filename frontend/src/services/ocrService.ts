// Servicio OCR avanzado para procesamiento de documentos escaneados
// Integra múltiples proveedores de OCR para máxima precisión

export interface OCRResult {
  text: string;
  confidence: number;
  boundingBoxes?: BoundingBox[];
  language?: string;
  processingTime: number;
  provider: string;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  confidence: number;
}

export interface OCRConfig {
  googleVision: {
    enabled: boolean;
    apiKey: string;
    endpoint: string;
  };
  awsTextract: {
    enabled: boolean;
    accessKey: string;
    secretKey: string;
    region: string;
  };
  tesseract: {
    enabled: boolean;
    language: string;
  };
}

export class AdvancedOCRService {
  private config: OCRConfig;

  constructor() {
    this.config = {
      googleVision: {
        enabled: !!(import.meta.env.VITE_GOOGLE_VISION_API_KEY || ''),
        apiKey: import.meta.env.VITE_GOOGLE_VISION_API_KEY || '',
        endpoint: 'https://vision.googleapis.com/v1/images:annotate'
      },
      awsTextract: {
        enabled: !!(import.meta.env.VITE_AWS_ACCESS_KEY_ID || ''),
        accessKey: import.meta.env.VITE_AWS_ACCESS_KEY_ID || '',
        secretKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY || '',
        region: import.meta.env.VITE_AWS_REGION || 'us-east-1'
      },
      tesseract: {
        enabled: true, // Siempre disponible como fallback
        language: 'spa+eng'
      }
    };
  }

  async processDocument(file: File): Promise<OCRResult> {
    const results: OCRResult[] = [];

    // Intentar con Google Vision primero (mejor calidad)
    if (this.config.googleVision.enabled) {
      try {
        const result = await this.processWithGoogleVision(file);
        results.push(result);
      } catch (error) {
        console.warn('Error con Google Vision:', error);
      }
    }

    // Intentar con AWS Textract
    if (this.config.awsTextract.enabled) {
      try {
        const result = await this.processWithAWSTextract(file);
        results.push(result);
      } catch (error) {
        console.warn('Error con AWS Textract:', error);
      }
    }

    // Tesseract como fallback
    if (results.length === 0 && this.config.tesseract.enabled) {
      try {
        const result = await this.processWithTesseract(file);
        results.push(result);
      } catch (error) {
        console.warn('Error con Tesseract:', error);
      }
    }

    // Retornar el mejor resultado
    if (results.length > 0) {
      return results.sort((a, b) => b.confidence - a.confidence)[0];
    }

    // Si todo falla, retornar resultado vacío
    return {
      text: '',
      confidence: 0,
      processingTime: 0,
      provider: 'none'
    };
  }

  private async processWithGoogleVision(file: File): Promise<OCRResult> {
    const startTime = Date.now();
    
    // Convertir archivo a base64
    const base64 = await this.fileToBase64(file);
    
    const requestBody = {
      requests: [{
        image: {
          content: base64.split(',')[1] // Remover prefijo data:image/...;base64,
        },
        features: [{
          type: 'TEXT_DETECTION',
          maxResults: 1
        }],
        imageContext: {
          languageHints: ['es', 'en']
        }
      }]
    };

    const response = await fetch(
      `${this.config.googleVision.endpoint}?key=${this.config.googleVision.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      }
    );

    if (!response.ok) {
      throw new Error(`Google Vision API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.responses?.[0]?.error) {
      throw new Error(`Google Vision error: ${data.responses[0].error.message}`);
    }

    const textAnnotations = data.responses?.[0]?.textAnnotations || [];
    const fullText = textAnnotations[0]?.description || '';
    const confidence = textAnnotations[0]?.confidence || 0.8;

    // Extraer bounding boxes
    const boundingBoxes: BoundingBox[] = textAnnotations.slice(1).map((annotation: any) => ({
      x: annotation.boundingPoly?.vertices?.[0]?.x || 0,
      y: annotation.boundingPoly?.vertices?.[0]?.y || 0,
      width: (annotation.boundingPoly?.vertices?.[2]?.x || 0) - (annotation.boundingPoly?.vertices?.[0]?.x || 0),
      height: (annotation.boundingPoly?.vertices?.[2]?.y || 0) - (annotation.boundingPoly?.vertices?.[0]?.y || 0),
      text: annotation.description || '',
      confidence: annotation.confidence || 0.8
    }));

    return {
      text: fullText,
      confidence: confidence * 100,
      boundingBoxes,
      language: 'es',
      processingTime: Date.now() - startTime,
      provider: 'google-vision'
    };
  }

  private async processWithAWSTextract(file: File): Promise<OCRResult> {
    const startTime = Date.now();
    
    // Por ahora, implementación placeholder
    // En producción se integraría con AWS SDK
    
    return {
      text: '',
      confidence: 0,
      processingTime: Date.now() - startTime,
      provider: 'aws-textract-placeholder'
    };
  }

  private async processWithTesseract(file: File): Promise<OCRResult> {
    const startTime = Date.now();
    
    try {
      // Implementación con Tesseract.js (requiere instalación)
      // Por ahora, implementación placeholder
      
      return {
        text: '',
        confidence: 60, // Tesseract típicamente tiene menor precisión
        processingTime: Date.now() - startTime,
        provider: 'tesseract-placeholder'
      };
    } catch (error) {
      throw new Error(`Tesseract error: ${(error as Error).message}`);
    }
  }

  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Método para preprocesar imágenes antes del OCR
  async preprocessImage(file: File): Promise<File> {
    // Implementación futura para:
    // - Corrección de orientación
    // - Mejora de contraste
    // - Reducción de ruido
    // - Normalización de tamaño
    
    return file; // Por ahora retorna el archivo original
  }

  // Método para evaluar la calidad del OCR
  evaluateOCRQuality(result: OCRResult): {
    quality: 'high' | 'medium' | 'low';
    recommendations: string[];
  } {
    const recommendations: string[] = [];
    let quality: 'high' | 'medium' | 'low' = 'medium';

    if (result.confidence > 90) {
      quality = 'high';
    } else if (result.confidence < 60) {
      quality = 'low';
      recommendations.push('Considere mejorar la calidad de la imagen');
      recommendations.push('Verifique que el documento esté bien iluminado');
    }

    if (result.text.length < 100) {
      recommendations.push('Texto extraído muy corto, verifique el documento');
    }

    if (result.processingTime > 10000) {
      recommendations.push('Tiempo de procesamiento alto, considere optimizar');
    }

    return { quality, recommendations };
  }
}

// Instancia singleton
export const ocrService = new AdvancedOCRService();