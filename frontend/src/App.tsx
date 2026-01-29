import { Flowbite, ThemeModeScript } from 'flowbite-react';
import customTheme from './utils/theme/custom-theme';
import router from './routes/Router';
import { RouterProvider } from 'react-router';
import { Toaster } from './components/shadcn-ui/Default-Ui/toaster';
import { lazy, Suspense } from 'react';
import Spinner from './views/spinner/Spinner';

// Lazy load del AuthProvider para diferir la carga de Firebase
const LazyAuthProvider = lazy(() => 
  import('./context/UnifiedAuthContext').then(mod => ({ default: mod.UnifiedAuthProvider }))
);
const LazyTerminologiaProvider = lazy(() => 
  import('./context/TerminologiaContext').then(mod => ({ default: mod.TerminologiaProvider }))
);
const LazyWhatsAppNotificationProvider = lazy(() => 
  import('./context/WhatsAppNotificationContext').then(mod => ({ default: mod.WhatsAppNotificationProvider }))
);

function App() {
  return (
    <>
      <ThemeModeScript />
      <Suspense fallback={<Spinner />}>
        <LazyAuthProvider>
          <LazyTerminologiaProvider>
            <LazyWhatsAppNotificationProvider>
              <Flowbite theme={{ theme: customTheme }}>
                <RouterProvider router={router} />
              </Flowbite>
            </LazyWhatsAppNotificationProvider>
          </LazyTerminologiaProvider>
        </LazyAuthProvider>
      </Suspense>
      <Toaster />
    </>
  );
}

export default App;
