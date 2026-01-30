import DOMPurify from 'dompurify';

/**
 * Sanitiza HTML para prevenir ataques XSS
 * Usar siempre antes de renderizar HTML con dangerouslySetInnerHTML
 */
export const sanitizeHtml = (dirty: string): string => {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'p', 'br', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre',
      'table', 'thead', 'tbody', 'tr', 'th', 'td', 'div', 'span',
      'img', 'hr', 'sub', 'sup', 'u', 's', 'strike'
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'class', 'id', 'style',
      'target', 'rel', 'width', 'height', 'align', 'valign',
      'colspan', 'rowspan', 'border', 'cellpadding', 'cellspacing'
    ],
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ['target'],
    ADD_TAGS: [],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur']
  });
};

/**
 * Sanitiza HTML para emails (más permisivo con estilos)
 */
export const sanitizeEmailHtml = (dirty: string): string => {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'html', 'head', 'body', 'meta', 'title', 'style',
      'p', 'br', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre',
      'table', 'thead', 'tbody', 'tr', 'th', 'td', 'div', 'span',
      'img', 'hr', 'sub', 'sup', 'u', 's', 'center', 'font'
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'class', 'id', 'style',
      'target', 'rel', 'width', 'height', 'align', 'valign',
      'colspan', 'rowspan', 'border', 'cellpadding', 'cellspacing',
      'bgcolor', 'color', 'face', 'size'
    ],
    ALLOW_DATA_ATTR: false,
    WHOLE_DOCUMENT: true
  });
};

/**
 * Sanitiza texto plano (elimina todo HTML)
 */
export const sanitizeText = (dirty: string): string => {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  });
};

export default sanitizeHtml;
