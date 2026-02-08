import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import FondoSvg from '../../fondo.svg';

const { width: screenWidth } = Dimensions.get('window');

type WelcomeScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Welcome'>;
};

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor="#6172FD" />
      
      <View style={styles.header}>
        <Image 
          source={require('../../logo.png')} 
          style={styles.headerLogo}
          resizeMode="contain"
        />
      </View>
      
      <View style={{ width: screenWidth, overflow: 'hidden' }}>
        <FondoSvg 
          width={screenWidth} 
          height={screenWidth * (976 / 1080)}
        />
      </View>
      
      <View style={styles.textContainer}>
        <Text style={styles.welcomeText}>Hola, que gusto verte!</Text>
        <Text style={styles.subtitleText}>
          Gestiona tus seguros de forma simple y rapida
        </Text>
        
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.buttonText}>Iniciar Sesion</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.spacer} />

      <View style={styles.footer}>
        <Text style={styles.versionText}>Version 1.0.0</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    height: 110,
    backgroundColor: '#6172FD',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 15,
  },
  headerLogo: {
    width: 55,
    height: 55,
  },
  textContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 30,
  },
  welcomeText: {
    fontSize: 28,
    fontFamily: 'Montserrat_700Bold',
    color: '#6172FD',
    marginBottom: 12,
  },
  subtitleText: {
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
  },
  spacer: {
    flex: 1,
  },
  button: {
    backgroundColor: '#6172FD',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 60,
    alignItems: 'center',
    shadowColor: '#6172FD',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Montserrat_600SemiBold',
  },
  footer: {
    paddingBottom: 20,
    alignItems: 'center',
  },
  versionText: {
    fontSize: 12,
    fontFamily: 'Montserrat_400Regular',
    color: '#C4C4C4',
  },
});

export default WelcomeScreen;
