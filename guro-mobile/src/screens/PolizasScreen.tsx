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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getPolizas, Poliza } from '../services/polizasService';
import { PolizasStackParamList } from '../navigation/PolizasStackNavigator';
import LoadingSpinner from '../components/LoadingSpinner';

type NavigationProp = NativeStackNavigationProp<PolizasStackParamList>;

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

  const fetchPolizas = async (pageNum: number = 1, isRefresh: boolean = false) => {
    try {
      setError(null);
      const response = await getPolizas({ 
        page: pageNum, 
        per_page: 15,
        search: search || undefined 
      });
      
      if (response.success) {
        if (isRefresh || pageNum === 1) {
          setPolizas(response.data);
        } else {
          setPolizas(prev => [...prev, ...response.data]);
        }
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
    <TouchableOpacity style={styles.polizaCard} onPress={() => handlePolizaPress(item.id)}>
      <View style={styles.polizaHeader}>
        <Text style={styles.polizaNumber}>{item.numero_poliza || 'Sin número'}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.estado) }]}>
          <Text style={styles.statusText}>{getStatusLabel(item.estado)}</Text>
        </View>
      </View>
      
      <Text style={styles.clientName}>{item.nombre_completo_cliente || `${item.nombres_cliente || ''} ${item.apellidos_cliente || ''}`.trim() || item.cliente || 'Cliente no especificado'}</Text>
      
      <View style={styles.ramoContainer}>
        <Ionicons name="shield-outline" size={14} color="#6B7280" />
        <Text style={styles.ramoText} numberOfLines={1}>{item.ramo_nombre || item.ramo_principal || item.ramo || 'N/A'}</Text>
      </View>
      
      <View style={styles.polizaFooter}>
        <View>
          <Text style={styles.labelSmall}>Prima</Text>
          <Text style={styles.primeValue}>{formatCurrency(item.prima_neta || 0)}</Text>
        </View>
        <View>
          <Text style={styles.labelSmall}>Vence</Text>
          <Text style={styles.dateValue}>{item.fecha_fin || 'N/A'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading && !refreshing) {
    return <LoadingSpinner />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pólizas</Text>
        <View style={styles.headerPlaceholder} />
      </View>

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
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6172FD']} />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.loadingMore}>
                <ActivityIndicator size="small" color="#6172FD" />
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
    fontSize: 20,
    fontFamily: 'Montserrat_700Bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  headerPlaceholder: {
    width: 40,
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
    backgroundColor: '#6172FD',
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
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  polizaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  polizaNumber: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#6172FD',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#FFFFFF',
  },
  clientName: {
    fontSize: 15,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#374151',
    marginBottom: 10,
  },
  polizaDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 13,
    fontFamily: 'Montserrat_400Regular',
    color: '#6B7280',
    flex: 1,
    marginLeft: 6,
  },
  ramoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  ramoText: {
    fontSize: 13,
    fontFamily: 'Montserrat_400Regular',
    color: '#6B7280',
    flex: 1,
    marginLeft: 6,
  },
  polizaFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12,
  },
  labelSmall: {
    fontSize: 11,
    fontFamily: 'Montserrat_500Medium',
    color: '#9CA3AF',
  },
  primeValue: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#10B981',
  },
  dateValue: {
    fontSize: 14,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#374151',
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
    backgroundColor: '#6172FD',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6172FD',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
});

export default PolizasScreen;
