import { Flowbite, ThemeModeScript } from 'flowbite-react';
import customTheme from './utils/theme/custom-theme';
import router from './routes/Router';
import { RouterProvider } from 'react-router';
import { Toaster } from './components/shadcn-ui/Default-Ui/toaster';
import { UnifiedAuthProvider } from './context/UnifiedAuthContext';

function App() {
  return (
    <>
      <ThemeModeScript />
      <UnifiedAuthProvider>
        <Flowbite theme={{ theme: customTheme }}>
            <RouterProvider router={router} />
        </Flowbite>
      </UnifiedAuthProvider>
      <Toaster />
    </>
  );
}

export default App;
