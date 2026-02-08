import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Dimensions, Animated, Linking } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import HomeScreen from '../screens/HomeScreen';
import ClientesStackNavigator from './ClientesStackNavigator';
import DashboardScreen from '../screens/DashboardScreen';
import PolizasStackNavigator from './PolizasStackNavigator';
import EmpleadosScreen from '../screens/EmpleadosScreen';
import MenuStackNavigator from './MenuStackNavigator';

const { width } = Dimensions.get('window');

export type BottomTabParamList = {
  Inicio: undefined;
  Clientes: undefined;
  Herramientas: undefined;
  Polizas: undefined;
  Menu: undefined;
};

const Tab = createBottomTabNavigator<BottomTabParamList>();

const CustomTabBar = ({ state, descriptors, navigation }: any) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [animation] = useState(new Animated.Value(0));

  const toggleExpand = () => {
    const toValue = isExpanded ? 0 : 1;
    setIsExpanded(!isExpanded);
    Animated.spring(animation, {
      toValue,
      useNativeDriver: true,
      friction: 6,
      tension: 80,
    }).start();
  };

  const navigateTo = (screen: string) => {
    setIsExpanded(false);
    Animated.spring(animation, {
      toValue: 0,
      useNativeDriver: true,
      friction: 6,
    }).start();
    navigation.navigate(screen);
  };

  const openWhatsApp = () => {
    setIsExpanded(false);
    Animated.spring(animation, {
      toValue: 0,
      useNativeDriver: true,
      friction: 6,
    }).start();
    navigation.navigate('WhatsApp');
  };

  const fanItem1Style = {
    transform: [
      {
        translateY: animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -80],
        }),
      },
      {
        translateX: animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -60],
        }),
      },
      {
        scale: animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 1],
        }),
      },
    ],
    opacity: animation,
  };

  const fanItem2Style = {
    transform: [
      {
        translateY: animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -100],
        }),
      },
      {
        scale: animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 1],
        }),
      },
    ],
    opacity: animation,
  };

  const fanItem3Style = {
    transform: [
      {
        translateY: animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -80],
        }),
      },
      {
        translateX: animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 60],
        }),
      },
      {
        scale: animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 1],
        }),
      },
    ],
    opacity: animation,
  };

  return (
    <View style={styles.tabBarContainer}>
      {/* Fan Menu Items */}
      {isExpanded && (
        <View style={styles.fanContainer}>
          <Animated.View style={[styles.fanItem, fanItem1Style]}>
            <TouchableOpacity style={styles.fanButton} onPress={() => navigateTo('Dashboard')}>
              <Ionicons name="grid-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.fanLabel}>Dashboard</Text>
          </Animated.View>
          
          <Animated.View style={[styles.fanItem, fanItem2Style]}>
            <TouchableOpacity style={[styles.fanButton, { backgroundColor: '#25D366' }]} onPress={openWhatsApp}>
              <Ionicons name="logo-whatsapp" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.fanLabel}>WhatsApp</Text>
          </Animated.View>
          
          <Animated.View style={[styles.fanItem, fanItem3Style]}>
            <TouchableOpacity style={styles.fanButton} onPress={() => navigateTo('Empleados')}>
              <Ionicons name="people-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.fanLabel}>Empleados</Text>
          </Animated.View>
        </View>
      )}

      {/* Overlay to close fan */}
      {isExpanded && (
        <TouchableOpacity 
          style={styles.overlay} 
          activeOpacity={1} 
          onPress={toggleExpand}
        />
      )}

      <View style={styles.curveBackground}>
        <Svg width={width} height={80} style={styles.svgCurve}>
          <Path
            d={`M0,0 L${width / 2 - 45},0 Q${width / 2 - 25},0 ${width / 2 - 25},20 Q${width / 2 - 25},55 ${width / 2},55 Q${width / 2 + 25},55 ${width / 2 + 25},20 Q${width / 2 + 25},0 ${width / 2 + 45},0 L${width},0 L${width},80 L0,80 Z`}
            fill="#FFFFFF"
          />
        </Svg>
      </View>
      
      <View style={styles.tabItemsContainer}>
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const isCenter = index === 2;

          const onPress = () => {
            if (isCenter) {
              toggleExpand();
              return;
            }
            
            if (isExpanded) {
              setIsExpanded(false);
              Animated.spring(animation, {
                toValue: 0,
                useNativeDriver: true,
                friction: 6,
              }).start();
            }

            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          if (isCenter) {
            return (
              <TouchableOpacity
                key={route.key}
                style={styles.centerButton}
                onPress={onPress}
                activeOpacity={0.8}
              >
                <Animated.View style={[
                  styles.centerButtonInner,
                  {
                    transform: [{
                      rotate: animation.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '45deg'],
                      }),
                    }],
                  },
                ]}>
                  <Ionicons name={isExpanded ? 'close' : 'apps'} size={26} color="#FFFFFF" />
                </Animated.View>
              </TouchableOpacity>
            );
          }

          const iconName = 
            route.name === 'Inicio' ? 'home-outline' :
            route.name === 'Clientes' ? 'person-outline' :
            route.name === 'Polizas' ? 'document-text-outline' : 'menu-outline';
          
          const label = 
            route.name === 'Menu' ? 'Menú' : 
            route.name === 'Polizas' ? 'Pólizas' : route.name;

          return (
            <TouchableOpacity
              key={route.key}
              style={styles.tabItem}
              onPress={onPress}
            >
              <Ionicons 
                name={iconName} 
                size={22} 
                color={isFocused ? '#6172FD' : '#9CA3AF'} 
              />
              <Text style={[styles.tabLabel, { color: isFocused ? '#6172FD' : '#9CA3AF' }]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const hideTabBarScreens = ['CreateCliente', 'CreatePoliza'];

const getTabBarVisibility = (route: any) => {
  const routeName = getFocusedRouteNameFromRoute(route);
  if (routeName && hideTabBarScreens.includes(routeName)) {
    return 'none' as const;
  }
  return 'flex' as const;
};

const BottomTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      tabBar={(props) => {
        const currentRoute = props.state.routes[props.state.index];
        const display = getTabBarVisibility(currentRoute);
        if (display === 'none') return null;
        return <CustomTabBar {...props} />;
      }}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Inicio" component={HomeScreen} />
      <Tab.Screen name="Clientes" component={ClientesStackNavigator} />
      <Tab.Screen name="Herramientas" component={DashboardScreen} />
      <Tab.Screen name="Polizas" component={PolizasStackNavigator} />
      <Tab.Screen name="Menu" component={MenuStackNavigator} />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  overlay: {
    position: 'absolute',
    top: -1000,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  fanContainer: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  fanItem: {
    position: 'absolute',
    alignItems: 'center',
  },
  fanButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#6172FD',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  fanLabel: {
    fontSize: 10,
    fontFamily: 'Montserrat_500Medium',
    color: '#374151',
    marginTop: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  curveBackground: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  svgCurve: {
    position: 'absolute',
    bottom: 0,
  },
  tabItemsContainer: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    paddingBottom: 20,
    alignItems: 'flex-end',
    justifyContent: 'space-around',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 5,
  },
  tabLabel: {
    fontSize: 10,
    fontFamily: 'Montserrat_500Medium',
    marginTop: 4,
  },
  centerButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: -35,
  },
  centerButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#6172FD',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6172FD',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  centerLabel: {
    fontSize: 8,
    fontFamily: 'Montserrat_600SemiBold',
    marginTop: 2,
    color: '#FFFFFF',
  },
});

export default BottomTabNavigator;
