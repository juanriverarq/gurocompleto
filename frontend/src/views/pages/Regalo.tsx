import { useEffect, useState } from 'react';
import { Flowbite } from 'flowbite-react';
import AOS from 'aos';
import 'aos/dist/aos.css';
import customTheme from 'src/utils/theme/custom-theme';
import LpHeader from 'src/components/landingpage/header/Header';
import Footer from 'src/components/landingpage/footer/Footer';
import { Gift, Calendar, Clock, Sparkles, CheckCircle2 } from 'lucide-react';
import { Button } from 'flowbite-react';

const Regalo = () => {
  // Calcular fecha límite (2 semanas desde ahora)
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  useEffect(() => {
    AOS.init();
    
    // Fecha límite: 2 semanas desde ahora
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 14);

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const distance = deadline.getTime() - now;

      if (distance > 0) {
        setTimeLeft({
          days: Math.floor(distance / (1000 * 60 * 60 * 24)),
          hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((distance % (1000 * 60)) / 1000)
        });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <Flowbite theme={{ theme: customTheme }}>
      <div className="landingpage">
        <LpHeader />

        {/* Hero Section */}
        <div className="bg-lightgray dark:bg-darkgray">
          <div className="container py-20">
            <div className="text-center">
              <div 
                className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-primary to-secondary rounded-full mb-6"
                data-aos="zoom-in"
                data-aos-duration="1000"
              >
                <Gift className="w-10 h-10 text-white" />
              </div>
              
              <h1 
                className="font-bold mb-6 sm:text-40 text-3xl sm:leading-[55px]"
                data-aos="fade-up"
                data-aos-delay="200"
                data-aos-duration="1000"
              >
                ¡Felicidades! 🎉
              </h1>
              
              <div className="max-w-3xl mx-auto space-y-6">
                <p 
                  className="text-xl md:text-2xl text-ld font-semibold"
                  data-aos="fade-up"
                  data-aos-delay="400"
                  data-aos-duration="1000"
                >
                  Has recibido un <span className="text-primary font-bold">10% de descuento</span> en nuestro software para la gestión de seguros con inteligencia artificial
                </p>
                
                <div
                  className="bg-gradient-to-r from-lightprimary to-lightsecondary dark:from-darkprimary dark:to-darksecondary rounded-2xl p-6 md:p-8 border-2 border-primary shadow-lg"
                  data-aos="fade-up"
                  data-aos-delay="600"
                  data-aos-duration="1000"
                >
                  <div className="flex items-center justify-center mb-4">
                    <Sparkles className="w-8 h-8 text-secondary mr-2" />
                    <h2 className="text-2xl md:text-3xl font-bold text-dark dark:text-white">
                      ¡REGALO ESPECIAL!
                    </h2>
                    <Sparkles className="w-8 h-8 text-secondary ml-2" />
                  </div>
                  <p className="text-xl md:text-2xl font-bold text-primary mb-2">
                    Te REGALAMOS 1 (Un) año de facturación y nómina electrónica
                  </p>
                  <p className="text-sm text-ld opacity-75">
                    *Solo para contrataciones de plan anual
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Countdown Timer */}
        <div className="bg-white dark:bg-dark py-16">
          <div className="container">
            <div 
              className="max-w-4xl mx-auto bg-lightgray dark:bg-darkgray rounded-2xl shadow-xl p-8 border-2 border-error"
              data-aos="fade-up"
              data-aos-duration="1000"
            >
              <div className="flex items-center justify-center mb-6">
                <Clock className="w-8 h-8 text-error mr-3" />
                <h3 className="text-2xl md:text-3xl font-bold text-dark dark:text-white">
                  ¡Tiempo Limitado!
                </h3>
              </div>
              
              <p className="text-center text-lg text-ld mb-6">
                Agenda tu cita antes de que expire esta oferta exclusiva
              </p>
              
              <div className="grid grid-cols-4 gap-2 sm:gap-4 max-w-2xl mx-auto">
                <div className="bg-gradient-to-br from-error to-red-600 rounded-xl p-2 sm:p-4 text-white text-center">
                  <div className="text-2xl sm:text-4xl md:text-5xl font-bold mb-1 sm:mb-2">
                    {timeLeft.days}
                  </div>
                  <div className="text-xs sm:text-sm md:text-base uppercase tracking-tight sm:tracking-wide">
                    Días
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-warning to-orange-600 rounded-xl p-2 sm:p-4 text-white text-center">
                  <div className="text-2xl sm:text-4xl md:text-5xl font-bold mb-1 sm:mb-2">
                    {timeLeft.hours}
                  </div>
                  <div className="text-xs sm:text-sm md:text-base uppercase tracking-tight sm:tracking-wide">
                    Horas
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl p-2 sm:p-4 text-white text-center">
                  <div className="text-2xl sm:text-4xl md:text-5xl font-bold mb-1 sm:mb-2">
                    {timeLeft.minutes}
                  </div>
                  <div className="text-xs sm:text-sm md:text-base uppercase tracking-tight sm:tracking-wide">
                    Min
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-success to-green-600 rounded-xl p-2 sm:p-4 text-white text-center">
                  <div className="text-2xl sm:text-4xl md:text-5xl font-bold mb-1 sm:mb-2">
                    {timeLeft.seconds}
                  </div>
                  <div className="text-xs sm:text-sm md:text-base uppercase tracking-tight sm:tracking-wide">
                    Seg
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Benefits Section */}
        <div className="bg-lightgray dark:bg-darkgray py-16">
          <div className="container">
            <h3 
              className="text-2xl md:text-3xl font-bold text-center text-dark dark:text-white mb-12"
              data-aos="fade-up"
              data-aos-duration="1000"
            >
              Lo que incluye tu regalo:
            </h3>
            
            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              <div 
                className="bg-white dark:bg-dark rounded-xl shadow-lg p-6 border-l-4 border-primary"
                data-aos="fade-right"
                data-aos-delay="200"
                data-aos-duration="1000"
              >
                <div className="flex items-start">
                  <CheckCircle2 className="w-6 h-6 text-primary mr-3 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="text-xl font-bold text-dark dark:text-white mb-2">
                      10% de Descuento
                    </h4>
                    <p className="text-ld">
                      En tu suscripción al software de gestión de seguros con IA más avanzado del mercado
                    </p>
                  </div>
                </div>
              </div>
              
              <div 
                className="bg-white dark:bg-dark rounded-xl shadow-lg p-6 border-l-4 border-secondary"
                data-aos="fade-left"
                data-aos-delay="200"
                data-aos-duration="1000"
              >
                <div className="flex items-start">
                  <CheckCircle2 className="w-6 h-6 text-secondary mr-3 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="text-xl font-bold text-dark dark:text-white mb-2">
                      1 Año GRATIS
                    </h4>
                    <p className="text-ld">
                      De facturación y nómina electrónica completamente gratis durante 12 meses
                    </p>
                  </div>
                </div>
              </div>
              
              <div 
                className="bg-white dark:bg-dark rounded-xl shadow-lg p-6 border-l-4 border-success"
                data-aos="fade-right"
                data-aos-delay="400"
                data-aos-duration="1000"
              >
                <div className="flex items-start">
                  <CheckCircle2 className="w-6 h-6 text-success mr-3 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="text-xl font-bold text-dark dark:text-white mb-2">
                      Inteligencia Artificial
                    </h4>
                    <p className="text-ld">
                      Automatización de procesos, análisis predictivo y asistente virtual incluidos
                    </p>
                  </div>
                </div>
              </div>
              
              <div 
                className="bg-white dark:bg-dark rounded-xl shadow-lg p-6 border-l-4 border-warning"
                data-aos="fade-left"
                data-aos-delay="400"
                data-aos-duration="1000"
              >
                <div className="flex items-start">
                  <CheckCircle2 className="w-6 h-6 text-warning mr-3 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="text-xl font-bold text-dark dark:text-white mb-2">
                      Soporte Premium
                    </h4>
                    <p className="text-ld">
                      Capacitación personalizada y soporte técnico prioritario
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Calendly Section */}
        <div className="bg-white dark:bg-dark py-16">
          <div className="container">
            <div 
              className="max-w-5xl mx-auto bg-lightgray dark:bg-darkgray rounded-2xl shadow-2xl p-8 md:p-12"
              data-aos="fade-up"
              data-aos-duration="1000"
            >
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-lightprimary dark:bg-darkprimary rounded-full mb-4">
                  <Calendar className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-3xl md:text-4xl font-bold text-dark dark:text-white mb-4">
                  Agenda tu Demostración
                </h3>
                <p className="text-lg text-ld max-w-2xl mx-auto">
                  Selecciona el día y hora que mejor te convenga para conocer todas las funcionalidades de Guro y activar tu regalo
                </p>
              </div>

              {/* Calendly Widget */}
              <div className="calendly-inline-widget" 
                   data-url="https://calendly.com/gurocontable-info/30min?hide_event_type_details=1&hide_gdpr_banner=1" 
                   style={{ minWidth: '320px', height: '700px' }}>
              </div>
              <script type="text/javascript" src="https://assets.calendly.com/assets/external/widget.js" async></script>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-lightgray dark:bg-darkgray py-16">
          <div className="container">
            <div
              className="max-w-3xl mx-auto text-center"
              data-aos="fade-up"
              data-aos-duration="1000"
            >
              <h3 className="text-2xl md:text-3xl font-bold text-dark dark:text-white mb-4">
                ¿Tienes preguntas?
              </h3>
              <p className="text-lg text-ld mb-8">
                Nuestro equipo está listo para ayudarte
              </p>
              <Button
                as="a"
                href="https://wa.me/573001009305"
                target="_blank"
                rel="noopener noreferrer"
                color="success"
                size="xl"
                className="font-semibold inline-flex items-center gap-2"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
                Contactar por WhatsApp
              </Button>
            </div>
          </div>
        </div>

        <Footer />
      </div>
    </Flowbite>
  );
};

export default Regalo;