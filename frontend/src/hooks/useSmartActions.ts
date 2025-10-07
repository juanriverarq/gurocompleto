import { useCallback } from 'react';
import { useDOMAnalyzer } from './useDOMAnalyzer';
import { SYSTEM_ROUTES } from '../config/systemRoutes';

interface ActionResult {
  success: boolean;
  message: string;
  data?: any;
}

export const useSmartActions = () => {
  const { 
    currentContext, 
    clickElement, 
    fillInput, 
    navigateToPage, 
    getPageDescription,
    analyzePage,
    findElements
  } = useDOMAnalyzer();

  // Función para encontrar una ruta por términos de búsqueda
  const findRouteByTerms = useCallback((searchTerms: string): string | null => {
    const search = searchTerms.toLowerCase();
    
    // Buscar coincidencia exacta en keywords o sinónimos
    const exactMatch = SYSTEM_ROUTES.find(route => 
      route.keywords.some(keyword => keyword.toLowerCase() === search) ||
      route.synonyms.some(synonym => synonym.toLowerCase() === search) ||
      route.title.toLowerCase().includes(search)
    );
    
    if (exactMatch) return exactMatch.path;
    
    // Buscar coincidencia parcial
    const partialMatch = SYSTEM_ROUTES.find(route => 
      route.keywords.some(keyword => keyword.toLowerCase().includes(search)) ||
      route.synonyms.some(synonym => synonym.toLowerCase().includes(search)) ||
      route.description.toLowerCase().includes(search)
    );
    
    return partialMatch?.path || null;
  }, []);

  // Acción para navegar a una página
  const executeNavigation = useCallback(async (destination: string): Promise<ActionResult> => {
    try {
      const route = findRouteByTerms(destination);
      
      if (route) {
        navigateToPage(route);
        
        // Esperar a que la página cargue y re-analizar
        setTimeout(() => {
          analyzePage();
        }, 2000);
        
        const routeInfo = SYSTEM_ROUTES.find(r => r.path === route);
        return {
          success: true,
          message: `Navegando a ${routeInfo?.title || destination}. La página se está cargando...`,
          data: { route, title: routeInfo?.title }
        };
      } else {
        return {
          success: false,
          message: `No encontré una página para "${destination}". ¿Podrías ser más específico?`
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Error al navegar: ${error}`
      };
    }
  }, [findRouteByTerms, navigateToPage, analyzePage]);

  // Acción para hacer clic en un elemento
  const executeClick = useCallback(async (elementDescription: string): Promise<ActionResult> => {
    try {
      // Re-analizar la página antes de buscar elementos
      if (!currentContext || Date.now() - currentContext.lastAnalyzed.getTime() > 10000) {
        analyzePage();
        // Esperar un poco para que el análisis termine
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const success = await clickElement(elementDescription);
      
      if (success) {
        // Esperar a que la acción surta efecto y re-analizar
        setTimeout(() => {
          analyzePage();
        }, 1500);
        
        return {
          success: true,
          message: `He hecho clic en "${elementDescription}". Procesando la acción...`
        };
      } else {
        // Buscar elementos similares para sugerir alternativas
        const similarElements = findElements(elementDescription);
        if (similarElements.length > 0) {
          const suggestions = similarElements.slice(0, 3).map(el => `"${el.text}"`).join(', ');
          return {
            success: false,
            message: `No pude hacer clic en "${elementDescription}". ¿Te refieres a alguno de estos elementos: ${suggestions}?`
          };
        } else {
          return {
            success: false,
            message: `No encontré el elemento "${elementDescription}" en la página actual. ¿Podrías describir el botón o enlace de otra manera?`
          };
        }
      }
    } catch (error) {
      return {
        success: false,
        message: `Error al hacer clic: ${error}`
      };
    }
  }, [currentContext, clickElement, analyzePage, findElements]);

  // Acción para llenar un campo
  const executeFillField = useCallback(async (fieldName: string, value: string): Promise<ActionResult> => {
    try {
      // Re-analizar si es necesario
      if (!currentContext || Date.now() - currentContext.lastAnalyzed.getTime() > 10000) {
        analyzePage();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const success = await fillInput(fieldName, value);
      
      if (success) {
        return {
          success: true,
          message: `He llenado el campo "${fieldName}" con "${value}".`
        };
      } else {
        // Buscar campos similares para sugerir alternativas
        const availableInputs = currentContext?.inputs || [];
        if (availableInputs.length > 0) {
          const suggestions = availableInputs.slice(0, 3).map(input => {
            const fieldLabel = input.placeholder || input.ariaLabel || input.text || input.id;
            return `"${fieldLabel}"`;
          }).join(', ');
          
          return {
            success: false,
            message: `No encontré el campo "${fieldName}". Los campos disponibles son: ${suggestions}`
          };
        } else {
          return {
            success: false,
            message: `No hay campos de entrada visibles en esta página.`
          };
        }
      }
    } catch (error) {
      return {
        success: false,
        message: `Error al llenar el campo: ${error}`
      };
    }
  }, [currentContext, fillInput, analyzePage]);

  // Acción para describir la página actual
  const executePageDescription = useCallback(async (): Promise<ActionResult> => {
    try {
      // Siempre re-analizar para tener información actualizada
      analyzePage();
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const description = getPageDescription();
      
      return {
        success: true,
        message: description,
        data: { 
          context: currentContext,
          elementsCount: {
            buttons: currentContext?.buttons.length || 0,
            links: currentContext?.links.length || 0,
            inputs: currentContext?.inputs.length || 0,
            headings: currentContext?.headings.length || 0
          }
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Error al analizar la página: ${error}`
      };
    }
  }, [analyzePage, getPageDescription, currentContext]);

  // Acción para buscar elementos en la página
  const executeSearch = useCallback(async (searchTerm: string): Promise<ActionResult> => {
    try {
      if (!currentContext) {
        analyzePage();
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      const foundElements = findElements(searchTerm);
      
      if (foundElements.length > 0) {
        const elementsList = foundElements.slice(0, 5).map(el => {
          const type = el.category === 'button' ? 'botón' : 
                      el.category === 'link' ? 'enlace' : 
                      el.category === 'input' ? 'campo' : 
                      el.category === 'content' ? 'encabezado' : 'elemento';
          return `- ${type}: "${el.text}"`;
        }).join('\n');
        
        return {
          success: true,
          message: `Encontré ${foundElements.length} elementos relacionados con "${searchTerm}":\n${elementsList}`,
          data: { elements: foundElements }
        };
      } else {
        return {
          success: false,
          message: `No encontré elementos relacionados con "${searchTerm}" en la página actual.`
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Error en la búsqueda: ${error}`
      };
    }
  }, [currentContext, findElements, analyzePage]);

  // Acción para obtener información de navegación disponible
  const executeGetNavigationInfo = useCallback((): ActionResult => {
    const categories = [...new Set(SYSTEM_ROUTES.map(route => route.category))];
    const routesByCategory = categories.map(category => {
      const routes = SYSTEM_ROUTES.filter(route => route.category === category);
      return {
        category,
        routes: routes.map(route => ({ title: route.title, keywords: route.keywords.slice(0, 3) }))
      };
    });

    let message = "PÁGINAS DISPONIBLES POR CATEGORÍA:\n\n";
    routesByCategory.forEach(cat => {
      message += `📁 ${cat.category.toUpperCase()}:\n`;
      cat.routes.slice(0, 5).forEach(route => {
        message += `  • ${route.title} (palabras clave: ${route.keywords.join(', ')})\n`;
      });
      message += "\n";
    });

    return {
      success: true,
      message,
      data: { categories: routesByCategory }
    };
  }, []);

  // Función principal para ejecutar acciones
  const executeAction = useCallback(async (actionType: string, params: any = {}): Promise<ActionResult> => {
    try {
      switch (actionType.toLowerCase()) {
        case 'navigate':
        case 'navegar':
        case 'ir':
        case 'llevar':
          return await executeNavigation(params.destination || params.query || '');
          
        case 'click':
        case 'clic':
        case 'presionar':
        case 'hacer_clic':
          return await executeClick(params.element || params.query || '');
          
        case 'fill':
        case 'llenar':
        case 'escribir':
        case 'completar':
          return await executeFillField(params.field || '', params.value || '');
          
        case 'describe':
        case 'describir':
        case 'ver':
        case 'mostrar':
        case 'analizar':
          return await executePageDescription();
          
        case 'search':
        case 'buscar':
        case 'encontrar':
          return await executeSearch(params.query || '');
          
        case 'navigation_info':
        case 'info_navegacion':
        case 'paginas':
        case 'rutas':
          return executeGetNavigationInfo();
          
        default:
          return {
            success: false,
            message: `Acción no reconocida: ${actionType}. Acciones disponibles: navegar, hacer clic, llenar campo, describir página, buscar elementos.`
          };
      }
    } catch (error) {
      return {
        success: false,
        message: `Error ejecutando acción: ${error}`
      };
    }
  }, [executeNavigation, executeClick, executeFillField, executePageDescription, executeSearch, executeGetNavigationInfo]);

  // Función para obtener el contexto actual de manera síncrona
  const getCurrentPageInfo = useCallback(() => {
    if (!currentContext) {
      return {
        available: false,
        message: "Información de página no disponible. Analizando..."
      };
    }

    return {
      available: true,
      url: currentContext.url,
      title: currentContext.title,
      elementsCount: {
        buttons: currentContext.buttons.length,
        links: currentContext.links.length,
        inputs: currentContext.inputs.length,
        headings: currentContext.headings.length,
        total: currentContext.mainElements.length
      },
      lastAnalyzed: currentContext.lastAnalyzed,
      isStale: Date.now() - currentContext.lastAnalyzed.getTime() > 15000
    };
  }, [currentContext]);

  return {
    executeAction,
    executeNavigation,
    executeClick,
    executeFillField,
    executePageDescription,
    executeSearch,
    executeGetNavigationInfo,
    getCurrentPageInfo,
    findRouteByTerms,
    currentContext
  };
}; 