import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  ImageBackground,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const PrivacyScreen: React.FC = () => {
  const navigation = useNavigation();

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
        <Text style={styles.headerTitle}>Políticas de Privacidad</Text>
        <View style={styles.headerPlaceholder} />
      </ImageBackground>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Última actualización */}
        <View style={styles.updateBadge}>
          <Ionicons name="time-outline" size={16} color="#6B7280" />
          <Text style={styles.updateText}>Última actualización: Enero 2026</Text>
        </View>

        {/* Introducción */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconContainer, { backgroundColor: '#573CFF20' }]}>
              <Ionicons name="lock-closed-outline" size={24} color="#573CFF" />
            </View>
            <Text style={styles.sectionTitle}>Tu Privacidad es Importante</Text>
          </View>
          <Text style={styles.paragraph}>
            En Guro nos comprometemos a proteger tu privacidad y la de tus clientes. Esta política describe cómo recopilamos, usamos y protegemos tu información personal.
          </Text>
        </View>

        {/* Información que Recopilamos */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconContainer, { backgroundColor: '#10B98120' }]}>
              <Ionicons name="folder-outline" size={24} color="#10B981" />
            </View>
            <Text style={styles.sectionTitle}>Información que Recopilamos</Text>
          </View>
          <Text style={styles.subTitle}>Información de Cuenta</Text>
          <View style={styles.listItem}>
            <Ionicons name="person-outline" size={16} color="#573CFF" />
            <Text style={styles.listText}>Nombre completo y datos de contacto</Text>
          </View>
          <View style={styles.listItem}>
            <Ionicons name="mail-outline" size={16} color="#573CFF" />
            <Text style={styles.listText}>Correo electrónico</Text>
          </View>
          <View style={styles.listItem}>
            <Ionicons name="call-outline" size={16} color="#573CFF" />
            <Text style={styles.listText}>Número de teléfono</Text>
          </View>
          <View style={styles.listItem}>
            <Ionicons name="business-outline" size={16} color="#573CFF" />
            <Text style={styles.listText}>Información de la agencia o correduría</Text>
          </View>

          <Text style={[styles.subTitle, { marginTop: 16 }]}>Información de Uso</Text>
          <View style={styles.listItem}>
            <Ionicons name="analytics-outline" size={16} color="#573CFF" />
            <Text style={styles.listText}>Datos de navegación y uso de la aplicación</Text>
          </View>
          <View style={styles.listItem}>
            <Ionicons name="phone-portrait-outline" size={16} color="#573CFF" />
            <Text style={styles.listText}>Información del dispositivo</Text>
          </View>
          <View style={styles.listItem}>
            <Ionicons name="location-outline" size={16} color="#573CFF" />
            <Text style={styles.listText}>Ubicación aproximada (si lo autorizas)</Text>
          </View>
        </View>

        {/* Uso de la Información */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconContainer, { backgroundColor: '#F59E0B20' }]}>
              <Ionicons name="settings-outline" size={24} color="#F59E0B" />
            </View>
            <Text style={styles.sectionTitle}>Cómo Usamos tu Información</Text>
          </View>
          <View style={styles.listItem}>
            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
            <Text style={styles.listText}>Proporcionar y mejorar nuestros servicios</Text>
          </View>
          <View style={styles.listItem}>
            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
            <Text style={styles.listText}>Personalizar tu experiencia en la plataforma</Text>
          </View>
          <View style={styles.listItem}>
            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
            <Text style={styles.listText}>Enviar notificaciones importantes sobre tu cuenta</Text>
          </View>
          <View style={styles.listItem}>
            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
            <Text style={styles.listText}>Comunicar actualizaciones y novedades</Text>
          </View>
          <View style={styles.listItem}>
            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
            <Text style={styles.listText}>Prevenir fraudes y garantizar la seguridad</Text>
          </View>
          <View style={styles.listItem}>
            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
            <Text style={styles.listText}>Cumplir con obligaciones legales</Text>
          </View>
        </View>

        {/* Protección de Datos */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconContainer, { backgroundColor: '#8B5CF620' }]}>
              <Ionicons name="shield-checkmark-outline" size={24} color="#8B5CF6" />
            </View>
            <Text style={styles.sectionTitle}>Protección de Datos</Text>
          </View>
          <Text style={styles.paragraph}>
            Implementamos medidas de seguridad técnicas y organizativas para proteger tu información:
          </Text>
          <View style={styles.securityItem}>
            <View style={styles.securityIcon}>
              <Ionicons name="key-outline" size={20} color="#8B5CF6" />
            </View>
            <View style={styles.securityContent}>
              <Text style={styles.securityTitle}>Encriptación</Text>
              <Text style={styles.securityText}>Todos los datos se transmiten con encriptación SSL/TLS</Text>
            </View>
          </View>
          <View style={styles.securityItem}>
            <View style={styles.securityIcon}>
              <Ionicons name="server-outline" size={20} color="#8B5CF6" />
            </View>
            <View style={styles.securityContent}>
              <Text style={styles.securityTitle}>Servidores Seguros</Text>
              <Text style={styles.securityText}>Infraestructura con certificaciones de seguridad</Text>
            </View>
          </View>
          <View style={styles.securityItem}>
            <View style={styles.securityIcon}>
              <Ionicons name="refresh-outline" size={20} color="#8B5CF6" />
            </View>
            <View style={styles.securityContent}>
              <Text style={styles.securityTitle}>Respaldos</Text>
              <Text style={styles.securityText}>Copias de seguridad automáticas diarias</Text>
            </View>
          </View>
        </View>

        {/* Tus Derechos */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconContainer, { backgroundColor: '#3B82F620' }]}>
              <Ionicons name="hand-left-outline" size={24} color="#3B82F6" />
            </View>
            <Text style={styles.sectionTitle}>Tus Derechos</Text>
          </View>
          <Text style={styles.paragraph}>
            Como usuario, tienes derecho a:
          </Text>
          <View style={styles.rightItem}>
            <Text style={styles.rightTitle}>Acceso</Text>
            <Text style={styles.rightText}>Solicitar una copia de tus datos personales</Text>
          </View>
          <View style={styles.rightItem}>
            <Text style={styles.rightTitle}>Rectificación</Text>
            <Text style={styles.rightText}>Corregir información inexacta o incompleta</Text>
          </View>
          <View style={styles.rightItem}>
            <Text style={styles.rightTitle}>Eliminación</Text>
            <Text style={styles.rightText}>Solicitar la eliminación de tus datos</Text>
          </View>
          <View style={styles.rightItem}>
            <Text style={styles.rightTitle}>Portabilidad</Text>
            <Text style={styles.rightText}>Recibir tus datos en formato estructurado</Text>
          </View>
          <View style={styles.rightItem}>
            <Text style={styles.rightTitle}>Oposición</Text>
            <Text style={styles.rightText}>Oponerte al procesamiento de tus datos</Text>
          </View>
        </View>

        {/* Cookies */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconContainer, { backgroundColor: '#EF444420' }]}>
              <Ionicons name="information-circle-outline" size={24} color="#EF4444" />
            </View>
            <Text style={styles.sectionTitle}>Cookies y Tecnologías</Text>
          </View>
          <Text style={styles.paragraph}>
            Utilizamos cookies y tecnologías similares para mejorar tu experiencia, analizar el uso de la plataforma y personalizar contenido. Puedes gestionar tus preferencias de cookies en la configuración de la aplicación.
          </Text>
        </View>

        {/* Contacto */}
        <View style={styles.contactCard}>
          <Ionicons name="shield-outline" size={28} color="#573CFF" />
          <Text style={styles.contactTitle}>Oficial de Protección de Datos</Text>
          <Text style={styles.contactText}>
            Para ejercer tus derechos o consultas sobre privacidad:
          </Text>
          <Text style={styles.contactEmail}>privacidad@guro.co</Text>
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
    width: 38,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 120,
  },
  updateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 20,
    gap: 6,
  },
  updateText: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#6B7280',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: 'Montserrat_700Bold',
    color: '#1F2937',
    flex: 1,
  },
  subTitle: {
    fontSize: 14,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#374151',
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
    color: '#4B5563',
    lineHeight: 22,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 10,
    gap: 10,
  },
  listText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
    color: '#4B5563',
    lineHeight: 20,
  },
  securityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 16,
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 10,
  },
  securityIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#8B5CF620',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  securityContent: {
    flex: 1,
  },
  securityTitle: {
    fontSize: 14,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#1F2937',
    marginBottom: 2,
  },
  securityText: {
    fontSize: 12,
    fontFamily: 'Montserrat_400Regular',
    color: '#6B7280',
  },
  rightItem: {
    marginTop: 12,
    paddingLeft: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#3B82F6',
  },
  rightTitle: {
    fontSize: 14,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#1F2937',
    marginBottom: 2,
  },
  rightText: {
    fontSize: 13,
    fontFamily: 'Montserrat_400Regular',
    color: '#6B7280',
  },
  contactCard: {
    backgroundColor: '#EEF2FF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  contactTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#1F2937',
    marginTop: 12,
    marginBottom: 8,
  },
  contactText: {
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  contactEmail: {
    fontSize: 15,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#573CFF',
    marginTop: 8,
  },
});

export default PrivacyScreen;
