import React, { useState } from 'react';
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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../context/AuthContext';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

type LoginScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Login'>;
};

const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, loading } = useAuth();

  const handleLogin = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Por favor ingresa tu correo electronico');
      return;
    }
    if (!password.trim()) {
      Alert.alert('Error', 'Por favor ingresa tu contrasena');
      return;
    }

    const result = await login(email.trim(), password);
    
    if (!result.success) {
      Alert.alert('Error', result.message);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor="#6172FD" />
      
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Inicio de Sesion</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Correo electronico</Text>
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
              <Text style={styles.label}>Contrasena</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="********"
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

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Iniciar Sesion</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.forgotPassword}>
              <Text style={styles.forgotPasswordText}>Olvidaste tu contrasena?</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>No tienes una cuenta? </Text>
            <TouchableOpacity onPress={() => Linking.openURL('https://guro.co/')}>
              <Text style={styles.registerLink}>Registrate</Text>
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
    backgroundColor: '#FFFFFF' 
  },
  header: {
    height: 110,
    backgroundColor: '#6172FD',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingBottom: 15,
    paddingHorizontal: 16,
  },
  backButton: {
    width: 40,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backArrow: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: 'bold',
    lineHeight: 24,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#FFFFFF',
  },
  headerSpacer: {
    width: 40,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },
  form: {
    width: '100%',
  },
  inputContainer: { 
    marginBottom: 20 
  },
  label: { 
    fontSize: 14, 
    fontFamily: 'Montserrat_600SemiBold', 
    color: '#374151', 
    marginBottom: 8 
  },
  input: {
    backgroundColor: '#F9FAFB', 
    borderWidth: 1, 
    borderColor: '#E5E7EB',
    borderRadius: 12, 
    paddingHorizontal: 16, 
    paddingVertical: 14, 
    fontSize: 16, 
    fontFamily: 'Montserrat_400Regular',
    color: '#111827',
  },
  passwordContainer: {
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#F9FAFB',
    borderWidth: 1, 
    borderColor: '#E5E7EB', 
    borderRadius: 12,
  },
  passwordInput: { 
    flex: 1, 
    paddingHorizontal: 16, 
    paddingVertical: 14, 
    fontSize: 16, 
    fontFamily: 'Montserrat_400Regular',
    color: '#111827' 
  },
  eyeButton: { 
    paddingHorizontal: 16 
  },
  eyeText: { 
    fontSize: 14, 
    color: '#6172FD' 
  },
  button: { 
    backgroundColor: '#6172FD', 
    borderRadius: 12, 
    paddingVertical: 16, 
    alignItems: 'center', 
    marginTop: 10,
    shadowColor: '#6172FD',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonDisabled: { 
    backgroundColor: '#A5B4FC' 
  },
  buttonText: { 
    color: '#FFFFFF', 
    fontSize: 16, 
    fontFamily: 'Montserrat_600SemiBold' 
  },
  forgotPassword: { 
    alignItems: 'center', 
    marginTop: 20 
  },
  forgotPasswordText: { 
    color: '#6172FD', 
    fontSize: 14 
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 30,
  },
  registerText: {
    color: '#6B7280',
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
  },
  registerLink: {
    color: '#6172FD',
    fontSize: 14,
    fontFamily: 'Montserrat_600SemiBold',
  },
});

export default LoginScreen;
