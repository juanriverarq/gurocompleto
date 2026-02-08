import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MenuScreen from '../screens/MenuScreen';
import ProfileDetailScreen from '../screens/ProfileDetailScreen';
import PermissionsScreen from '../screens/PermissionsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import FAQScreen from '../screens/FAQScreen';
import TermsScreen from '../screens/TermsScreen';
import PrivacyScreen from '../screens/PrivacyScreen';

export type MenuStackParamList = {
  MenuMain: undefined;
  ProfileDetail: undefined;
  Permissions: undefined;
  Notifications: undefined;
  FAQ: undefined;
  Terms: undefined;
  Privacy: undefined;
};

const Stack = createNativeStackNavigator<MenuStackParamList>();

const MenuStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MenuMain" component={MenuScreen} />
      <Stack.Screen name="ProfileDetail" component={ProfileDetailScreen} />
      <Stack.Screen name="Permissions" component={PermissionsScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="FAQ" component={FAQScreen} />
      <Stack.Screen name="Terms" component={TermsScreen} />
      <Stack.Screen name="Privacy" component={PrivacyScreen} />
    </Stack.Navigator>
  );
};

export default MenuStackNavigator;
