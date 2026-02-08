import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  FlatList,
  Linking,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import Banner1 from '../../banners/Banner 1.svg';
import Banner2 from '../../banners/2.svg';
import Banner3 from '../../banners/3.svg';
import Banner4 from '../../banners/4.svg';
import Banner5 from '../../banners/5.svg';
import NotificationsPopup from '../components/NotificationsPopup';

const { width: screenWidth } = Dimensions.get('window');

const banners = [
  { id: '1', component: Banner1, url: 'https://guro.co/comenzar' },
  { id: '2', component: Banner2, url: 'https://guro.co/comenzar' },
  { id: '3', component: Banner3, url: 'https://guro.co/comenzar' },
  { id: '4', component: Banner4, url: 'https://guro.co/comenzar' },
  { id: '5', component: Banner5, url: 'https://guro.co/comenzar' },
];

const dailyQuotes = [
  { id: '1', text: 'El éxito en seguros no se mide por las pólizas vendidas, sino por las familias protegidas.', author: 'Anónimo' },
  { id: '2', text: 'La confianza es el activo más valioso de un corredor de seguros.', author: 'Warren Buffett' },
  { id: '3', text: 'No vendas seguros, vende tranquilidad y protección.', author: 'Zig Ziglar' },
  { id: '4', text: 'El mejor momento para asegurar el futuro es hoy.', author: 'Proverbio' },
  { id: '5', text: 'Un buen corredor no busca clientes para sus productos, busca productos para sus clientes.', author: 'Seth Godin' },
];

const newsItems = [
  {
    id: '1',
    icon: 'newspaper-outline',
    category: 'Regulación',
    title: 'Nuevas normas de Superfinanciera para seguros digitales',
    color: '#6172FD',
    bgColor: '#EEF2FF',
  },
  {
    id: '2',
    icon: 'trending-up-outline',
    category: 'Mercado',
    title: 'El sector asegurador crece un 12% en Colombia este año',
    color: '#22C55E',
    bgColor: '#F0FDF4',
  },
  {
    id: '3',
    icon: 'shield-outline',
    category: 'Producto',
    title: 'Seguros paramétricos: la nueva tendencia en protección',
    color: '#F59E0B',
    bgColor: '#FFF7ED',
  },
  {
    id: '4',
    icon: 'people-outline',
    category: 'Ventas',
    title: 'Cómo aumentar tu tasa de renovación al 85%',
    color: '#EC4899',
    bgColor: '#FDF2F8',
  },
];

const didYouKnow = [
  { id: '1', icon: 'bar-chart-outline', fact: 'El 70% de los clientes renuevan si los contactas 30 días antes del vencimiento.' },
  { id: '2', icon: 'bulb-outline', fact: 'Los clientes con más de 2 pólizas tienen un 90% de retención.' },
  { id: '3', icon: 'trophy-outline', fact: 'Los corredores top dedican el 40% de su tiempo a seguimiento post-venta.' },
  { id: '4', icon: 'phone-portrait-outline', fact: 'El 65% de los clientes prefieren comunicarse por WhatsApp.' },
  { id: '5', icon: 'locate-outline', fact: 'Ofrecer cross-selling aumenta el ticket promedio en un 35%.' },
];

const shortcuts = [
  { id: '1', icon: 'add-circle-outline', label: 'Nueva Póliza', color: '#6172FD', screen: 'Polizas' },
  { id: '2', icon: 'person-add-outline', label: 'Nuevo Cliente', color: '#22C55E', screen: 'Clientes' },
  { id: '3', icon: 'chatbubble-outline', label: 'Enviar Mensaje', color: '#3B82F6', screen: 'WhatsApp' },
  { id: '4', icon: 'bar-chart-outline', label: 'Ver Reportes', color: '#F59E0B', screen: 'Dashboard' },
];

const tips = [
  {
    id: '1',
    icon: 'bulb-outline',
    title: 'Conoce a tu cliente',
    description: 'Escucha sus necesidades antes de ofrecer un producto. Un cliente bien atendido es un cliente fiel.',
  },
  {
    id: '2',
    icon: 'calendar-outline',
    title: 'Anticipa renovaciones',
    description: 'Contacta a tus clientes 30 días antes del vencimiento para asegurar la renovación.',
  },
  {
    id: '3',
    icon: 'shield-checkmark-outline',
    title: 'Explica las coberturas',
    description: 'Un cliente informado valora más su póliza y entiende la importancia de estar protegido.',
  },
  {
    id: '4',
    icon: 'trending-up-outline',
    title: 'Diversifica tu portafolio',
    description: 'Ofrece diferentes tipos de seguros para aumentar tus ingresos y fidelizar clientes.',
  },
];

