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
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getEmpleados, Empleado } from '../services/empleadosService';
import LoadingSpinner from '../components/LoadingSpinner';

const EmpleadosListScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [totalEmpleados, setTotalEmpleados] = useState(0);

  const fetchData = async (pageNum: number = 1, isRefresh: boolean = false, searchTerm?: string) => {
    try {
      setError(null);
      
      const response = await getEmpleados({ 
        page: pageNum, 
        per_page: 20,
        search: searchTerm || undefined,
      });
      
      if (response.success) {
        if (isRefresh || pageNum === 1) {
          setEmpleados(response.data);
        } else {
          setEmpleados(prev => [...prev, ...response.data]);
        }
        setHasMore(response.pagination.current_page < response.pagination.last_page);
        setPage(response.pagination.current_page);
        setTotalEmpleados(response.pagination.total);
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
    fetchData(1);
  }, []);

  useEffect(() => {
    const delaySearch = setTimeout(() => {
      setLoading(true);
      setPage(1);
      fetchData(1, true, search);
    }, 500);

    return () => clearTimeout(delaySearch);
  }, [search]);

  const onRefresh = () => {
    setRefreshing(true);
    setPage(1);
    fetchData(1, true, search);
  };

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      setLoadingMore(true);
      fetchData(page + 1, false, search);
    }
  };

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'activo': return '#10B981';
      case 'inactivo': return '#EF4444';
      case 'vacaciones': return '#F59E0B';
      case 'licencia': return '#8B5CF6';
      default: return '#6B7280';
    }
  };

  const getEstadoLabel = (estado: string) => {
    const labels: Record<string, string> = {
      'activo': 'Activo',
      'inactivo': 'Inactivo',
      'vacaciones': 'Vacaciones',
      'licencia': 'Licencia',
      'retirado': 'Retirado',
    };
    return labels[estado] || estado;
  };

  const renderEmpleado = ({ item }: { item: Empleado }) => (
    <TouchableOpacity 
      style={styles.empleadoCard}
      onPress={() => navigation.navigate('EmpleadoDetail', { empleadoId: item.id })}
    >
      <View style={styles.cardTop}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>
            {item.nombres?.charAt(0) || ''}{item.apellidos?.charAt(0) || ''}
          </Text>
        </View>
        <View style={styles.empleadoInfo}>
          <Text style={styles.empleadoName}>{item.nombres} {item.apellidos}</Text>
          <Text style={styles.empleadoCargo}>{item.cargo || 'Sin cargo'}</Text>
          {item.email && (
            <View style={styles.contactRow}>
              <Ionicons name="mail-outline" size={12} color="#9CA3AF" />
              <Text style={styles.contactText} numberOfLines={1}>{item.email}</Text>
            </View>
          )}
          {(item.celular || item.telefono) && (
            <View style={styles.contactRow}>
              <Ionicons name="call-outline" size={12} color="#9CA3AF" />
              <Text style={styles.contactText}>{item.celular || item.telefono}</Text>
            </View>
          )}
        </View>
        <View style={styles.empleadoRight}>
          <View style={[styles.estadoBadge, { backgroundColor: getEstadoColor(item.estado) + '20' }]}>
            <View style={[styles.estadoDot, { backgroundColor: getEstadoColor(item.estado) }]} />
            <Text style={[styles.estadoText, { color: getEstadoColor(item.estado) }]}>
              {getEstadoLabel(item.estado)}
            </Text>
          </View>
          {item.rol && (
            <View style={styles.rolBadge}>
              <Ionicons name="shield-checkmark" size={11} color="#6172FD" />
              <Text style={styles.rolText}>{item.rol.nombre}</Text>
            </View>
          )}
        </View>
      </View>
      {(item.celular || item.email) && (
        <View style={styles.quickActionsRow}>
          {item.celular && (
            <TouchableOpacity style={styles.quickBtn} onPress={(e) => { e.stopPropagation(); Linking.openURL(`tel:${item.celular}`); }}>
              <Ionicons name="call" size={15} color="#6172FD" />
              <Text style={styles.quickBtnText}>Llamar</Text>
            </TouchableOpacity>
          )}
          {item.celular && (
            <TouchableOpacity style={styles.quickBtn} onPress={(e) => { e.stopPropagation(); Linking.openURL(`https://wa.me/57${item.celular?.replace(/\D/g, '')}`); }}>
              <Ionicons name="logo-whatsapp" size={15} color="#25D366" />
              <Text style={[styles.quickBtnText, { color: '#25D366' }]}>WhatsApp</Text>
            </TouchableOpacity>
          )}
          {item.email && (
            <TouchableOpacity style={styles.quickBtn} onPress={(e) => { e.stopPropagation(); Linking.openURL(`mailto:${item.email}`); }}>
              <Ionicons name="mail" size={15} color="#3B82F6" />
              <Text style={[styles.quickBtnText, { color: '#3B82F6' }]}>Email</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  );

  if (loading && !refreshing && empleados.length === 0) {
    return <LoadingSpinner />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Empleados</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar empleado..."
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.totalText}>{totalEmpleados} empleados</Text>
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchData(1, true)}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={empleados}
          renderItem={renderEmpleado}
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
              <Ionicons name="people-outline" size={48} color="#9CA3AF" />
              <Text style={styles.emptyText}>No se encontraron empleados</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('CreateEmpleado')}
      >
        <Ionicons name="person-add" size={24} color="#FFFFFF" />
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
    paddingHorizontal: 14,
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
    fontSize: 15,
    fontFamily: 'Montserrat_500Medium',
    color: '#1F2937',
  },
  totalText: {
    marginTop: 12,
    fontSize: 13,
    fontFamily: 'Montserrat_500Medium',
    color: '#6B7280',
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
  empleadoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#6172FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontFamily: 'Montserrat_700Bold',
    color: '#FFFFFF',
  },
  empleadoInfo: {
    flex: 1,
    marginLeft: 12,
  },
  empleadoName: {
    fontSize: 15,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#1F2937',
  },
  empleadoCargo: {
    fontSize: 13,
    fontFamily: 'Montserrat_400Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 4,
  },
  contactText: {
    fontSize: 11,
    fontFamily: 'Montserrat_400Regular',
    color: '#9CA3AF',
    flex: 1,
  },
  rolBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  rolText: {
    fontSize: 10,
    fontFamily: 'Montserrat_500Medium',
    color: '#6172FD',
  },
  empleadoRight: {
    alignItems: 'flex-end',
  },
  estadoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  estadoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  estadoText: {
    fontSize: 11,
    fontFamily: 'Montserrat_600SemiBold',
  },
  quickActionsRow: {
    flexDirection: 'row',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    justifyContent: 'space-around',
  },
  quickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  quickBtnText: {
    fontSize: 11,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#6172FD',
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

export default EmpleadosListScreen;
