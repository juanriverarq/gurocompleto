import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const TermsScreen: React.FC = () => {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Políticas de Uso</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Última actualización */}
        <View style={styles.updateBadge}>
          <Ionicons name="time-outline" size={16} color="#6B7280" />
          <Text style={styles.updateText}>Última actualización: Enero 2026</Text>
        </View>

        {/* Introducción */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconContainer, { backgroundColor: '#6172FD20' }]}>
              <Ionicons name="document-text-outline" size={24} color="#6172FD" />
            </View>
            <Text style={styles.sectionTitle}>Introducción</Text>
          </View>
          <Text style={styles.paragraph}>
            Bienvenido a Guro. Al acceder y utilizar nuestra aplicación móvil y servicios, usted acepta cumplir con estos términos y condiciones de uso. Por favor, lea detenidamente este documento antes de utilizar nuestros servicios.
          </Text>
        </View>

        {/* Definiciones */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconContainer, { backgroundColor: '#10B98120' }]}>
              <Ionicons name="book-outline" size={24} color="#10B981" />
            </View>
            <Text style={styles.sectionTitle}>Definiciones</Text>
          </View>
          <View style={styles.definitionItem}>
            <Text style={styles.definitionTerm}>• "Guro":</Text>
            <Text style={styles.definitionText}> Se refiere a la plataforma, aplicación móvil y todos los servicios asociados.</Text>
          </View>
          <View style={styles.definitionItem}>
            <Text style={styles.definitionTerm}>• "Usuario":</Text>
            <Text style={styles.definitionText}> Cualquier persona que acceda o utilice los servicios de Guro.</Text>
          </View>
          <View style={styles.definitionItem}>
            <Text style={styles.definitionTerm}>• "Contenido":</Text>
            <Text style={styles.definitionText}> Toda información, datos, textos e imágenes disponibles en la plataforma.</Text>
          </View>
        </View>

        {/* Uso Aceptable */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconContainer, { backgroundColor: '#F59E0B20' }]}>
              <Ionicons name="checkmark-circle-outline" size={24} color="#F59E0B" />
            </View>
            <Text style={styles.sectionTitle}>Uso Aceptable</Text>
          </View>
          <Text style={styles.paragraph}>
            Al utilizar Guro, usted se compromete a:
          </Text>
          <View style={styles.listItem}>
            <Ionicons name="checkmark" size={16} color="#10B981" />
            <Text style={styles.listText}>Proporcionar información veraz y actualizada.</Text>
          </View>
          <View style={styles.listItem}>
            <Ionicons name="checkmark" size={16} color="#10B981" />
            <Text style={styles.listText}>Mantener la confidencialidad de sus credenciales de acceso.</Text>
          </View>
          <View style={styles.listItem}>
            <Ionicons name="checkmark" size={16} color="#10B981" />
            <Text style={styles.listText}>Utilizar la plataforma únicamente para fines legales y autorizados.</Text>
          </View>
          <View style={styles.listItem}>
            <Ionicons name="checkmark" size={16} color="#10B981" />
            <Text style={styles.listText}>Respetar los derechos de propiedad intelectual.</Text>
          </View>
          <View style={styles.listItem}>
            <Ionicons name="checkmark" size={16} color="#10B981" />
            <Text style={styles.listText}>No intentar acceder a sistemas o datos no autorizados.</Text>
          </View>
        </View>

        {/* Restricciones */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconContainer, { backgroundColor: '#EF444420' }]}>
              <Ionicons name="close-circle-outline" size={24} color="#EF4444" />
            </View>
            <Text style={styles.sectionTitle}>Restricciones</Text>
          </View>
          <Text style={styles.paragraph}>
            Está prohibido:
          </Text>
          <View style={styles.listItem}>
            <Ionicons name="close" size={16} color="#EF4444" />
            <Text style={styles.listText}>Copiar, modificar o distribuir el contenido sin autorización.</Text>
          </View>
          <View style={styles.listItem}>
            <Ionicons name="close" size={16} color="#EF4444" />
            <Text style={styles.listText}>Realizar ingeniería inversa del software.</Text>
          </View>
          <View style={styles.listItem}>
            <Ionicons name="close" size={16} color="#EF4444" />
            <Text style={styles.listText}>Usar la plataforma para actividades ilegales o fraudulentas.</Text>
          </View>
          <View style={styles.listItem}>
            <Ionicons name="close" size={16} color="#EF4444" />
            <Text style={styles.listText}>Compartir credenciales de acceso con terceros.</Text>
          </View>
        </View>

        {/* Propiedad Intelectual */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconContainer, { backgroundColor: '#8B5CF620' }]}>
              <Ionicons name="shield-checkmark-outline" size={24} color="#8B5CF6" />
            </View>
            <Text style={styles.sectionTitle}>Propiedad Intelectual</Text>
          </View>
          <Text style={styles.paragraph}>
            Todos los derechos de propiedad intelectual sobre Guro, incluyendo pero no limitado a marcas, logos, diseños, código fuente y contenido, son propiedad exclusiva de Guro o sus licenciantes. El uso de la plataforma no otorga ningún derecho de propiedad sobre estos elementos.
          </Text>
        </View>

        {/* Limitación de Responsabilidad */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconContainer, { backgroundColor: '#3B82F620' }]}>
              <Ionicons name="alert-circle-outline" size={24} color="#3B82F6" />
            </View>
            <Text style={styles.sectionTitle}>Limitación de Responsabilidad</Text>
          </View>
          <Text style={styles.paragraph}>
            Guro proporciona sus servicios "tal cual" y no garantiza que la plataforma esté libre de errores o interrupciones. En ningún caso Guro será responsable por daños indirectos, incidentales o consecuentes derivados del uso de la plataforma.
          </Text>
        </View>

        {/* Modificaciones */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconContainer, { backgroundColor: '#6B728020' }]}>
              <Ionicons name="create-outline" size={24} color="#6B7280" />
            </View>
            <Text style={styles.sectionTitle}>Modificaciones</Text>
          </View>
          <Text style={styles.paragraph}>
            Guro se reserva el derecho de modificar estos términos en cualquier momento. Los cambios serán notificados a través de la aplicación o por correo electrónico. El uso continuado de la plataforma después de dichas modificaciones constituye su aceptación de los nuevos términos.
          </Text>
        </View>

        {/* Contacto */}
        <View style={styles.contactCard}>
          <Ionicons name="mail-outline" size={28} color="#6172FD" />
          <Text style={styles.contactTitle}>¿Tienes preguntas?</Text>
          <Text style={styles.contactText}>
            Si tienes dudas sobre estas políticas, contáctanos en:
          </Text>
          <Text style={styles.contactEmail}>legal@guro.co</Text>
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
    height: 120,
    backgroundColor: '#6172FD',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 45,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Montserrat_700Bold',
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
  },
  paragraph: {
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
    color: '#4B5563',
    lineHeight: 22,
  },
  definitionItem: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  definitionTerm: {
    fontSize: 14,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#1F2937',
  },
  definitionText: {
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
    color: '#4B5563',
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
    color: '#6172FD',
    marginTop: 8,
  },
});

export default TermsScreen;
