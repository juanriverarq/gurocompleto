import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Linking,
  ImageBackground,
  Image,
  Animated,
  Pressable,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import NotificationsPopup from '../components/NotificationsPopup';

const { width: SW } = Dimensions.get('window');
const TOOL_W = SW * 0.7;
const TOOL_GAP = 12;

/* ── Data ── */

const banners = [
  { id: '1', image: require('../../banners/1.png'), url: 'https://guro.co/comenzar' },
  { id: '2', image: require('../../banners/2.png'), url: 'https://guro.co/comenzar' },
];

const tools = [
  {
    id: '1', title: 'Gestión de Pólizas', icon: 'file-document-outline' as const,
    color: '#3B82F6', bg: '#EFF6FF',
    features: ['Emisión y endosos', 'Alertas de vencimiento', 'Dashboard de primas'],
    screen: 'Polizas',
  },
  {
    id: '2', title: 'CRM de Clientes', icon: 'account-group-outline' as const,
    color: '#22C55E', bg: '#F0FDF4',
    features: ['Ficha 360° por cliente', 'Segmentación', 'Historial completo'],
    screen: 'Clientes',
  },
  {
    id: '3', title: 'Renovaciones', icon: 'autorenew' as const,
    color: '#F59E0B', bg: '#FEF3C7',
    features: ['Pólizas por vencer', 'Contacto y seguimiento', 'Procesar renovación'],
    screen: 'Renovaciones',
  },
  {
    id: '4', title: 'Cartera', icon: 'wallet-outline' as const,
    color: '#10B981', bg: '#D1FAE5',
    features: ['Cobros y recaudos', 'Estado de pagos', 'KPIs financieros'],
    screen: 'Cartera',
  },
  {
    id: '5', title: 'WhatsApp Business', icon: 'whatsapp' as const,
    color: '#25D366', bg: '#F0FDF4',
    features: ['Chat en tiempo real', 'Gestión de contactos', 'Envío de mensajes'],
    screen: 'WhatsApp',
  },
  {
    id: '6', title: 'Dashboard', icon: 'chart-box-outline' as const,
    color: '#573CFF', bg: '#EEF2FF',
    features: ['KPIs en tiempo real', 'Finanzas y recaudos', 'Tendencias'],
    screen: 'Dashboard',
  },
  {
    id: '7', title: 'Empleados', icon: 'account-tie-outline' as const,
    color: '#EC4899', bg: '#FDF2F8',
    features: ['Gestión de equipo', 'Trazabilidad', 'Permisos y roles'],
    screen: 'Empleados',
  },
];

const quickActions = [
  { id: '1', icon: 'account-plus-outline' as const, label: 'NUEVO CLIENTE', screen: 'CreateCliente' },
  { id: '2', icon: 'file-plus-outline' as const, label: 'NUEVA PÓLIZA', screen: 'CreatePoliza' },
  { id: '3', icon: 'account-tie-outline' as const, label: 'NUEVO EMPLEADO', screen: 'CreateEmpleado' },
];

const consejos = [
  { id: '1', icon: 'chart-bar' as const, text: 'El 70% de los clientes renuevan si los contactas 30 días antes.', color: '#573CFF' },
  { id: '2', icon: 'lightbulb-on-outline' as const, text: 'Clientes con +2 pólizas tienen 90% de retención.', color: '#22C55E' },
  { id: '3', icon: 'trophy-outline' as const, text: 'Los corredores top dedican 40% a seguimiento post-venta.', color: '#F59E0B' },
  { id: '4', icon: 'cellphone-message' as const, text: 'El 65% de los clientes prefieren WhatsApp.', color: '#3B82F6' },
  { id: '5', icon: 'target' as const, text: 'Cross-selling aumenta el ticket promedio en 35%.', color: '#EC4899' },
];

