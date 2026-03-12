import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useUnifiedAuth } from 'src/context/UnifiedAuthContext';
import saasApi from 'src/services/saasApi';
import freepikService, {
  type GeneratedImage,
  type FreepikResource,
  type ImageSize,
  SOCIAL_FORMATS,
} from 'src/services/freepikService';
import ContentPlanner from './ContentPlanner';
import { walletApi } from 'src/services/api/walletApi';

// ─── Persistence ─────────────────────────────────────────────────────
interface SavedImage { id: string; src: string; prompt: string; ts: number; favorite?: boolean; }
const SK = 'guro_studio_v2';
const load = (): SavedImage[] => { try { return JSON.parse(localStorage.getItem(SK) || '[]'); } catch { return []; } };
const persist = (list: SavedImage[]) => { try { localStorage.setItem(SK, JSON.stringify(list)); } catch {} };
const uid = () => `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const MAX_HISTORY = 80;

type View = 'home' | 'generate' | 'inspire' | 'upload' | 'history' | 'planner';

// ═════════════════════════════════════════════════════════════════════
// PARTICLE BLOB
// ═════════════════════════════════════════════════════════════════════
const ParticleBlob = () => {
  const ref = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    let w = 0, h = 0, raf = 0;

    const fit = () => {
      const r = c.parentElement!.getBoundingClientRect();
      w = r.width; h = r.height;
      c.width = w * devicePixelRatio; c.height = h * devicePixelRatio;
      c.style.width = `${w}px`; c.style.height = `${h}px`;
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      build();
    };

    type P = {
      bx: number; by: number;
      x: number; y: number;
      ro: number; ao: number;
      s: number; phase: number; speed: number; o: number; sc: number;
    };
    let pts: P[] = [];
    const N = 420;

    // Large deformed arc — organic wobble
    const ringR = (angle: number, R: number, t: number) => {
      return R
        + Math.sin(angle * 2.0 + t * 0.3) * R * 0.10
        + Math.sin(angle * 3.0 - t * 0.2) * R * 0.07
        + Math.cos(angle * 5.0 + t * 0.4) * R * 0.05
        + Math.sin(angle * 8.0 - t * 0.15) * R * 0.03;
    };

    const build = () => {
      const old = pts.length;
      const cx = w / 2, cy = h / 2;
      const R = Math.min(w, h) * 0.42;
      const np: P[] = [];

      for (let i = 0; i < N; i++) {
        const t = i / N;
        const angle = t * Math.PI * 2;

        // Extra-wide scatter band so final shape stays dotted (not a tight ribbon)
        const rOff = (Math.random() - 0.5) * 240;
        // Larger angular offset so dots stay visually separated
        const aOff = (Math.random() - 0.5) * 0.18;
        const r = ringR(angle, R, 0) + rOff;
        const bx = cx + Math.cos(angle + aOff) * r;
        const by = cy + Math.sin(angle + aOff) * r;

        // Dots closer to the ring center are brighter, outer ones dimmer
        const distFromRing = Math.abs(rOff) / 120;
        const baseOpacity = 0.12 + (1 - distFromRing) * 0.5;

        np.push({
          bx, by,
          x: old > 0 && pts[i] ? pts[i].x : Math.random() * w,
          y: old > 0 && pts[i] ? pts[i].y : Math.random() * h,
          ro: rOff,
          ao: aOff,
          s: 0.9 + Math.random() * 1.7,
          phase: Math.random() * Math.PI * 2,
          speed: 0.1 + Math.random() * 0.4,
          o: baseOpacity,
          sc: 0,
        });
      }
      pts = np;
    };

    fit(); window.addEventListener('resize', fit);
    const mm = (e: MouseEvent) => { const r = c.getBoundingClientRect(); mouse.current = { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const ml = () => { mouse.current = { x: -9999, y: -9999 }; };
    c.addEventListener('mousemove', mm); c.addEventListener('mouseleave', ml);

    let time = 0, entry = 0;
    const isDark = () => document.documentElement.classList.contains('dark');

    const loop = () => {
      time += 0.004;
      ctx.clearRect(0, 0, w, h);
      const dark = isDark();

      // Entry convergence: ~3s
      if (entry < 1) entry = Math.min(1, entry + 0.005);
      const ease = 1 - Math.pow(1 - entry, 3);

      const mx = mouse.current.x, my = mouse.current.y;
      const cx = w / 2, cy = h / 2;
      const R = Math.min(w, h) * 0.42;

      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const angle = (i / N) * Math.PI * 2;

        // Keep each particle's own spread offsets in the final converged state
        const aa = angle + p.ao;
        const rr = ringR(aa, R, time) + p.ro;
        p.bx = cx + Math.cos(aa) * rr;
        p.by = cy + Math.sin(aa) * rr;

        // Gentle drift along the ring
        p.phase += p.speed * 0.002;
        let tx = p.bx + Math.sin(time * 0.8 + p.phase) * 2;
        let ty = p.by + Math.cos(time * 0.6 + p.phase) * 2;

        // Mouse scatter
        const dx = tx - mx, dy = ty - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 100) {
          const force = (1 - dist / 100) * 60;
          const a = Math.atan2(dy, dx);
          tx += Math.cos(a) * force;
          ty += Math.sin(a) * force;
          p.sc = Math.min(p.sc + 0.1, 1);
        } else {
          p.sc = Math.max(p.sc - 0.02, 0);
        }

        // Lerp — slow at start (scattered), faster as they converge
        const lerp = 0.008 + ease * 0.055;
        p.x += (tx - p.x) * lerp;
        p.y += (ty - p.y) * lerp;

        // Draw small dots
        const alpha = p.o * (0.2 + ease * 0.8) * (1 - p.sc * 0.3);
        const sz = p.s * (1 + p.sc * 0.4);

        if (dark) {
          ctx.fillStyle = p.sc > 0.3
            ? `rgba(139,92,246,${alpha})`
            : `rgba(255,255,255,${alpha * 0.7})`;
        } else {
          ctx.fillStyle = p.sc > 0.3
            ? `rgba(139,92,246,${alpha * 0.7})`
            : `rgba(100,80,160,${alpha * 0.35})`;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, sz, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', fit);
      c.removeEventListener('mousemove', mm);
      c.removeEventListener('mouseleave', ml);
    };
  }, []);

  return <canvas ref={ref} className="absolute inset-0 pointer-events-auto" />;
};

// ─── Shared UI ───────────────────────────────────────────────────────
const FadeIn = ({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) => {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), delay); return () => clearTimeout(t); }, [delay]);
  return <div className={`transition-all duration-500 ease-out ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'} ${className}`}>{children}</div>;
};
const Spin = () => <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />;

