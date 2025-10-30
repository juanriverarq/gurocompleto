import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { Card, Button, TextInput, Label, Select, Alert, Spinner } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { quotesService, QuoteSubmission } from 'src/services/quotesService';
import { visitsService } from 'src/services/visitsService';
import { INSURANCE_PRODUCTS, FIELDS_BY_TIPO, FieldDef } from 'src/data/insuranceProducts';
import enlacesService from 'src/services/enlacesCotizacionService';

const QuoteForm: React.FC = () => {
  const { slug, tipo } = useParams<{ slug: string; tipo: string }>();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [enlaceActivo, setEnlaceActivo] = useState(true);

  const product = INSURANCE_PRODUCTS.find((p) => p.value === tipo);
  const fields = FIELDS_BY_TIPO[tipo || ''] || [];

  useEffect(() => {
    if (!tipo || !product) {
      // Redirigir o mostrar error si tipo inválido
      console.warn('Tipo de producto inválido:', tipo);
      return;
    }

    // Verificar si el enlace está activo
    const checkEnlaceStatus = async () => {
      try {
        const enlaces = await enlacesService.list({ per_page: 100 });
        const enlacesRows = (enlaces?.data || enlaces?.data?.data || enlaces || []).data || enlaces?.data || [];
        const enlace = enlacesRows.find((e: any) => e.tipo === tipo && e.activo);
        setEnlaceActivo(!!enlace);
      } catch {
        setEnlaceActivo(false);
      }
    };

    checkEnlaceStatus();

    // Trackear visita al formulario
    if (slug && tipo) {
      visitsService.trackVisit({ slug, tipo }).catch(() => {});
    }
  }, [tipo, product, slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug || !tipo) return;

    try {
      setLoading(true);
      const payload: QuoteSubmission = {
        slug,
        tipo,
        data: formData,
      };
      await quotesService.submitQuote(payload);
      setSubmitted(true);
    } catch (error) {
      console.error('Error al enviar cotización:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  if (!product) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <Alert color="failure">
          <Icon icon="solar:danger-triangle-bold" className="mr-2" />
          Producto no encontrado.
        </Alert>
      </div>
    );
  }

  if (!enlaceActivo) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <Alert color="warning">
          <Icon icon="solar:eye-closed-bold" className="mr-2" />
          Este enlace de cotización no está disponible en este momento.
        </Alert>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <Card className="max-w-md w-full text-center">
          <Icon icon="solar:check-circle-bold" className="text-green-500 w-16 h-16 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">¡Cotización enviada!</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Gracias por tu interés. Nos pondremos en contacto contigo pronto.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-10">
      <div className="max-w-lg mx-auto px-5">
        <Card>
          <div className="text-center mb-6">
            <Icon icon={product.icon} className={`w-12 h-12 mx-auto mb-2 ${product.color}`} />
            <h1 className="text-2xl font-bold">{product.label}</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Solicita tu cotización personalizada
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
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

            <Button type="submit" color="primary" className="w-full" disabled={loading}>
              {loading ? (
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
      </div>
    </div>
  );
};

export default QuoteForm;