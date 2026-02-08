import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PolizasScreen from '../screens/PolizasScreen';
import PolizaDetailScreen from '../screens/PolizaDetailScreen';
import CreatePolizaScreen from '../screens/CreatePolizaScreen';

export type PolizasStackParamList = {
  PolizasList: undefined;
  PolizaDetail: { polizaId: number };
  CreatePoliza: undefined;
};

const Stack = createNativeStackNavigator<PolizasStackParamList>();

const PolizasStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PolizasList" component={PolizasScreen} />
      <Stack.Screen name="PolizaDetail" component={PolizaDetailScreen} />
      <Stack.Screen name="CreatePoliza" component={CreatePolizaScreen} />
    </Stack.Navigator>
  );
};

export default PolizasStackNavigator;