const dailyQuotes = [
  { text: 'El éxito en seguros no se mide por las pólizas vendidas, sino por las familias protegidas.', author: 'Anónimo' },
  { text: 'La confianza es el activo más valioso de un corredor de seguros.', author: 'Warren Buffett' },
  { text: 'No vendas seguros, vende tranquilidad y protección.', author: 'Zig Ziglar' },
  { text: 'El mejor momento para asegurar el futuro es hoy.', author: 'Proverbio' },
  { text: 'Un buen corredor busca productos para sus clientes, no clientes para sus productos.', author: 'Seth Godin' },
  { text: 'El seguro es la única inversión que esperamos nunca necesitar, pero agradecemos cuando la tenemos.', author: 'Anónimo' },
  { text: 'Cada póliza que vendes es una promesa de protección que cumples.', author: 'Anónimo' },
  { text: 'La persistencia supera al talento cuando el talento no persiste.', author: 'Calvin Coolidge' },
  { text: 'Tu reputación es tu mejor carta de presentación.', author: 'Henry Ford' },
  { text: 'El cliente no compra un producto, compra la solución a su preocupación.', author: 'Philip Kotler' },
  { text: 'La diferencia entre ordinario y extraordinario es ese pequeño extra.', author: 'Jimmy Johnson' },
  { text: 'Vender es ayudar a alguien a tomar una decisión que mejorará su vida.', author: 'Brian Tracy' },
  { text: 'El servicio al cliente no es un departamento, es una actitud.', author: 'Anónimo' },
  { text: 'Las relaciones duraderas se construyen con confianza, no con contratos.', author: 'Stephen Covey' },
  { text: 'Haz lo que amas y no trabajarás ni un solo día de tu vida.', author: 'Confucio' },
  { text: 'El riesgo más grande es no tomar ningún riesgo.', author: 'Mark Zuckerberg' },
  { text: 'No busques clientes para tus productos, busca productos para tus clientes.', author: 'Seth Godin' },
  { text: 'La excelencia no es un acto, sino un hábito.', author: 'Aristóteles' },
  { text: 'Cada día es una nueva oportunidad para proteger a una familia más.', author: 'Anónimo' },
  { text: 'El profesionalismo es hacer las cosas bien incluso cuando nadie te está mirando.', author: 'Anónimo' },
  { text: 'Un cliente satisfecho es la mejor estrategia de negocio.', author: 'Michael LeBoeuf' },
  { text: 'La preparación de hoy determina el éxito de mañana.', author: 'Anónimo' },
  { text: 'Escuchar es la habilidad más poderosa en ventas.', author: 'Dale Carnegie' },
  { text: 'Tu actitud determina tu altitud en los negocios.', author: 'Zig Ziglar' },
  { text: 'El conocimiento del producto genera confianza, la confianza genera ventas.', author: 'Anónimo' },
  { text: 'No cuentes los días, haz que los días cuenten.', author: 'Muhammad Ali' },
  { text: 'La clave del éxito es empezar antes de estar listo.', author: 'Marie Forleo' },
  { text: 'Un buen seguimiento vale más que una buena primera impresión.', author: 'Anónimo' },
  { text: 'El éxito es la suma de pequeños esfuerzos repetidos día tras día.', author: 'Robert Collier' },
  { text: 'Proteger patrimonios es una de las profesiones más nobles que existen.', author: 'Anónimo' },
];

const getDailyQuote = () => {
  const today = new Date();
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  return dailyQuotes[seed % dailyQuotes.length];
};

/* ── Component ── */

/* ── Animated CTA Chip (login-style purple expand) ── */
const AnimatedCtaChip: React.FC<{
  icon: any;
  label: string;
  onPress: () => void;
}> = ({ icon, label, onPress }) => {
  const purpleWidth = useRef(new Animated.Value(44)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
      friction: 8,
      tension: 120,
    }).start();

    Animated.timing(purpleWidth, {
      toValue: 200,
      duration: 280,
      useNativeDriver: false,
    }).start(() => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 4,
        tension: 80,
      }).start();
      onPress();
      setTimeout(() => purpleWidth.setValue(44), 400);
    });
  }, [onPress]);

  return (
    <Pressable onPress={handlePress}>
      <Animated.View style={[s.ctaChip, { transform: [{ scale: scaleAnim }] }]}>
        <Animated.View style={[s.ctaChipPurple, { width: purpleWidth }]} />
        <View style={s.ctaChipContent}>
          <View style={s.ctaChipIconWrap}>
            <MaterialCommunityIcons name={icon} size={18} color="#FFFFFF" />
          </View>
          <Text style={s.ctaChipLabel}>{label}</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
};

