import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  LayoutAnimation,
  Platform,
  UIManager,
  ImageBackground,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

const faqData: FAQItem[] = [
  {
    id: '1',
    category: 'General',
    question: '¿Qué es Guro?',
    answer: 'Guro es una plataforma integral de gestión de seguros diseñada para intermediarios y corredores. Te permite administrar pólizas, clientes, renovaciones y comunicaciones desde un solo lugar.',
  },
  {
    id: '2',
    category: 'General',
    question: '¿Cómo puedo contactar al soporte?',
    answer: 'Puedes contactarnos a través del Chat de Ayuda en el menú principal, que te conectará directamente con nuestro equipo de soporte vía WhatsApp. También puedes escribirnos a soporte@guro.co.',
  },
  {
    id: '3',
    category: 'Pólizas',
    question: '¿Cómo agrego una nueva póliza?',
    answer: 'Para agregar una nueva póliza, ve a la sección de Pólizas desde el menú principal o el dashboard. Presiona el botón "+" y completa el formulario con los datos del cliente y la póliza.',
  },
  {
    id: '4',
    category: 'Pólizas',
    question: '¿Cómo recibo alertas de vencimiento?',
    answer: 'Las alertas de vencimiento se configuran automáticamente. Recibirás notificaciones 30, 15 y 7 días antes del vencimiento de cada póliza. Puedes personalizar estas alertas en Configuración > Notificaciones.',
  },
  {
    id: '5',
    category: 'Pólizas',
    question: '¿Puedo exportar mis pólizas?',
    answer: 'Sí, puedes generar un resumen PDF de cada póliza desde la pantalla de detalle. También puedes exportar listados completos desde la versión web de Guro.',
  },
  {
    id: '6',
    category: 'Clientes',
    question: '¿Cómo registro un nuevo cliente?',
    answer: 'Ve a la sección de Clientes y presiona el botón "+" para agregar un nuevo cliente. Completa la información básica como nombre, documento, teléfono y correo electrónico.',
  },
  {
    id: '7',
    category: 'Clientes',
    question: '¿Puedo ver el historial de pólizas de un cliente?',
    answer: 'Sí, al entrar al detalle de un cliente podrás ver todas las pólizas asociadas, tanto activas como vencidas, junto con el historial de renovaciones.',
  },
  {
    id: '8',
    category: 'WhatsApp',
    question: '¿Cómo funciona el inbox de WhatsApp?',
    answer: 'El inbox de WhatsApp te permite gestionar todas las conversaciones con tus clientes desde la app. Puedes responder mensajes, asignar conversaciones a agentes y organizar por departamentos.',
  },
  {
    id: '9',
    category: 'WhatsApp',
    question: '¿Necesito una cuenta de WhatsApp Business?',
    answer: 'Sí, para usar el inbox de WhatsApp necesitas tener una cuenta de WhatsApp Business API configurada. Contacta a nuestro equipo de soporte para ayudarte con la configuración.',
  },
  {
    id: '10',
    category: 'Cuenta',
    question: '¿Cómo cambio mi contraseña?',
    answer: 'Ve a Menú > Mi Perfil > Seguridad y selecciona "Cambiar Contraseña". Deberás ingresar tu contraseña actual y la nueva contraseña dos veces para confirmar.',
  },
  {
    id: '11',
    category: 'Cuenta',
    question: '¿Puedo tener múltiples usuarios en mi cuenta?',
    answer: 'Sí, Guro permite agregar múltiples usuarios a tu agencia. Cada usuario puede tener diferentes roles y permisos según sus responsabilidades.',
  },
  {
    id: '12',
    category: 'Cuenta',
    question: '¿Mis datos están seguros?',
    answer: 'Absolutamente. Utilizamos encriptación de nivel bancario para proteger tus datos. Toda la información se almacena en servidores seguros con respaldos automáticos diarios.',
  },
];

const categories = ['Todos', 'General', 'Pólizas', 'Clientes', 'WhatsApp', 'Cuenta'];

