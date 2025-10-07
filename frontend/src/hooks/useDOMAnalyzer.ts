import { useState, useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';

interface DOMElement {
  tag: string;
  text: string;
  id?: string;
  className?: string;
  type?: string;
  placeholder?: string;
  href?: string;
  role?: string;
  ariaLabel?: string;
  selector: string;
  isInteractive: boolean;
  category: 'button' | 'link' | 'input' | 'form' | 'navigation' | 'content' | 'other';
  isVisible: boolean;
}

interface PageContext {
  url: string;
  title: string;
  description: string;
  mainElements: DOMElement[];
  forms: DOMElement[];
  buttons: DOMElement[];
  links: DOMElement[];
  inputs: DOMElement[];
  headings: DOMElement[];
  lastAnalyzed: Date;
}

export const useDOMAnalyzer = () => {
  const [currentContext, setCurrentContext] = useState<PageContext | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Función para verificar si un elemento es visible
  const isElementVisible = useCallback((element: Element): boolean => {
    try {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        rect.top < window.innerHeight &&
        rect.bottom > 0 &&
        rect.left < window.innerWidth &&
        rect.right > 0
      );
    } catch (error) {
      return false;
    }
  }, []);

  // Función para generar selector único y confiable
  const generateSelector = useCallback((element: Element): string => {
    try {
      // Priorizar IDs únicos
      if (element.id && document.querySelectorAll(`#${element.id}`).length === 1) {
        return `#${element.id}`;
      }

      // Construir selector jerárquico
      const parts: string[] = [];
      let currentElement = element;
      let depth = 0;

      while (currentElement && currentElement !== document.body && depth < 5) {
        let selector = currentElement.tagName.toLowerCase();
        
        // Agregar clases significativas (evitar clases de estado)
        if (currentElement.className) {
          const meaningfulClasses = currentElement.className.split(' ')
            .filter(cls => 
              cls.trim() && 
              !cls.includes('hover') && 
              !cls.includes('focus') && 
              !cls.includes('active') &&
              !cls.startsWith('transition') &&
              !cls.startsWith('duration') &&
              !cls.startsWith('ease')
            )
            .slice(0, 2);
          
          if (meaningfulClasses.length > 0) {
            selector += `.${meaningfulClasses.join('.')}`;
          }
        }

        // Agregar atributos únicos
        if (currentElement.getAttribute('data-testid')) {
          selector += `[data-testid="${currentElement.getAttribute('data-testid')}"]`;
        } else if (currentElement.getAttribute('role')) {
          selector += `[role="${currentElement.getAttribute('role')}"]`;
        }

        parts.unshift(selector);
        currentElement = currentElement.parentElement!;
        depth++;
      }

      return parts.join(' > ');
    } catch (error) {
      return element.tagName.toLowerCase();
    }
  }, []);

  // Función para categorizar elementos
  const categorizeElement = useCallback((element: Element): DOMElement['category'] => {
    const tag = element.tagName.toLowerCase();
    const role = element.getAttribute('role');
    const type = element.getAttribute('type');
    
    if (tag === 'button' || role === 'button' || type === 'button' || type === 'submit') {
      return 'button';
    }
    
    if (tag === 'a' || role === 'link') {
      return 'link';
    }
    
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      return 'input';
    }
    
    if (tag === 'form') {
      return 'form';
    }
    
    if (role === 'navigation' || element.closest('nav')) {
      return 'navigation';
    }
    
    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
      return 'content';
    }
    
    return 'other';
  }, []);

  // Función para extraer texto significativo
  const extractElementText = useCallback((element: Element): string => {
    // Priorizar atributos específicos
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();
    
    const title = element.getAttribute('title');
    if (title && title.trim()) return title.trim();
    
    const placeholder = element.getAttribute('placeholder');
    if (placeholder && placeholder.trim()) return placeholder.trim();
    
    const alt = element.getAttribute('alt');
    if (alt && alt.trim()) return alt.trim();

    // Para inputs, usar label asociado
    if (element.tagName.toLowerCase() === 'input') {
      const id = element.id;
      if (id) {
        const label = document.querySelector(`label[for="${id}"]`);
        if (label && label.textContent) {
          return label.textContent.trim();
        }
      }
    }
    
    // Extraer texto visible del elemento
    let textContent = '';
    
    // Para elementos con texto directo
    if (element.childNodes.length === 1 && element.childNodes[0].nodeType === Node.TEXT_NODE) {
      textContent = element.textContent?.trim() || '';
    } else {
      // Para elementos con estructura, buscar texto más específico
      const textNodes = Array.from(element.childNodes)
        .filter(node => node.nodeType === Node.TEXT_NODE)
        .map(node => node.textContent?.trim())
        .filter(text => text && text.length > 0);
      
      if (textNodes.length > 0) {
        textContent = textNodes.join(' ');
      } else {
        textContent = element.textContent?.trim() || '';
      }
    }
    
    // Limpiar y limitar texto
    textContent = textContent.replace(/\s+/g, ' ').trim();
    if (textContent.length > 100) {
      textContent = textContent.substring(0, 97) + '...';
    }
    
    return textContent;
  }, []);

  // Función principal para analizar el DOM
  const analyzePage = useCallback((): PageContext => {
    setIsAnalyzing(true);
    
    try {
      const elements: DOMElement[] = [];
      
      // Selectores más específicos y completos
      const selectors = [
        // Botones
        'button:not([style*="display: none"]):not([hidden])',
        '[role="button"]:not([style*="display: none"]):not([hidden])',
        'input[type="button"]:not([style*="display: none"]):not([hidden])',
        'input[type="submit"]:not([style*="display: none"]):not([hidden])',
        '.btn:not([style*="display: none"]):not([hidden])',
        
        // Enlaces
        'a[href]:not([href="#"]):not([style*="display: none"]):not([hidden])',
        
        // Inputs
        'input:not([type="hidden"]):not([style*="display: none"]):not([hidden])',
        'textarea:not([style*="display: none"]):not([hidden])',
        'select:not([style*="display: none"]):not([hidden])',
        
        // Elementos interactivos
        '[onclick]:not([style*="display: none"]):not([hidden])',
        '[data-testid]:not([style*="display: none"]):not([hidden])',
        
        // Encabezados y contenido importante
        'h1, h2, h3, h4, h5, h6',
        '[role="main"] *',
        '.main-content *',
        '.content *',
        
        // Elementos de navegación
        'nav a',
        '[role="navigation"] a',
        '.sidebar a',
        '.menu a'
      ];

      // Analizar cada selector
      selectors.forEach(selector => {
        try {
          const foundElements = document.querySelectorAll(selector);
          foundElements.forEach(element => {
            // Verificar visibilidad
            if (!isElementVisible(element)) return;
            
            const text = extractElementText(element);
            if (!text || text.length < 1) return;
            
            // Evitar elementos del modal del asistente de voz
            if (element.closest('[data-voice-assistant]') || 
                element.closest('.voice-assistant-modal')) {
              return;
            }
            
            const domElement: DOMElement = {
              tag: element.tagName.toLowerCase(),
              text,
              id: element.id || undefined,
              className: element.className || undefined,
              type: element.getAttribute('type') || undefined,
              placeholder: element.getAttribute('placeholder') || undefined,
              href: element.getAttribute('href') || undefined,
              role: element.getAttribute('role') || undefined,
              ariaLabel: element.getAttribute('aria-label') || undefined,
              selector: generateSelector(element),
              isInteractive: ['button', 'a', 'input', 'textarea', 'select'].includes(element.tagName.toLowerCase()) || 
                           element.getAttribute('role') === 'button' || 
                           element.hasAttribute('onclick'),
              category: categorizeElement(element),
              isVisible: true
            };
            
            // Evitar duplicados exactos
            const isDuplicate = elements.some(existing => 
              existing.text === domElement.text && 
              existing.tag === domElement.tag &&
              existing.category === domElement.category
            );
            
            if (!isDuplicate) {
              elements.push(domElement);
            }
          });
        } catch (error) {
        }
      });

      // Ordenar por relevancia e importancia
      elements.sort((a, b) => {
        const categoryPriority = { 
          button: 1, 
          input: 2, 
          link: 3, 
          navigation: 4, 
          content: 5, 
          form: 6, 
          other: 7 
        };
        
        // Priorizar elementos interactivos
        if (a.isInteractive && !b.isInteractive) return -1;
        if (!a.isInteractive && b.isInteractive) return 1;
        
        // Luego por categoría
        return categoryPriority[a.category] - categoryPriority[b.category];
      });

      const context: PageContext = {
        url: window.location.pathname,
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
        mainElements: elements.slice(0, 30), // Aumentar límite
        forms: elements.filter(el => el.category === 'form'),
        buttons: elements.filter(el => el.category === 'button'),
        links: elements.filter(el => el.category === 'link'),
        inputs: elements.filter(el => el.category === 'input'),
        headings: elements.filter(el => el.category === 'content'),
        lastAnalyzed: new Date()
      };

      setCurrentContext(context);
      setIsAnalyzing(false);
      return context;
      
    } catch (error) {
      setIsAnalyzing(false);
      throw error;
    }
  }, [isElementVisible, generateSelector, categorizeElement, extractElementText]);

  // Auto-análisis cuando cambia la ruta
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        analyzePage();
      } catch (error) {
      }
    }, 1500); // Esperar más tiempo para que la página se cargue completamente

    return () => clearTimeout(timer);
  }, [location.pathname, analyzePage]);

  // Función para encontrar elementos por texto o descripción
  const findElements = useCallback((searchText: string): DOMElement[] => {
    if (!currentContext) return [];
    
    const search = searchText.toLowerCase();
    return currentContext.mainElements.filter(element => 
      element.text.toLowerCase().includes(search) ||
      element.ariaLabel?.toLowerCase().includes(search) ||
      element.placeholder?.toLowerCase().includes(search) ||
      element.id?.toLowerCase().includes(search) ||
      element.className?.toLowerCase().includes(search)
    );
  }, [currentContext]);

  // Función mejorada para hacer clic en un elemento
  const clickElement = useCallback(async (searchText: string): Promise<boolean> => {
    const elements = findElements(searchText);
    if (elements.length === 0) return false;
    
    // Priorizar elementos más específicos
    const sortedElements = elements.sort((a, b) => {
      if (a.category === 'button' && b.category !== 'button') return -1;
      if (b.category === 'button' && a.category !== 'button') return 1;
      if (a.text.toLowerCase() === searchText.toLowerCase()) return -1;
      if (b.text.toLowerCase() === searchText.toLowerCase()) return 1;
      return 0;
    });
    
    const targetElement = sortedElements[0];
    
    try {
      // Intentar múltiples métodos de selección
      let domElement = document.querySelector(targetElement.selector);
      
             // Si no funciona el selector, buscar por texto
       if (!domElement) {
         const allElements = document.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]');
         domElement = Array.from(allElements).find(el => 
           el.textContent?.toLowerCase().includes(searchText.toLowerCase()) ||
           el.getAttribute('aria-label')?.toLowerCase().includes(searchText.toLowerCase())
         ) || null;
       }
      
      if (domElement && domElement instanceof HTMLElement) {
        // Verificar que el elemento sea visible
        if (!isElementVisible(domElement)) {
          return false;
        }
        
        // Scroll al elemento
        domElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Esperar para el scroll
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Hacer clic
        domElement.click();
        
        // También disparar evento de clic manualmente por si acaso
        domElement.dispatchEvent(new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window
        }));
        
        return true;
      }
    } catch (error) {
    }
    
    return false;
  }, [findElements, isElementVisible]);

  // Función mejorada para llenar un input
  const fillInput = useCallback(async (fieldName: string, value: string): Promise<boolean> => {
    const inputs = currentContext?.inputs.filter(input => 
      input.text.toLowerCase().includes(fieldName.toLowerCase()) ||
      input.placeholder?.toLowerCase().includes(fieldName.toLowerCase()) ||
      input.ariaLabel?.toLowerCase().includes(fieldName.toLowerCase()) ||
      input.id?.toLowerCase().includes(fieldName.toLowerCase())
    ) || [];
    
    if (inputs.length === 0) return false;
    
    const targetInput = inputs[0];
    
    try {
      // Intentar múltiples métodos de selección
      let domElement = document.querySelector(targetInput.selector) as HTMLInputElement;
      
      // Si no funciona el selector, buscar por atributos
      if (!domElement) {
        const allInputs = document.querySelectorAll('input, textarea, select');
        domElement = Array.from(allInputs).find(el => 
          el.getAttribute('placeholder')?.toLowerCase().includes(fieldName.toLowerCase()) ||
          el.getAttribute('aria-label')?.toLowerCase().includes(fieldName.toLowerCase()) ||
          el.id?.toLowerCase().includes(fieldName.toLowerCase())
        ) as HTMLInputElement;
      }
      
      if (domElement) {
        // Verificar visibilidad
        if (!isElementVisible(domElement)) {
          return false;
        }
        
        // Scroll al elemento
        domElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Focus y llenar
        domElement.focus();
        domElement.value = value;
        
        // Disparar eventos para frameworks reactivos
        domElement.dispatchEvent(new Event('input', { bubbles: true }));
        domElement.dispatchEvent(new Event('change', { bubbles: true }));
        domElement.dispatchEvent(new Event('blur', { bubbles: true }));
        
        return true;
      }
    } catch (error) {
    }
    
    return false;
  }, [currentContext, isElementVisible]);

  // Función para navegar a una página
  const navigateToPage = useCallback((path: string) => {
    navigate(path);
  }, [navigate]);

  // Función mejorada para obtener descripción de la página actual
  const getPageDescription = useCallback((): string => {
    if (!currentContext) return 'Página no analizada aún. Reintentando análisis...';
    
    const buttonCount = currentContext.buttons.length;
    const linkCount = currentContext.links.length;
    const inputCount = currentContext.inputs.length;
    const headingCount = currentContext.headings.length;
    
    let description = `PÁGINA ACTUAL: ${currentContext.title}\n`;
    description += `URL: ${currentContext.url}\n`;
    description += `ELEMENTOS ENCONTRADOS: ${buttonCount} botones, ${linkCount} enlaces, ${inputCount} campos, ${headingCount} encabezados\n`;
    
    if (currentContext.headings.length > 0) {
      description += `\nENCABEZADOS PRINCIPALES:\n`;
      currentContext.headings.slice(0, 5).forEach(heading => {
        description += `- ${heading.text}\n`;
      });
    }
    
    if (currentContext.buttons.length > 0) {
      description += `\nBOTONES DISPONIBLES:\n`;
      currentContext.buttons.slice(0, 8).forEach(btn => {
        description += `- "${btn.text}" (${btn.tag})\n`;
      });
    }
    
    if (currentContext.inputs.length > 0) {
      description += `\nCAMPOS DE ENTRADA:\n`;
      currentContext.inputs.slice(0, 6).forEach(input => {
        const fieldName = input.placeholder || input.ariaLabel || input.text || input.id;
        description += `- ${fieldName} (${input.type || input.tag})\n`;
      });
    }
    
    if (currentContext.links.length > 0) {
      description += `\nENLACES PRINCIPALES:\n`;
      currentContext.links.slice(0, 6).forEach(link => {
        description += `- "${link.text}"\n`;
      });
    }
    
    return description;
  }, [currentContext]);

  // Función para iniciar análisis automático
  const startAutoAnalysis = useCallback(() => {
    const observer = new MutationObserver(() => {
      // Re-analizar cuando el DOM cambie significativamente
      const timer = setTimeout(() => {
        try {
          analyzePage();
        } catch (error) {
        }
      }, 2000);
      
      return () => clearTimeout(timer);
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false
    });
    
    return () => observer.disconnect();
  }, [analyzePage]);

  return {
    currentContext,
    isAnalyzing,
    analyzePage,
    findElements,
    clickElement,
    fillInput,
    navigateToPage,
    getPageDescription,
    startAutoAnalysis
  };
}; 