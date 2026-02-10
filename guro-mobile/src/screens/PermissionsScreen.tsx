import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  Switch,
  Alert,
  Linking,
  Platform,
  ImageBackground,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';

interface PermissionItem {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  enabled: boolean;
  onToggle: () => void;
}

const PermissionsScreen: React.FC = () => {
  const navigation = useNavigation();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    try {
      // Verificar permisos de notificaciones
      const { status } = await Notifications.getPermissionsAsync();
      setNotificationsEnabled(status === 'granted');
    } catch (error) {
      console.error('Error checking permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const requestNotificationPermission = async () => {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      
      if (existingStatus === 'granted') {
        // Ya tiene permisos, preguntar si quiere desactivar
        Alert.alert(
          'Notificaciones Activadas',
          'Las notificaciones ya están activadas. Para desactivarlas, ve a la configuración de tu dispositivo.',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Ir a Configuración', onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }

      if (existingStatus === 'denied') {
        // Permiso denegado previamente, redirigir a configuración
        Alert.alert(
          'Permiso Requerido',
          'Para recibir notificaciones, necesitas activarlas en la configuración de tu dispositivo.',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Ir a Configuración', onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }

      // Solicitar permiso
      const { status } = await Notifications.requestPermissionsAsync();
      setNotificationsEnabled(status === 'granted');

      if (status === 'granted') {
        Alert.alert('¡Listo!', 'Las notificaciones han sido activadas correctamente.');
      } else {
        Alert.alert(
          'Permiso Denegado',
          'No podrás recibir notificaciones de la app. Puedes activarlas más tarde en la configuración.',
        );
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      Alert.alert('Error', 'No se pudo solicitar el permiso de notificaciones.');
    }
  };

  const openAppSettings = () => {
    Linking.openSettings();
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <ImageBackground
        source={require('../../assets/backgrounds/hero-gradient.webp')}
        style={styles.header}
        imageStyle={{ transform: [{ scale: 2 }] }}
        resizeMode="cover"
      >
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Permisos</Text>
        <View style={styles.headerPlaceholder} />
      </ImageBackground>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Descripción */}
        <View style={styles.descriptionCard}>
          <Ionicons name="shield-checkmark-outline" size={40} color="#573CFF" />
          <Text style={styles.descriptionTitle}>Gestiona tus Permisos</Text>
          <Text style={styles.descriptionText}>
            Controla qué permisos tiene la app para brindarte una mejor experiencia.
          </Text>
        </View>

        {/* Permisos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Permisos de la App</Text>

          {/* Notificaciones */}
          <View style={styles.permissionCard}>
            <View style={styles.permissionLeft}>
              <View style={[styles.iconContainer, { backgroundColor: '#EF444420' }]}>
                <Ionicons name="notifications-outline" size={24} color="#EF4444" />
              </View>
              <View style={styles.permissionInfo}>
                <Text style={styles.permissionTitle}>Notificaciones</Text>
                <Text style={styles.permissionDescription}>
                  Recibe alertas sobre vencimientos de pólizas, mensajes y más.
                </Text>
              </View>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={requestNotificationPermission}
              trackColor={{ false: '#E5E7EB', true: '#573CFF' }}
              thumbColor={notificationsEnabled ? '#FFFFFF' : '#FFFFFF'}
              ios_backgroundColor="#E5E7EB"
            />
          </View>

          {/* Información adicional */}
          <View style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={20} color="#6B7280" />
            <Text style={styles.infoText}>
              Algunos permisos solo pueden modificarse desde la configuración del sistema.
            </Text>
          </View>
        </View>

        {/* Acciones */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Configuración del Sistema</Text>
          
          <TouchableOpacity style={styles.actionCard} onPress={openAppSettings}>
            <View style={styles.actionLeft}>
              <View style={[styles.iconContainer, { backgroundColor: '#3B82F620' }]}>
                <Ionicons name="settings-outline" size={24} color="#3B82F6" />
              </View>
              <View style={styles.actionInfo}>
                <Text style={styles.actionTitle}>Abrir Configuración</Text>
                <Text style={styles.actionDescription}>
                  Gestiona todos los permisos de la app
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Estado de permisos */}
        <View style={styles.statusSection}>
          <Text style={styles.statusTitle}>Estado Actual</Text>
          <View style={styles.statusRow}>
            <View style={styles.statusItem}>
              <View style={[
                styles.statusDot, 
                { backgroundColor: notificationsEnabled ? '#10B981' : '#EF4444' }
              ]} />
              <Text style={styles.statusLabel}>Notificaciones</Text>
            </View>
          </View>
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
    letterSpacing: -0.3,
    color: '#FFFFFF',
    textAlign: 'center',
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
  permissionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  permissionLeft: {
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
  permissionInfo: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: 15,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#1F2937',
    marginBottom: 4,
  },
  permissionDescription: {
    fontSize: 12,
    fontFamily: 'Montserrat_400Regular',
    color: '#6B7280',
    lineHeight: 16,
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
  actionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  actionInfo: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#1F2937',
    marginBottom: 2,
  },
  actionDescription: {
    fontSize: 12,
    fontFamily: 'Montserrat_400Regular',
    color: '#6B7280',
  },
  statusSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statusTitle: {
    fontSize: 14,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#1F2937',
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusLabel: {
    fontSize: 13,
    fontFamily: 'Montserrat_500Medium',
    color: '#374151',
  },
});

export default PermissionsScreen;
