import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList,
  RefreshControl,
  ScrollView,
  Modal,
  ActivityIndicator,
  TextInput,
  ImageBackground,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getAuditLogs, getAuditStats, AuditLog, AuditStats } from '../services/auditService';
import { getEmpleados, Empleado } from '../services/empleadosService';
import LoadingSpinner from '../components/LoadingSpinner';

interface Employee {
  user_id: number;
  user_name: string;
  user_email: string;
  total_actions: number;
}

const EmpleadosScreen: React.FC = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [empleadosList, setEmpleadosList] = useState<Empleado[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [loadingEmpleados, setLoadingEmpleados] = useState(false);

  const fetchData = async (pageNum: number = 1, isRefresh: boolean = false, userId?: number) => {
    try {
      setError(null);
      
      const params: any = { page: pageNum, per_page: 20 };
      if (userId) params.user_id = userId;
      
      const [logsResponse, statsResponse] = await Promise.all([
        getAuditLogs(params),
        pageNum === 1 && !userId ? getAuditStats(30) : Promise.resolve(null)
      ]);
      
      if (logsResponse.success) {
        if (isRefresh || pageNum === 1) {
          setLogs(logsResponse.data);
        } else {
          setLogs(prev => [...prev, ...logsResponse.data]);
        }
        setHasMore(logsResponse.pagination.current_page < logsResponse.pagination.last_page);
        setPage(logsResponse.pagination.current_page);
      }
      
      if (statsResponse?.success) {
        setStats(statsResponse.stats);
        // Extraer empleados de top_users
        if (statsResponse.stats.top_users) {
          setEmployees(statsResponse.stats.top_users);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  const fetchEmpleados = async () => {
    try {
      setLoadingEmpleados(true);
      const response = await getEmpleados({ per_page: 100 });
      if (response.success) {
        setEmpleadosList(response.data);
      }
    } catch (err) {
      // silently fail, we still have top_users as fallback
    } finally {
      setLoadingEmpleados(false);
    }
  };

  useEffect(() => {
    fetchData(1);
    fetchEmpleados();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    setPage(1);
    fetchData(1, true, selectedEmployee?.user_id);
  };

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      setLoadingMore(true);
      fetchData(page + 1, false, selectedEmployee?.user_id);
    }
  };

  const handleSelectEmployee = (employee: Employee | null) => {
    setSelectedEmployee(employee);
    setShowEmployeeModal(false);
    setLoading(true);
    setPage(1);
    fetchData(1, true, employee?.user_id);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActionIcon = (action: string) => {
    if (action.includes('create') || action.includes('store')) return 'add-circle-outline';
    if (action.includes('update') || action.includes('edit')) return 'create-outline';
    if (action.includes('delete') || action.includes('destroy')) return 'trash-outline';
    if (action.includes('login')) return 'log-in-outline';
    if (action.includes('logout')) return 'log-out-outline';
    if (action.includes('view') || action.includes('show') || action.includes('index')) return 'eye-outline';
    return 'ellipse-outline';
  };

  const getActionColor = (action: string) => {
    if (action.includes('create') || action.includes('store')) return '#10B981';
    if (action.includes('update') || action.includes('edit')) return '#F59E0B';
    if (action.includes('delete') || action.includes('destroy')) return '#EF4444';
    if (action.includes('login')) return '#3B82F6';
    if (action.includes('logout')) return '#6B7280';
    return '#573CFF';
  };

  const getModuleLabel = (module: string) => {
    const labels: Record<string, string> = {
      'polizas': 'Pólizas',
      'clientes': 'Clientes',
      'siniestros': 'Siniestros',
      'usuarios': 'Usuarios',
      'auth': 'Autenticación',
      'dashboard': 'Dashboard',
      'reportes': 'Reportes',
    };
    return labels[module?.toLowerCase()] || module || 'Sistema';
  };

  const renderLog = ({ item }: { item: AuditLog }) => (
    <View style={styles.logCard}>
      <View style={styles.logHeader}>
        <View style={[styles.iconContainer, { backgroundColor: getActionColor(item.action) + '20' }]}>
          <Ionicons name={getActionIcon(item.action) as any} size={20} color={getActionColor(item.action)} />
        </View>
        <View style={styles.logInfo}>
          <Text style={styles.logAction}>{item.action}</Text>
          <Text style={styles.logModule}>{getModuleLabel(item.module)}</Text>
        </View>
        <Text style={styles.logTime}>{formatDate(item.created_at)}</Text>
      </View>
      <View style={styles.logDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="person-outline" size={14} color="#9CA3AF" />
          <Text style={styles.detailText}>
            {item.user_name || item.metadata?.user_name || item.metadata?.nombre || (item.user_id ? `Usuario #${item.user_id}` : 'Sistema')}
          </Text>
        </View>
        {item.ip_address && (
          <View style={styles.detailRow}>
            <Ionicons name="globe-outline" size={14} color="#9CA3AF" />
            <Text style={styles.detailText}>{item.ip_address}</Text>
          </View>
        )}
      </View>
    </View>
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
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trazabilidad</Text>
        <TouchableOpacity style={styles.filterButton} onPress={() => setShowEmployeeModal(true)}>
          <Ionicons name="filter-outline" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </ImageBackground>

      {/* Filtro de empleado activo */}
      {selectedEmployee && (
        <View style={styles.activeFilterContainer}>
          <View style={styles.activeFilter}>
            <Ionicons name="person" size={16} color="#573CFF" />
            <Text style={styles.activeFilterText}>{selectedEmployee.user_name}</Text>
            <TouchableOpacity onPress={() => handleSelectEmployee(null)}>
              <Ionicons name="close-circle" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Modal de selección de empleado */}
      <Modal
        visible={showEmployeeModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEmployeeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filtrar por Empleado</Text>
              <TouchableOpacity onPress={() => setShowEmployeeModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalSearchContainer}>
              <Ionicons name="search" size={18} color="#9CA3AF" />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Buscar empleado..."
                placeholderTextColor="#9CA3AF"
                value={employeeSearch}
                onChangeText={setEmployeeSearch}
              />
              {employeeSearch.length > 0 && (
                <TouchableOpacity onPress={() => setEmployeeSearch('')}>
                  <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>
            
            <TouchableOpacity 
              style={[styles.employeeItem, !selectedEmployee && styles.employeeItemActive]}
              onPress={() => handleSelectEmployee(null)}
            >
              <View style={styles.employeeIcon}>
                <Ionicons name="people" size={20} color="#573CFF" />
              </View>
              <View style={styles.employeeInfo}>
                <Text style={styles.employeeName}>Todos los empleados</Text>
                <Text style={styles.employeeEmail}>Ver actividad de todos</Text>
              </View>
              {!selectedEmployee && (
                <Ionicons name="checkmark-circle" size={22} color="#573CFF" />
              )}
            </TouchableOpacity>

            {loadingEmpleados ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#573CFF" />
              </View>
            ) : (
              <ScrollView style={styles.employeeList}>
                {(() => {
                  // Merge empleados list with audit top_users for best coverage
                  const searchLower = employeeSearch.toLowerCase();
                  
                  // Use empleadosList if available, otherwise fall back to audit top_users
                  if (empleadosList.length > 0) {
                    const filtered = empleadosList.filter(emp => {
                      if (!employeeSearch) return true;
                      return (
                        `${emp.nombres} ${emp.apellidos}`.toLowerCase().includes(searchLower) ||
                        emp.email?.toLowerCase().includes(searchLower) ||
                        emp.cargo?.toLowerCase().includes(searchLower)
                      );
                    });
                    return filtered.map((emp) => {
                      const auditUser = employees.find(e => e.user_email === emp.email);
                      return (
                        <TouchableOpacity 
                          key={emp.id}
                          style={[
                            styles.employeeItem, 
                            selectedEmployee?.user_id === (auditUser?.user_id || emp.id) && styles.employeeItemActive
                          ]}
                          onPress={() => handleSelectEmployee({
                            user_id: auditUser?.user_id || emp.id,
                            user_name: `${emp.nombres} ${emp.apellidos}`,
                            user_email: emp.email,
                            total_actions: auditUser?.total_actions || 0,
                          })}
                        >
                          <View style={[styles.employeeIcon, { backgroundColor: emp.estado === 'activo' ? '#D1FAE5' : '#F3F4F6' }]}>
                            <Text style={{ fontSize: 14, fontFamily: 'Montserrat_700Bold', color: emp.estado === 'activo' ? '#10B981' : '#9CA3AF' }}>
                              {emp.nombres?.charAt(0) || ''}{emp.apellidos?.charAt(0) || ''}
                            </Text>
                          </View>
                          <View style={styles.employeeInfo}>
                            <Text style={styles.employeeName}>{emp.nombres} {emp.apellidos}</Text>
                            <Text style={styles.employeeEmail}>{emp.email}</Text>
                            <Text style={styles.employeeCargo}>{emp.cargo || emp.tipo_vinculacion || 'Sin cargo'}</Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            {auditUser && (
                              <Text style={styles.employeeActions}>{auditUser.total_actions} acciones</Text>
                            )}
                            {selectedEmployee?.user_id === (auditUser?.user_id || emp.id) && (
                              <Ionicons name="checkmark-circle" size={22} color="#573CFF" style={{ marginTop: 4 }} />
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    });
                  }
                  
                  // Fallback to audit top_users
                  const filtered = employees.filter(emp => {
                    if (!employeeSearch) return true;
                    return (
                      emp.user_name?.toLowerCase().includes(searchLower) ||
                      emp.user_email?.toLowerCase().includes(searchLower)
                    );
                  });
                  return filtered.map((employee) => (
                    <TouchableOpacity 
                      key={employee.user_id}
                      style={[
                        styles.employeeItem, 
                        selectedEmployee?.user_id === employee.user_id && styles.employeeItemActive
                      ]}
                      onPress={() => handleSelectEmployee(employee)}
                    >
                      <View style={styles.employeeIcon}>
                        <Ionicons name="person" size={20} color="#573CFF" />
                      </View>
                      <View style={styles.employeeInfo}>
                        <Text style={styles.employeeName}>{employee.user_name}</Text>
                        <Text style={styles.employeeEmail}>{employee.user_email}</Text>
                        <Text style={styles.employeeActions}>{employee.total_actions} acciones</Text>
                      </View>
                      {selectedEmployee?.user_id === employee.user_id && (
                        <Ionicons name="checkmark-circle" size={22} color="#573CFF" />
                      )}
                    </TouchableOpacity>
                  ));
                })()}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

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
          data={logs}
          renderItem={renderLog}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#573CFF']} />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={
            stats ? (
              <View style={styles.statsContainer}>
                <Text style={styles.statsTitle}>Últimos 30 días</Text>
                <View style={styles.statsRow}>
                  <View style={styles.statCard}>
                    <Text style={styles.statNumber}>{stats.total_actions}</Text>
                    <Text style={styles.statLabel}>Acciones</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statNumber}>{stats.unique_users}</Text>
                    <Text style={styles.statLabel}>Usuarios</Text>
                  </View>
                </View>
                <Text style={styles.sectionTitle}>Actividad Reciente</Text>
              </View>
            ) : null
          }
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
              <Text style={styles.emptyText}>No hay actividad registrada</Text>
            </View>
          }
        />
      )}
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
    width: 40,
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
  statsContainer: {
    marginTop: 20,
    marginBottom: 10,
  },
  statsTitle: {
    fontSize: 14,
    fontFamily: 'Montserrat_500Medium',
    color: '#6B7280',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statNumber: {
    fontSize: 28,
    fontFamily: 'Montserrat_700Bold',
    color: '#573CFF',
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#6B7280',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#374151',
    marginBottom: 12,
  },
  logCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logInfo: {
    flex: 1,
    marginLeft: 12,
  },
  logAction: {
    fontSize: 14,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#374151',
  },
  logModule: {
    fontSize: 12,
    fontFamily: 'Montserrat_400Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  logTime: {
    fontSize: 11,
    fontFamily: 'Montserrat_400Regular',
    color: '#9CA3AF',
  },
  logDetails: {
    flexDirection: 'row',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  detailText: {
    fontSize: 12,
    fontFamily: 'Montserrat_400Regular',
    color: '#6B7280',
    marginLeft: 4,
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
  filterButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeFilterContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
  },
  activeFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
    gap: 8,
  },
  activeFilterText: {
    fontSize: 13,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#573CFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Montserrat_700Bold',
    color: '#1F2937',
  },
  employeeList: {
    maxHeight: 400,
  },
  employeeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
  },
  employeeItemActive: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#573CFF',
  },
  employeeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  employeeInfo: {
    flex: 1,
  },
  employeeName: {
    fontSize: 15,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#1F2937',
  },
  employeeEmail: {
    fontSize: 12,
    fontFamily: 'Montserrat_400Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  employeeActions: {
    fontSize: 11,
    fontFamily: 'Montserrat_500Medium',
    color: '#573CFF',
    marginTop: 4,
  },
  employeeCargo: {
    fontSize: 11,
    fontFamily: 'Montserrat_400Regular',
    color: '#9CA3AF',
    marginTop: 2,
  },
  modalSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginVertical: 12,
    gap: 8,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Montserrat_500Medium',
    color: '#1F2937',
    padding: 0,
  },
});

export default EmpleadosScreen;
