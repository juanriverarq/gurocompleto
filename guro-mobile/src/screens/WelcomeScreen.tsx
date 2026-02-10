import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  Animated,
  ImageBackground,
  PanResponder,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Ionicons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

type WelcomeScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Welcome'>;
};

const SWIPE_THRESHOLD = screenWidth * 0.35;

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ navigation }) => {
  const purpleWidth = useRef(new Animated.Value(56)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const navigated = useRef(false);
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(30)).current;

  React.useEffect(() => {
    Animated.timing(textOpacity, {
      toValue: 1,
      duration: 800,
      delay: 400,
      useNativeDriver: true,
    }).start();
    Animated.timing(textTranslateY, {
      toValue: 0,
      duration: 800,
      delay: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  const completeNavigation = () => {
    if (navigated.current) return;
    navigated.current = true;

    Animated.timing(purpleWidth, {
      toValue: screenWidth,
      duration: 200,
      useNativeDriver: false,
    }).start(() => {
      navigation.navigate('Login');
      setTimeout(() => {
        purpleWidth.setValue(56);
        scaleAnim.setValue(1);
        navigated.current = false;
      }, 500);
    });
  };

  const animateAndNavigate = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      friction: 8,
      tension: 120,
    }).start();

    completeNavigation();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 5,
      onPanResponderMove: (_, gs) => {
        if (gs.dx > 0) {
          purpleWidth.setValue(56 + gs.dx);
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx >= SWIPE_THRESHOLD) {
          completeNavigation();
        } else {
          Animated.spring(purpleWidth, {
            toValue: 56,
            useNativeDriver: false,
            friction: 6,
            tension: 80,
          }).start();
        }
      },
    })
  ).current;

  return (
    <ImageBackground
      source={require('../../assets/backgrounds/hero-gradient.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <StatusBar style="light" />

      {/* Lottie Logo */}
      <View style={styles.lottieContainer}>
        <LottieView
          source={require('../../LOTTIE.json')}
          style={styles.lottie}
          autoPlay
          loop
        />
      </View>

      {/* Title + subtitle */}
      <Animated.View style={[styles.textContainer, { opacity: textOpacity, transform: [{ translateY: textTranslateY }] }]}>
        <Text style={styles.title}>
          Tu agencia de seguros{'\n'}en tu bolsillo
        </Text>
        <Text style={styles.subtitle}>
          Clientes, pólizas, renovaciones, cobros y WhatsApp. Todo desde tu celular.
        </Text>
        <Text style={styles.italicNote}>(sí, es realmente así de simple)</Text>
      </Animated.View>

      {/* CTA with swipe + tap */}
      <View style={styles.ctaContainer}>
        <Pressable onPress={animateAndNavigate}>
          <Animated.View
            style={[styles.ctaButton, { transform: [{ scale: scaleAnim }] }]}
            {...panResponder.panHandlers}
          >
            <Animated.View style={[styles.ctaIconBox, { width: purpleWidth }]} />
            <View style={styles.ctaContentOverlay}>
              <View style={styles.ctaArrowWrap}>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </View>
              <Text style={styles.ctaText}>DESLIZA O TOCA</Text>
            </View>
          </Animated.View>
        </Pressable>
      </View>

      {/* Version */}
      <View style={styles.footer}>
        <Text style={styles.versionText}>Versión 1.0.0</Text>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  lottieContainer: {
    alignItems: 'center',
    marginTop: -screenHeight * 0.04,
  },
  lottie: {
    width: 480,
    height: 480,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  title: {
    fontSize: 30,
    fontFamily: 'Montserrat_700Bold',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 36,
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_600SemiBold',
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 320,
    marginBottom: 10,
  },
  italicNote: {
    fontSize: 13,
    fontFamily: 'Montserrat_400Regular',
    color: 'rgba(255,255,255,0.35)',
    fontStyle: 'italic',
  },
  ctaContainer: {
    alignItems: 'center',
    paddingHorizontal: 28,
    marginBottom: 40,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d0d0d',
    borderRadius: 20,
    height: 56,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  ctaIconBox: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: 56,
    backgroundColor: '#573CFF',
    borderRadius: 20,
  },
  ctaContentOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
  },
  ctaArrowWrap: {
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaText: {
    paddingHorizontal: 20,
    fontSize: 11,
    fontFamily: 'Montserrat_700Bold',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  footer: {
    paddingBottom: 30,
    alignItems: 'center',
  },
  versionText: {
    fontSize: 11,
    fontFamily: 'Montserrat_400Regular',
    color: 'rgba(255,255,255,0.25)',
  },
});

export default WelcomeScreen;