const GlowingBorder = ({ seconds }: { seconds: number }) => (
  <div className="relative w-[85%] max-w-md aspect-square">
    {/* Outer glow container — clips the rotating gradient to the rounded shape */}
    <div className="absolute inset-0 rounded-2xl overflow-hidden">
      {/* Rotating conic gradient — oversized so the glow sweeps around the border */}
      <div className="absolute inset-[-50%] animate-[glowSpin_4s_linear_infinite]" style={{
        background: 'conic-gradient(from 0deg, transparent 0%, transparent 50%, #6d28d9 65%, #a78bfa 75%, #c4b5fd 80%, #a78bfa 85%, #6d28d9 95%, transparent 100%)',
      }} />
      {/* Inner cutout — creates the "border only" effect */}
      <div className="absolute inset-[2px] rounded-[14px] bg-gray-100 dark:bg-[#0e0e0e]" />
    </div>
    {/* Soft outer glow shadow */}
    <div className="absolute inset-0 rounded-2xl animate-[glowPulse_4s_ease-in-out_infinite]" style={{
      boxShadow: '0 0 30px 4px rgba(139, 92, 246, 0.15), 0 0 60px 8px rgba(139, 92, 246, 0.05)',
    }} />
    {/* Content */}
    <div className="absolute inset-[2px] rounded-[14px] flex flex-col items-center justify-end pb-8 gap-2 z-10">
      <p className="text-[13px] text-gray-500 dark:text-gray-400 font-medium">Se está generando la imagen...</p>
      <span className="text-[11px] text-gray-400 dark:text-gray-600 tabular-nums">{seconds}s</span>
    </div>
    <style>{`
      @keyframes glowSpin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      @keyframes glowPulse {
        0%, 100% { opacity: 0.6; }
        50% { opacity: 1; }
      }
    `}</style>
  </div>
);
const PH = ({ icon, title }: { icon: string; title: string }) => (
  <div className="flex items-center gap-2.5 pb-3 mb-3 border-b border-gray-200 dark:border-white/[0.06]">
    <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-500/10 flex items-center justify-center">
      <Icon icon={icon} width={15} className="text-purple-600 dark:text-purple-400" />
    </div>
    <span className="text-[12px] font-bold text-gray-800 dark:text-gray-200">{title}</span>
  </div>
);

// ─── Helper: URL to base64 ───────────────────────────────────────────
const urlToBase64 = async (url: string): Promise<string> => {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(',')[1] || '');
    r.readAsDataURL(blob);
  });
};

// ─── Logo overlay helper ─────────────────────────────────────────────
const overlayLogoOnImage = (imageSrc: string, logoBase64: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const logoImg = new Image();
      logoImg.crossOrigin = 'anonymous';
      logoImg.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        const ctx = c.getContext('2d');
        if (!ctx) { reject(new Error('No canvas context')); return; }
        // Draw the generated image
        ctx.drawImage(img, 0, 0);
        // Calculate logo size: max 15% of image width, maintain aspect ratio
        const maxLogoW = img.width * 0.15;
        const scale = Math.min(maxLogoW / logoImg.width, 1);
        const lw = logoImg.width * scale;
        const lh = logoImg.height * scale;
        // Position: bottom-right corner with padding
        const padding = img.width * 0.03;
        const lx = img.width - lw - padding;
        const ly = img.height - lh - padding;
        // Draw semi-transparent white background behind logo for visibility
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        const bgPad = padding * 0.4;
        ctx.beginPath();
        ctx.roundRect(lx - bgPad, ly - bgPad, lw + bgPad * 2, lh + bgPad * 2, bgPad);
        ctx.fill();
        // Draw the logo
        ctx.drawImage(logoImg, lx, ly, lw, lh);
        resolve(c.toDataURL('image/png'));
      };
      logoImg.onerror = reject;
      logoImg.src = `data:image/png;base64,${logoBase64}`;
    };
    img.onerror = reject;
    img.src = imageSrc;
  });
};

