import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { Spinner, Alert, Card, Button, TextInput, Label, Select } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { miniWebService, MiniWebConfig } from 'src/services/miniWebService';
import { visitsService } from 'src/services/visitsService';
import { quotesService, QuoteSubmission } from 'src/services/quotesService';
import { INSURANCE_PRODUCTS, FIELDS_BY_TIPO, FieldDef } from 'src/data/insuranceProducts';
import enlacesService from 'src/services/enlacesCotizacionService';

const fallbackTheme = {
  primary: '#3B82F6',
  background: '#FFFFFF',
  text: '#111827',
};

const buildWhatsAppLink = (wa?: string, text?: string) => {
  if (!wa) return '#';
  const msg = encodeURIComponent(text || 'Hola, me interesa más información.');
  const clean = wa.replace(/[^\d]/g, '');
  return `https://wa.me/${clean}?text=${msg}`;
};

const MiniWebPublic: React.FC = () => {
  const { slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<MiniWebConfig | null>(null);
  const [error, setError] = useState<string>('');
  
  // Estado para formulario de cotización inline
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [selectedTipo, setSelectedTipo] = useState<string>('');
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [enlaceActivo, setEnlaceActivo] = useState(true);

  const product = INSURANCE_PRODUCTS.find((p) => p.value === selectedTipo);
  const fields = FIELDS_BY_TIPO[selectedTipo || ''] || [];

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!slug) {
          setError('Slug inválido');
          return;
        }
        // Track visit
        await visitsService.trackVisit({ slug });

        const res = await miniWebService.getPublicBySlug(slug);
        if (mounted) {
          if (res.success && res.data && res.data.published) {
            setConfig(res.data);
          } else {
            setError('Mini Web no encontrada o no publicada.');
          }
        }
      } catch (e) {
        setError('No se pudo cargar la Mini Web.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [slug]);

  const theme = useMemo(() => {
    return {
      primary: config?.theme?.primary || fallbackTheme.primary,
      background: config?.theme?.background || fallbackTheme.background,
      text: config?.theme?.text || fallbackTheme.text,
    };
  }, [config]);

  const handleLinkClick = async (e: React.MouseEvent<HTMLAnchorElement>, url: string) => {
    // Detectar si es un enlace de cotización interno (/web/:slug/:tipo)
    const match = url.match(/^\/web\/[^/]+\/([^/]+)$/);
    if (match && match[1]) {
      e.preventDefault();
      const tipo = match[1];
      
      // Verificar si el enlace está activo
      try {
        const enlaces = await enlacesService.list({ per_page: 100 });
        const enlacesRows = (enlaces?.data || enlaces?.data?.data || enlaces || []).data || enlaces?.data || [];
        const enlace = enlacesRows.find((e: any) => e.tipo === tipo && e.activo);
        
        if (enlace) {
          setSelectedTipo(tipo);
          setEnlaceActivo(true);
          setShowQuoteForm(true);
          setFormData({});
          setSubmitted(false);
          // Track visit
          if (slug) {
            visitsService.trackVisit({ slug, tipo }).catch(() => {});
          }
        } else {
          setEnlaceActivo(false);
          setShowQuoteForm(true);
        }
      } catch {
        setEnlaceActivo(false);
        setShowQuoteForm(true);
      }
    }
  };

  const handleSubmitQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug || !selectedTipo) return;

    try {
      setSubmitting(true);
      const payload: QuoteSubmission = {
        slug,
        tipo: selectedTipo,
        data: formData,
      };
      await quotesService.submitQuote(payload);
      setSubmitted(true);
    } catch (error) {
      console.error('Error al enviar cotización:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleBackToLinks = () => {
    setShowQuoteForm(false);
    setSelectedTipo('');
    setFormData({});
    setSubmitted(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center" style={{ background: fallbackTheme.background }}>
        <Spinner size="xl" />
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="min-h-screen grid place-items-center p-6" style={{ background: fallbackTheme.background }}>
        <div className="max-w-md w-full">
          <Alert color="failure">
            {error || 'Mini Web no disponible.'}
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{
        background: theme.background,
        color: theme.text,
      }}
    >
      <div className="max-w-lg mx-auto px-5 py-10">
        {!showQuoteForm ? (
          // Vista principal de Mini Web
          <div className="text-center">
            {/* Logo */}
            {(config.logoUrl || config.avatarUrl) ? (
              <img
                src={config.logoUrl || config.avatarUrl}
                alt={config.title}
                className="mx-auto h-16 object-contain mb-4"
                style={{ borderColor: theme.primary }}
              />
            ) : (
              <div
                className="mx-auto h-16 w-16 grid place-items-center border rounded-md mb-4"
                style={{ borderColor: theme.primary, background: '#F3F4F6' }}
              >
                <Icon icon="solar:gallery-bold" className="text-gray-400" width={26} />
              </div>
            )}

            {/* Title + bio */}
            <h1 className="text-2xl font-semibold">{config.title}</h1>
            {config.bio && <p className="mt-2 opacity-80">{config.bio}</p>}

            {/* Contacto (centrado justo después de la descripción) */}
            {(config.contact?.whatsapp ||
              config.contact?.phone ||
              config.contact?.email ||
              config.contact?.address) && (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                {config.contact?.whatsapp && (
                  <a
                    aria-label="WhatsApp"
                    href={buildWhatsAppLink(config.contact.whatsapp, `Hola ${config.title}`)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center h-10 w-10 rounded-full"
                    style={{ background: theme.primary, color: '#ffffff' }}
                  >
                    <Icon icon="mdi:whatsapp" width={22} />
                  </a>
                )}
                {config.contact?.phone && (
                  <a
                    aria-label="Teléfono"
                    href={`tel:${config.contact.phone}`}
                    className="inline-flex items-center justify-center h-10 w-10 rounded-full"
                    style={{ background: theme.primary, color: '#ffffff' }}
                  >
                    <Icon icon="mdi:phone" width={22} />
                  </a>
                )}
                {config.contact?.email && (
                  <a
                    aria-label="Email"
                    href={`mailto:${config.contact.email}`}
                    className="inline-flex items-center justify-center h-10 w-10 rounded-full"
                    style={{ background: theme.primary, color: '#ffffff' }}
                  >
                    <Icon icon="mdi:email" width={22} />
                  </a>
                )}
                {config.contact?.address && (
                  <a
                    aria-label="Dirección"
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(config.contact.address)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center h-10 w-10 rounded-full"
                    style={{ background: theme.primary, color: '#ffffff' }}
                  >
                    <Icon icon="mdi:map-marker" width={22} />
                  </a>
                )}
              </div>
            )}

            {/* Botones / enlaces */}
            <div className="mt-6 space-y-3">
              {(config.links || []).map((lnk, idx) => (
                <a
                  key={idx}
                  href={lnk.url || '#'}
                  onClick={(e) => handleLinkClick(e, lnk.url)}
                  className="block w-full rounded-lg py-2 font-medium cursor-pointer hover:opacity-80 transition-opacity"
                  style={{
                    border: '1px solid ' + theme.primary,
                    color: theme.primary,
                  }}
                >
                  {lnk.label || 'Abrir'}
                </a>
              ))}
            </div>

            {/* Socials */}
            <div className="mt-6 flex items-center justify-center gap-4">
              {config.social?.instagram && (
                <a href={config.social.instagram} target="_blank" rel="noreferrer" aria-label="Instagram">
                  <Icon icon="mdi:instagram" width={22} />
                </a>
              )}
              {config.social?.facebook && (
                <a href={config.social.facebook} target="_blank" rel="noreferrer" aria-label="Facebook">
                  <Icon icon="mdi:facebook" width={22} />
                </a>
              )}
              {config.social?.website && (
                <a href={config.social.website} target="_blank" rel="noreferrer" aria-label="Website">
                  <Icon icon="mdi:web" width={22} />
                </a>
              )}
              {config.social?.youtube && (
                <a href={config.social.youtube} target="_blank" rel="noreferrer" aria-label="YouTube">
                  <Icon icon="mdi:youtube" width={22} />
                </a>
              )}
              {config.social?.linkedin && (
                <a href={config.social.linkedin} target="_blank" rel="noreferrer" aria-label="LinkedIn">
                  <Icon icon="mdi:linkedin" width={22} />
                </a>
              )}
              {config.social?.tiktok && (
                <a href={config.social.tiktok} target="_blank" rel="noreferrer" aria-label="TikTok">
                  <Icon icon="mdi:tiktok" width={22} />
                </a>
              )}
              {config.social?.x && (
                <a href={config.social.x} target="_blank" rel="noreferrer" aria-label="X">
                  <Icon icon="mdi:twitter" width={22} />
                </a>
              )}
            </div>

            {/* Footer */}
            <div className="mt-10 text-xs opacity-60">
              © {new Date().getFullYear()} - Mini Web
            </div>
          </div>
        ) : (
          // Formulario de cotización inline
          <div>
            <Button
              color="light"
              size="sm"
              onClick={handleBackToLinks}
              className="mb-4"
            >
              <Icon icon="solar:arrow-left-bold" className="me-2" width={16} />
              Volver
            </Button>

            {!enlaceActivo ? (
              <Alert color="warning">
                <Icon icon="solar:eye-closed-bold" className="mr-2" />
                Este enlace de cotización no está disponible en este momento.
              </Alert>
            ) : submitted ? (
              <Card className="text-center">
                <Icon icon="solar:check-circle-bold" className="text-green-500 w-16 h-16 mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">¡Cotización enviada!</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Gracias por tu interés. Nos pondremos en contacto contigo pronto.
                </p>
                <Button color="primary" onClick={handleBackToLinks}>
                  Volver a la Mini Web
                </Button>
              </Card>
            ) : product ? (
              <Card>
                <div className="text-center mb-6">
                  <Icon icon={product.icon} className={`w-12 h-12 mx-auto mb-2 ${product.color}`} />
                  <h1 className="text-2xl font-bold">{product.label}</h1>
                  <p className="text-gray-600 dark:text-gray-400">
                    Solicita tu cotización personalizada
                  </p>
                </div>

                <form onSubmit={handleSubmitQuote} className="space-y-4">
                  {fields.map((field: FieldDef) => (
                    <div key={field.key}>
                      <Label htmlFor={field.key} value={field.label} />
                      {field.type === 'select' ? (
                        <Select
                          id={field.key}
                          value={formData[field.key] || ''}
                          onChange={(e) => handleChange(field.key, e.target.value)}
                          required={field.required}
                        >
                          <option value="">Seleccionar...</option>
                          {field.options?.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <TextInput
                          id={field.key}
                          type={field.type}
                          value={formData[field.key] || ''}
                          onChange={(e) => handleChange(field.key, e.target.value)}
                          min={field.min}
                          max={field.max}
                          required={field.required}
                          placeholder={`Ingresa ${field.label.toLowerCase()}`}
                        />
                      )}
                    </div>
                  ))}

                  <Button type="submit" color="primary" className="w-full" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Spinner size="sm" className="me-2" />
                        Enviando...
                      </>
                    ) : (
                      'Solicitar Cotización'
                    )}
                  </Button>
                </form>

                <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  <p>Tu información será tratada de forma confidencial.</p>
                </div>
              </Card>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

export default MiniWebPublic;