import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  ImageBackground,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getCartera, CarteraItem, CarteraEstadisticas, ContadoresTabs } from '../services/carteraService';
import LoadingSpinner from '../components/LoadingSpinner';

const TAB_FILTERS = [
  { key: 'general', label: 'General' },
  { key: 'porCobrar', label: 'Por cobrar' },
  { key: 'porPagar', label: 'Por pagar' },
  { key: 'recaudosCompletados', label: 'Completados' },
];

const CarteraScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<CarteraItem[]>([]);
  const [stats, setStats] = useState<CarteraEstadisticas | null>(null);
  const [counters, setCounters] = useState<ContadoresTabs | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [activeTab, setActiveTab] = useState('general');

  const fetchCartera = async (pageNum: number = 1, isRefresh: boolean = false, tab?: string) => {
    try {
      setError(null);
      const currentTab = tab !== undefined ? tab : activeTab;
      const response = await getCartera({
        page: pageNum,
        per_page: 20,
        search: search || undefined,
        tab: currentTab !== 'general' ? currentTab : undefined,
      });

      if (response.success) {
        if (isRefresh || pageNum === 1) {
          setItems(response.data);
        } else {
          setItems(prev => [...prev, ...response.data]);
        }
        setTotalCount(response.pagination.total || 0);
        setHasMore(response.pagination.current_page < response.pagination.last_page);
        setPage(response.pagination.current_page);
        if (response.estadisticas) setStats(response.estadisticas);
        if (response.contadoresTabs) setCounters(response.contadoresTabs);
      } else {
        setError(response.message || 'Error al cargar cartera');
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchCartera();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    setPage(1);
    fetchCartera(1, true);
  };

  const onSearch = () => {
    setLoading(true);
    setPage(1);
    fetchCartera(1, true);
  };

  const onTabChange = (tab: string) => {
    setActiveTab(tab);
    setLoading(true);
    setPage(1);
    fetchCartera(1, true, tab);
  };

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      setLoadingMore(true);
      fetchCartera(page + 1);
    }
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(value);
  };

  const formatCurrencyFull = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(value);
  };

  const getEstadoPagoColor = (estado: string) => {
    switch (estado?.toLowerCase()) {
      case 'al día': case 'pagado': return '#10B981';
      case 'parcial': return '#F59E0B';
      case 'pendiente': return '#EF4444';
      case 'vencido': return '#DC2626';
      default: return '#6B7280';
    }
  };

  const renderItem = ({ item }: { item: CarteraItem }) => {
    const estadoColor = getEstadoPagoColor(item.estado_pago);
    const porcentajeRecaudo = item.recaudo_oficina.total > 0
      ? Math.round((item.recaudo_oficina.recaudado / item.recaudo_oficina.total) * 100)
      : 0;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('PolizaDetail', { polizaId: item.id })}
      >
        <View style={[styles.cardAccent, { backgroundColor: estadoColor }]} />
        <View style={styles.cardBody}>
          <View style={styles.cardTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardNumber} numberOfLines={1}>{item.numero_poliza || 'Sin número'}</Text>
              <Text style={styles.cardClient} numberOfLines={1}>{item.cliente || 'Sin cliente'}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: `${estadoColor}18` }]}>
              <Text style={[styles.badgeText, { color: estadoColor }]}>{item.estado_pago || 'N/A'}</Text>
            </View>
          </View>

          {/* Progress bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${porcentajeRecaudo}%`, backgroundColor: estadoColor }]} />
            </View>
            <Text style={styles.progressText}>{porcentajeRecaudo}%</Text>
          </View>

          <View style={styles.cardBottomRow}>
            <View style={styles.cardMeta}>
              <Text style={styles.metaLabel}>Total</Text>
              <Text style={styles.metaValue}>{formatCurrencyFull(item.total)}</Text>
            </View>
            <View style={styles.cardMeta}>
              <Text style={styles.metaLabel}>Recaudado</Text>
              <Text style={[styles.metaValue, { color: '#10B981' }]}>{formatCurrencyFull(item.recaudo_oficina.recaudado)}</Text>
            </View>
            <View style={styles.cardMeta}>
              <Text style={styles.metaLabel}>Pendiente</Text>
              <Text style={[styles.metaValue, { color: '#EF4444' }]}>{formatCurrencyFull(item.recaudo_oficina.pendiente)}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing) {
    return <LoadingSpinner />;
  }

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require('../../assets/backgrounds/hero-gradient.webp')}
        style={styles.header}
        imageStyle={{ transform: [{ scale: 2 }] }}
        resizeMode="cover"
      >
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.headerTitle}>Cartera</Text>
            <Text style={styles.headerCount}>{totalCount} pólizas activas</Text>
          </View>
          <View style={{ width: 38 }} />
        </View>
      </ImageBackground>

      <FlatList
        data={error ? [] : items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#573CFF']} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={
          <View>
            {/* KPI Summary */}
            {stats && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kpiScroll}>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Prima total</Text>
                  <Text style={styles.kpiValue}>{formatCurrency(stats.primaTotal)}</Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Recaudado</Text>
                  <Text style={[styles.kpiValue, { color: '#10B981' }]}>{formatCurrency(stats.recaudadoTotal)}</Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Por cobrar</Text>
                  <Text style={[styles.kpiValue, { color: '#EF4444' }]}>{formatCurrency(stats.porCobrarTotal)}</Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Tasa recaudo</Text>
                  <Text style={[styles.kpiValue, { color: '#3B82F6' }]}>{stats.tasaRecaudo.toFixed(1)}%</Text>
                </View>
              </ScrollView>
            )}

            {/* Tab filters */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
              {TAB_FILTERS.map((t) => {
                const count = counters ? (counters as any)[t.key] : 0;
                return (
                  <TouchableOpacity
                    key={t.key}
                    style={[styles.tabChip, activeTab === t.key && styles.tabChipActive, { marginRight: 10 }]}
                    onPress={() => onTabChange(t.key)}
                  >
                    <Text style={[styles.tabChipText, activeTab === t.key && styles.tabChipTextActive]}>
                      {t.label} {count > 0 ? `(${count})` : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Search */}
            <View style={styles.searchContainer}>
              <View style={styles.searchInputContainer}>
                <Ionicons name="search-outline" size={20} color="#9CA3AF" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar póliza, cliente..."
                  placeholderTextColor="#9CA3AF"
                  value={search}
                  onChangeText={setSearch}
                  onSubmitEditing={onSearch}
                  returnKeyType="search"
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => { setSearch(''); onSearch(); }}>
                    <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={() => fetchCartera(1, true)}>
                  <Text style={styles.retryButtonText}>Reintentar</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator style={{ paddingVertical: 20 }} color="#573CFF" /> : null}
        ListEmptyComponent={
          !error ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="wallet-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyText}>No hay datos de cartera</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    paddingTop: 54, paddingBottom: 16, paddingHorizontal: 20,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: {
    width: 38, height: 38, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 17, fontFamily: 'Montserrat_700Bold', color: '#FFFFFF', letterSpacing: -0.3 },
  headerCount: { fontSize: 11, fontFamily: 'Montserrat_500Medium', color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  kpiScroll: { paddingHorizontal: 20, paddingVertical: 12 },
  kpiCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, minWidth: 100, marginRight: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  kpiLabel: { fontSize: 10, fontFamily: 'Montserrat_500Medium', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 },
  kpiValue: { fontSize: 16, fontFamily: 'Montserrat_700Bold', color: '#0d0d0d', marginTop: 4 },
  tabScroll: { paddingHorizontal: 20, paddingBottom: 10, paddingTop: 4 },
  tabChip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 22, backgroundColor: '#F3F4F6', minHeight: 40, justifyContent: 'center' },
  tabChipActive: { backgroundColor: '#573CFF' },
  tabChipText: { fontSize: 14, fontFamily: 'Montserrat_600SemiBold', color: '#6B7280', lineHeight: 20 },
  tabChipTextActive: { color: '#FFFFFF' },
  searchContainer: { paddingHorizontal: 20, paddingBottom: 8 },
  searchInputContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16, fontFamily: 'Montserrat_400Regular', color: '#374151' },
  listContent: { paddingHorizontal: 20, paddingBottom: 120 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 14, marginBottom: 8, flexDirection: 'row', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, paddingVertical: 12, paddingHorizontal: 14 },
  cardTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 },
  cardNumber: { fontSize: 13, fontFamily: 'Montserrat_700Bold', color: '#0d0d0d', letterSpacing: -0.2 },
  cardClient: { fontSize: 12, fontFamily: 'Montserrat_500Medium', color: '#6B7280', marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginLeft: 8 },
  badgeText: { fontSize: 10, fontFamily: 'Montserrat_700Bold', letterSpacing: 0.3 },
  progressContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  progressBar: { flex: 1, height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressText: { fontSize: 11, fontFamily: 'Montserrat_600SemiBold', color: '#6B7280', width: 35, textAlign: 'right' },
  cardBottomRow: { flexDirection: 'row', justifyContent: 'space-between' },
  cardMeta: {},
  metaLabel: { fontSize: 10, fontFamily: 'Montserrat_500Medium', color: '#9CA3AF' },
  metaValue: { fontSize: 12, fontFamily: 'Montserrat_700Bold', color: '#374151', marginTop: 1 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { marginTop: 12, fontSize: 16, fontFamily: 'Montserrat_500Medium', color: '#EF4444', textAlign: 'center' },
  retryButton: { marginTop: 20, backgroundColor: '#573CFF', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  retryButtonText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Montserrat_600SemiBold' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyText: { marginTop: 12, fontSize: 16, fontFamily: 'Montserrat_500Medium', color: '#9CA3AF' },
});

export default CarteraScreen;