const HomeScreen: React.FC = () => {
  const { user, broker, logout } = useAuth();
  const navigation = useNavigation<any>();
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [activeTipIndex, setActiveTipIndex] = useState(0);
  const [activeFactIndex, setActiveFactIndex] = useState(0);
  const bannerFlatListRef = useRef<ScrollView>(null);

  const todayQuote = dailyQuotes[new Date().getDay() % dailyQuotes.length];

  const getUserName = () => {
    if (broker?.name) return broker.name.split(' ')[0];
    if (user?.displayName) return user.displayName.split(' ')[0];
    return user?.email?.split('@')[0] || 'Usuario';
  };

  return (
    <View style={styles.container}>
      {/* Header con gradiente visual */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Image 
            source={require('../../logo.png')} 
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <TouchableOpacity style={styles.notificationButton} onPress={() => setShowNotifications(true)}>
            <Ionicons name="notifications-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <View style={styles.greetingContainer}>
          <Text style={styles.greeting}>Hola, {getUserName()}</Text>
          <Text style={styles.subtitle}>Bienvenid@ de vuelta</Text>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Quick Actions */}
        <View style={styles.quickActionsContainer}>
          <View style={styles.quickActionsRow}>
            <TouchableOpacity style={styles.quickAction} onPress={() => navigation.navigate('Dashboard')}>
              <View style={[styles.quickActionIcon, { backgroundColor: '#EEF2FF' }]}>
                <Ionicons name="grid-outline" size={22} color="#6172FD" />
              </View>
              <Text style={styles.quickActionText}>Dashboard</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickAction} onPress={() => navigation.navigate('Clientes')}>
              <View style={[styles.quickActionIcon, { backgroundColor: '#F0FDF4' }]}>
                <Ionicons name="people-outline" size={22} color="#22C55E" />
              </View>
              <Text style={styles.quickActionText}>Clientes</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickAction} onPress={() => navigation.navigate('Polizas')}>
              <View style={[styles.quickActionIcon, { backgroundColor: '#FFF7ED' }]}>
                <Ionicons name="document-text-outline" size={22} color="#F59E0B" />
              </View>
              <Text style={styles.quickActionText}>Pólizas</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickAction} onPress={() => navigation.navigate('Empleados')}>
              <View style={[styles.quickActionIcon, { backgroundColor: '#FDF2F8' }]}>
                <Ionicons name="eye-outline" size={22} color="#EC4899" />
              </View>
              <Text style={styles.quickActionText}>Empleados</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.whatsappCard} onPress={() => navigation.navigate('WhatsApp')}>
            <View style={styles.whatsappCardLeft}>
              <View style={styles.whatsappIconContainer}>
                <Ionicons name="logo-whatsapp" size={24} color="#FFFFFF" />
              </View>
              <View>
                <Text style={styles.whatsappCardTitle}>Chat WhatsApp</Text>
                <Text style={styles.whatsappCardSub}>Gestiona tus conversaciones</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>

        {/* Daily Quote */}
        <View style={styles.quoteCard}>
          <View style={styles.quoteIconRow}>
            <Ionicons name="chatbubble-ellipses" size={18} color="#6172FD" />
            <Text style={styles.quoteLabel}>Frase del Día</Text>
          </View>
          <Text style={styles.quoteText}>"{todayQuote.text}"</Text>
          <Text style={styles.quoteAuthor}>— {todayQuote.author}</Text>
        </View>

        {/* Accesos Rápidos */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Accesos Rápidos</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shortcutsScroll}>
          {shortcuts.map((item) => (
            <TouchableOpacity key={item.id} style={styles.shortcutChip} onPress={() => navigation.navigate(item.screen)}>
              <Ionicons name={item.icon as any} size={18} color={item.color} />
              <Text style={[styles.shortcutText, { color: item.color }]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Noticias del Sector */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Noticias del Sector</Text>
        </View>
        {newsItems.map((item) => (
          <TouchableOpacity key={item.id} style={styles.newsCard} activeOpacity={0.7}>
            <View style={[styles.newsIconBg, { backgroundColor: item.bgColor }]}>
              <Ionicons name={item.icon as any} size={20} color={item.color} />
            </View>
            <View style={styles.newsContent}>
              <Text style={[styles.newsCategory, { color: item.color }]}>{item.category}</Text>
              <Text style={styles.newsTitle} numberOfLines={2}>{item.title}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
          </TouchableOpacity>
        ))}

        {/* ¿Sabías que? */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>¿Sabías que?</Text>
        </View>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) => {
            const index = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
            setActiveFactIndex(index);
          }}
        >
          {didYouKnow.map((item) => (
            <View key={item.id} style={styles.factSlide}>
              <View style={styles.factCard}>
                <View style={styles.factIconBg}>
                  <Ionicons name={item.icon as any} size={22} color="#6172FD" />
                </View>
                <Text style={styles.factText}>{item.fact}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
        <View style={styles.paginationContainer}>
          {didYouKnow.map((_, index) => (
            <Animated.View
              key={index}
              style={[
                styles.paginationDot,
                index === activeFactIndex && styles.paginationDotActive,
              ]}
            />
          ))}
        </View>

        {/* Tips Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Tips de Gestión</Text>
        </View>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) => {
            const index = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
            setActiveTipIndex(index);
          }}
          style={styles.tipsScrollView}
        >
          {tips.map((item) => (
            <View key={item.id} style={styles.tipSlide}>
              <View style={styles.tipCard}>
                <View style={styles.tipIconContainer}>
                  <Ionicons name={item.icon as any} size={24} color="#6172FD" />
                </View>
                <View style={styles.tipContent}>
                  <Text style={styles.tipTitle}>{item.title}</Text>
                  <Text style={styles.tipDescription}>{item.description}</Text>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
        <View style={styles.paginationContainer}>
          {tips.map((_, index) => (
            <Animated.View
              key={index}
              style={[
                styles.paginationDot,
                index === activeTipIndex && styles.paginationDotActive,
              ]}
            />
          ))}
        </View>

        {/* Banners Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Te Recomendamos</Text>
        </View>
        <ScrollView
          ref={bannerFlatListRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) => {
            const index = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
            setActiveBannerIndex(index);
          }}
          style={styles.bannerScrollView}
        >
          {banners.map((item) => {
            const BannerComponent = item.component;
            return (
              <View key={item.id} style={styles.bannerSlide}>
                <TouchableOpacity 
                  style={styles.bannerCard}
                  onPress={() => item.url && Linking.openURL(item.url)}
                  activeOpacity={0.9}
                >
                  <BannerComponent width={screenWidth - 40} height={170} preserveAspectRatio="xMidYMid slice" />
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
        <View style={[styles.paginationContainer, { marginBottom: 100 }]}>
          {banners.map((_, index) => (
            <Animated.View
              key={index}
              style={[
                styles.paginationDot,
                index === activeBannerIndex && styles.paginationDotActive,
              ]}
            />
          ))}
        </View>
      </ScrollView>

      <NotificationsPopup 
        visible={showNotifications} 
        onClose={() => setShowNotifications(false)} 
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F5F6FA',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: { 
    backgroundColor: '#6172FD',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    shadowColor: '#6172FD',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerLogo: {
    width: 55,
    height: 55,
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  greetingContainer: {
    marginBottom: 0,
  },
  greeting: { 
    fontSize: 24, 
    fontFamily: 'Montserrat_700Bold',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
    color: 'rgba(255,255,255,0.7)',
    marginTop: 3,
  },
  quickActionsContainer: {
    paddingHorizontal: 16,
    marginTop: -1,
    paddingTop: 20,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  quickAction: {
    alignItems: 'center',
    width: '23%',
  },
  quickActionIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  quickActionText: {
    fontSize: 11,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#374151',
    textAlign: 'center',
  },
  whatsappCard: {
    backgroundColor: '#25D366',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    shadowColor: '#25D366',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  whatsappCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  whatsappIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  whatsappCardTitle: {
    fontSize: 15,
    fontFamily: 'Montserrat_700Bold',
    color: '#FFFFFF',
  },
  whatsappCardSub: {
    fontSize: 12,
    fontFamily: 'Montserrat_400Regular',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 1,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 14,
  },
  sectionTitle: { 
    fontSize: 18, 
    fontFamily: 'Montserrat_700Bold',
    color: '#1F2937', 
  },
  tipsScrollView: {
    // full width
  },
  tipSlide: {
    width: screenWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipCard: {
    width: screenWidth - 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  tipIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 15,
    fontFamily: 'Montserrat_700Bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  tipDescription: {
    fontSize: 13,
    fontFamily: 'Montserrat_400Regular',
    color: '#6B7280',
    lineHeight: 18,
  },
  bannerScrollView: {
    // full width
  },
  bannerSlide: {
    width: screenWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerCard: {
    width: screenWidth - 40,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 8,
    gap: 8,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D1D5DB',
  },
  paginationDotActive: {
    backgroundColor: '#6172FD',
    width: 24,
    borderRadius: 4,
  },
  // Daily Quote
  quoteCard: {
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderLeftWidth: 4,
    borderLeftColor: '#6172FD',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  quoteIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  quoteLabel: {
    fontSize: 12,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#6172FD',
  },
  quoteText: {
    fontSize: 14,
    fontFamily: 'Montserrat_500Medium',
    color: '#374151',
    lineHeight: 21,
    fontStyle: 'italic',
  },
  quoteAuthor: {
    fontSize: 12,
    fontFamily: 'Montserrat_400Regular',
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'right',
  },
  // Shortcuts
  shortcutsScroll: {
    paddingHorizontal: 16,
    gap: 10,
  },
  shortcutChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  shortcutText: {
    fontSize: 13,
    fontFamily: 'Montserrat_600SemiBold',
  },
  // News
  newsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  newsIconBg: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newsContent: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  newsCategory: {
    fontSize: 10,
    fontFamily: 'Montserrat_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  newsTitle: {
    fontSize: 13,
    fontFamily: 'Montserrat_500Medium',
    color: '#374151',
    lineHeight: 18,
  },
  // Did You Know
  factSlide: {
    width: screenWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  factCard: {
    width: screenWidth - 40,
    backgroundColor: '#6172FD',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  factIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  factText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Montserrat_500Medium',
    color: '#FFFFFF',
    lineHeight: 20,
  },
});

export default HomeScreen;
