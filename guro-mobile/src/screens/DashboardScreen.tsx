import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  RefreshControl,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getDashboardData, DashboardData, getPrimasChart, getClientesChart, getPolizasChart, ChartResponse } from '../services/dashboardService';
import LoadingSpinner from '../components/LoadingSpinner';

const SCREEN_WIDTH = Dimensions.get('window').width;

const DashboardScreen: React.FC = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [primasChart, setPrimasChart] = useState<ChartResponse['data'] | null>(null);
  const [clientesChart, setClientesChart] = useState<ChartResponse['data'] | null>(null);
  const [polizasChart, setPolizasChart] = useState<ChartResponse['data'] | null>(null);
  const [chartPeriod, setChartPeriod] = useState<'week' | 'month' | 'year'>('month');

  const fetchData = async () => {
    try {
      setError(null);
      const [dashRes, primasRes, clientesRes, polizasRes] = await Promise.all([
        getDashboardData(),
        getPrimasChart(chartPeriod).catch(() => null),
        getClientesChart(chartPeriod).catch(() => null),
        getPolizasChart(chartPeriod).catch(() => null),
      ]);
      if (dashRes.success) {
        setData(dashRes.data);
      } else {
        setError(dashRes.message || 'Error al cargar datos');
      }
      if (primasRes?.success) setPrimasChart(primasRes.data);
      if (clientesRes?.success) setClientesChart(clientesRes.data);
      if (polizasRes?.success) setPolizasChart(polizasRes.data);
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [chartPeriod]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatCurrencyFull = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getPolizaTipoIcon = (tipo: string): string => {
    const map: Record<string, string> = {
      vida: 'heart',
      auto: 'car',
      automovil: 'car',
      hogar: 'home',
      salud: 'medkit',
      empresarial: 'business',
      responsabilidad_civil: 'shield',
      transporte: 'airplane',
      incendio: 'flame',
      todo_riesgo: 'shield-checkmark',
    };
    return map[tipo?.toLowerCase()] || 'document-text';
  };

  const getPolizaTipoColor = (tipo: string): string => {
    const map: Record<string, string> = {
      vida: '#EC4899',
      auto: '#3B82F6',
      automovil: '#3B82F6',
      hogar: '#F59E0B',
      salud: '#22C55E',
      empresarial: '#8B5CF6',
      responsabilidad_civil: '#6366F1',
      transporte: '#06B6D4',
      incendio: '#EF4444',
      todo_riesgo: '#14B8A6',
    };
    return map[tipo?.toLowerCase()] || '#6B7280';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#22C55E';
      case 'expired': return '#EF4444';
      case 'cancelled': return '#9CA3AF';
      default: return '#F59E0B';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Activa';
      case 'expired': return 'Vencida';
      case 'cancelled': return 'Cancelada';
      default: return status;
    }
  };

  // Simple bar chart component
  const renderMiniChart = (chartData: ChartResponse['data'] | null, color: string, label: string) => {
    if (!chartData || !chartData.data.length) return null;
    const maxVal = Math.max(...chartData.data, 1);
    const barWidth = Math.max(4, (SCREEN_WIDTH - 80) / chartData.data.length - 3);
    // Show last 6 labels
    const step = Math.max(1, Math.floor(chartData.labels.length / 5));

    return (
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>{label}</Text>
        <View style={styles.chartBarsContainer}>
          {chartData.data.map((val, i) => (
            <View key={i} style={styles.chartBarWrapper}>
              <View
                style={[
                  styles.chartBar,
                  {
                    height: Math.max(4, (val / maxVal) * 80),
                    width: barWidth,
                    backgroundColor: val > 0 ? color : '#E5E7EB',
                  },
                ]}
              />
              {i % step === 0 && (
                <Text style={styles.chartBarLabel} numberOfLines={1}>
                  {chartData.labels[i]?.split(' ')[0] || ''}
                </Text>
              )}
            </View>
          ))}
        </View>
      </View>
    );
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
          <Text style={styles.retryButtonText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const crecimiento = data?.ventas.crecimiento_porcentaje || 0;
  const polizasTipo = data?.polizas_por_tipo || {};
  const polizasRecientes = data?.polizas_recientes || [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Dashboard</Text>
          {data?.broker?.name && (
            <Text style={styles.headerSubtitle}>{data.broker.name}</Text>
          )}
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
          <Ionicons name="refresh-outline" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6172FD']} />
        }
      >
        {/* Resumen de Pólizas */}
        <Text style={styles.sectionTitle}>Pólizas</Text>
        <View style={styles.polizasGrid}>
          <View style={styles.polizaCard}>
            <View style={[styles.polizaIconBg, { backgroundColor: '#EEF2FF' }]}>
              <Ionicons name="document-text" size={20} color="#6172FD" />
            </View>
            <Text style={styles.polizaNumber}>{data?.resumen_polizas.total || 0}</Text>
            <Text style={styles.polizaLabel}>Total</Text>
          </View>
          <View style={styles.polizaCard}>
            <View style={[styles.polizaIconBg, { backgroundColor: '#F0FDF4' }]}>
              <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
            </View>
            <Text style={styles.polizaNumber}>{data?.resumen_polizas.activas || 0}</Text>
            <Text style={styles.polizaLabel}>Activas</Text>
          </View>
          <View style={styles.polizaCard}>
            <View style={[styles.polizaIconBg, { backgroundColor: '#FFF7ED' }]}>
              <Ionicons name="time" size={20} color="#F59E0B" />
            </View>
            <Text style={styles.polizaNumber}>{data?.resumen_polizas.por_vencer || 0}</Text>
            <Text style={styles.polizaLabel}>Por Vencer</Text>
          </View>
          <View style={styles.polizaCard}>
            <View style={[styles.polizaIconBg, { backgroundColor: '#FEF2F2' }]}>
              <Ionicons name="close-circle" size={20} color="#EF4444" />
            </View>
            <Text style={styles.polizaNumber}>{data?.resumen_polizas.vencidas || 0}</Text>
            <Text style={styles.polizaLabel}>Vencidas</Text>
          </View>
        </View>

        {/* Finanzas */}
        <Text style={styles.sectionTitle}>Finanzas</Text>
        <View style={styles.financeCard}>
          <View style={styles.financeItem}>
            <View style={styles.financeLeft}>
              <View style={[styles.financeDot, { backgroundColor: '#6172FD' }]} />
              <Text style={styles.financeLabel}>Primas Totales</Text>
            </View>
            <Text style={styles.financeValue}>
              {formatCurrencyFull(data?.finanzas.valor_primas_numero || 0)}
            </Text>
          </View>
          <View style={styles.financeDivider} />
          <View style={styles.financeItem}>
            <View style={styles.financeLeft}>
              <View style={[styles.financeDot, { backgroundColor: '#22C55E' }]} />
              <Text style={styles.financeLabel}>Comisiones</Text>
            </View>
            <Text style={[styles.financeValue, { color: '#22C55E' }]}>
              {formatCurrencyFull(data?.finanzas.comision_numero || 0)}
            </Text>
          </View>
          <View style={styles.financeDivider} />
          <View style={styles.financeItem}>
            <View style={styles.financeLeft}>
              <View style={[styles.financeDot, { backgroundColor: '#F59E0B' }]} />
              <Text style={styles.financeLabel}>Valor Asegurado</Text>
            </View>
            <Text style={styles.financeValue}>
              {formatCurrencyFull(data?.finanzas.valor_asegurado_numero || 0)}
            </Text>
          </View>
        </View>

        {/* Recaudos */}
        {data?.recaudos && (
          <>
            <Text style={styles.sectionTitle}>Recaudos y Cartera</Text>
            <View style={styles.recaudosCard}>
              <View style={styles.recaudoRow}>
                <View style={styles.recaudoItem}>
                  <View style={[styles.recaudoIconBg, { backgroundColor: '#F0FDF4' }]}>
                    <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
                  </View>
                  <View>
                    <Text style={styles.recaudoLabel}>Primas Cobradas</Text>
                    <Text style={[styles.recaudoValue, { color: '#22C55E' }]}>
                      {formatCurrency(data.recaudos.primas_cobradas)}
                    </Text>
                  </View>
                </View>
                <View style={styles.recaudoItem}>
                  <View style={[styles.recaudoIconBg, { backgroundColor: '#FFF7ED' }]}>
                    <Ionicons name="time-outline" size={18} color="#F59E0B" />
                  </View>
                  <View>
                    <Text style={styles.recaudoLabel}>Primas Pendientes</Text>
                    <Text style={[styles.recaudoValue, { color: '#F59E0B' }]}>
                      {formatCurrency(data.recaudos.primas_pendientes)}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.recaudoDivider} />
              <View style={styles.recaudoRow}>
                <View style={styles.recaudoItem}>
                  <View style={[styles.recaudoIconBg, { backgroundColor: '#EEF2FF' }]}>
                    <Ionicons name="wallet" size={18} color="#6172FD" />
                  </View>
                  <View>
                    <Text style={styles.recaudoLabel}>Comisiones Cobradas</Text>
                    <Text style={[styles.recaudoValue, { color: '#6172FD' }]}>
                      {formatCurrency(data.recaudos.comisiones_cobradas)}
                    </Text>
                  </View>
                </View>
                <View style={styles.recaudoItem}>
                  <View style={[styles.recaudoIconBg, { backgroundColor: '#FEF2F2' }]}>
                    <Ionicons name="alert-circle" size={18} color="#EF4444" />
                  </View>
                  <View>
                    <Text style={styles.recaudoLabel}>Comisiones Pend.</Text>
                    <Text style={[styles.recaudoValue, { color: '#EF4444' }]}>
                      {formatCurrency(data.recaudos.comisiones_pendientes)}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </>
        )}

        {/* Ventas + Clientes Row */}
        <Text style={styles.sectionTitle}>Ventas y Clientes</Text>
        <View style={styles.dualCardRow}>
          <View style={styles.ventasCard}>
            <View style={styles.ventasHeader}>
              <Ionicons name="trending-up" size={18} color="#6172FD" />
              <Text style={styles.ventasHeaderText}>Este Mes</Text>
            </View>
            <Text style={styles.ventasBigNumber}>{data?.ventas.del_mes || 0}</Text>
            <View style={styles.ventasCompare}>
              <Text style={styles.ventasCompareLabel}>Anterior: {data?.ventas.mes_anterior || 0}</Text>
              <View style={[styles.ventasBadge, { backgroundColor: crecimiento >= 0 ? '#F0FDF4' : '#FEF2F2' }]}>
                <Ionicons 
                  name={crecimiento >= 0 ? 'arrow-up' : 'arrow-down'} 
                  size={12} 
                  color={crecimiento >= 0 ? '#22C55E' : '#EF4444'} 
                />
                <Text style={[styles.ventasBadgeText, { color: crecimiento >= 0 ? '#22C55E' : '#EF4444' }]}>
                  {Math.abs(crecimiento)}%
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.clientesCard}>
            <View style={styles.ventasHeader}>
              <Ionicons name="people" size={18} color="#3B82F6" />
              <Text style={[styles.ventasHeaderText, { color: '#3B82F6' }]}>Clientes</Text>
            </View>
            <Text style={styles.ventasBigNumber}>{data?.clientes.total || 0}</Text>
            <View style={styles.clientesActiveRow}>
              <View style={[styles.clientesActiveDot, { backgroundColor: '#22C55E' }]} />
              <Text style={styles.ventasCompareLabel}>{data?.clientes.activos || 0} activos</Text>
            </View>
            <View style={[styles.clientesActiveRow, { marginTop: 2 }]}>
              <View style={[styles.clientesActiveDot, { backgroundColor: '#F59E0B' }]} />
              <Text style={styles.ventasCompareLabel}>{data?.clientes.prospectos || 0} prospectos</Text>
            </View>
          </View>
        </View>

        {/* Siniestros + Tareas */}
        <Text style={styles.sectionTitle}>Siniestros</Text>
        <View style={styles.siniestrosCard}>
          <View style={styles.siniestroItem}>
            <View style={[styles.siniestroIconBg, { backgroundColor: '#EEF2FF' }]}>
              <Ionicons name="shield" size={20} color="#6172FD" />
            </View>
            <View style={styles.siniestroInfo}>
              <Text style={styles.siniestroNumber}>{data?.siniestros.total || 0}</Text>
              <Text style={styles.siniestroLabel}>Total</Text>
            </View>
          </View>
          <View style={styles.siniestrosDivider} />
          <View style={styles.siniestroItem}>
            <View style={[styles.siniestroIconBg, { backgroundColor: '#FFF7ED' }]}>
              <Ionicons name="warning" size={20} color="#F59E0B" />
            </View>
            <View style={styles.siniestroInfo}>
              <Text style={styles.siniestroNumber}>{data?.siniestros.pendientes || 0}</Text>
              <Text style={styles.siniestroLabel}>Pendientes</Text>
            </View>
          </View>
          <View style={styles.siniestrosDivider} />
          <View style={styles.siniestroItem}>
            <View style={[styles.siniestroIconBg, { backgroundColor: '#F0FDF4' }]}>
              <Ionicons name="checkmark-done" size={20} color="#22C55E" />
            </View>
            <View style={styles.siniestroInfo}>
              <Text style={styles.siniestroNumber}>{data?.siniestros.aprobados || 0}</Text>
              <Text style={styles.siniestroLabel}>Aprobados</Text>
            </View>
          </View>
        </View>

        {/* Tareas Comerciales */}
        {data?.tareas_comerciales && (
          <View style={styles.tareasCard}>
            <View style={[styles.tareasIconBg]}>
              <Ionicons name="clipboard" size={20} color="#8B5CF6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tareasLabel}>Tareas Comerciales Activas</Text>
              <Text style={styles.tareasNumber}>{data.tareas_comerciales.activas}</Text>
            </View>
          </View>
        )}

        {/* Pólizas por Tipo */}
        {Object.keys(polizasTipo).length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Distribución por Tipo</Text>
            <View style={styles.tipoCard}>
              {Object.entries(polizasTipo).map(([tipo, count]) => (
                <View key={tipo} style={styles.tipoRow}>
                  <View style={styles.tipoLeft}>
                    <View style={[styles.tipoIconBg, { backgroundColor: getPolizaTipoColor(tipo) + '20' }]}>
                      <Ionicons name={getPolizaTipoIcon(tipo) as any} size={16} color={getPolizaTipoColor(tipo)} />
                    </View>
                    <Text style={styles.tipoName}>{tipo || 'Sin tipo'}</Text>
                  </View>
                  <View style={styles.tipoRight}>
                    <View style={styles.tipoBarBg}>
                      <View style={[styles.tipoBarFill, { 
                        width: `${Math.min(100, (count / (data?.resumen_polizas.total || 1)) * 100)}%`,
                        backgroundColor: getPolizaTipoColor(tipo),
                      }]} />
                    </View>
                    <Text style={styles.tipoCount}>{count}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Charts */}
        <View style={styles.chartPeriodRow}>
          <Text style={styles.sectionTitle}>Tendencias</Text>
          <View style={styles.periodSelector}>
            {(['week', 'month', 'year'] as const).map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.periodBtn, chartPeriod === p && styles.periodBtnActive]}
                onPress={() => setChartPeriod(p)}
              >
                <Text style={[styles.periodBtnText, chartPeriod === p && styles.periodBtnTextActive]}>
                  {p === 'week' ? 'Sem' : p === 'month' ? 'Mes' : 'Año'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {renderMiniChart(primasChart, '#6172FD', 'Primas')}
        {renderMiniChart(polizasChart, '#22C55E', 'Pólizas Nuevas')}
        {renderMiniChart(clientesChart, '#3B82F6', 'Clientes Nuevos')}

        {/* Pólizas Recientes */}
        {polizasRecientes.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Pólizas Recientes</Text>
            {polizasRecientes.map((poliza) => (
              <View key={poliza.id} style={styles.recentCard}>
                <View style={styles.recentLeft}>
                  <View style={[styles.recentStatusDot, { backgroundColor: getStatusColor(poliza.status) }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recentClient} numberOfLines={1}>{poliza.client_name || 'Sin cliente'}</Text>
                    <Text style={styles.recentPolicy} numberOfLines={1}>
                      {poliza.policy_number || 'S/N'} · {poliza.insurance_company || ''}
                    </Text>
                  </View>
                </View>
                <View style={styles.recentRight}>
                  <Text style={styles.recentAmount}>{formatCurrency(poliza.premium_amount || 0)}</Text>
                  <Text style={[styles.recentStatus, { color: getStatusColor(poliza.status) }]}>
                    {getStatusLabel(poliza.status)}
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F6FA',
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
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Montserrat_600SemiBold',
  },
  header: {
    height: 110,
    backgroundColor: '#6172FD',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
    shadowColor: '#6172FD',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Montserrat_700Bold',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 11,
    fontFamily: 'Montserrat_400Regular',
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 120,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: 'Montserrat_700Bold',
    color: '#1F2937',
    marginBottom: 12,
    marginTop: 20,
  },
  // Pólizas Grid
  polizasGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  polizaCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  polizaIconBg: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  polizaNumber: {
    fontSize: 24,
    fontFamily: 'Montserrat_700Bold',
    color: '#1F2937',
  },
  polizaLabel: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#9CA3AF',
    marginTop: 2,
  },
  // Finance Card
  financeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  financeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  financeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  financeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  financeLabel: {
    fontSize: 14,
    fontFamily: 'Montserrat_500Medium',
    color: '#6B7280',
  },
  financeValue: {
    fontSize: 15,
    fontFamily: 'Montserrat_700Bold',
    color: '#1F2937',
  },
  financeDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },
  // Recaudos
  recaudosCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  recaudoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  recaudoItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recaudoIconBg: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recaudoLabel: {
    fontSize: 10,
    fontFamily: 'Montserrat_500Medium',
    color: '#9CA3AF',
  },
  recaudoValue: {
    fontSize: 13,
    fontFamily: 'Montserrat_700Bold',
    marginTop: 1,
  },
  recaudoDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 10,
  },
  // Ventas + Clientes
  dualCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ventasCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  clientesCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  ventasHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  ventasHeaderText: {
    fontSize: 12,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#6172FD',
  },
  ventasBigNumber: {
    fontSize: 28,
    fontFamily: 'Montserrat_700Bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  ventasCompare: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ventasCompareLabel: {
    fontSize: 11,
    fontFamily: 'Montserrat_400Regular',
    color: '#9CA3AF',
  },
  ventasBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 2,
  },
  ventasBadgeText: {
    fontSize: 11,
    fontFamily: 'Montserrat_700Bold',
  },
  clientesActiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  clientesActiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  // Siniestros
  siniestrosCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  siniestroItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  siniestroIconBg: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  siniestroInfo: {
    alignItems: 'center',
  },
  siniestroNumber: {
    fontSize: 18,
    fontFamily: 'Montserrat_700Bold',
    color: '#1F2937',
  },
  siniestroLabel: {
    fontSize: 10,
    fontFamily: 'Montserrat_500Medium',
    color: '#9CA3AF',
    marginTop: 1,
  },
  siniestrosDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 4,
  },
  // Tareas
  tareasCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  tareasIconBg: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F5F3FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tareasLabel: {
    fontSize: 13,
    fontFamily: 'Montserrat_500Medium',
    color: '#6B7280',
  },
  tareasNumber: {
    fontSize: 22,
    fontFamily: 'Montserrat_700Bold',
    color: '#8B5CF6',
  },
  // Pólizas por Tipo
  tipoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  tipoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  tipoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  tipoIconBg: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tipoName: {
    fontSize: 13,
    fontFamily: 'Montserrat_500Medium',
    color: '#374151',
    textTransform: 'capitalize',
  },
  tipoRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  tipoBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  tipoBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  tipoCount: {
    fontSize: 13,
    fontFamily: 'Montserrat_700Bold',
    color: '#1F2937',
    width: 30,
    textAlign: 'right',
  },
  // Charts
  chartPeriodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 12,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 2,
  },
  periodBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  periodBtnActive: {
    backgroundColor: '#6172FD',
  },
  periodBtnText: {
    fontSize: 12,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#9CA3AF',
  },
  periodBtnTextActive: {
    color: '#FFFFFF',
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  chartTitle: {
    fontSize: 13,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#6B7280',
    marginBottom: 12,
  },
  chartBarsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 100,
  },
  chartBarWrapper: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
  },
  chartBar: {
    borderRadius: 3,
    minHeight: 4,
  },
  chartBarLabel: {
    fontSize: 8,
    fontFamily: 'Montserrat_400Regular',
    color: '#9CA3AF',
    marginTop: 4,
  },
  // Pólizas Recientes
  recentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  recentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  recentStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  recentClient: {
    fontSize: 13,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#1F2937',
  },
  recentPolicy: {
    fontSize: 11,
    fontFamily: 'Montserrat_400Regular',
    color: '#9CA3AF',
    marginTop: 1,
  },
  recentRight: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  recentAmount: {
    fontSize: 13,
    fontFamily: 'Montserrat_700Bold',
    color: '#1F2937',
  },
  recentStatus: {
    fontSize: 10,
    fontFamily: 'Montserrat_600SemiBold',
    marginTop: 2,
  },
});

export default DashboardScreen;
