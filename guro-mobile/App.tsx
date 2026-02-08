import React, { useState, useEffect, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { useFonts, Montserrat_400Regular, Montserrat_500Medium, Montserrat_600SemiBold, Montserrat_700Bold } from '@expo-google-fonts/montserrat';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import AnimatedSplash from './src/components/AnimatedSplash';

// Mantener el splash nativo visible mientras cargamos
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [splashFinished, setSplashFinished] = useState(false);
  const [appIsReady, setAppIsReady] = useState(false);
  
  const [fontsLoaded] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      // Ocultar splash nativo cuando las fuentes estén listas
      SplashScreen.hideAsync();
      setAppIsReady(true);
    }
  }, [fontsLoaded]);

  if (!appIsReady || !splashFinished) {
    return (
      <AnimatedSplash onAnimationFinish={() => setSplashFinished(true)} />
    );
  }

  return (
    <AuthProvider>
      <StatusBar style="auto" />
      <AppNavigator />
    </AuthProvider>
  );
}
