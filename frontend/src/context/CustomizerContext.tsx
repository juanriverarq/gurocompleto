
import  { createContext, useState, ReactNode, useEffect } from 'react';
import config from './config'
import React from "react";

// Define the shape of the context state
interface CustomizerContextState {
  selectedIconId: number;
  setSelectedIconId: (id: number) => void;
  activeDir: string;
  setActiveDir: (dir: string) => void;
  activeMode: string;
  setActiveMode: (mode: string) => void;
  activeTheme: string;
  setActiveTheme: (theme: string) => void;
  activeLayout: string;
  setActiveLayout: (layout: string) => void;
  isCardShadow: boolean;
  setIsCardShadow: (shadow: boolean) => void;
  isLayout: string;
  setIsLayout: (layout: string) => void;
  isBorderRadius: number;
  setIsBorderRadius: (radius: number) => void;
  isCollapse: string;
  setIsCollapse: (collapse: string) => void;

}

// Create the context with an initial value
export const CustomizerContext = createContext<CustomizerContextState | any>(undefined);

// Define the type for the children prop
interface CustomizerContextProps {
  children: ReactNode;
}

const readInitialMode = (): 'light' | 'dark' => {
  try {
    const saved = localStorage.getItem('guro_active_mode');
    if (saved === 'light' || saved === 'dark') return saved;
    // Si Flowbite ya escribió un modo en su key, respetarlo
    const fb = localStorage.getItem('flowbite-theme-mode');
    if (fb === 'light' || fb === 'dark') return fb;
  } catch {}
  return 'dark';
};

// Create the provider component
export const CustomizerContextProvider: React.FC<CustomizerContextProps> = ({ children }) => {
  const [selectedIconId, setSelectedIconId] = useState<number>(1);

  // Enhanced setSelectedIconId with logging
  const enhancedSetSelectedIconId = (id: number) => {
    setSelectedIconId(id);
  };
  const [activeDir, setActiveDir] = useState<string>(config.activeDir);
  const [activeMode, setActiveMode] = useState<string>(readInitialMode);
  const [activeTheme, setActiveTheme] = useState<string>(config.activeTheme);
  const [activeLayout, setActiveLayout] = useState<string>(config.activeLayout);
  const [isCardShadow, setIsCardShadow] = useState<boolean>(config.isCardShadow);
  const [isLayout, setIsLayout] = useState<string>(config.isLayout);
  const [isBorderRadius, setIsBorderRadius] = useState<number>(config.isBorderRadius);
  const [isCollapse, setIsCollapse] = useState<string>(config.isCollapse);
  const [isLanguage, setIsLanguage] = useState<string>(config.isLanguage);


  // Sincronizar SOLO la clase `dark` con el modo activo, sin borrar otras clases
  // que pudieran existir en <html> (Flowbite, RTL, libs varias).
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const isDark = activeMode === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.classList.remove('light'); // legacy: limpiar si quedó
    try {
      localStorage.setItem('guro_active_mode', activeMode);
      // Mantener Flowbite alineado para que su <ThemeModeInit> no nos sobreescriba al re-montar
      localStorage.setItem('flowbite-theme-mode', activeMode);
    } catch {}
  }, [activeMode]);

  // Atributos de layout van en su propio effect (no tocan la clase `dark`)
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('dir', activeDir);
  }, [activeDir]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-color-theme', activeTheme);
  }, [activeTheme]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-layout', activeLayout);
  }, [activeLayout]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-boxed-layout', isLayout);
  }, [isLayout]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-sidebar-type', isCollapse);
  }, [isCollapse]);

  // Sincronizar entre pestañas: si otra pestaña cambia el tema (vía nuestra key
  // o vía la key interna de Flowbite), actualizar el estado de React para que
  // no haya divergencia (estado dice "dark" pero el DOM ya fue puesto en "light").
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== 'guro_active_mode' && e.key !== 'flowbite-theme-mode') return;
      const v = e.newValue;
      if (v === 'light' || v === 'dark') {
        setActiveMode((prev) => (prev === v ? prev : v));
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return (
    <CustomizerContext.Provider
      value={{
        selectedIconId,
        setSelectedIconId: enhancedSetSelectedIconId,
        activeDir,
        setActiveDir,
        activeMode,
        setActiveMode,
        activeTheme,
        setActiveTheme,
        activeLayout,
        setActiveLayout,
        isCardShadow,
        setIsCardShadow,
        isLayout,
        setIsLayout,
        isBorderRadius,
        setIsBorderRadius,
        isCollapse,
        setIsCollapse,
        isLanguage,
        setIsLanguage,

      }}
    >
      {children}
    </CustomizerContext.Provider>
  );
};


