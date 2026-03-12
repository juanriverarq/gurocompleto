import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';

interface MessageMedia {
  url?: string;
  type?: string;
  filename?: string;
  mimetype?: string;
  mime_type?: string;
  caption?: string;
  gcs_path?: string;
}

interface MessageContentProps {
  messageType: string;
  content: string | null;
  media?: MessageMedia | null;
  isOutgoing: boolean;
  authToken?: string | null;
}

/**
 * Componente para renderizar contenido de mensajes según su tipo
 * Soporta: text, image, video, audio, document, location, contact, sticker, interactive
 */
const MessageContent: React.FC<MessageContentProps> = ({ messageType, content, media, isOutgoing, authToken }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);

  const textColorClass = isOutgoing ? 'text-[#111b21] dark:text-[#e9edef]' : 'text-[#111b21] dark:text-[#e9edef]';
  const secondaryTextClass = isOutgoing ? 'text-[#667781] dark:text-[rgba(255,255,255,0.55)]' : 'text-[#667781] dark:text-gray-400';

  // Helper para construir URL de media del backend
  const getMediaUrl = (url: string | undefined | null, mediaObj?: MessageMedia | null): string | null => {
    if (!url) return null;
    const backendUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001/api';
    const baseUrl = backendUrl.replace('/api', '');

    // Helper: construir URL del proxy con token
    const buildProxyUrl = (gcsPath: string) => {
      const encoded = btoa(gcsPath);
      const tokenParam = authToken ? `?token=${encodeURIComponent(authToken)}` : '';
      return `${backendUrl}/saas/whatsapp-inbox/media/${encoded}${tokenParam}`;
    };

    // Si tiene gcs_path, usar proxy del backend (resuelve 403 de Firebase)
    const gcsPath = mediaObj?.gcs_path;
    if (gcsPath) {
      return buildProxyUrl(gcsPath);
    }

    // Si es URL de Firebase Storage, extraer el path y usar proxy
    if (url.includes('firebasestorage.googleapis.com')) {
      const match = url.match(/\/o\/(.+?)(\?|$)/);
      if (match) {
        const decodedPath = decodeURIComponent(match[1]);
        return buildProxyUrl(decodedPath);
      }
    }

    // Si es URL relativa, agregar base URL del backend
    if (url.startsWith('/storage/')) {
      return `${baseUrl}${url}`;
    }
    // Si es URL de ngrok con /storage/, convertir a URL local del backend
    if (url.includes('ngrok') && url.includes('/storage/')) {
      const storagePath = url.substring(url.indexOf('/storage/'));
      return `${baseUrl}${storagePath}`;
    }
    // Si ya es URL absoluta (ej: media de Meta), usarla directamente
    return url;
  };

  // Renderizar según tipo de mensaje
  switch (messageType) {
    case 'image':
      const imageUrl = getMediaUrl(media?.url, media) || content;
      return (
        <div className="space-y-1">
          {imageUrl && !imageError ? (
            <>
              <div 
                className="relative cursor-pointer rounded-lg overflow-hidden"
                onClick={() => setShowFullImage(true)}
              >
                {!imageLoaded && (
                  <div className="w-48 h-48 bg-gray-200 dark:bg-gray-600 animate-pulse flex items-center justify-center">
                    <Icon icon="solar:gallery-bold" width={32} className="text-gray-400" />
                  </div>
                )}
                <img
                  src={imageUrl}
                  alt="Imagen"
                  className={`max-w-[250px] max-h-[300px] rounded-lg object-cover ${!imageLoaded ? 'hidden' : ''}`}
                  onLoad={() => setImageLoaded(true)}
                  onError={() => setImageError(true)}
                />
                <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center">
                  <Icon icon="solar:maximize-square-bold" width={24} className="text-white opacity-0 hover:opacity-100 drop-shadow-lg" />
                </div>
              </div>
              {media?.caption && (
                <p className={`text-sm ${textColorClass}`}>{media.caption}</p>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-600 rounded-lg">
              <Icon icon="solar:gallery-broken" width={20} className="text-gray-400" />
              <span className={`text-sm ${secondaryTextClass}`}>Imagen no disponible</span>
            </div>
          )}
          
          {/* Lightbox de imagen completa (portal) */}
          {showFullImage && imageUrl && createPortal(
            <div 
              className="fixed inset-0 z-[9999] flex flex-col bg-[#111b21]/95 backdrop-blur-sm"
              onClick={() => setShowFullImage(false)}
            >
              {/* Top bar */}
              <div className="flex items-center justify-between px-4 py-3 bg-[#202c33]" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-3 text-[#e9edef] text-sm">
                  <Icon icon="solar:gallery-bold" width={18} className="text-gray-400" />
                  <span>{media?.caption || media?.filename || 'Imagen'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={imageUrl}
                    download={media?.filename || 'imagen'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-full hover:bg-white/10 text-[#aebac1] hover:text-white transition-colors"
                    title="Descargar"
                    onClick={e => e.stopPropagation()}
                  >
                    <Icon icon="solar:download-bold" width={20} />
                  </a>
                  <button 
                    className="p-2 rounded-full hover:bg-white/10 text-[#aebac1] hover:text-white transition-colors"
                    onClick={() => setShowFullImage(false)}
                    title="Cerrar"
                  >
                    <Icon icon="solar:close-circle-bold" width={22} />
                  </button>
                </div>
              </div>
              {/* Image area */}
              <div className="flex-1 flex items-center justify-center p-6 overflow-auto">
                <img
                  src={imageUrl}
                  alt="Imagen completa"
                  className="max-w-full max-h-full object-contain rounded-md shadow-2xl"
                  onClick={e => e.stopPropagation()}
                />
              </div>
              {/* Caption bar */}
              {media?.caption && (
                <div className="px-6 py-3 bg-[#202c33] text-center" onClick={e => e.stopPropagation()}>
                  <p className="text-[#e9edef] text-sm">{media.caption}</p>
                </div>
              )}
            </div>,
            document.body
          )}
        </div>
      );

    case 'video':
      const videoUrl = getMediaUrl(media?.url, media) || content;
      return (
        <div className="space-y-1">
          {videoUrl ? (
            <>
              <video
                src={videoUrl}
                controls
                className="max-w-[280px] max-h-[200px] rounded-lg"
                preload="metadata"
              />
              {media?.caption && (
                <p className={`text-sm ${textColorClass}`}>{media.caption}</p>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-600 rounded-lg">
              <Icon icon="solar:video-frame-broken" width={20} className="text-gray-400" />
              <span className={`text-sm ${secondaryTextClass}`}>Video no disponible</span>
            </div>
          )}
        </div>
      );

    case 'audio':
      const audioUrl = getMediaUrl(media?.url, media) || content;
      return (
        <div className="flex items-center gap-2">
          {audioUrl ? (
            <audio
              src={audioUrl}
              controls
              className="max-w-[220px] h-10"
              preload="metadata"
            />
          ) : (
            <div className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-600 rounded-lg">
              <Icon icon="solar:microphone-broken" width={20} className="text-gray-400" />
              <span className={`text-sm ${secondaryTextClass}`}>Audio no disponible</span>
            </div>
          )}
        </div>
      );

    case 'document':
      const docUrl = getMediaUrl(media?.url, media) || content;
      const filename = media?.filename || 'Documento';
      return (
        <a
          href={docUrl || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
            isOutgoing 
              ? 'bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15' 
              : 'bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/15'
          }`}
        >
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            isOutgoing ? 'bg-black/10 dark:bg-white/15' : 'bg-red-100 dark:bg-red-900/30'
          }`}>
            <Icon 
              icon="solar:document-bold" 
              width={24} 
              className={isOutgoing ? 'text-red-600 dark:text-red-400' : 'text-red-500'} 
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium truncate ${textColorClass}`}>
              {filename}
            </p>
            <p className={`text-xs ${secondaryTextClass}`}>
              {media?.mimetype || 'Documento'}
            </p>
          </div>
          <Icon 
            icon="solar:download-bold" 
            width={20} 
            className={secondaryTextClass} 
          />
        </a>
      );

    case 'location':
      const locationData = typeof content === 'string' ? JSON.parse(content || '{}') : content;
      const lat = locationData?.latitude || locationData?.lat;
      const lng = locationData?.longitude || locationData?.lng;
      const locationName = locationData?.name || 'Ubicación';
      
      return (
        <a
          href={`https://www.google.com/maps?q=${lat},${lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`block p-2 rounded-lg transition-colors ${
            isOutgoing 
              ? 'bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15' 
              : 'bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/15'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <Icon icon="solar:map-point-bold" width={20} className="text-red-500" />
            <span className={`text-sm font-medium ${textColorClass}`}>{locationName}</span>
          </div>
          <div className="w-full h-32 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
            <Icon icon="solar:map-bold-duotone" width={48} className="text-gray-400" />
          </div>
          <p className={`text-xs mt-1 ${secondaryTextClass}`}>
            {lat?.toFixed(6)}, {lng?.toFixed(6)}
          </p>
        </a>
      );

    case 'contact':
      const contactData = typeof content === 'string' ? JSON.parse(content || '{}') : content;
      return (
        <div className={`flex items-center gap-3 p-3 rounded-lg ${
          isOutgoing ? 'bg-black/5 dark:bg-white/10' : 'bg-gray-100 dark:bg-white/10'
        }`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            isOutgoing ? 'bg-black/10 dark:bg-white/15' : 'bg-blue-100 dark:bg-blue-900/30'
          }`}>
            <Icon icon="solar:user-bold" width={24} className={isOutgoing ? 'text-blue-600 dark:text-blue-400' : 'text-blue-500'} />
          </div>
          <div>
            <p className={`text-sm font-medium ${textColorClass}`}>
              {contactData?.name || 'Contacto'}
            </p>
            {contactData?.phone && (
              <p className={`text-xs ${secondaryTextClass}`}>{contactData.phone}</p>
            )}
          </div>
        </div>
      );

    case 'sticker':
      const stickerUrl = media?.url || content;
      return (
        <div className="p-1">
          {stickerUrl ? (
            <img
              src={stickerUrl}
              alt="Sticker"
              className="w-32 h-32 object-contain"
            />
          ) : (
            <div className="w-32 h-32 bg-gray-100 dark:bg-gray-600 rounded-lg flex items-center justify-center">
              <Icon icon="solar:sticker-smile-circle-2-bold" width={48} className="text-gray-400" />
            </div>
          )}
        </div>
      );

    case 'interactive':
      // Mensajes interactivos (botones, listas)
      return (
        <div className="space-y-2">
          {content && <p className={`text-sm ${textColorClass}`}>{content}</p>}
          <div className={`text-xs ${secondaryTextClass} flex items-center gap-1`}>
            <Icon icon="solar:widget-bold" width={14} />
            <span>Mensaje interactivo</span>
          </div>
        </div>
      );

    case 'template':
      // Plantillas de WhatsApp Business
      return (
        <div className="space-y-1">
          {content && <p className={`text-sm ${textColorClass}`}>{content}</p>}
          <div className={`text-xs ${secondaryTextClass} flex items-center gap-1`}>
            <Icon icon="solar:document-text-bold" width={14} />
            <span>Plantilla</span>
          </div>
        </div>
      );

    case 'text':
    default:
      return (
        <p className={`text-sm whitespace-pre-wrap break-words ${textColorClass}`}>
          {content || ''}
        </p>
      );
  }
};

export default MessageContent;
