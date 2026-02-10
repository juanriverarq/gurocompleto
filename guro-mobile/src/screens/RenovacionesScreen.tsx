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
import { getRenovaciones, getRenovacionesStats, Renovacion, RenovacionesStats } from '../services/renovacionesService';
import LoadingSpinner from '../components/LoadingSpinner';

const ESTADO_FILTERS = ['Todos', 'Vencido', 'Critico', 'Pendiente', 'Renovado'];

const RenovacionesScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [renovaciones, setRenovaciones] = useState<Renovacion[]>([]);
  const [stats, setStats] = useState<RenovacionesStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [activeFilter, setActiveFilter] = useState('Todos');
  const [showFilters, setShowFilters] = useState(false);

  const fetchRenovaciones = async (pageNum: number = 1, isRefresh: boolean = false, estadoFilter?: string) => {
    try {
      setError(null);
      const estado = estadoFilter !== undefined ? estadoFilter : (activeFilter !== 'Todos' ? activeFilter.toUpperCase() : undefined);
      const response = await getRenovaciones({
        page: pageNum,
        per_page: 15,
        search: search || undefined,
        estado: estado || undefined,
      });

      if (response.success) {
        if (isRefresh || pageNum === 1) {
          setRenovaciones(response.data);
        } else {
          setRenovaciones(prev => [...prev, ...response.data]);
        }
        setTotalCount(response.total || 0);
        setHasMore(response.current_page < response.last_page);
        setPage(response.current_page);
      } else {
        setError(response.message || 'Error al cargar renovaciones');
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await getRenovacionesStats();
      if (response.success) {
        setStats(response.data);
      }
    } catch {}
  };

  useEffect(() => {
    fetchRenovaciones();
    fetchStats();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    setPage(1);
    fetchRenovaciones(1, true);
    fetchStats();
  };

  const onSearch = () => {
    setLoading(true);
    setPage(1);
    fetchRenovaciones(1, true);
  };

  const onFilterChange = (filter: string) => {
    setActiveFilter(filter);
    setLoading(true);
    setPage(1);
    const estado = filter !== 'Todos' ? filter.toUpperCase() : undefined;
    fetchRenovaciones(1, true, estado || '');
  };

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      setLoadingMore(true);
      fetchRenovaciones(page + 1);
    }
  };

  const getEstadoColor = (estado: string) => {
    switch (estado?.toUpperCase()) {
      case 'VENCIDO': return '#EF4444';
      case 'CRITICO': return '#F59E0B';
      case 'PENDIENTE': return '#3B82F6';
      case 'RENOVADO': return '#10B981';
      default: return '#6B7280';
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const renderStatCard = (label: string, value: number, color: string) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  const renderRenovacion = ({ item }: { item: Renovacion }) => {
    const dias = item.diasVencimiento ?? item.dias_vencimiento ?? 0;
    const estadoColor = getEstadoColor(item.estado);
    const diasText = dias < 0
      ? `Venció hace ${Math.abs(dias)} días`
      : dias === 0
        ? 'Vence hoy'
        : `Vence en ${dias} días`;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('RenovacionDetail', { renovacion: item })}
      >
        <View style={[styles.cardAccent, { backgroundColor: estadoColor }]} />
        <View style={styles.cardBody}>
          <View style={styles.cardTopRow}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.cardNumber} numberOfLines={1}>{item.numeroPoliza || item.numero_poliza || 'Sin número'}</Text>
              <Text style={styles.cardClient} numberOfLines={1}>{item.cliente || 'Sin cliente'}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: `${estadoColor}18` }]}>
              <Text style={[styles.badgeText, { color: estadoColor }]}>
                {item.estado || 'N/A'}
              </Text>
            </View>
          </View>
          <View style={styles.cardBottomRow}>
            <View style={styles.cardMeta}>
              <Ionicons name="time-outline" size={12} color="#9CA3AF" />
              <Text style={[styles.metaText, dias <= 7 && dias >= 0 && { color: '#F59E0B' }, dias < 0 && { color: '#EF4444' }]}>
                {diasText}
              </Text>
            </View>
            <Text style={styles.primeValue}>{formatCurrency(item.valorPrima || item.prima_neta || 0)}</Text>
          </View>
          <View style={styles.cardMetaRow}>
            <View style={styles.cardMeta}>
              <Ionicons name="shield-outline" size={12} color="#9CA3AF" />
              <Text style={styles.metaText} numberOfLines={1}>{item.ramo || item.tipoSeguro || 'N/A'}</Text>
            </View>
            <View style={styles.cardMeta}>
              <Ionicons name="business-outline" size={12} color="#9CA3AF" />
              <Text style={styles.metaText} numberOfLines={1}>{item.aseguradora || 'N/A'}</Text>
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
        source={require('../../assets/backgrounds/hero-gradient.png')}
        style={styles.header}
        imageStyle={{ transform: [{ scale: 2 }] }}
        resizeMode="cover"
      >
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.headerTitle}>Renovaciones</Text>
            <Text style={styles.headerCount}>{totalCount} registros</Text>
          </View>
          <TouchableOpacity
            style={[styles.filterBtn, showFilters && styles.filterBtnActive]}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Ionicons name="options-outline" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </ImageBackground>

      <FlatList
        data={error ? [] : renovaciones}
        renderItem={renderRenovacion}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#573CFF']} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={
          <View>
            {/* Stats summary */}
            {stats && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsScroll}>
                {renderStatCard('Críticas', stats.renovaciones_criticas, '#F59E0B')}
                {renderStatCard('Pendientes', stats.renovaciones_pendientes, '#3B82F6')}
                {renderStatCard('Vencidas', stats.renovaciones_vencidas, '#EF4444')}
                {renderStatCard('Renovadas', stats.renovaciones_completadas, '#10B981')}
              </ScrollView>
            )}

            {/* Filters */}
            {showFilters && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                {ESTADO_FILTERS.map((f) => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.filterChip, activeFilter === f && styles.filterChipActive, { marginRight: 10 }]}
                    onPress={() => onFilterChange(f)}
                  >
                    <Text style={[styles.filterChipText, activeFilter === f && styles.filterChipTextActive]}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

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
                <TouchableOpacity style={styles.retryButton} onPress={() => fetchRenovaciones(1, true)}>
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
              <Ionicons name="calendar-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyText}>No hay renovaciones</Text>
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
  filterBtn: {
    width: 38, height: 38, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center',
  },
  filterBtnActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  statsScroll: { paddingHorizontal: 20, paddingVertical: 12 },
  statCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16,
    borderLeftWidth: 3, minWidth: 90, marginRight: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  statValue: { fontSize: 20, fontFamily: 'Montserrat_700Bold' },
  statLabel: { fontSize: 11, fontFamily: 'Montserrat_500Medium', color: '#9CA3AF', marginTop: 2 },
  filterScroll: { paddingHorizontal: 20, paddingVertical: 12 },
  filterChip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 22, backgroundColor: '#F3F4F6', minHeight: 40, justifyContent: 'center' },
  filterChipActive: { backgroundColor: '#573CFF' },
  filterChipText: { fontSize: 14, fontFamily: 'Montserrat_600SemiBold', color: '#6B7280', lineHeight: 20 },
  filterChipTextActive: { color: '#FFFFFF' },
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
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  badgeText: { fontSize: 11, fontFamily: 'Montserrat_700Bold', letterSpacing: 0.3 },
  cardBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, fontFamily: 'Montserrat_400Regular', color: '#9CA3AF' },
  primeValue: { fontSize: 12, fontFamily: 'Montserrat_700Bold', color: '#10B981' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { marginTop: 12, fontSize: 16, fontFamily: 'Montserrat_500Medium', color: '#EF4444', textAlign: 'center' },
  retryButton: { marginTop: 20, backgroundColor: '#573CFF', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  retryButtonText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Montserrat_600SemiBold' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyText: { marginTop: 12, fontSize: 16, fontFamily: 'Montserrat_500Medium', color: '#9CA3AF' },
});

export default RenovacionesScreen;