const HomeScreen: React.FC = () => {
  const { user, broker } = useAuth();
  const navigation = useNavigation<any>();
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeBannerIdx, setActiveBannerIdx] = useState(0);

  const todayQuote = getDailyQuote();

  const getUserName = () => {
    if (broker?.name) return broker.name.split(' ')[0];
    if (user?.displayName) return user.displayName.split(' ')[0];
    return user?.email?.split('@')[0] || 'Usuario';
  };

  return (
    <View style={s.container}>
      {/* ─── HEADER ─── */}
      <ImageBackground
        source={require('../../assets/backgrounds/hero-gradient.webp')}
        style={s.header}
        imageStyle={{ transform: [{ scale: 2 }] }}
        resizeMode="cover"
      >
        <View style={s.headerRow}>
          <View>
            <Text style={s.greeting}>Hola, {getUserName()}</Text>
            <Text style={s.greetingSub}>Bienvenid@ de vuelta</Text>
          </View>
          <TouchableOpacity style={s.bellBtn} onPress={() => setShowNotifications(true)}>
            <MaterialCommunityIcons name="bell-outline" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </ImageBackground>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ─── QUICK ACTIONS (create buttons) ─── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipScroll}>
          {quickActions.map((q) => (
            <AnimatedCtaChip
              key={q.id}
              icon={q.icon}
              label={q.label}
              onPress={() => navigation.navigate(q.screen)}
            />
          ))}
        </ScrollView>

        {/* ─── TOOLS CAROUSEL (landing-style square cards) ─── */}
        <View style={s.sec}>
          <Text style={s.badge}>GESTIONA</Text>
        </View>
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.toolScroll}
          decelerationRate="fast"
          snapToInterval={TOOL_W + TOOL_GAP}
        >
          {tools.map((t) => (
            <TouchableOpacity
              key={t.id} style={s.toolCard} activeOpacity={0.8}
              onPress={() => navigation.navigate(t.screen)}
            >
              <View style={[s.toolIconWrap, { backgroundColor: t.bg }]}>
                <MaterialCommunityIcons name={t.icon} size={26} color={t.color} />
              </View>
              <Text style={s.toolTitle}>{t.title}</Text>
              {t.features.map((f, i) => (
                <View key={i} style={s.toolFeatureRow}>
                  <MaterialCommunityIcons name="check-circle" size={14} color={t.color} />
                  <Text style={s.toolFeature}>{f}</Text>
                </View>
              ))}
              <View style={s.toolCta}>
                <Text style={[s.toolCtaText, { color: t.color }]}>Ver más</Text>
                <MaterialCommunityIcons name="arrow-right" size={14} color={t.color} />
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ─── CONSEJOS (horizontal snap cards) ─── */}
        <View style={s.sec}>
          <Text style={s.badge}>CONSEJOS</Text>
        </View>
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.insightScroll}
          decelerationRate="fast"
          snapToInterval={SW * 0.78 + 12}
        >
          {consejos.map((item) => (
            <View key={item.id} style={s.insightCard}>
              <View style={[s.insightIcon, { backgroundColor: item.color + '15' }]}>
                <MaterialCommunityIcons name={item.icon} size={22} color={item.color} />
              </View>
              <Text style={s.insightText}>{item.text}</Text>
            </View>
          ))}
        </ScrollView>

        {/* ─── QUOTE ─── */}
        <View style={s.secPad}>
          <Text style={s.badge}>FRASE DEL DÍA</Text>
          <View style={s.quoteCard}>
            <MaterialCommunityIcons name="format-quote-open" size={24} color="#573CFF" style={{ marginBottom: 8 }} />
            <Text style={s.quoteText}>{todayQuote.text}</Text>
            <Text style={s.quoteAuthor}>— {todayQuote.author}</Text>
          </View>
        </View>

        {/* ─── BANNERS ─── */}
        <View style={s.sec}>
          <Text style={[s.badge, { marginLeft: 0 }]}>RECOMENDADO</Text>
        </View>
        <ScrollView
          horizontal pagingEnabled showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setActiveBannerIdx(Math.round(e.nativeEvent.contentOffset.x / SW))}
        >
          {banners.map((item) => (
            <View key={item.id} style={s.bannerSlide}>
              <TouchableOpacity style={s.bannerCard} activeOpacity={0.9} onPress={() => item.url && Linking.openURL(item.url)}>
                <Image source={item.image} style={{ width: SW - 40, height: 150, borderRadius: 20 }} resizeMode="cover" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
        <View style={s.dots}>
          {banners.map((_, i) => (
            <View key={i} style={[s.dot, i === activeBannerIdx && s.dotActive]} />
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <NotificationsPopup visible={showNotifications} onClose={() => setShowNotifications(false)} />
    </View>
  );
};

/* ════════════════════════════════════════════════════════════════ */
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },

  /* ── Header ── */
  header: {
    paddingTop: 54, paddingBottom: 18, paddingHorizontal: 20,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bellBtn: {
    width: 38, height: 38, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  greeting: { fontSize: 22, fontFamily: 'Montserrat_700Bold', color: '#FFF', letterSpacing: -0.3 },
  greetingSub: { fontSize: 13, fontFamily: 'Montserrat_400Regular', color: 'rgba(255,255,255,0.45)', marginTop: 2 },

  /* ── Scroll ── */
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 16 },

  /* ── Sections ── */
  sec: { paddingHorizontal: 20, marginBottom: 12 },
  secPad: { paddingHorizontal: 20, marginBottom: 20, marginTop: 4 },
  badge: {
    fontSize: 11, fontFamily: 'Montserrat_700Bold', color: '#573CFF',
    letterSpacing: 1.5, marginBottom: 12,
  },

  /* ── Quick Action CTAs ── */
  chipScroll: { paddingHorizontal: 20, gap: 10, marginBottom: 20 },
  ctaChip: {
    backgroundColor: '#0d0d0d', borderRadius: 16,
    height: 44, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 10, elevation: 4,
  },
  ctaChipPurple: {
    position: 'absolute', left: 0, top: 0,
    height: 44, backgroundColor: '#573CFF',
    borderRadius: 16,
  },
  ctaChipContent: {
    flexDirection: 'row', alignItems: 'center', height: 44,
  },
  ctaChipIconWrap: {
    width: 44, height: 44, justifyContent: 'center', alignItems: 'center',
  },
  ctaChipLabel: {
    fontSize: 10, fontFamily: 'Montserrat_700Bold', color: '#FFFFFF',
    letterSpacing: 1.5, paddingRight: 16,
  },

  /* ── Tools Carousel (landing-style) ── */
  toolScroll: { paddingLeft: 20, paddingRight: 8, gap: TOOL_GAP, marginBottom: 24 },
  toolCard: {
    width: TOOL_W, backgroundColor: '#FFFFFF', borderRadius: 22, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07, shadowRadius: 16, elevation: 4,
  },
  toolIconWrap: {
    width: 52, height: 52, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center', marginBottom: 14,
  },
  toolTitle: {
    fontSize: 16, fontFamily: 'Montserrat_700Bold', color: '#0d0d0d',
    marginBottom: 12, letterSpacing: -0.2,
  },
  toolFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  toolFeature: { fontSize: 12, fontFamily: 'Montserrat_400Regular', color: '#6B7280' },
  toolCta: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12,
  },
  toolCtaText: { fontSize: 13, fontFamily: 'Montserrat_600SemiBold' },

  /* ── Insights ── */
  insightScroll: { paddingLeft: 20, paddingRight: 8, gap: 12, marginBottom: 24 },
  insightCard: {
    width: SW * 0.78, backgroundColor: '#0d0d0d', borderRadius: 20, padding: 20,
    flexDirection: 'row', alignItems: 'center',
  },
  insightIcon: {
    width: 46, height: 46, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  insightText: {
    flex: 1, fontSize: 13, fontFamily: 'Montserrat_500Medium',
    color: 'rgba(255,255,255,0.8)', lineHeight: 20,
  },

  /* ── Quote ── */
  quoteCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 22,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
  },
  quoteText: {
    fontSize: 15, fontFamily: 'Montserrat_500Medium', color: '#374151',
    lineHeight: 23, fontStyle: 'italic',
  },
  quoteAuthor: {
    fontSize: 12, fontFamily: 'Montserrat_400Regular', color: '#9CA3AF',
    marginTop: 10, textAlign: 'right',
  },

  /* ── Banners ── */
  bannerSlide: { width: SW, alignItems: 'center' },
  bannerCard: {
    width: SW - 40, borderRadius: 20, overflow: 'hidden', backgroundColor: '#FFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },

  /* ── Dots ── */
  dots: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    marginTop: 14, marginBottom: 8, gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#D1D5DB' },
  dotActive: { backgroundColor: '#573CFF', width: 20, borderRadius: 3 },
});

export default HomeScreen;
