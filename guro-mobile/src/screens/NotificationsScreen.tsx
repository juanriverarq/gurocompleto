import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  Switch,
  Alert,
  Linking,
  ImageBackground,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

const NOTIFICATION_SETTINGS_KEY = '@notification_settings';

interface NotificationSettings {
  polizasVencimiento: boolean;
  nuevosClientes: boolean;
  mensajesWhatsApp: boolean;
  recordatorios: boolean;
  actualizaciones: boolean;
  promociones: boolean;
}

const defaultSettings: NotificationSettings = {
  polizasVencimiento: true,
  nuevosClientes: true,
  mensajesWhatsApp: true,
  recordatorios: true,
  actualizaciones: true,
  promociones: false,
};

const NotificationsScreen: React.FC = () => {
  const navigation = useNavigation();
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    loadSettings();
    checkPermission();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
      if (stored) {
        setSettings(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
  };

  const saveSettings = async (newSettings: NotificationSettings) => {
    try {
      await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('Error saving notification settings:', error);
    }
  };

  const checkPermission = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    setPermissionGranted(status === 'granted');
  };

  const toggleSetting = (key: keyof NotificationSettings) => {
    if (!permissionGranted) {
      Alert.alert(
        'Permisos Requeridos',
        'Necesitas activar los permisos de notificaciones para configurar estas opciones.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Ir a Configuración', onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }
    
    const newSettings = { ...settings, [key]: !settings[key] };
    saveSettings(newSettings);
  };

  const notificationOptions = [
    {
      key: 'polizasVencimiento' as keyof NotificationSettings,
      title: 'Vencimiento de Pólizas',
      description: 'Alertas cuando una póliza está próxima a vencer',
      icon: 'calendar-outline' as const,
      iconColor: '#EF4444',
    },
    {
      key: 'nuevosClientes' as keyof NotificationSettings,
      title: 'Nuevos Clientes',
      description: 'Notificaciones de nuevos clientes registrados',
      icon: 'person-add-outline' as const,
      iconColor: '#10B981',
    },
    {
      key: 'mensajesWhatsApp' as keyof NotificationSettings,
      title: 'Mensajes WhatsApp',
      description: 'Nuevos mensajes en el inbox de WhatsApp',
      icon: 'logo-whatsapp' as const,
      iconColor: '#25D366',
    },
    {
      key: 'recordatorios' as keyof NotificationSettings,
      title: 'Recordatorios',
      description: 'Recordatorios de tareas y seguimientos',
      icon: 'alarm-outline' as const,
      iconColor: '#F59E0B',
    },
    {
      key: 'actualizaciones' as keyof NotificationSettings,
      title: 'Actualizaciones',
      description: 'Novedades y mejoras de la aplicación',
      icon: 'refresh-outline' as const,
      iconColor: '#3B82F6',
    },
    {
      key: 'promociones' as keyof NotificationSettings,
      title: 'Promociones',
      description: 'Ofertas especiales y promociones',
      icon: 'pricetag-outline' as const,
      iconColor: '#8B5CF6',
    },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <ImageBackground
        source={require('../../assets/backgrounds/hero-gradient.png')}
        style={styles.header}
        imageStyle={{ transform: [{ scale: 2 }] }}
        resizeMode="cover"
      >
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notificaciones</Text>
        <View style={styles.headerPlaceholder} />
      </ImageBackground>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Estado de permisos */}
        {!permissionGranted && (
          <TouchableOpacity 
            style={styles.warningCard}
            onPress={() => Linking.openSettings()}
          >
            <Ionicons name="warning-outline" size={24} color="#F59E0B" />
            <View style={styles.warningContent}>
              <Text style={styles.warningTitle}>Notificaciones Desactivadas</Text>
              <Text style={styles.warningText}>
                Toca aquí para activar las notificaciones en la configuración del sistema.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#F59E0B" />
          </TouchableOpacity>
        )}

        {/* Descripción */}
        <View style={styles.descriptionCard}>
          <Ionicons name="notifications-outline" size={40} color="#573CFF" />
          <Text style={styles.descriptionTitle}>Personaliza tus Alertas</Text>
          <Text style={styles.descriptionText}>
            Elige qué tipo de notificaciones deseas recibir para mantenerte informado.
          </Text>
        </View>

        {/* Opciones de notificación */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tipos de Notificaciones</Text>

          {notificationOptions.map((option) => (
            <View key={option.key} style={styles.optionCard}>
              <View style={styles.optionLeft}>
                <View style={[styles.iconContainer, { backgroundColor: option.iconColor + '20' }]}>
                  <Ionicons name={option.icon} size={22} color={option.iconColor} />
                </View>
                <View style={styles.optionInfo}>
                  <Text style={styles.optionTitle}>{option.title}</Text>
                  <Text style={styles.optionDescription}>{option.description}</Text>
                </View>
              </View>
              <Switch
                value={settings[option.key]}
                onValueChange={() => toggleSetting(option.key)}
                trackColor={{ false: '#E5E7EB', true: '#573CFF' }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#E5E7EB"
                disabled={!permissionGranted}
              />
            </View>
          ))}
        </View>

        {/* Información adicional */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={20} color="#6B7280" />
          <Text style={styles.infoText}>
            Puedes cambiar estas preferencias en cualquier momento. Las notificaciones importantes del sistema siempre se enviarán.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingTop: 54,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
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
  headerPlaceholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 120,
  },
  warningCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F59E0B40',
  },
  warningContent: {
    flex: 1,
    marginHorizontal: 12,
  },
  warningTitle: {
    fontSize: 14,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#92400E',
    marginBottom: 2,
  },
  warningText: {
    fontSize: 12,
    fontFamily: 'Montserrat_400Regular',
    color: '#A16207',
  },
  descriptionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  descriptionTitle: {
    fontSize: 18,
    fontFamily: 'Montserrat_700Bold',
    color: '#1F2937',
    marginTop: 12,
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#6B7280',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  optionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionInfo: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 15,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#1F2937',
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: 12,
    fontFamily: 'Montserrat_400Regular',
    color: '#6B7280',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Montserrat_400Regular',
    color: '#6B7280',
    lineHeight: 18,
  },
});

export default NotificationsScreen;