// ═════════════════════════════════════════════════════════════════════
// MAIN
// ═════════════════════════════════════════════════════════════════════
const CreadorContenido = () => {
  const { tenant } = useUnifiedAuth();
  const [view, setView] = useState<View>('home');
  const [canvas, setCanvas] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [refImage, setRefImage] = useState<string | null>(null);
  const [refBase64, setRefBase64] = useState<string | null>(null);
  const [refUrl, setRefUrl] = useState<string | null>(null);
  const [genPrompt, setGenPrompt] = useState('');
  const [editPrompt, setEditPrompt] = useState('');
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState('');
  const [genTimer, setGenTimer] = useState(0);

  useEffect(() => {
    if (!genLoading) { setGenTimer(0); return; }
    const t = setInterval(() => setGenTimer((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [genLoading]);
  const [selectedSize, setSelectedSize] = useState<ImageSize>('square_1_1');

  // ── Wallet / billing ──
  const COST_PER_IMAGE_COP = 500;
  const formatCOP = (n: number) => '$' + n.toLocaleString('es-CO') + ' COP';
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const refreshWallet = useCallback(async () => {
    try {
      const res = await walletApi.getBalance();
      if (res.success && res.data) setWalletBalance(res.data.balance_cop);
      else setWalletBalance(null);
    } catch { setWalletBalance(null); }
    finally { setWalletLoading(false); }
  }, []);
  useEffect(() => { refreshWallet(); }, [refreshWallet]);

  // Fetch agency info directly for accurate logo and branding
  const [agencyLogo, setAgencyLogo] = useState<string | null>(null);
  const [agencyLogoBase64, setAgencyLogoBase64] = useState<string | null>(null);
  const [useLogo, setUseLogo] = useState(true);
  const [agencyName, setAgencyName] = useState<string>('');
  const [agencyPrimaryColor, setAgencyPrimaryColor] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        const headers = await (saasApi as any).getAuthHeaders();
        const resp = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:8081/api'}/saas/informacion-agencia`,
          { headers },
        );
        if (!resp.ok) return;
        const json = await resp.json();
        if (!json.success || !json.data) return;
        const b = json.data;
        if (b.logo_url) {
          setAgencyLogo(b.logo_url);
          // Fetch logo image and convert to base64 so we can pass it to the AI
          try {
            const logoResp = await fetch(b.logo_url, { headers: await (saasApi as any).getAuthHeaders() });
            if (logoResp.ok) {
              const blob = await logoResp.blob();
              const reader = new FileReader();
              reader.onload = () => {
                const dataUrl = reader.result as string;
                const b64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
                setAgencyLogoBase64(b64);
                console.log('✅ Logo de agencia cargado como base64 para IA');
              };
              reader.readAsDataURL(blob);
            }
          } catch (logoErr) {
            console.warn('No se pudo convertir logo a base64:', logoErr);
          }
        }
        if (b.name || b.nombre) setAgencyName(b.name || b.nombre || '');
        const br = b.branding || {};
        if (br.primary_color) setAgencyPrimaryColor(br.primary_color);
      } catch (e) {
        console.warn('CreadorContenido: no se pudo cargar info de agencia', e);
      }
    })();
  }, []);

  const logo = agencyLogo || tenant?.logo_url || tenant?.branding?.logo || (tenant as any)?.logo || null;
  const name = agencyName || tenant?.branding?.nombre_comercial || (tenant as any)?.name || tenant?.nombre || '';
  const agencyColors = useMemo(() => {
    const c: string[] = [];
    // Prefer the directly fetched primary color
    if (agencyPrimaryColor) { c.push(agencyPrimaryColor); return c; }
    const b = tenant?.branding;
    if (b?.primary_color) c.push(b.primary_color); else if (b?.colores?.primario) c.push(b.colores.primario);
    return c.filter(Boolean);
  }, [tenant, agencyPrimaryColor]);

  const download = () => { if (!canvas) return; const a = document.createElement('a'); a.href = canvas; a.download = `design-${Date.now()}.png`; a.click(); };

  // Auto-save to history (called after every successful generation)
  const [currentImageId, setCurrentImageId] = useState<string | null>(null);
  const autoSave = useCallback((src: string, prompt: string) => {
    const list = load();
    // Avoid duplicates by checking if same src already exists (shouldn't happen, but safety)
    const newId = uid();
    list.unshift({ id: newId, src, prompt, ts: Date.now() });
    while (list.length > MAX_HISTORY) list.pop();
    persist(list);
    setCurrentImageId(newId);
  }, []);

  // Toggle favorite on current image
  const [favVersion, setFavVersion] = useState(0);
  const toggleFavorite = useCallback(() => {
    if (!currentImageId) return;
    const list = load();
    const idx = list.findIndex(i => i.id === currentImageId);
    if (idx >= 0) { list[idx].favorite = !list[idx].favorite; persist(list); setFavVersion(v => v + 1); }
  }, [currentImageId]);

  const isFavorite = useMemo(() => {
    if (!currentImageId) return false;
    const list = load();
    return list.find(i => i.id === currentImageId)?.favorite ?? false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentImageId, favVersion]);

  // Generate: uses Flux Kontext Pro for reference-based, Gemini for text-only/edits
  const generate = useCallback(async (promptOverride?: string, isEdit?: boolean) => {
    let full = (promptOverride || genPrompt).trim();
    const hasRef = refUrl || refBase64 || (isEdit && canvas);

    if (!full && !hasRef) { setGenError('Escribe qué quieres crear'); return; }

    // Wallet balance check
    if (walletBalance !== null && walletBalance < COST_PER_IMAGE_COP) {
      setGenError(`Saldo insuficiente. Necesitas ${formatCOP(COST_PER_IMAGE_COP)} por imagen. Tu saldo: ${formatCOP(walletBalance)}. Recarga tu wallet.`);
      return;
    }

    // Strong prompt for reference-based generation — tells AI to closely follow the reference
    if (hasRef && !full) {
      full = 'Closely replicate this exact design. Keep the same layout, composition, colors, typography style, and visual elements. Only adapt the text and branding.';
    } else if (hasRef && full) {
      full = `Using the reference image as the primary visual guide, closely follow its layout, composition, and style. ${full}`;
    }
    if (name) full = `${full}. Brand: "${name}"`;
    if (agencyColors.length > 0) full = `${full}. Use brand colors: ${agencyColors.join(', ')}`;
    if (name) full = `${full}. Include the brand name "${name}" as visible text in the design.`;

    setGenLoading(true); setGenError('');
    try {
      let generatedSrc: string | null = null;

      // For edits: use Gemini with the current canvas as base64
      if (isEdit && canvas) {
        const imageRef = canvas.replace(/^data:image\/\w+;base64,/, '');
        const res = await freepikService.generateImage({
          prompt: full, num_images: 1, image: { size: selectedSize },
          aiModel: 'gemini', autoImprovePrompt: false,
          referenceImage: imageRef,
        });
        if (res.data[0]) generatedSrc = `data:image/png;base64,${res.data[0].base64}`;
      } else {
        const res = await freepikService.generateImage({
          prompt: full, num_images: 1, image: { size: selectedSize },
          autoImprovePrompt: false,
          referenceImageUrl: refUrl || undefined,
          referenceImage: !refUrl ? (refBase64 || undefined) : undefined,
        });
        if (res.data[0]) generatedSrc = `data:image/png;base64,${res.data[0].base64}`;
      }

      // After generation, overlay the agency logo on the image (if toggle is on)
      if (generatedSrc && useLogo && agencyLogoBase64) {
        try {
          const overlayed = await overlayLogoOnImage(generatedSrc, agencyLogoBase64);
          generatedSrc = overlayed;
        } catch (overlayErr) {
          console.warn('No se pudo superponer el logo:', overlayErr);
        }
      }

      if (generatedSrc) {
        setCanvas(generatedSrc); setLabel(full); setEditPrompt('');
        autoSave(generatedSrc, full);
        // Charge wallet
        try {
          const charge = await walletApi.chargeStudio(1, 'Guro Studio: imagen generada');
          if (charge.success && charge.data?.balance_cop !== undefined) {
            setWalletBalance(charge.data.balance_cop);
          } else if (!charge.success) {
            console.warn('Wallet charge failed (post-generation):', charge.message);
          }
        } catch { /* non-blocking */ }
      }
    } catch (e: any) { setGenError(e.message || 'Error al generar'); }
    finally { setGenLoading(false); }
  }, [genPrompt, refUrl, refBase64, canvas, name, agencyColors, selectedSize, agencyLogoBase64, useLogo, autoSave, walletBalance]);

  // Select reference image (from inspire or upload)
  const selectRef = useCallback(async (src: string) => {
    setRefImage(src); setCanvas(null); setLabel(''); setGenPrompt(''); setGenError('');
    setView('generate');

    if (src.startsWith('data:')) {
      // Uploaded file — use base64, no URL available
      setRefUrl(null);
      setRefBase64(src.replace(/^data:image\/\w+;base64,/, ''));
    } else {
      // URL from Freepik search — store URL for Flux Kontext Pro (much better at following references)
      setRefUrl(src);
      setRefBase64(null);
    }
  }, []);

  const goHome = () => {
    setView('home'); setCanvas(null); setRefImage(null); setRefBase64(null); setRefUrl(null);
    setLabel(''); setGenPrompt(''); setEditPrompt(''); setGenError('');
  };

  const NAV: { id: View; icon: string; tip: string }[] = [
    { id: 'home', icon: 'solar:add-circle-linear', tip: 'Nuevo' },
    { id: 'planner', icon: 'solar:calendar-bold-duotone', tip: 'Planificador' },
    { id: 'generate', icon: 'solar:magic-stick-3-linear', tip: 'Generar' },
    { id: 'inspire', icon: 'solar:magnifer-linear', tip: 'Inspiración' },
    { id: 'upload', icon: 'solar:upload-linear', tip: 'Subir' },
    { id: 'history', icon: 'solar:clock-circle-linear', tip: 'Historial' },
  ];

  // Callback for planner to generate images via the same pipeline
  const generateImageForPlanner = useCallback(async (prompt: string, withLogo?: boolean): Promise<string | null> => {
    // Wallet balance check
    if (walletBalance !== null && walletBalance < COST_PER_IMAGE_COP) {
      throw new Error(`Saldo insuficiente. Necesitas ${formatCOP(COST_PER_IMAGE_COP)} por imagen. Saldo: ${formatCOP(walletBalance)}`);
    }
    try {
      let full = prompt;
      if (name) full = `${full}. Brand: "${name}"`;
      if (agencyColors.length > 0) full = `${full}. Use brand colors: ${agencyColors.join(', ')}`;
      if (name) full = `${full}. Include the brand name "${name}" as visible text in the design.`;

      const res = await freepikService.generateImage({
        prompt: full, num_images: 1, image: { size: 'square_1_1' },
        autoImprovePrompt: false,
      });
      if (res.data[0]) {
        let src = `data:image/png;base64,${res.data[0].base64}`;
        // Overlay logo only if requested and available
        if (withLogo !== false && agencyLogoBase64) {
          try { src = await overlayLogoOnImage(src, agencyLogoBase64); } catch {}
        }
        // Charge wallet
        try {
          const charge = await walletApi.chargeStudio(1, 'Guro Studio: imagen planificador');
          if (charge.success && charge.data?.balance_cop !== undefined) {
            setWalletBalance(charge.data.balance_cop);
          }
        } catch { /* non-blocking */ }
        return src;
      }
      return null;
    } catch (e) { throw e; }
  }, [name, agencyColors, agencyLogoBase64, walletBalance]);

  // Inspire/Upload use full-width when no ref selected; sidebar+canvas when ref is chosen
  const hasSelectedRef = !!refImage;
  const fullWidthView = (view === 'inspire' || view === 'upload') && !hasSelectedRef && !canvas;
  const sidebarView = (view === 'generate' || view === 'history') || hasSelectedRef || !!canvas;

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] -mx-2 -mt-2 bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white overflow-hidden rounded-2xl transition-colors duration-300">
      {/* Top bar */}
      {canvas && (
        <div className="flex items-center justify-between px-4 h-10 bg-gray-50 dark:bg-[#111] border-b border-gray-200 dark:border-white/5 shrink-0">
          <div className="flex items-center gap-2">
            {logo && <img src={logo} alt="" className="h-5 w-auto object-contain rounded" />}
            <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">{name || 'Guro'} Studio</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={toggleFavorite} className={`flex items-center gap-1 px-3 py-1 rounded-lg transition-all active:scale-95 ${isFavorite ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-500' : 'bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300'}`}>
              <Icon icon={isFavorite ? 'solar:star-bold' : 'solar:star-linear'} width={12} />
              <span className="text-[10px]">{isFavorite ? 'Favorito' : 'Favorito'}</span>
            </button>
            <button onClick={download} className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-[10px] text-white font-semibold transition-all active:scale-95 shadow-lg shadow-purple-600/20">Descargar</button>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* ── Pill toolbar ── */}
        <div className="w-[52px] shrink-0 flex flex-col items-center pt-4">
          <div className="bg-gray-100 dark:bg-[#161616] rounded-2xl py-2.5 px-1.5 flex flex-col items-center gap-1 border border-gray-200/60 dark:border-white/[0.06] shadow-lg shadow-black/5 dark:shadow-black/40">
            {NAV.map((n) => (
              <button key={n.id} onClick={() => {
                if (n.id === 'home') goHome();
                else { setView(n.id); if (n.id !== 'generate') { setRefImage(null); setRefBase64(null); setRefUrl(null); setCanvas(null); } }
              }} title={n.tip}
                className={`group relative w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
                  view === n.id ? 'bg-purple-100 dark:bg-white/10 text-purple-600 dark:text-white' : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-white/5'
                } active:scale-90`}>
                <Icon icon={n.icon} width={17} />
                <div className="absolute left-full ml-2 px-2 py-0.5 rounded-md bg-gray-800 dark:bg-[#222] text-[9px] font-medium text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 z-50 shadow-xl">{n.tip}</div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Home ── */}
        {view === 'home' && (
          <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-transparent dark:via-transparent dark:to-transparent" />
            <div className="absolute inset-0"><ParticleBlob /></div>
            <div className="relative z-10 text-center">
              <FadeIn><h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Tu espacio está listo</h2></FadeIn>
              <FadeIn delay={100}><p className="text-[11px] text-gray-500 mb-8">{name ? `${name} — ` : ''}Elige una opción y empieza a crear</p></FadeIn>
              <div className="flex gap-3 flex-wrap justify-center">
                {[
                  { icon: 'solar:magnifer-bold', label: 'Encontrar\ninspiración', v: 'inspire' as View, delay: 200 },
                  { icon: 'solar:gallery-add-bold', label: 'Generar\nimagen', v: 'generate' as View, accent: true, delay: 300 },
                  { icon: 'solar:calendar-bold', label: 'Planificar\ncontenido', v: 'planner' as View, delay: 350, gradient: true },
                  { icon: 'solar:upload-minimalistic-bold', label: 'Subir\nimagen', v: 'upload' as View, delay: 400 },
                ].map((c) => (
                  <FadeIn key={c.label} delay={c.delay}>
                    <button onClick={() => setView(c.v)}
                      className={`group w-[120px] py-5 rounded-2xl border transition-all duration-300 flex flex-col items-center gap-3 hover:-translate-y-1 active:scale-95 ${
                        (c as any).gradient
                          ? 'bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-500/5 dark:to-purple-500/5 border-indigo-200 dark:border-indigo-500/10 hover:shadow-xl hover:shadow-indigo-500/10'
                          : c.accent
                            ? 'bg-purple-50 dark:bg-purple-500/5 border-purple-200 dark:border-purple-500/10 hover:shadow-xl hover:shadow-purple-500/10'
                            : 'bg-white dark:bg-[#161616] border-gray-200 dark:border-white/[0.04] hover:shadow-xl hover:shadow-black/5 dark:hover:shadow-black/30'
                      }`}>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 ${(c as any).gradient ? 'bg-indigo-100 dark:bg-indigo-500/10' : c.accent ? 'bg-purple-100 dark:bg-purple-500/10' : 'bg-gray-100 dark:bg-white/5'}`}>
                        <Icon icon={c.icon} width={19} className={(c as any).gradient ? 'text-indigo-500 dark:text-indigo-400' : c.accent ? 'text-purple-500 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'} />
                      </div>
                      <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 leading-tight whitespace-pre-line">{c.label}</span>
                    </button>
                  </FadeIn>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Planner view ── */}
        {view === 'planner' && (
          <div className="flex-1 overflow-hidden">
            <ContentPlanner
              agencyName={name}
              agencyColors={agencyColors}
              agencyLogoBase64={agencyLogoBase64}
              onGenerateImage={generateImageForPlanner}
              hasLogo={!!agencyLogoBase64}
            />
          </div>
        )}

        {/* ── Full-width view: Inspire search / Upload zone (centered, no sidebar) ── */}
        {fullWidthView && (
          <div className="flex-1 flex flex-col items-center overflow-auto bg-gray-50 dark:bg-[#0a0a0a] transition-colors">
            <div className="w-full max-w-2xl px-6 py-8">
              <FadeIn>
                {view === 'inspire' && <InspireFull onSelect={selectRef} />}
                {view === 'upload' && <UploadFull onSelect={selectRef} />}
              </FadeIn>
            </div>
          </div>
        )}

        {/* ── Sidebar + Canvas layout (generate, history, or after selecting ref) ── */}
        {view !== 'home' && view !== 'planner' && sidebarView && !fullWidthView && (
          <>
            {/* Left panel */}
            <div className="w-[280px] bg-gray-50 dark:bg-[#111] border-r border-gray-200 dark:border-white/[0.04] overflow-y-auto shrink-0 transition-colors">
              <div className="p-4">
                <FadeIn>
                  {view === 'generate' && (
                    <GeneratePanel
                      prompt={genPrompt} setPrompt={setGenPrompt}
                      loading={genLoading} error={genError}
                      onGenerate={() => generate()}
                      refImage={refImage}
                      clearRef={() => { setRefImage(null); setRefBase64(null); setRefUrl(null); }}
                      hasRef={!!refBase64 || !!refUrl}
                      selectedSize={selectedSize} setSelectedSize={setSelectedSize}
                      useLogo={useLogo} setUseLogo={setUseLogo} hasLogo={!!agencyLogoBase64}
                      walletBalance={walletBalance} costPerImage={COST_PER_IMAGE_COP}
                    />
                  )}
                  {(view === 'inspire' || view === 'upload') && refImage && (
                    <GeneratePanel
                      prompt={genPrompt} setPrompt={setGenPrompt}
                      loading={genLoading} error={genError}
                      onGenerate={() => generate()}
                      refImage={refImage}
                      clearRef={() => { setRefImage(null); setRefBase64(null); setRefUrl(null); }}
                      hasRef={!!refBase64 || !!refUrl}
                      selectedSize={selectedSize} setSelectedSize={setSelectedSize}
                      useLogo={useLogo} setUseLogo={setUseLogo} hasLogo={!!agencyLogoBase64}
                      walletBalance={walletBalance} costPerImage={COST_PER_IMAGE_COP}
                    />
                  )}
                  {view === 'history' && <HistoryPanel onSelect={(src, lbl, id) => { setCanvas(src); setLabel(lbl || ''); if (id) setCurrentImageId(id); setView('generate'); }} />}
                </FadeIn>
              </div>
            </div>

            {/* Right canvas area */}
            <div className="flex-1 flex flex-col items-center justify-center bg-gray-100 dark:bg-[#0a0a0a] overflow-auto transition-colors relative">
              {(canvas || refImage) ? (
                <FadeIn className="flex flex-col items-center gap-4 p-6 w-full max-w-3xl">
                  <div className="flex items-start justify-center gap-4">
                    {refImage && canvas && (
                      <div className="flex flex-col items-center gap-1.5 shrink-0">
                        <span className="text-[9px] font-medium text-gray-400 dark:text-gray-600 uppercase tracking-wider">Referencia</span>
                        <img src={refImage} alt="" className="w-24 h-24 rounded-xl object-cover ring-1 ring-black/5 dark:ring-white/5 shadow-lg" />
                      </div>
                    )}
                    <div className="flex flex-col items-center gap-2">
                      {refImage && !canvas && <span className="text-[9px] font-medium text-gray-400 dark:text-gray-600 uppercase tracking-wider">Imagen de referencia</span>}
                      {canvas && <span className="text-[9px] font-medium text-purple-500 dark:text-purple-400 uppercase tracking-wider">Resultado generado</span>}
                      <img src={canvas || refImage!} alt="" className="max-h-[55vh] max-w-full rounded-2xl shadow-2xl shadow-black/15 dark:shadow-black/50 object-contain ring-1 ring-black/5 dark:ring-white/5" />
                    </div>
                  </div>

                  {canvas && (
                    <FadeIn delay={150} className="w-full max-w-lg">
                      <div className="bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-3 shadow-xl shadow-black/5 dark:shadow-black/30">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon icon="solar:pen-bold" width={13} className="text-purple-500" />
                          <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">Editar resultado</span>
                        </div>
                        <div className="flex gap-2">
                          <input value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)}
                            placeholder="Ej: cambia los colores, agrega texto, hazlo más moderno..."
                            onKeyDown={(e) => e.key === 'Enter' && editPrompt.trim() && generate(editPrompt, true)}
                            className="flex-1 px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] text-[11px] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 dark:focus:border-purple-500/30 transition-all" />
                          <button onClick={() => generate(editPrompt, true)} disabled={genLoading || !editPrompt.trim()}
                            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-30 text-[10px] text-white font-bold transition-all active:scale-95 shadow-lg shadow-purple-600/20 shrink-0">
                            {genLoading ? <Spin /> : 'Editar'}
                          </button>
                        </div>
                        {genLoading && <p className="text-[9px] text-gray-400 text-center mt-2 animate-pulse">Editando imagen... {genTimer}s</p>}
                        {genError && <p className="text-[10px] text-red-500 mt-2">{genError}</p>}
                      </div>
                    </FadeIn>
                  )}

                  {refImage && !canvas && (
                    <FadeIn delay={200} className="w-full max-w-lg">
                      <div className="bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-4 shadow-xl shadow-black/5 dark:shadow-black/30 space-y-3">
                        <div className="flex items-center gap-2">
                          <Icon icon="solar:magic-stick-3-bold-duotone" width={14} className="text-purple-500" />
                          <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-300">Recrear para tu marca</span>
                        </div>
                        <p className="text-[10px] text-gray-400 dark:text-gray-600 leading-relaxed">
                          La IA recreará esta imagen conservando el estilo y diseño, adaptándola a tu marca{name ? ` "${name}"` : ''}.
                        </p>
                        <textarea value={genPrompt} onChange={(e) => setGenPrompt(e.target.value)}
                          placeholder="Opcional: describe ajustes específicos..."
                          rows={2}
                          className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] text-[11px] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 dark:focus:border-purple-500/30 resize-none transition-all" />
                        {genError && <p className="text-[10px] text-red-500 bg-red-50 dark:bg-red-500/5 rounded-lg px-3 py-1.5">{genError}</p>}
                        <button onClick={() => generate()} disabled={genLoading}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-[11px] text-white font-bold transition-all active:scale-[0.97] shadow-lg shadow-purple-600/25">
                          {genLoading ? <><Spin /> Recreando...</> : <><Icon icon="solar:magic-stick-3-bold" width={14} /> Recrear para mi marca</>}
                        </button>
                        {genLoading && <p className="text-[9px] text-gray-400 text-center animate-pulse">Recreando diseño... {genTimer}s</p>}
                      </div>
                    </FadeIn>
                  )}
                </FadeIn>
              ) : genLoading ? (
                <GlowingBorder seconds={genTimer} />
              ) : (
                <FadeIn className="text-center">
                  <div className="w-14 h-14 rounded-2xl bg-gray-200 dark:bg-white/5 flex items-center justify-center mx-auto mb-3">
                    <Icon icon="solar:pallete-2-bold-duotone" width={24} className="text-gray-400 dark:text-gray-700" />
                  </div>
                  <p className="text-[11px] text-gray-400 dark:text-gray-700">
                    {view === 'history' ? 'Selecciona un diseño del historial' : 'Tu imagen aparecerá aquí'}
                  </p>
                </FadeIn>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════
// GENERATE PANEL
// ═════════════════════════════════════════════════════════════════════
const SIZE_OPTIONS: { value: ImageSize; label: string; icon: string; ratio: string }[] = [
  { value: 'square_1_1', label: '1:1', icon: 'solar:square-bold', ratio: 'Cuadrado' },
  { value: 'portrait_4_5', label: '4:5', icon: 'solar:smartphone-bold', ratio: 'Retrato' },
  { value: 'portrait_9_16', label: '9:16', icon: 'solar:smartphone-bold', ratio: 'Historia' },
  { value: 'landscape_4_3', label: '4:3', icon: 'solar:monitor-bold', ratio: 'Horizontal' },
  { value: 'landscape_16_9', label: '16:9', icon: 'solar:tv-bold', ratio: 'Panorámico' },
];

const GeneratePanel = ({ prompt, setPrompt, loading, error, onGenerate, refImage, clearRef, hasRef, selectedSize, setSelectedSize, useLogo, setUseLogo, hasLogo, walletBalance, costPerImage }: {
  prompt: string; setPrompt: (s: string) => void;
  loading: boolean; error: string;
  onGenerate: () => void;
  refImage: string | null; clearRef: () => void;
  hasRef: boolean;
  selectedSize: ImageSize; setSelectedSize: (s: ImageSize) => void;
  useLogo: boolean; setUseLogo: (v: boolean) => void; hasLogo: boolean;
  walletBalance: number | null; costPerImage: number;
}) => {
  const fmtCOP = (n: number) => '$' + n.toLocaleString('es-CO');
  const canAfford = walletBalance === null || walletBalance >= costPerImage;
  const [showFormats, setShowFormats] = useState(false);
  const grouped = useMemo(() => {
    const map: Record<string, typeof SOCIAL_FORMATS> = {};
    SOCIAL_FORMATS.forEach((f) => { (map[f.platform] ||= []).push(f); });
    return map;
  }, []);

  return (
    <div className="space-y-4">
      <PH icon="solar:magic-stick-3-bold-duotone" title="Generar imagen" />

      {refImage && (
        <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-white/[0.06] group">
          <img src={refImage} alt="" className="w-full h-24 object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <span className="absolute bottom-1.5 left-2 text-[9px] text-white/80 font-medium">
            {hasRef ? '✓ Referencia lista' : 'Cargando referencia...'}
          </span>
          <button onClick={clearRef} className="absolute top-1.5 right-1.5 w-5 h-5 rounded-lg bg-black/40 backdrop-blur flex items-center justify-center hover:bg-black/60 transition-all active:scale-90">
            <Icon icon="solar:close-circle-bold" width={12} className="text-white/70" />
          </button>
        </div>
      )}

      {!refImage && (
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe la imagen que quieres crear..."
          rows={3}
          className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] text-[12px] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 dark:focus:border-purple-500/30 resize-none leading-relaxed transition-all shadow-sm" />
      )}

      {/* Size selector */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">Tamaño</span>
          <button onClick={() => setShowFormats(!showFormats)} className="text-[9px] text-purple-500 hover:text-purple-400 font-medium transition-colors">
            {showFormats ? 'Proporciones' : 'Redes sociales'}
          </button>
        </div>

        {!showFormats ? (
          <div className="flex gap-1.5">
            {SIZE_OPTIONS.map((s) => (
              <button key={s.value} onClick={() => setSelectedSize(s.value)}
                className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg border text-[9px] font-medium transition-all active:scale-95 ${
                  selectedSize === s.value
                    ? 'bg-purple-50 dark:bg-purple-500/10 border-purple-300 dark:border-purple-500/30 text-purple-600 dark:text-purple-400'
                    : 'bg-white dark:bg-white/[0.02] border-gray-200 dark:border-white/[0.06] text-gray-500 dark:text-gray-500 hover:border-gray-300 dark:hover:border-white/10'
                }`}>
                <Icon icon={s.icon} width={14} />
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
            {Object.entries(grouped).map(([platform, formats]) => (
              <div key={platform}>
                <span className="text-[9px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-wider">{platform}</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {formats.map((f) => (
                    <button key={f.id} onClick={() => { setSelectedSize(f.size); setShowFormats(false); }}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[9px] transition-all active:scale-95 ${
                        selectedSize === f.size
                          ? 'bg-purple-50 dark:bg-purple-500/10 border-purple-300 dark:border-purple-500/30 text-purple-600 dark:text-purple-400'
                          : 'bg-white dark:bg-white/[0.02] border-gray-200 dark:border-white/[0.06] text-gray-500 hover:border-gray-300 dark:hover:border-white/10'
                      }`}>
                      <Icon icon={f.icon} width={11} />
                      <span>{f.name}</span>
                      <span className="text-gray-400 dark:text-gray-600">{f.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Logo toggle */}
      <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Icon icon="solar:shield-check-bold" width={14} className={useLogo && hasLogo ? 'text-purple-500' : 'text-gray-400'} />
          <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">Incluir logo</span>
        </div>
        {hasLogo ? (
          <button onClick={() => setUseLogo(!useLogo)}
            className={`relative w-8 h-[18px] rounded-full transition-all duration-200 ${useLogo ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-700'}`}>
            <div className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-all duration-200 ${useLogo ? 'left-[15px]' : 'left-[2px]'}`} />
          </button>
        ) : (
          <span className="text-[9px] text-amber-500 dark:text-amber-400 font-medium">Sin logo configurado</span>
        )}
      </div>

      {refImage && (
        <p className="text-[10px] text-gray-400 dark:text-gray-600 leading-relaxed">
          La IA recreará el diseño de la referencia adaptado a tu marca. Usa el panel derecho para generar o ajustar.
        </p>
      )}

      {/* Wallet balance & cost */}
      <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.04]">
        <div className="flex items-center gap-1.5">
          <Icon icon="solar:wallet-bold" width={13} className={canAfford ? 'text-green-500' : 'text-red-500'} />
          <span className="text-[9px] font-medium text-gray-500 dark:text-gray-400">
            {walletBalance !== null ? fmtCOP(walletBalance) : 'Cargando...'}
          </span>
        </div>
        <span className="text-[9px] font-semibold text-gray-400 dark:text-gray-500">{fmtCOP(costPerImage)} / imagen</span>
      </div>

      {!canAfford && (
        <div className="flex items-start gap-2 p-2.5 rounded-xl bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/10">
          <Icon icon="solar:danger-triangle-bold" width={14} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-semibold text-red-600 dark:text-red-400">Saldo insuficiente</p>
            <p className="text-[9px] text-red-500/70 dark:text-red-400/60">Necesitas {fmtCOP(costPerImage)} por imagen. Recarga tu wallet para continuar.</p>
          </div>
        </div>
      )}

      {!refImage && (
        <>
          {error && <p className="text-[10px] text-red-500 bg-red-50 dark:bg-red-500/5 rounded-xl px-3 py-2">{error}</p>}
          <button onClick={onGenerate} disabled={loading || !canAfford}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-[11px] text-white font-bold transition-all active:scale-[0.97] shadow-lg shadow-purple-600/25">
            {loading ? <><Spin /> Generando...</> : <><Icon icon="solar:magic-stick-3-bold" width={14} /> Generar ({fmtCOP(costPerImage)})</>}
          </button>
          {loading && <p className="text-[9px] text-gray-400 text-center animate-pulse">Generando imagen en alta resolución...</p>}
        </>
      )}
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════
// INSPIRE FULL (centered, full-width — before selecting an image)
// ═════════════════════════════════════════════════════════════════════
const CONTENT_FILTERS: { id: string; label: string; icon: string; filter?: { photo?: boolean; vector?: boolean; psd?: boolean } }[] = [
  { id: 'all', label: 'Todos', icon: 'solar:gallery-bold' },
  { id: 'photo', label: 'Fotos', icon: 'solar:camera-bold', filter: { photo: true } },
  { id: 'vector', label: 'Piezas gráficas', icon: 'solar:pallete-2-bold', filter: { vector: true } },
  { id: 'psd', label: 'Ilustraciones', icon: 'solar:pen-new-round-bold', filter: { psd: true } },
];

const InspireFull = ({ onSelect }: { onSelect: (url: string) => void }) => {
  const [term, setTerm] = useState('');
  const [items, setItems] = useState<FreepikResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [activeFilter, setActiveFilter] = useState('all');

  const tags = ['seguro de auto', 'seguro de vida', 'seguro médico', 'protección familiar', 'seguro de hogar', 'agente de seguros', 'póliza de seguro', 'insurance post'];

  const search = useCallback(async (q?: string, p?: number, filterId?: string) => {
    const query = q ?? term; if (!query.trim()) return;
    setLoading(true);
    try {
      const fId = filterId ?? activeFilter;
      const ct = CONTENT_FILTERS.find((f) => f.id === fId)?.filter;
      const res = await freepikService.searchResources({
        term: query, page: p ?? page, limit: 20, order: 'relevance',
        filters: ct ? { content_type: ct } : undefined,
      });
      setItems(res.data); setPages(res.meta.last_page); setPage(res.meta.current_page);
    } catch {} finally { setLoading(false); }
  }, [term, page, activeFilter]);

  const switchFilter = (id: string) => {
    setActiveFilter(id);
    if (term.trim()) search(term, 1, id);
  };

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h3 className="text-base font-bold text-gray-800 dark:text-white mb-1">Encontrar inspiración</h3>
        <p className="text-[11px] text-gray-400 dark:text-gray-600">Busca un diseño y la IA lo recreará conservando el estilo, adaptado a tu marca.</p>
      </div>

      <div className="relative max-w-md mx-auto">
        <Icon icon="solar:magnifer-linear" width={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-600" />
        <input value={term} onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder="Buscar imágenes de inspiración..."
          className="w-full pl-10 pr-4 py-3 rounded-xl bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] text-[13px] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 dark:focus:border-purple-500/30 transition-all shadow-sm" />
      </div>

      {/* Content type filter tabs */}
      <div className="flex justify-center gap-1.5">
        {CONTENT_FILTERS.map((f) => (
          <button key={f.id} onClick={() => switchFilter(f.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all active:scale-95 ${
              activeFilter === f.id
                ? 'bg-purple-100 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20'
                : 'bg-white dark:bg-white/[0.03] text-gray-500 dark:text-gray-500 border border-gray-200 dark:border-white/[0.04] hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-white/10'
            }`}>
            <Icon icon={f.icon} width={13} />
            {f.label}
          </button>
        ))}
      </div>

      {items.length === 0 && !loading && (
        <div className="flex flex-wrap gap-2 justify-center">
          {tags.map((q) => (
            <button key={q} onClick={() => { setTerm(q); search(q, 1); }}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.04] text-[11px] text-gray-500 hover:text-purple-600 dark:hover:text-white hover:border-purple-300 dark:hover:border-purple-500/20 transition-all hover:-translate-y-0.5 active:scale-95">{q}</button>
          ))}
        </div>
      )}

      {loading ? <div className="flex justify-center py-16"><Spin /></div> : (
        <>
          <div className="grid grid-cols-4 gap-3">
            {items.map((r, i) => (
              <FadeIn key={r.id} delay={i * 30}>
                <button onClick={() => onSelect(r.image.source.url)}
                  className="group rounded-xl overflow-hidden border border-gray-200 dark:border-white/[0.04] hover:border-purple-400 dark:hover:border-purple-500/30 transition-all duration-300 relative shadow-sm hover:shadow-lg w-full">
                  <img src={r.image.source.url} alt="" className="w-full aspect-square object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white opacity-0 group-hover:opacity-100 transition-all duration-300 bg-purple-600/90 px-3 py-1.5 rounded-lg shadow-lg translate-y-2 group-hover:translate-y-0">Usar como base</span>
                  </div>
                </button>
              </FadeIn>
            ))}
          </div>
          {pages > 1 && (
            <div className="flex justify-between items-center text-[11px] text-gray-400 pt-2">
              <button onClick={() => search(undefined, Math.max(1, page - 1))} disabled={page <= 1} className="hover:text-purple-500 disabled:opacity-30 transition-colors">← Anterior</button>
              <span className="text-gray-300 dark:text-gray-600">{page} / {pages}</span>
              <button onClick={() => search(undefined, Math.min(pages, page + 1))} disabled={page >= pages} className="hover:text-purple-500 disabled:opacity-30 transition-colors">Siguiente →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════
// UPLOAD FULL (centered, full-width — before selecting an image)
// ═════════════════════════════════════════════════════════════════════
const UploadFull = ({ onSelect }: { onSelect: (dataUrl: string) => void }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => { if (reader.result) onSelect(reader.result as string); };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-base font-bold text-gray-800 dark:text-white mb-1">Subir imagen</h3>
        <p className="text-[11px] text-gray-400 dark:text-gray-600">Sube una imagen y la IA recreará el diseño adaptado a tu marca.</p>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onClick={() => inputRef.current?.click()}
        className={`max-w-md mx-auto flex flex-col items-center justify-center py-20 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-300 group ${
          dragging
            ? 'border-purple-400 bg-purple-50 dark:bg-purple-500/5 scale-[1.02]'
            : 'border-gray-300 dark:border-white/[0.06] hover:border-purple-300 dark:hover:border-white/10 bg-white dark:bg-white/[0.02] hover:bg-purple-50/50 dark:hover:bg-white/[0.03]'
        }`}
      >
        <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-white/5 flex items-center justify-center mb-4 transition-all duration-300 group-hover:scale-110 group-hover:bg-purple-100 dark:group-hover:bg-purple-500/10">
          <Icon icon="solar:cloud-upload-linear" width={30} className="text-gray-400 dark:text-gray-600 transition-colors group-hover:text-purple-500 dark:group-hover:text-purple-400" />
        </div>
        <span className="text-[12px] text-gray-500 font-medium">Arrastra una imagen o haz clic para seleccionar</span>
        <span className="text-[10px] text-gray-400 dark:text-gray-700 mt-1">PNG, JPG, WEBP</span>
      </div>

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════
// HISTORY PANEL
// ═════════════════════════════════════════════════════════════════════
const HistoryPanel = ({ onSelect }: { onSelect: (src: string, lbl?: string, id?: string) => void }) => {
  const [list, setList] = useState(load());
  const [filter, setFilter] = useState<'all' | 'favorites'>('all');
  const del = (id: string) => { const n = list.filter((p) => p.id !== id); persist(n); setList(n); };
  const toggleFav = (id: string) => {
    const n = list.map(p => p.id === id ? { ...p, favorite: !p.favorite } : p);
    persist(n); setList(n);
  };
  const filtered = filter === 'favorites' ? list.filter(p => p.favorite) : list;
  const favCount = list.filter(p => p.favorite).length;

  return (
    <div className="space-y-4">
      <PH icon="solar:clock-circle-bold-duotone" title="Historial" />

      {list.length > 0 && (
        <div className="flex gap-1.5">
          <button onClick={() => setFilter('all')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-medium transition-all active:scale-95 ${filter === 'all' ? 'bg-purple-100 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20' : 'bg-white dark:bg-white/[0.03] text-gray-500 border border-gray-200 dark:border-white/[0.04] hover:border-gray-300 dark:hover:border-white/10'}`}>
            <Icon icon="solar:clock-circle-bold" width={11} /> Todos ({list.length})
          </button>
          <button onClick={() => setFilter('favorites')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-medium transition-all active:scale-95 ${filter === 'favorites' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-500 border border-amber-200 dark:border-amber-500/20' : 'bg-white dark:bg-white/[0.03] text-gray-500 border border-gray-200 dark:border-white/[0.04] hover:border-gray-300 dark:hover:border-white/10'}`}>
            <Icon icon="solar:star-bold" width={11} /> Favoritos ({favCount})
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <FadeIn className="text-center py-10">
          <div className="w-12 h-12 rounded-2xl bg-gray-200 dark:bg-white/5 flex items-center justify-center mx-auto mb-3">
            <Icon icon={filter === 'favorites' ? 'solar:star-bold-duotone' : 'solar:folder-bold-duotone'} width={22} className="text-gray-400 dark:text-gray-700" />
          </div>
          <p className="text-[11px] text-gray-400 dark:text-gray-700">
            {filter === 'favorites' ? 'Sin favoritos aún' : 'Las imágenes generadas aparecerán aquí'}
          </p>
        </FadeIn>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {filtered.map((p, i) => (
            <FadeIn key={p.id} delay={i * 40}>
              <div className="group relative rounded-xl overflow-hidden border border-gray-200 dark:border-white/[0.04] hover:border-purple-400 dark:hover:border-purple-500/20 transition-all duration-300 shadow-sm hover:shadow-lg">
                <button onClick={() => onSelect(p.src, p.prompt, p.id)} className="w-full">
                  <img src={p.src} alt="" className="w-full aspect-square object-cover transition-transform duration-500 group-hover:scale-105" />
                </button>
                {p.favorite && (
                  <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-md bg-amber-400/90 backdrop-blur flex items-center justify-center shadow-sm">
                    <Icon icon="solar:star-bold" width={10} className="text-white" />
                  </div>
                )}
                <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  <button onClick={() => toggleFav(p.id)}
                    className={`w-5 h-5 rounded-lg backdrop-blur flex items-center justify-center transition-all active:scale-90 ${p.favorite ? 'bg-amber-400/80 hover:bg-amber-500/90' : 'bg-black/40 hover:bg-amber-400/80'}`}>
                    <Icon icon={p.favorite ? 'solar:star-bold' : 'solar:star-linear'} width={10} className="text-white" />
                  </button>
                  <button onClick={() => del(p.id)}
                    className="w-5 h-5 rounded-lg bg-black/40 backdrop-blur flex items-center justify-center hover:bg-red-500/80 transition-all active:scale-90">
                    <Icon icon="solar:trash-bin-trash-bold" width={10} className="text-white" />
                  </button>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      )}
    </div>
  );
};

export default CreadorContenido;
