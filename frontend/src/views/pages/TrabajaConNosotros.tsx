import React, { useState, useRef } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import Navbar from 'src/components/landingpage/framer-landing/Navbar';

interface FormData {
  nombre: string;
  email: string;
  telefono: string;
  ciudad: string;
  experiencia_seguros: string;
  experiencia_crm: string;
  experiencia_anos: string;
  disponibilidad: string;
  aspiracion_salarial: string;
  linkedin: string;
  mensaje: string;
  hojaDeVida: File | null;
}

const initialForm: FormData = {
  nombre: '',
  email: '',
  telefono: '',
  ciudad: '',
  experiencia_seguros: '',
  experiencia_crm: '',
  experiencia_anos: '',
  disponibilidad: '',
  aspiracion_salarial: '',
  linkedin: '',
  mensaje: '',
  hojaDeVida: null,
};

const FONT = "'General Sans', sans-serif";

const TrabajaConNosotros: React.FC = () => {
  const [form, setForm] = useState<FormData>(initialForm);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef(null);
  const whyRef = useRef(null);
  const isFormInView = useInView(formRef, { once: true, margin: '-80px' });
  const isWhyInView = useInView(whyRef, { once: true, margin: '-80px' });

  const steps = [
    { title: 'Datos personales', icon: 'solar:user-bold-duotone' },
    { title: 'Experiencia', icon: 'solar:case-bold-duotone' },
    { title: 'Hoja de vida', icon: 'solar:document-add-bold-duotone' },
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setForm({ ...form, hojaDeVida: file });
    setFileName(file?.name || '');
  };

  const canNext = () => {
    if (step === 0) return form.nombre && form.email && form.telefono && form.ciudad;
    if (step === 1) return form.experiencia_seguros && form.experiencia_anos && form.disponibilidad;
    if (step === 2) return form.hojaDeVida !== null;
    return false;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (v instanceof File) fd.append(k, v);
        else if (v) fd.append(k, v as string);
      });
      await fetch('https://app.guro.co/api/saas/aplicaciones-empleo', {
        method: 'POST',
        body: fd,
      }).catch(() => {});
      setSubmitted(true);
    } catch {
      setSubmitted(true);
    }
    setSubmitting(false);
  };

  /* ─── SUCCESS STATE ─── */
  if (submitted) {
    return (
      <div className="light min-h-screen bg-white overflow-x-hidden" data-theme="light" style={{ fontFamily: FONT, colorScheme: 'light' }}>
        <Navbar />
        <section className="relative overflow-hidden min-h-screen flex flex-col items-center justify-center"
          style={{ backgroundImage: 'url(https://framerusercontent.com/images/jBUMVVFjKCBRw4l4EEvLSAq3ik4.png?width=2880&height=2190)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
          <motion.div initial={{ opacity: 0, y: 40, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="text-center max-w-lg mx-auto px-6">
            <div className="w-20 h-20 rounded-full bg-[#573CFF] flex items-center justify-center mx-auto mb-8">
              <Icon icon="solar:check-circle-bold" className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white leading-[1.1] tracking-[-0.02em] mb-4" style={{ fontFamily: FONT }}>
              ¡Aplicación enviada!
            </h1>
            <p className="text-lg text-white/50 mb-10">Gracias por tu interés en Guro. Revisaremos tu perfil y nos pondremos en contacto contigo pronto.</p>
            <a href="/" className="group relative inline-flex items-center bg-[#0d0d0d] rounded-2xl h-[52px] overflow-hidden">
              <span className="absolute inset-y-0 left-0 w-[52px] group-hover:w-full bg-[#573CFF] rounded-2xl transition-all duration-300 ease-out" />
              <span className="relative z-10 flex items-center justify-center w-[52px] h-full flex-shrink-0">
                <Icon icon="solar:arrow-left-linear" className="w-5 h-5 text-white" />
              </span>
              <span className="relative z-10 pl-2 pr-5 text-[11px] font-bold text-white uppercase tracking-[0.15em] whitespace-nowrap">Volver a Guro</span>
            </a>
          </motion.div>
        </section>
      </div>
    );
  }

  /* ─── MAIN PAGE ─── */
  return (
    <div className="light min-h-screen bg-white overflow-x-hidden" data-theme="light" style={{ fontFamily: FONT, colorScheme: 'light' }}>
      <Navbar />

      {/* ═══════ HERO ═══════ */}
      <section className="relative overflow-hidden min-h-[85vh] flex flex-col"
        style={{ backgroundImage: 'url(https://framerusercontent.com/images/jBUMVVFjKCBRw4l4EEvLSAq3ik4.png?width=2880&height=2190)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
        {/* Grain */}
        <div className="pointer-events-none absolute inset-0 z-[5] mix-blend-overlay"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.7'/%3E%3C/svg%3E")`, backgroundRepeat: 'repeat', backgroundSize: '200px 200px', opacity: 0.18 }} />

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center max-w-[990px] mx-auto px-4 sm:px-6 lg:px-8 pt-32 sm:pt-40 pb-20 sm:pb-28 text-center">
          {/* Badge */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="flex items-center gap-2 mb-6">
            <div className="w-6 h-6 rounded flex items-center justify-center bg-[#573CFF]">
              <Icon icon="solar:case-bold" className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#573CFF]" style={{ color: '#a5b4fc' }}>Estamos contratando</span>
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 40, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="text-[2rem] sm:text-[3rem] md:text-[3.5rem] lg:text-[4rem] font-bold text-white leading-[1.05] tracking-[-0.03em] mb-6" style={{ fontFamily: FONT }}>
            Ejecutivo Comercial
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 25, filter: 'blur(8px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="text-[1.1rem] sm:text-[1.5rem] md:text-[1.75rem] font-bold text-white/50 max-w-[750px] mx-auto mb-4 leading-[1.15] tracking-[-0.01em]">
            En Guro, la plataforma tecnológica para agencias de seguros, seguimos creciendo y queremos sumar a nuestro equipo.
          </motion.p>

          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.5 }}
            className="text-sm text-white/40 italic mb-10">(sí, puedes ganar comisiones sin techo)</motion.p>

          {/* Quick pills */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.5 }}
            className="flex flex-wrap items-center justify-center gap-3 mb-10">
            {[
              { icon: 'solar:map-point-bold', text: 'Medellín / Bello' },
              { icon: 'solar:clock-circle-bold', text: 'Tiempo completo' },
              { icon: 'solar:buildings-bold', text: 'Presencial' },
              { icon: 'solar:wallet-money-bold', text: 'SMLV + Comisiones' },
            ].map((p) => (
              <div key={p.text} className="flex items-center gap-1.5 text-[13px] text-white/50">
                <Icon icon={p.icon} className="w-4 h-4 text-white/50" />
                <span>{p.text}</span>
              </div>
            ))}
          </motion.div>

          {/* CTA */}
          <motion.div initial={{ opacity: 0, y: 30, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.6, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
            <a href="#aplicar" className="group relative inline-flex items-center bg-[#0d0d0d] rounded-2xl h-[56px] shadow-2xl shadow-black/30 overflow-hidden">
              <span className="absolute inset-y-0 left-0 w-[56px] group-hover:w-full bg-[#573CFF] rounded-2xl transition-all duration-300 ease-out" />
              <span className="relative z-10 flex items-center justify-center w-[56px] h-full flex-shrink-0">
                <Icon icon="solar:arrow-right-linear" className="w-5 h-5 text-white" />
              </span>
              <span className="relative z-10 pl-2 pr-6 text-[11px] sm:text-xs font-bold text-white uppercase tracking-[0.15em] whitespace-nowrap">Aplicar ahora</span>
            </a>
          </motion.div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-32 z-[6] bg-gradient-to-t from-white to-transparent" />
      </section>

      {/* ═══════ JOB DETAILS — White section like Features ═══════ */}
      <section className="py-20 sm:py-28 bg-white">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section header */}
          <motion.div ref={formRef} initial={{ opacity: 0, y: 30, filter: 'blur(6px)' }} animate={isFormInView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="text-center mb-16 sm:mb-24">
            <h2 className="text-3xl sm:text-4xl lg:text-[3.25rem] font-bold text-[#0d0d0d] leading-[1.1] tracking-[-0.02em] mb-4" style={{ fontFamily: FONT }}>
              ¿Tienes experiencia en seguros<span className="hidden sm:inline"><br /></span>{' '}y te apasionan las ventas?
            </h2>
            <p className="text-[1.25rem] sm:text-[1.5rem] font-bold text-gray-400 max-w-2xl mx-auto leading-[1.2] tracking-[-0.01em]">
              Buscamos alguien con ganas de crecer en una startup que está transformando el sector asegurador.
            </p>
          </motion.div>

          {/* Two columns: Requirements + Conditions */}
          <div className="flex flex-col lg:flex-row items-start gap-10 lg:gap-16 mb-20 sm:mb-32">
            {/* Requirements */}
            <motion.div className="w-full lg:w-1/2"
              initial={{ opacity: 0, x: -40 }} animate={isFormInView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}>
              <div className="flex items-center gap-2 mb-5">
                <div className="w-6 h-6 rounded flex items-center justify-center bg-[#573CFF]">
                  <Icon icon="solar:magnifer-bold" className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#573CFF]">Perfil que buscamos</span>
              </div>
              <h3 className="text-2xl sm:text-[1.75rem] lg:text-[2rem] font-bold text-[#0d0d0d] leading-[1.15] tracking-tight mb-6" style={{ fontFamily: FONT }}>
                Experiencia comercial en el mundo de los seguros
              </h3>
              <ul className="space-y-3">
                {[
                  'Experiencia en el nicho de seguros (agencias, corredores o aseguradoras)',
                  'Conocimiento y manejo de CRMs',
                  'Habilidades comerciales, negociación y cierre de ventas',
                  'Persona proactiva, organizada y orientada a resultados',
                ].map((b, bi) => (
                  <motion.li key={b} className="flex items-start gap-3 text-[15px] text-gray-600 leading-relaxed"
                    initial={{ opacity: 0, x: -15 }} animate={isFormInView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.4, delay: 0.3 + bi * 0.1 }}>
                    <span className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-[#0d0d0d]" />
                    {b}
                  </motion.li>
                ))}
              </ul>
            </motion.div>

            {/* Conditions */}
            <motion.div className="w-full lg:w-1/2"
              initial={{ opacity: 0, x: 40 }} animate={isFormInView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}>
              <div className="flex items-center gap-2 mb-5">
                <div className="w-6 h-6 rounded flex items-center justify-center bg-[#573CFF]">
                  <Icon icon="solar:wallet-bold" className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#573CFF]">Condiciones</span>
              </div>
              <h3 className="text-2xl sm:text-[1.75rem] lg:text-[2rem] font-bold text-[#0d0d0d] leading-[1.15] tracking-tight mb-6" style={{ fontFamily: FONT }}>
                Salario + comisiones sin techo
              </h3>
              <ul className="space-y-3">
                {[
                  'Salario mínimo + prestaciones de ley',
                  'Comisiones por ventas con cierre exitoso',
                  'Oportunidad de crecimiento en una startup tecnológica del sector asegurador',
                  'Modalidad presencial en Medellín o Bello — Tiempo completo',
                ].map((b, bi) => (
                  <motion.li key={b} className="flex items-start gap-3 text-[15px] text-gray-600 leading-relaxed"
                    initial={{ opacity: 0, x: -15 }} animate={isFormInView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.4, delay: 0.4 + bi * 0.1 }}>
                    <span className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-[#0d0d0d]" />
                    {b}
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══════ WHY GURO — Gray card like CTAGradient ═══════ */}
      <section ref={whyRef} className="pt-0 pb-10 sm:pb-16 bg-white">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 40, scale: 0.97 }} animate={isWhyInView ? { opacity: 1, y: 0, scale: 1 } : {}} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="bg-[#f5f5f5] rounded-[28px] overflow-hidden">
            <div className="p-6 sm:p-12 lg:p-14">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-6 h-6 rounded flex items-center justify-center bg-[#573CFF]">
                  <Icon icon="solar:star-bold" className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#573CFF]">¿Por qué Guro?</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-[#0d0d0d] leading-[1.1] tracking-[-0.02em] mb-10" style={{ fontFamily: FONT }}>
                Únete a una startup en crecimiento
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {[
                  { icon: 'solar:rocket-2-bold', title: 'Tecnología de punta', desc: 'Trabaja con IA, WhatsApp API y herramientas modernas para el sector asegurador.' },
                  { icon: 'solar:graph-up-bold', title: 'Crecimiento real', desc: 'Comisiones sin techo. Tu esfuerzo se refleja directamente en tus ingresos.' },
                  { icon: 'solar:users-group-rounded-bold', title: 'Equipo increíble', desc: 'Un equipo joven, dinámico y apasionado por transformar la industria.' },
                ].map((item, i) => (
                  <motion.div key={item.title}
                    initial={{ opacity: 0, y: 20 }} animate={isWhyInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
                    className="bg-white rounded-2xl p-6 border border-gray-100">
                    <div className="w-10 h-10 rounded-xl bg-[#573CFF]/10 flex items-center justify-center mb-4">
                      <Icon icon={item.icon} className="w-5 h-5 text-[#573CFF]" />
                    </div>
                    <h3 className="text-[15px] font-bold text-[#0d0d0d] mb-2">{item.title}</h3>
                    <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════ APPLICATION FORM — Dark hero-like section ═══════ */}
      <section id="aplicar" className="relative overflow-hidden py-20 sm:py-28"
        style={{ backgroundColor: '#0d0d0d' }}>

        <div className="relative z-10 max-w-[560px] mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold text-white leading-[1.1] tracking-[-0.02em] mb-4" style={{ fontFamily: FONT }}>Aplica ahora</h2>
            <p className="text-white/50 text-[15px]">Completa el formulario y adjunta tu hoja de vida</p>
          </div>

          {/* Form card */}
          <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[24px] p-6 sm:p-8">
            {/* Step indicator */}
            <div className="flex items-center gap-0 mb-8">
              {steps.map((s, i) => (
                <React.Fragment key={i}>
                  <div className="flex items-center gap-2 cursor-pointer" onClick={() => { if (i < step) setStep(i); }}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 ${i <= step ? 'bg-[#573CFF]' : 'bg-white/5 border border-white/10'}`}>
                      {i < step
                        ? <Icon icon="solar:check-read-bold" className="w-3.5 h-3.5 text-white" />
                        : <Icon icon={s.icon} className={`w-3.5 h-3.5 ${i === step ? 'text-white' : 'text-white/30'}`} />}
                    </div>
                    <span className={`text-xs font-semibold transition-colors ${i === step ? 'text-white' : 'text-white/30'} ${i === step ? '' : 'hidden sm:inline'}`}>{s.title}</span>
                  </div>
                  {i < steps.length - 1 && <div className={`flex-1 h-0.5 mx-2 rounded transition-colors duration-300 ${i < step ? 'bg-[#573CFF]' : 'bg-white/10'}`} />}
                </React.Fragment>
              ))}
            </div>

            {/* Steps */}
            <AnimatePresence mode="wait">
              <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}
                className="flex flex-col gap-4">
                {step === 0 && <>
                  <InputField label="Nombre completo *" name="nombre" value={form.nombre} onChange={handleChange} placeholder="Ej: Juan Carlos Pérez" icon="solar:user-bold-duotone" />
                  <InputField label="Correo electrónico *" name="email" type="email" value={form.email} onChange={handleChange} placeholder="tu@email.com" icon="solar:letter-bold-duotone" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InputField label="Teléfono *" name="telefono" type="tel" value={form.telefono} onChange={handleChange} placeholder="+57 300 000 0000" icon="solar:phone-bold-duotone" />
                    <SelectField label="Ciudad *" name="ciudad" value={form.ciudad} onChange={handleChange} options={['', 'Medellín', 'Bello', 'Envigado', 'Itagüí', 'Sabaneta', 'Otra']} icon="solar:map-point-bold-duotone" />
                  </div>
                </>}
                {step === 1 && <>
                  <SelectField label="¿Tienes experiencia en seguros? *" name="experiencia_seguros" value={form.experiencia_seguros} onChange={handleChange}
                    options={['', 'Sí, en agencia de seguros', 'Sí, en corredora de seguros', 'Sí, en aseguradora', 'Sí, como asesor independiente', 'No, pero tengo experiencia comercial']}
                    icon="solar:shield-check-bold-duotone" />
                  <SelectField label="Años de experiencia comercial *" name="experiencia_anos" value={form.experiencia_anos} onChange={handleChange}
                    options={['', 'Menos de 1 año', '1 a 3 años', '3 a 5 años', 'Más de 5 años']}
                    icon="solar:calendar-bold-duotone" />
                  <SelectField label="¿Manejas algún CRM?" name="experiencia_crm" value={form.experiencia_crm} onChange={handleChange}
                    options={['', 'Sí, Salesforce', 'Sí, HubSpot', 'Sí, Zoho', 'Sí, otro CRM', 'No, pero aprendo rápido']}
                    icon="solar:monitor-bold-duotone" />
                  <SelectField label="Disponibilidad *" name="disponibilidad" value={form.disponibilidad} onChange={handleChange}
                    options={['', 'Inmediata', 'En 15 días', 'En 1 mes', 'En más de 1 mes']}
                    icon="solar:clock-circle-bold-duotone" />
                  <InputField label="Perfil de LinkedIn (opcional)" name="linkedin" value={form.linkedin} onChange={handleChange} placeholder="https://linkedin.com/in/tu-perfil" icon="solar:link-bold-duotone" />
                </>}
                {step === 2 && <>
                  <div onClick={() => fileRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition-all duration-300 ${fileName ? 'border-[#573CFF] bg-[#573CFF]/5' : 'border-white/15 bg-white/[0.02] hover:border-white/25'}`}>
                    <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" onChange={handleFile} className="hidden" />
                    {fileName ? (
                      <>
                        <Icon icon="solar:document-bold-duotone" className="w-10 h-10 text-[#573CFF] mx-auto mb-3" />
                        <p className="text-white text-sm font-semibold mb-1">{fileName}</p>
                        <p className="text-white/40 text-xs">Clic para cambiar archivo</p>
                      </>
                    ) : (
                      <>
                        <Icon icon="solar:cloud-upload-bold-duotone" className="w-10 h-10 text-white/30 mx-auto mb-3" />
                        <p className="text-white/60 text-sm font-semibold mb-1">Sube tu hoja de vida</p>
                        <p className="text-white/35 text-xs">PDF, DOC o DOCX (máx. 5MB)</p>
                      </>
                    )}
                  </div>
                  <InputField label="Aspiración salarial (opcional)" name="aspiracion_salarial" value={form.aspiracion_salarial} onChange={handleChange} placeholder="Ej: $1.800.000" icon="solar:wallet-money-bold-duotone" />
                  <div>
                    <label style={{ color: '#ffffff', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, display: 'block' }}>Mensaje adicional (opcional)</label>
                    <textarea name="mensaje" value={form.mensaje} onChange={handleChange} placeholder="Cuéntanos por qué te interesa esta posición..." rows={3}
                      className="w-full p-3 rounded-xl border border-white/10 bg-white/[0.04] text-sm resize-vertical outline-none focus:border-[#573CFF]/50 transition-colors"
                      style={{ color: '#ffffff', fontFamily: 'inherit' }} />
                  </div>
                </>}
              </motion.div>
            </AnimatePresence>

            {/* Nav buttons */}
            <div className="flex gap-3 mt-7">
              {step > 0 && (
                <button onClick={() => setStep(step - 1)}
                  className="flex-1 h-[48px] rounded-2xl border border-white/10 bg-transparent text-white/60 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-white/5 transition-colors cursor-pointer">
                  <Icon icon="solar:arrow-left-linear" className="w-4 h-4" /> Anterior
                </button>
              )}
              {step < 2 ? (
                <button onClick={() => canNext() && setStep(step + 1)} disabled={!canNext()}
                  className={`flex-1 group relative inline-flex items-center justify-center rounded-2xl h-[48px] overflow-hidden transition-all ${canNext() ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'}`}
                  style={{ background: canNext() ? '#0d0d0d' : 'rgba(255,255,255,0.05)' }}>
                  {canNext() && <span className="absolute inset-y-0 left-0 w-0 group-hover:w-full bg-[#573CFF] rounded-2xl transition-all duration-300 ease-out" />}
                  <span className="relative z-10 text-[11px] font-bold text-white uppercase tracking-[0.15em] flex items-center gap-2">
                    Siguiente <Icon icon="solar:arrow-right-linear" className="w-4 h-4" />
                  </span>
                </button>
              ) : (
                <button onClick={() => canNext() && !submitting && handleSubmit()} disabled={!canNext() || submitting}
                  className={`flex-1 group relative inline-flex items-center justify-center rounded-2xl h-[48px] overflow-hidden transition-all ${canNext() && !submitting ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'}`}
                  style={{ background: canNext() ? '#0d0d0d' : 'rgba(255,255,255,0.05)' }}>
                  {canNext() && !submitting && <span className="absolute inset-y-0 left-0 w-0 group-hover:w-full bg-[#573CFF] rounded-2xl transition-all duration-300 ease-out" />}
                  <span className="relative z-10 text-[11px] font-bold text-white uppercase tracking-[0.15em] flex items-center gap-2">
                    {submitting ? <><Icon icon="solar:refresh-bold-duotone" className="w-4 h-4 animate-spin" /> Enviando...</> : <>Enviar aplicación <Icon icon="solar:check-circle-bold" className="w-4 h-4" /></>}
                  </span>
                </button>
              )}
            </div>

            <p className="text-[10px] text-center mt-4" style={{ color: '#0d0d0d' }}>
              Al enviar aceptas que tus datos serán tratados según nuestra <a href="/politica-privacidad" className="underline" style={{ color: '#0d0d0d' }}>política de privacidad</a>.
            </p>
          </div>
        </div>
      </section>

    </div>
  );
};

/* ── Reusable input field — Guro style ── */
const InputField: React.FC<{
  label: string; name: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string; type?: string; icon?: string;
}> = ({ label, name, value, onChange, placeholder, type = 'text', icon }) => (
  <div>
    <label style={{ color: '#ffffff', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, display: 'block' }}>{label}</label>
    <div className="relative">
      {icon && <Icon icon={icon} className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'rgba(255,255,255,0.3)' }} />}
      <input type={type} name={name} value={value} onChange={onChange} placeholder={placeholder}
        className={`w-full ${icon ? 'pl-9' : 'pl-3'} pr-3 py-3 rounded-xl border border-white/10 bg-white/[0.04] text-sm outline-none focus:border-[#573CFF]/50 transition-colors`}
        style={{ color: '#ffffff', fontFamily: 'inherit' }} />
    </div>
  </div>
);

/* ── Reusable select field — Guro style ── */
const SelectField: React.FC<{
  label: string; name: string; value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: string[]; icon?: string;
}> = ({ label, name, value, onChange, options, icon }) => (
  <div>
    <label style={{ color: '#ffffff', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, display: 'block' }}>{label}</label>
    <div className="relative">
      {icon && <Icon icon={icon} className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'rgba(255,255,255,0.3)' }} />}
      <select name={name} value={value} onChange={onChange}
        className={`w-full ${icon ? 'pl-9' : 'pl-3'} pr-8 py-3 rounded-xl border border-white/10 bg-white/[0.04] text-sm outline-none focus:border-[#573CFF]/50 transition-colors appearance-none`}
        style={{ color: value ? '#ffffff' : 'rgba(255,255,255,0.25)', fontFamily: 'inherit', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M6 8L1 3h10z' fill='rgba(255,255,255,0.3)'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}>
        {options.map((o, i) => (
          <option key={i} value={o} style={{ background: '#1a1a2e', color: o ? '#fff' : '#666' }}>
            {o || 'Selecciona una opción'}
          </option>
        ))}
      </select>
    </div>
  </div>
);

export default TrabajaConNosotros;
