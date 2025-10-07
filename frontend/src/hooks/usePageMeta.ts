import { useEffect } from 'react';

interface PageMetaProps {
  title: string;
  description?: string;
  keywords?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
}

export const usePageMeta = ({
  title,
  description = 'Guro es el software de seguros más avanzado con inteligencia artificial. Transforma tu agencia de seguros con automatización, gestión de pólizas, siniestros y análisis predictivo.',
  keywords = 'software de seguros, agencia de seguros, inteligencia artificial seguros, Guro, gestión pólizas, siniestros, cotizaciones automáticas, IA seguros, plataforma seguros, automatización seguros',
  ogTitle,
  ogDescription,
  ogImage = '/favicon.png'
}: PageMetaProps) => {
  useEffect(() => {
    // Actualizar título de la página
    document.title = `${title} | Guro - Software de Seguros con IA`;

    // Actualizar meta description
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.setAttribute('name', 'description');
      document.head.appendChild(metaDescription);
    }
    metaDescription.setAttribute('content', description);

    // Actualizar meta keywords
    let metaKeywords = document.querySelector('meta[name="keywords"]');
    if (!metaKeywords) {
      metaKeywords = document.createElement('meta');
      metaKeywords.setAttribute('name', 'keywords');
      document.head.appendChild(metaKeywords);
    }
    metaKeywords.setAttribute('content', keywords);

    // Open Graph Title
    let ogTitleMeta = document.querySelector('meta[property="og:title"]');
    if (!ogTitleMeta) {
      ogTitleMeta = document.createElement('meta');
      ogTitleMeta.setAttribute('property', 'og:title');
      document.head.appendChild(ogTitleMeta);
    }
    ogTitleMeta.setAttribute('content', ogTitle || title);

    // Open Graph Description
    let ogDescriptionMeta = document.querySelector('meta[property="og:description"]');
    if (!ogDescriptionMeta) {
      ogDescriptionMeta = document.createElement('meta');
      ogDescriptionMeta.setAttribute('property', 'og:description');
      document.head.appendChild(ogDescriptionMeta);
    }
    ogDescriptionMeta.setAttribute('content', ogDescription || description);

    // Open Graph Image
    let ogImageMeta = document.querySelector('meta[property="og:image"]');
    if (!ogImageMeta) {
      ogImageMeta = document.createElement('meta');
      ogImageMeta.setAttribute('property', 'og:image');
      document.head.appendChild(ogImageMeta);
    }
    ogImageMeta.setAttribute('content', ogImage);

    // Open Graph Type
    let ogTypeMeta = document.querySelector('meta[property="og:type"]');
    if (!ogTypeMeta) {
      ogTypeMeta = document.createElement('meta');
      ogTypeMeta.setAttribute('property', 'og:type');
      document.head.appendChild(ogTypeMeta);
    }
    ogTypeMeta.setAttribute('content', 'website');

    // Twitter Card
    let twitterCardMeta = document.querySelector('meta[name="twitter:card"]');
    if (!twitterCardMeta) {
      twitterCardMeta = document.createElement('meta');
      twitterCardMeta.setAttribute('name', 'twitter:card');
      document.head.appendChild(twitterCardMeta);
    }
    twitterCardMeta.setAttribute('content', 'summary_large_image');

  }, [title, description, keywords, ogTitle, ogDescription, ogImage]);
};

export default usePageMeta; 