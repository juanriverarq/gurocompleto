import { useState, useCallback } from 'react';
import { DEEPSEEK_CONFIG } from '../config/ttsConfig';
import { SYSTEM_ROUTES, findRouteByIntent, RouteInfo } from '../config/systemRoutes';

interface IntentAnalysis {
  type: 'navigation' | 'information' | 'action' | 'unknown';
  confidence: number;
  targetRoute?: RouteInfo;
  action?: string;
  parameters?: Record<string, any>;
  explanation: string;
}

export const useIntentAnalyzer = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Prompt especializado para análisis de intenciones
  const INTENT_ANALYSIS_PROMPT = `Eres un analizador de intenciones para el sistema Guro de seguros. 
Tu trabajo es interpretar las solicitudes del usuario y determinar qué acción debe realizar el sistema.

PÁGINAS DISPONIBLES EN EL SISTEMA:
${SYSTEM_ROUTES.map(route => `- ${route.title}: ${route.path} (${route.synonyms.join(', ')})`).join('\n')}

TIPOS DE INTENCIONES:
1. NAVIGATION: Usuario quiere ir a una página específica
2. INFORMATION: Usuario quiere información sobre algo
3. ACTION: Usuario quiere realizar una acción específica (crear, editar, eliminar, etc.)
4. UNKNOWN: No se puede determinar la intención

RESPONDE SOLO EN FORMATO JSON:
{
  "type": "navigation|information|action|unknown",
  "confidence": 0.0-1.0,
  "targetRoute": "ruta_exacta_si_aplica",
  "action": "acción_específica_si_aplica",
  "parameters": {"param1": "valor1"},
  "explanation": "explicación_breve_en_español"
}

EJEMPLOS:
- "Quiero ver las pólizas" → {"type": "navigation", "confidence": 0.9, "targetRoute": "/apps/seguros/polizas", "explanation": "Usuario quiere navegar a la lista de pólizas"}
- "Crear una nueva póliza" → {"type": "navigation", "confidence": 0.95, "targetRoute": "/apps/seguros/polizas/nueva", "explanation": "Usuario quiere crear una nueva póliza"}
- "¿Cuántos siniestros tengo?" → {"type": "information", "confidence": 0.8, "targetRoute": "/apps/seguros/siniestros", "explanation": "Usuario quiere información sobre siniestros"}

Analiza la siguiente solicitud:`;

  const analyzeIntent = useCallback(async (userInput: string): Promise<IntentAnalysis> => {
    setIsAnalyzing(true);
    
    try {
      // Primero, intentar coincidencia directa con rutas
      const directMatch = findRouteByIntent(userInput);
      if (directMatch) {
        setIsAnalyzing(false);
        return {
          type: 'navigation',
          confidence: 0.9,
          targetRoute: directMatch,
          explanation: `Navegación directa a ${directMatch.title}`
        };
      }

      // Si no hay coincidencia directa, usar DeepSeek para análisis avanzado
      const response = await fetch(`${DEEPSEEK_CONFIG.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_CONFIG.apiKey}`
        },
        body: JSON.stringify({
          model: DEEPSEEK_CONFIG.model,
          messages: [
            {
              role: 'system',
              content: INTENT_ANALYSIS_PROMPT
            },
            {
              role: 'user',
              content: userInput
            }
          ],
          max_tokens: 200,
          temperature: 0.1 // Baja temperatura para respuestas más consistentes
        })
      });

      if (!response.ok) {
        throw new Error(`DeepSeek API error: ${response.status}`);
      }

      const data = await response.json();
      const aiResponse = data.choices[0]?.message?.content?.trim();

      if (!aiResponse) {
        throw new Error('No response from DeepSeek');
      }

      // Parsear respuesta JSON
      try {
        const analysis = JSON.parse(aiResponse);
        
        // Validar y enriquecer la respuesta
        if (analysis.targetRoute) {
          const route = SYSTEM_ROUTES.find(r => r.path === analysis.targetRoute);
          if (route) {
            analysis.targetRoute = route;
          }
        }

        setIsAnalyzing(false);
        return {
          type: analysis.type || 'unknown',
          confidence: analysis.confidence || 0.5,
          targetRoute: analysis.targetRoute,
          action: analysis.action,
          parameters: analysis.parameters,
          explanation: analysis.explanation || 'Análisis completado'
        };
      } catch (parseError) {
        
        // Fallback: análisis básico
        setIsAnalyzing(false);
        return {
          type: 'unknown',
          confidence: 0.3,
          explanation: 'No pude interpretar completamente tu solicitud. ¿Puedes ser más específico?'
        };
      }

    } catch (error) {
      setIsAnalyzing(false);
      
      return {
        type: 'unknown',
        confidence: 0.1,
        explanation: 'Error al analizar tu solicitud. Por favor, intenta nuevamente.'
      };
    }
  }, []);

  // Función para generar respuesta contextual
  const generateContextualResponse = useCallback((analysis: IntentAnalysis): string => {
    switch (analysis.type) {
      case 'navigation':
        if (analysis.targetRoute) {
          return `Te llevaré a ${analysis.targetRoute.title}. ${analysis.targetRoute.description}`;
        }
        return 'Navegando a la página solicitada...';
        
      case 'information':
        if (analysis.targetRoute) {
          return `Para obtener esa información, vamos a ${analysis.targetRoute.title}. ${analysis.explanation}`;
        }
        return 'Buscando la información solicitada...';
        
      case 'action':
        return `Voy a ayudarte con esa acción. ${analysis.explanation}`;
        
      default:
        return analysis.explanation || 'No estoy seguro de qué necesitas. ¿Puedes ser más específico?';
    }
  }, []);

  // Función para detectar si es una consulta sobre seguros vs navegación
  const isInsuranceQuery = useCallback((userInput: string): boolean => {
    const insuranceKeywords = [
      'cuánto', 'cuántos', 'qué es', 'cómo funciona', 'explicar', 'información',
      'consulta', 'pregunta', 'duda', 'ayuda con', 'necesito saber',
      'cobertura', 'prima', 'deducible', 'beneficio', 'exclusión'
    ];
    
    const input = userInput.toLowerCase();
    return insuranceKeywords.some(keyword => input.includes(keyword));
  }, []);

  return {
    analyzeIntent,
    generateContextualResponse,
    isInsuranceQuery,
    isAnalyzing
  };
}; 