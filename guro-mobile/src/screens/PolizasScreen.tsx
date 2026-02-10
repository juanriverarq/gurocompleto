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
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getPolizas, Poliza } from '../services/polizasService';
import { PolizasStackParamList } from '../navigation/PolizasStackNavigator';
import LoadingSpinner from '../components/LoadingSpinner';

type NavigationProp = NativeStackNavigationProp<PolizasStackParamList>;

const ESTADO_FILTERS = ['Todos', 'Activa', 'Vencida', 'Pendiente', 'Cancelada'];

const PolizasScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [polizas, setPolizas] = useState<Poliza[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [activeFilter, setActiveFilter] = useState('Todos');
  const [showFilters, setShowFilters] = useState(false);

  const fetchPolizas = async (pageNum: number = 1, isRefresh: boolean = false, estadoFilter?: string) => {
    try {
      setError(null);
      const estado = estadoFilter !== undefined ? estadoFilter : (activeFilter !== 'Todos' ? activeFilter.toLowerCase() : undefined);
      const response = await getPolizas({ 
        page: pageNum, 
        per_page: 15,
        search: search || undefined,
        estado: estado || undefined,
      });
      
      if (response.success) {
        if (isRefresh || pageNum === 1) {
          setPolizas(response.data);
        } else {
          setPolizas(prev => [...prev, ...response.data]);
        }
        setTotalCount(response.total || 0);
        setHasMore(response.current_page < response.last_page);
        setPage(response.current_page);
      } else {
        setError(response.message || 'Error al cargar pólizas');
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
    fetchPolizas(1);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    setPage(1);
    fetchPolizas(1, true);
  };

  const onSearch = () => {
    setLoading(true);
    setPage(1);
    fetchPolizas(1, true);
  };

  const onFilterChange = (filter: string) => {
    setActiveFilter(filter);
    setLoading(true);
    setPage(1);
    const estado = filter !== 'Todos' ? filter.toLowerCase() : undefined;
    fetchPolizas(1, true, estado || '');
  };

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      setLoadingMore(true);
      fetchPolizas(page + 1);
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

  const getStatusColor = (estado: string) => {
    switch (estado?.toLowerCase()) {
      case 'active':
      case 'activa':
        return '#10B981';
      case 'expired':
      case 'vencida':
        return '#EF4444';
      case 'cancelled':
      case 'cancelada':
        return '#6B7280';
      case 'pending':
      case 'pendiente':
        return '#F59E0B';
      default:
        return '#6B7280';
    }
  };

  const getStatusLabel = (estado: string) => {
    switch (estado?.toLowerCase()) {
      case 'active':
        return 'Activa';
      case 'expired':
        return 'Vencida';
      case 'cancelled':
        return 'Cancelada';
      case 'pending':
        return 'Pendiente';
      default:
        return estado || 'N/A';
    }
  };

  const handlePolizaPress = (polizaId: number) => {
    navigation.navigate('PolizaDetail', { polizaId });
  };

  const renderPoliza = ({ item }: { item: Poliza }) => (
    <TouchableOpacity style={styles.polizaCard} activeOpacity={0.7} onPress={() => handlePolizaPress(item.id)}>
      <View style={[styles.cardAccent, { backgroundColor: getStatusColor(item.estado) }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.polizaNumber} numberOfLines={1}>{item.numero_poliza || 'Sin número'}</Text>
            <Text style={styles.clientName} numberOfLines={1}>
              {item.nombre_completo_cliente || `${item.nombres_cliente || ''} ${item.apellidos_cliente || ''}`.trim() || item.cliente || 'Sin cliente'}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(item.estado)}18` }]}>
            <Text style={[styles.statusText, { color: getStatusColor(item.estado) }]}>{getStatusLabel(item.estado)}</Text>
          </View>
        </View>
        <View style={styles.cardBottomRow}>
          <View style={styles.cardMeta}>
            <Ionicons name="shield-outline" size={12} color="#9CA3AF" />
            <Text style={styles.metaText} numberOfLines={1}>{item.ramo_nombre || item.ramo_principal || item.ramo || 'N/A'}</Text>
          </View>
          <View style={styles.cardMeta}>
            <Ionicons name="calendar-outline" size={12} color="#9CA3AF" />
            <Text style={styles.metaText}>{item.fecha_fin || 'N/A'}</Text>
          </View>
          <Text style={styles.primeValue}>{formatCurrency(item.prima_neta || 0)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

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
          <View>
            <Text style={styles.headerTitle}>Pólizas</Text>
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

      {showFilters && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {ESTADO_FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, activeFilter === f && styles.filterChipActive]}
              onPress={() => onFilterChange(f)}
            >
              <Text style={[styles.filterChipText, activeFilter === f && styles.filterChipTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

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

      {error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchPolizas(1, true)}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={polizas}
          renderItem={renderPoliza}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#573CFF']} />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.loadingMore}>
                <ActivityIndicator size="small" color="#573CFF" />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={48} color="#9CA3AF" />
              <Text style={styles.emptyText}>No hay pólizas</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('CreatePoliza')}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>
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
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: 'Montserrat_700Bold',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  headerCount: {
    fontSize: 11,
    fontFamily: 'Montserrat_500Medium',
    color: 'rgba(255,255,255,0.55)',
    marginTop: 2,
  },
  filterBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#374151',
  },
  filterScroll: {
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  filterChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
  },
  filterChipActive: {
    backgroundColor: '#573CFF',
  },
  filterChipText: {
    fontSize: 14,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#6B7280',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontFamily: 'Montserrat_500Medium',
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    fontFamily: 'Montserrat_500Medium',
    color: '#EF4444',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#573CFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Montserrat_600SemiBold',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  polizaCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginBottom: 8,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  cardAccent: {
    width: 4,
  },
  cardBody: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  polizaNumber: {
    fontSize: 13,
    fontFamily: 'Montserrat_700Bold',
    color: '#0d0d0d',
    letterSpacing: -0.2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 10,
    fontFamily: 'Montserrat_700Bold',
    letterSpacing: 0.3,
  },
  clientName: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#6B7280',
    marginTop: 2,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    fontFamily: 'Montserrat_400Regular',
    color: '#9CA3AF',
  },
  primeValue: {
    fontSize: 12,
    fontFamily: 'Montserrat_700Bold',
    color: '#10B981',
    marginLeft: 'auto',
  },
  loadingMore: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    fontFamily: 'Montserrat_500Medium',
    color: '#9CA3AF',
  },
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#573CFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#573CFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
});

export default PolizasScreen;
