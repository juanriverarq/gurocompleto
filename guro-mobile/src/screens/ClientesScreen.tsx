import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList,
  RefreshControl,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getClientes, Cliente } from '../services/clientesService';
import { ClientesStackParamList } from '../navigation/ClientesStackNavigator';
import LoadingSpinner from '../components/LoadingSpinner';

type NavigationProp = NativeStackNavigationProp<ClientesStackParamList>;

const ClientesScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [filteredClientes, setFilteredClientes] = useState<Cliente[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchClientes = async (isRefresh: boolean = false) => {
    try {
      setError(null);
      const response = await getClientes();
      
      if (response.success) {
        setClientes(response.data);
        setFilteredClientes(response.data);
      } else {
        setError(response.message || 'Error al cargar clientes');
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchClientes();
  }, []);

  useEffect(() => {
    if (search.trim() === '') {
      setFilteredClientes(clientes);
    } else {
      const searchLower = search.toLowerCase();
      const filtered = clientes.filter(cliente => 
        (cliente.nombre?.toLowerCase().includes(searchLower)) ||
        (cliente.apellidos?.toLowerCase().includes(searchLower)) ||
        (cliente.email_principal?.toLowerCase().includes(searchLower)) ||
        (cliente.cuit?.toLowerCase().includes(searchLower)) ||
        (cliente.celular_principal?.includes(search)) ||
        (cliente.empresa?.toLowerCase().includes(searchLower))
      );
      setFilteredClientes(filtered);
    }
  }, [search, clientes]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchClientes(true);
  };

  const getClienteName = (cliente: Cliente) => {
    if (cliente.client_type === 'empresa' && cliente.empresa) {
      return cliente.empresa;
    }
    return `${cliente.nombre || ''} ${cliente.apellidos || ''}`.trim() || 'Sin nombre';
  };

  const getClienteInitials = (cliente: Cliente) => {
    const name = getClienteName(cliente);
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getClienteTypeIcon = (cliente: Cliente) => {
    return cliente.client_type === 'empresa' ? 'business' : 'person';
  };

  const handleClientePress = (clienteId: number) => {
    navigation.navigate('ClienteDetail', { clienteId });
  };

  const renderCliente = ({ item }: { item: Cliente }) => (
    <TouchableOpacity style={styles.clienteCard} onPress={() => handleClientePress(item.id)}>
      <View style={styles.avatarContainer}>
        <View style={[styles.avatar, { backgroundColor: item.client_type === 'empresa' ? '#8B5CF620' : '#6172FD20' }]}>
          <Ionicons 
            name={getClienteTypeIcon(item)} 
            size={24} 
            color={item.client_type === 'empresa' ? '#8B5CF6' : '#6172FD'} 
          />
        </View>
      </View>
      <View style={styles.clienteInfo}>
        <Text style={styles.clienteName}>{getClienteName(item)}</Text>
        {item.email_principal && (
          <View style={styles.detailRow}>
            <Ionicons name="mail-outline" size={12} color="#9CA3AF" />
            <Text style={styles.detailText}>{item.email_principal}</Text>
          </View>
        )}
        {(item.celular_principal || item.telefono) && (
          <View style={styles.detailRow}>
            <Ionicons name="call-outline" size={12} color="#9CA3AF" />
            <Text style={styles.detailText}>{item.celular_principal || item.telefono}</Text>
          </View>
        )}
      </View>
      <View style={styles.clienteActions}>
        <View style={[styles.typeBadge, { backgroundColor: item.client_type === 'empresa' ? '#8B5CF620' : '#10B98120' }]}>
          <Text style={[styles.typeText, { color: item.client_type === 'empresa' ? '#8B5CF6' : '#10B981' }]}>
            {item.client_type === 'empresa' ? 'Empresa' : 'Persona'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
      </View>
    </TouchableOpacity>
  );

  if (loading && !refreshing) {
    return <LoadingSpinner />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Clientes</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search-outline" size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar cliente..."
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
        <Text style={styles.totalText}>{filteredClientes.length} clientes</Text>
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchClientes(true)}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredClientes}
          renderItem={renderCliente}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6172FD']} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color="#9CA3AF" />
              <Text style={styles.emptyText}>No hay clientes</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('CreateCliente')}
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
  totalText: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'right',
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
  clienteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clienteInfo: {
    flex: 1,
  },
  clienteName: {
    fontSize: 15,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#374151',
    marginBottom: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  detailText: {
    fontSize: 12,
    fontFamily: 'Montserrat_400Regular',
    color: '#6B7280',
    marginLeft: 4,
  },
  clienteActions: {
    alignItems: 'flex-end',
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  typeText: {
    fontSize: 10,
    fontFamily: 'Montserrat_600SemiBold',
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

export default ClientesScreen;
