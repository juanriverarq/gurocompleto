import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  Image,
  Linking,
  Alert,
  ImageBackground,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { MenuStackParamList } from '../navigation/MenuStackNavigator';

type NavigationProp = NativeStackNavigationProp<MenuStackParamList>;

const MenuScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { logout, user, broker } = useAuth();

  const getUserName = () => {
    if (broker?.name) return broker.name;
    if (user?.displayName) return user.displayName;
    if (user?.email) return user.email.split('@')[0];
    return 'Usuario';
  };

  const getUserEmail = () => {
    return user?.email || broker?.email || '';
  };

  const openWhatsApp = () => {
    const phoneNumber = '573105360658'; // Número de soporte Guro
    const message = 'Hola, necesito ayuda con Guro';
    Linking.openURL(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`);
  };

  const openURL = (url: string) => {
    Linking.openURL(url);
  };

  const handleRateApp = () => {
    Alert.alert(
      'Calificar App',
      '¿Te gusta Guro? ¡Déjanos tu calificación!',
      [
        { text: 'Ahora no', style: 'cancel' },
        { text: 'Calificar', onPress: () => openURL('https://guro.co') }
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro que deseas cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Cerrar Sesión', style: 'destructive', onPress: logout }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require('../../assets/backgrounds/hero-gradient.png')}
        style={styles.header}
        imageStyle={{ transform: [{ scale: 2 }] }}
        resizeMode="cover"
      >
        <Text style={styles.headerTitle}>Menú</Text>
      </ImageBackground>
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Perfil */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={40} color="#573CFF" />
            </View>
          </View>
          <Text style={styles.userName}>{getUserName()}</Text>
          <Text style={styles.userEmail}>{getUserEmail()}</Text>
          <TouchableOpacity style={styles.viewProfileButton} onPress={() => navigation.navigate('ProfileDetail')}>
            <Text style={styles.viewProfileText}>Ver mi perfil</Text>
            <Ionicons name="chevron-forward" size={16} color="#573CFF" />
          </TouchableOpacity>
        </View>

        {/* Chat WhatsApp */}
        <View style={styles.menuSection}>
          <TouchableOpacity style={styles.menuItem} onPress={openWhatsApp}>
            <View style={[styles.menuIconContainer, { backgroundColor: '#25D36620' }]}>
              <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
            </View>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuItemText}>Chat de Ayuda</Text>
              <Text style={styles.menuItemSubtext}>Habla con nuestro bot de WhatsApp</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Configuración y Privacidad */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Configuración y Privacidad</Text>
          
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Permissions')}>
            <View style={[styles.menuIconContainer, { backgroundColor: '#573CFF20' }]}>
              <Ionicons name="key-outline" size={22} color="#573CFF" />
            </View>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuItemText}>Permisos</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Notifications')}>
            <View style={[styles.menuIconContainer, { backgroundColor: '#F59E0B20' }]}>
              <Ionicons name="notifications-outline" size={22} color="#F59E0B" />
            </View>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuItemText}>Notificaciones</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={[styles.menuIconContainer, { backgroundColor: '#10B98120' }]}>
              <Ionicons name="shield-checkmark-outline" size={22} color="#10B981" />
            </View>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuItemText}>Seguridad</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Información y Ayuda */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Información y Ayuda</Text>
          
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('FAQ')}>
            <View style={[styles.menuIconContainer, { backgroundColor: '#3B82F620' }]}>
              <Ionicons name="help-circle-outline" size={22} color="#3B82F6" />
            </View>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuItemText}>Preguntas Frecuentes</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => openURL('https://guro.co/ayuda')}>
            <View style={[styles.menuIconContainer, { backgroundColor: '#8B5CF620' }]}>
              <Ionicons name="headset-outline" size={22} color="#8B5CF6" />
            </View>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuItemText}>Centro de Ayuda</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Terms')}>
            <View style={[styles.menuIconContainer, { backgroundColor: '#6B728020' }]}>
              <Ionicons name="document-text-outline" size={22} color="#6B7280" />
            </View>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuItemText}>Políticas de Uso</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Privacy')}>
            <View style={[styles.menuIconContainer, { backgroundColor: '#EC489920' }]}>
              <Ionicons name="lock-closed-outline" size={22} color="#EC4899" />
            </View>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuItemText}>Políticas de Privacidad</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Calificación */}
        <View style={styles.menuSection}>
          <TouchableOpacity style={styles.menuItem} onPress={handleRateApp}>
            <View style={[styles.menuIconContainer, { backgroundColor: '#FBBF2420' }]}>
              <Ionicons name="star-outline" size={22} color="#FBBF24" />
            </View>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuItemText}>Califica la App</Text>
              <Text style={styles.menuItemSubtext}>¡Tu opinión nos ayuda a mejorar!</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Cerrar Sesión */}
        <View style={styles.menuSection}>
          <TouchableOpacity style={styles.logoutItem} onPress={handleLogout}>
            <View style={[styles.menuIconContainer, { backgroundColor: '#EF444420' }]}>
              <Ionicons name="log-out-outline" size={22} color="#EF4444" />
            </View>
            <View style={styles.menuTextContainer}>
              <Text style={styles.logoutText}>Cerrar Sesión</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.versionText}>Guro v1.0.0</Text>
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
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: 'Montserrat_700Bold',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  scrollView: {
    flex: 1,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarContainer: {
    marginBottom: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#573CFF15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userName: {
    fontSize: 20,
    fontFamily: 'Montserrat_700Bold',
    color: '#374151',
  },
  userEmail: {
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
    color: '#6B7280',
    marginTop: 4,
  },
  viewProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#573CFF10',
    borderRadius: 20,
  },
  viewProfileText: {
    fontSize: 14,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#573CFF',
    marginRight: 4,
  },
  menuSection: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 16,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#9CA3AF',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  menuItemText: {
    fontSize: 15,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#374151',
  },
  menuItemSubtext: {
    fontSize: 12,
    fontFamily: 'Montserrat_400Regular',
    color: '#9CA3AF',
    marginTop: 2,
  },
  logoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  logoutText: {
    fontSize: 15,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#EF4444',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingBottom: 120,
  },
  versionText: {
    fontSize: 12,
    fontFamily: 'Montserrat_400Regular',
    color: '#9CA3AF',
  },
});

export default MenuScreen;
