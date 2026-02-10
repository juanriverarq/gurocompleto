import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
  Linking,
  Dimensions,
  Pressable,
  Animated,
  ImageBackground,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../context/AuthContext';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Ionicons } from '@expo/vector-icons';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

type LoginScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Login'>;
};

const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, loading } = useAuth();
  const purpleWidth = useRef(new Animated.Value(56)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const animateAndExecute = (callback: () => void) => {
    // Scale down slightly
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      friction: 8,
      tension: 120,
    }).start();

    // Expand purple to full width
    Animated.timing(purpleWidth, {
      toValue: screenWidth,
      duration: 300,
      useNativeDriver: false,
    }).start(() => {
      // Scale back
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 4,
        tension: 80,
      }).start();
      callback();
      // Reset purple width after action
      setTimeout(() => {
        purpleWidth.setValue(56);
      }, 500);
    });
  };

  const handleLogin = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Por favor ingresa tu correo electrónico');
      return;
    }
    if (!password.trim()) {
      Alert.alert('Error', 'Por favor ingresa tu contraseña');
      return;
    }

    const result = await login(email.trim(), password);
    
    if (!result.success) {
      Alert.alert('Error', result.message);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Header with aurora background */}
      <ImageBackground
        source={require('../../assets/backgrounds/hero-gradient.png')}
        style={styles.header}
        imageStyle={{ transform: [{ scale: 2 }] }}
        resizeMode="cover"
      >
        <View style={styles.headerRow}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Inicia sesión</Text>
          <View style={{ width: 38 }} />
        </View>
        <Text style={styles.headerSubtitle}>Accede a tu agencia inteligente</Text>
      </ImageBackground>

      {/* Form card */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formCard}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>CORREO ELECTRÓNICO</Text>
              <TextInput
                style={styles.input}
                placeholder="tu@email.com"
                placeholderTextColor="#9CA3AF"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>CONTRASEÑA</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="••••••••"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  editable={!loading}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Text style={styles.eyeText}>{showPassword ? 'Ocultar' : 'Ver'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Pressable
              onPress={() => animateAndExecute(handleLogin)}
              disabled={loading}
            >
              <Animated.View style={[styles.ctaButton, loading && styles.ctaButtonDisabled, { transform: [{ scale: scaleAnim }] }]}>
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Animated.View style={[styles.ctaIconBox, { width: purpleWidth }]} />
                    <View style={styles.ctaContentOverlay}>
                      <View style={styles.ctaArrowWrap}>
                        <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                      </View>
                      <Text style={styles.ctaText}>INICIAR SESIÓN</Text>
                    </View>
                  </>
                )}
              </Animated.View>
            </Pressable>

            <TouchableOpacity style={styles.forgotPassword}>
              <Text style={styles.forgotPasswordText}>¿Olvidaste tu contraseña?</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>¿No tienes una cuenta? </Text>
            <TouchableOpacity onPress={() => Linking.openURL('https://guro.co/comenzar')}>
              <Text style={styles.registerLink}>Regístrate</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingTop: 54,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: 'Montserrat_700Bold',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: 'Montserrat_400Regular',
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    marginTop: 6,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  inputContainer: { 
    marginBottom: 20,
  },
  label: { 
    fontSize: 11, 
    fontFamily: 'Montserrat_700Bold', 
    color: '#0d0d0d', 
    marginBottom: 8,
    letterSpacing: 1.5,
  },
  input: {
    backgroundColor: '#f5f5f5', 
    borderWidth: 0,
    borderRadius: 16, 
    paddingHorizontal: 18, 
    paddingVertical: 15, 
    fontSize: 16, 
    fontFamily: 'Montserrat_400Regular',
    color: '#0d0d0d',
  },
  passwordContainer: {
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
  },
  passwordInput: { 
    flex: 1, 
    paddingHorizontal: 18, 
    paddingVertical: 15, 
    fontSize: 16, 
    fontFamily: 'Montserrat_400Regular',
    color: '#0d0d0d',
  },
  eyeButton: { 
    paddingHorizontal: 16,
  },
  eyeText: { 
    fontSize: 13, 
    fontFamily: 'Montserrat_600SemiBold',
    color: '#573CFF',
  },
  ctaButton: { 
    backgroundColor: '#0d0d0d',
    borderRadius: 20, 
    height: 56,
    flexDirection: 'row',
    alignItems: 'center', 
    marginTop: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  ctaButtonDisabled: { 
    backgroundColor: '#9CA3AF',
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
    position: 'absolute',
    left: 0,
    right: 0,
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
    color: '#FFFFFF', 
    fontSize: 11, 
    fontFamily: 'Montserrat_700Bold',
    letterSpacing: 2,
    paddingHorizontal: 20,
  },
  forgotPassword: { 
    alignItems: 'center', 
    marginTop: 20,
  },
  forgotPasswordText: { 
    color: '#573CFF', 
    fontSize: 13,
    fontFamily: 'Montserrat_500Medium',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 28,
  },
  registerText: {
    color: '#6B7280',
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
  },
  registerLink: {
    color: '#573CFF',
    fontSize: 14,
    fontFamily: 'Montserrat_700Bold',
  },
});

export default LoginScreen;