const FAQScreen: React.FC = () => {
  const navigation = useNavigation();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('Todos');

  const toggleExpand = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(expandedId === id ? null : id);
  };

  const filteredFAQs = selectedCategory === 'Todos' 
    ? faqData 
    : faqData.filter(faq => faq.category === selectedCategory);

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
        <Text style={styles.headerTitle}>Preguntas Frecuentes</Text>
        <View style={styles.headerPlaceholder} />
      </ImageBackground>

      {/* Categorías */}
      <View style={styles.categoriesWrapper}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContainer}
        >
          {categories.map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryChip,
                selectedCategory === category && styles.categoryChipActive
              ]}
              onPress={() => setSelectedCategory(category)}
            >
              <Text style={[
                styles.categoryText,
                selectedCategory === category && styles.categoryTextActive
              ]}>
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Descripción */}
        <View style={styles.descriptionCard}>
          <Ionicons name="help-circle-outline" size={40} color="#573CFF" />
          <Text style={styles.descriptionTitle}>¿Tienes dudas?</Text>
          <Text style={styles.descriptionText}>
            Encuentra respuestas a las preguntas más comunes sobre Guro.
          </Text>
        </View>

        {/* Lista de FAQs */}
        <View style={styles.faqList}>
          {filteredFAQs.map((faq) => (
            <TouchableOpacity
              key={faq.id}
              style={styles.faqCard}
              onPress={() => toggleExpand(faq.id)}
              activeOpacity={0.7}
            >
              <View style={styles.faqHeader}>
                <View style={styles.faqQuestion}>
                  <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(faq.category) + '20' }]}>
                    <Text style={[styles.categoryBadgeText, { color: getCategoryColor(faq.category) }]}>
                      {faq.category}
                    </Text>
                  </View>
                  <Text style={styles.questionText}>{faq.question}</Text>
                </View>
                <Ionicons 
                  name={expandedId === faq.id ? 'chevron-up' : 'chevron-down'} 
                  size={20} 
                  color="#6B7280" 
                />
              </View>
              {expandedId === faq.id && (
                <View style={styles.faqAnswer}>
                  <Text style={styles.answerText}>{faq.answer}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Contacto */}
        <View style={styles.contactCard}>
          <Ionicons name="chatbubbles-outline" size={28} color="#573CFF" />
          <Text style={styles.contactTitle}>¿No encontraste lo que buscabas?</Text>
          <Text style={styles.contactText}>
            Contáctanos directamente y te ayudaremos con gusto.
          </Text>
          <TouchableOpacity style={styles.contactButton}>
            <Ionicons name="logo-whatsapp" size={20} color="#FFFFFF" />
            <Text style={styles.contactButtonText}>Contactar Soporte</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const getCategoryColor = (category: string): string => {
  const colors: { [key: string]: string } = {
    'General': '#573CFF',
    'Pólizas': '#10B981',
    'Clientes': '#F59E0B',
    'WhatsApp': '#25D366',
    'Cuenta': '#8B5CF6',
  };
  return colors[category] || '#6B7280';
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
  categoriesWrapper: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  categoriesContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: '#573CFF',
  },
  categoryText: {
    fontSize: 13,
    fontFamily: 'Montserrat_500Medium',
    color: '#6B7280',
  },
  categoryTextActive: {
    color: '#FFFFFF',
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
    marginBottom: 20,
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
  faqList: {
    gap: 12,
  },
  faqCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  faqQuestion: {
    flex: 1,
    marginRight: 12,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontFamily: 'Montserrat_600SemiBold',
    textTransform: 'uppercase',
  },
  questionText: {
    fontSize: 15,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#1F2937',
    lineHeight: 22,
  },
  faqAnswer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  answerText: {
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
    color: '#6B7280',
    lineHeight: 22,
  },
  contactCard: {
    backgroundColor: '#EEF2FF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  contactTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#1F2937',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  contactText: {
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#25D366',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  contactButtonText: {
    fontSize: 14,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#FFFFFF',
  },
});

export default FAQScreen;
