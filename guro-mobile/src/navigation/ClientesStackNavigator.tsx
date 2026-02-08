import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ClientesScreen from '../screens/ClientesScreen';
import ClienteDetailScreen from '../screens/ClienteDetailScreen';
import CreateClienteScreen from '../screens/CreateClienteScreen';

export type ClientesStackParamList = {
  ClientesList: undefined;
  ClienteDetail: { clienteId: number };
  CreateCliente: undefined;
};

const Stack = createNativeStackNavigator<ClientesStackParamList>();

const ClientesStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ClientesList" component={ClientesScreen} />
      <Stack.Screen name="ClienteDetail" component={ClienteDetailScreen} />
      <Stack.Screen name="CreateCliente" component={CreateClienteScreen} />
    </Stack.Navigator>
  );
};

export default ClientesStackNavigator;
