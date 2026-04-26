/**
 * GuroLoader — DESACTIVADO TEMPORALMENTE
 *
 * El loader fullscreen (Lottie + background image) se apagó globalmente para mejorar
 * la percepción de fluidez en navegación entre rutas, auth, y dashboard.
 *
 * Al retornar `null` quedan silenciados todos los usos:
 *   - `App.tsx` (Suspense de providers Firebase)
 *   - `Loadable.tsx` (fallback de todas las rutas lazy-loaded)
 *   - `UnifiedProtectedFullLayout.tsx` (verificación auth)
 *   - `CreateBroker.tsx` (onboarding auth)
 *   - cualquier `<GuroLoader />` inline
 *
 * Para reactivar: restaurar el implementation original (ver git history) o reemplazar el
 * `return null` por el JSX Lottie.
 */

interface GuroLoaderProps {
  size?: number;
  message?: string;
  fullScreen?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const GuroLoader = (_props: GuroLoaderProps) => null;

export default GuroLoader;
