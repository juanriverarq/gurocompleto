import { Flowbite } from 'flowbite-react';
import customTheme from './utils/theme/custom-theme';
import router from './routes/Router';
import { RouterProvider } from 'react-router';
import { Toaster } from './components/shadcn-ui/Default-Ui/toaster';
import { lazy, Suspense, useContext } from 'react';
import { CustomizerContext } from './context/CustomizerContext';
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
const LazyTaskNotificationProvider = lazy(() =>
  import('./context/TaskNotificationContext').then(mod => ({ default: mod.TaskNotificationProvider }))
);
const LazyRuntSyncProvider = lazy(() =>
  import('./context/RuntSyncContext').then(mod => ({ default: mod.RuntSyncProvider }))
);

function App() {
  const { activeMode } = useContext(CustomizerContext);

  return (
    <>
      <Suspense fallback={<Spinner />}>
        <LazyAuthProvider>
          <LazyTerminologiaProvider>
            <LazyWhatsAppNotificationProvider>
              <LazyTaskNotificationProvider>
              <LazyRuntSyncProvider>
                <Flowbite theme={{ theme: customTheme, mode: activeMode as 'light' | 'dark' }}>
                  <RouterProvider router={router} />
                </Flowbite>
              </LazyRuntSyncProvider>
              </LazyTaskNotificationProvider>
            </LazyWhatsAppNotificationProvider>
          </LazyTerminologiaProvider>
        </LazyAuthProvider>
      </Suspense>
      <Toaster />
    </>
  );
}

export default App;
