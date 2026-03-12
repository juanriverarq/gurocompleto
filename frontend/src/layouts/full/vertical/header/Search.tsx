import { Modal, TextInput } from "flowbite-react";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { useNavigate } from "react-router";
import saasApi from "src/services/saasApi";

type GlobalSearchItem = {
  type: string;
  id: number | string;
  title: string;
  subtitle?: string | null;
  url: string;
  icon?: string | null;
};

const Search = () => {
  const [openModal, setOpenModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<GlobalSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const navigate = useNavigate();

  // Control de concurrencia para evitar race conditions en respuestas
  const reqIdRef = useRef(0);
  const debounceRef = useRef<number | undefined>(undefined);

  const resetState = () => {
    setSearchTerm("");
    setResults([]);
    setCounts({});
    setLoading(false);
    setErrorMsg(null);
  };

  const handleOpen = () => {
    setOpenModal(true);
    // Dejar el estado como esté; el autofocus permitirá escribir de inmediato
  };

  const handleModalClose = () => {
    setOpenModal(false);
    resetState();
  };

  const fetchResults = async (q: string) => {
    const myReqId = ++reqIdRef.current;
    setLoading(true);
    setErrorMsg(null);

    try {
      const resp = await saasApi.globalSearch(q, 5);
      // Ignorar respuestas viejas
      if (myReqId !== reqIdRef.current) return;

      // El backend devuelve directamente { success: true, data: [...], counts: {...}, query: "..." }
      // saasApi.globalSearch retorna el JSON del backend con data, counts, query
      const items: GlobalSearchItem[] = Array.isArray((resp as any)?.data) ? (resp as any).data : [];
      const cts: Record<string, number> = (resp as any)?.counts || {};

      console.log('🔍 GlobalSearch response:', { resp, items, cts, itemsLength: items.length });

      setResults(items);
      setCounts(cts);
    } catch (e: any) {
      if (myReqId !== reqIdRef.current) return;
      setErrorMsg(e?.message || "Error al buscar");
      setResults([]);
      setCounts({});
    } finally {
      if (myReqId === reqIdRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    // Debounce de 300ms
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    const q = searchTerm.trim();
    if (!q) {
      setResults([]);
      setCounts({});
      setLoading(false);
      setErrorMsg(null);
      return;
    }
    debounceRef.current = window.setTimeout(() => {
      fetchResults(q);
    }, 300);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const buildHrefForItem = (item: GlobalSearchItem): string => {
    let href = item.url || "/apps";
    const t = (item.type || "").toLowerCase();

    const ensureParam = (param: string, fallbackPath: string) => {
      try {
        const u = new URL(href, window.location.origin);
        u.searchParams.set(param, String(item.id));
        href = u.pathname + (u.search ? u.search : "");
      } catch {
        href = `${fallbackPath}?${encodeURIComponent(param)}=${encodeURIComponent(String(item.id))}`;
      }
    };

    if (t.includes("vendedor") || t.includes("asesor") || t.includes("seller")) {
      ensureParam("open_vendedor_id", "/apps/admin/vendedores");
    } else if (t.includes("cliente") || t.includes("client")) {
      ensureParam("open_client_id", "/apps/seguros/clientes");
    } else if (t.includes("poliz") || t.includes("policy")) {
      ensureParam("open_policy_id", "/apps/seguros/polizas");
    } else if (t.includes("siniestro") || t.includes("claim")) {
      ensureParam("open_siniestro_id", "/apps/seguros/siniestros");
    } else if (t.includes("auto") || t.includes("automovil") || t.includes("vehicul") || t.includes("vehicle")) {
      ensureParam("open_auto_id", "/apps/seguros/automoviles");
    } else if (t.includes("vinculado")) {
      // Vinculados link directly to the poliza edit page with vinculados tab
      // item.url already contains the full path from backend
    } else if ((t.includes("whatsapp") || t.includes("wpp")) && (t.includes("camp") || t.includes("campaign"))) {
      // Campañas de WhatsApp
      ensureParam("open_whatsapp_campaign_id", "/apps/saas/configuracion-masiva");
    } else if (t.includes("email") && (t.includes("camp") || t.includes("campaign"))) {
      // Campañas de Email
      ensureParam("open_email_campaign_id", "/apps/marketing/plantillas");
    } else if ((t.includes("llamada") || t.includes("voice") || t.includes("call")) && (t.includes("camp") || t.includes("campaign"))) {
      // Campañas de llamadas / voz
      try {
        const u = new URL("/apps/voice-ai/dashboard", window.location.origin);
        u.searchParams.set("tab", "campaigns");
        u.searchParams.set("open_voice_campaign_id", String(item.id));
        href = u.pathname + "?" + u.searchParams.toString();
      } catch {
        href = `/apps/voice-ai/dashboard?tab=campaigns&open_voice_campaign_id=${encodeURIComponent(String(item.id))}`;
      }
    }

    return href;
  };

  const handleResultClick = (item: GlobalSearchItem) => {
    const href = buildHrefForItem(item);
    setOpenModal(false);
    resetState();
    navigate(href || "/apps");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const first = results[0];
      if (first) handleResultClick(first);
    } else if (e.key === "Escape") {
      handleModalClose();
    }
  };

  return (
    <div>
      <button
        onClick={handleOpen}
        className="h-10 w-10 text-darklink dark:text-white text-sm hover:text-primary hover:bg-lightprimary dark:hover:text-primary dark:hover:bg-darkminisidebar rounded-full flex justify-center items-center cursor-pointer"
        title="Buscar"
        aria-label="Abrir buscador global"
      >
        <Icon icon="solar:magnifer-line-duotone" height={20} />
      </button>

      <Modal dismissible show={openModal} onClose={handleModalClose} size="lg">
        <div className="p-6 border-b border-ld">
          <div className="relative">
            <TextInput
              placeholder="Buscar vendedores, clientes, pólizas, autos, siniestros..."
              className="form-control"
              sizing="md"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              required
            />
            <Icon
              icon="solar:magnifer-line-duotone"
              height={20}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            />
          </div>
        </div>

        <Modal.Body className="pt-0">
          <div className="max-h-72 overflow-y-auto">
            {searchTerm && (
              <div className="pt-3 pb-2 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {loading
                    ? "Buscando..."
                    : `${results.length} resultado${results.length !== 1 ? "s" : ""} para "${searchTerm}"`}
                </p>
                {Object.keys(counts || {}).length > 0 && (
                  <div className="text-xs text-gray-400 hidden sm:block">
                    {Object.entries(counts)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(" • ")}
                  </div>
                )}
              </div>
            )}

            {!searchTerm && (
              <div className="py-8 text-center text-gray-500">
                Escribe para buscar en todo el sistema
              </div>
            )}

            {errorMsg && (
              <div className="py-6 text-center text-red-500">
                <Icon icon="solar:bug-bold-duotone" height={28} className="mx-auto mb-2" />
                {errorMsg}
              </div>
            )}

            {!errorMsg && searchTerm && !loading && results.length === 0 && (
              <div className="py-8 text-center">
                <Icon
                  icon="solar:magnifer-bug-bold-duotone"
                  height={48}
                  className="text-gray-400 mx-auto mb-3"
                />
                <p className="text-gray-500">
                  No se encontraron resultados para "{searchTerm}"
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Intenta con otros términos de búsqueda
                </p>
              </div>
            )}

            {!errorMsg && results.length > 0 && (
              <div className="pt-4">
                <h5 className="text-lg mb-3 font-semibold">Resultados</h5>
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {results.map((item, index) => (
                    <div
                      key={`${item.type}-${item.id}-${index}`}
                      onClick={() => handleResultClick(item)}
                      className="py-3 px-3 group relative hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg cursor-pointer transition-colors flex items-center gap-3"
                    >
                      <div className="h-8 w-8 bg-lightprimary rounded-full flex items-center justify-center flex-shrink-0">
                        <Icon
                          icon={item.icon || "solar:document-bold-duotone"}
                          height={16}
                          className="text-primary"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase tracking-wide text-gray-400">
                            {item.type}
                          </span>
                          <span className="text-gray-300">•</span>
                          <h6 className="group-hover:text-primary mb-0 font-medium text-sm truncate">
                            {item.title}
                          </h6>
                        </div>
                        {item.subtitle && (
                          <p className="text-xs text-bodytext truncate">
                            {item.subtitle}
                          </p>
                        )}
                      </div>
                      <Icon
                        icon="solar:arrow-right-line-duotone"
                        height={16}
                        className="text-gray-400 group-hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default Search;
