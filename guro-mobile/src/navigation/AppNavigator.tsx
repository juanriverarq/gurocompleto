import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import WelcomeScreen from '../screens/WelcomeScreen';
import LoginScreen from '../screens/LoginScreen';
import BottomTabNavigator from './BottomTabNavigator';
import DashboardScreen from '../screens/DashboardScreen';
import EmpleadosScreen from '../screens/EmpleadosScreen';
import EmpleadosMenuScreen from '../screens/EmpleadosMenuScreen';
import EmpleadosListScreen from '../screens/EmpleadosListScreen';
import EmpleadoDetailScreen from '../screens/EmpleadoDetailScreen';
import CreateEmpleadoScreen from '../screens/CreateEmpleadoScreen';
import WhatsAppScreen from '../screens/WhatsAppScreen';
import WhatsAppChatScreen from '../screens/WhatsAppChatScreen';
import WhatsAppContactProfileScreen from '../screens/WhatsAppContactProfileScreen';
import LoadingSpinner from '../components/LoadingSpinner';

export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  MainTabs: undefined;
  Dashboard: undefined;
  Empleados: undefined;
  EmpleadosList: undefined;
  EmpleadoDetail: { empleadoId: number };
  CreateEmpleado: undefined;
  Trazabilidad: undefined;
  WhatsApp: undefined;
  WhatsAppChat: { conversationId: number; contactName: string; phone: string };
  WhatsAppContactProfile: { conversationId: number; contactName: string; phone: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <>
            <Stack.Screen name="MainTabs" component={BottomTabNavigator} />
            <Stack.Screen name="Dashboard" component={DashboardScreen} />
            <Stack.Screen name="Empleados" component={EmpleadosMenuScreen} />
            <Stack.Screen name="EmpleadosList" component={EmpleadosListScreen} />
            <Stack.Screen name="EmpleadoDetail" component={EmpleadoDetailScreen} />
            <Stack.Screen name="CreateEmpleado" component={CreateEmpleadoScreen} />
            <Stack.Screen name="Trazabilidad" component={EmpleadosScreen} />
            <Stack.Screen name="WhatsApp" component={WhatsAppScreen} />
            <Stack.Screen name="WhatsAppChat" component={WhatsAppChatScreen} />
            <Stack.Screen name="WhatsAppContactProfile" component={WhatsAppContactProfileScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
