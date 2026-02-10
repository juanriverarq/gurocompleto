import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  RefreshControl,
  ImageBackground,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { getProfile, ProfileData } from '../services/profileService';
import LoadingSpinner from '../components/LoadingSpinner';

const ProfileDetailScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user, broker } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async () => {
    try {
      setError(null);
      const response = await getProfile();
      if (response.success) {
        setProfileData(response.data);
      } else {
        setError(response.message || 'Error al cargar perfil');
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchProfile();
  };

  const getPlanLabel = (plan: string) => {
    const plans: Record<string, string> = {
      'basic': 'Básico',
      'starter': 'Starter',
      'professional': 'Profesional',
      'enterprise': 'Empresarial',
      'trial': 'Prueba',
    };
    return plans[plan?.toLowerCase()] || plan || 'Sin plan';
  };

  const getPlanColor = (plan: string) => {
    const colors: Record<string, string> = {
      'basic': '#6B7280',
      'starter': '#3B82F6',
      'professional': '#8B5CF6',
      'enterprise': '#F59E0B',
      'trial': '#10B981',
    };
    return colors[plan?.toLowerCase()] || '#573CFF';
  };

  const getStatusLabel = (status: string) => {
    const statuses: Record<string, string> = {
      'active': 'Activo',
      'inactive': 'Inactivo',
      'suspended': 'Suspendido',
      'trial': 'Prueba',
    };
    return statuses[status?.toLowerCase()] || status || 'N/A';
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'active': '#10B981',
      'inactive': '#6B7280',
      'suspended': '#EF4444',
      'trial': '#F59E0B',
    };
    return colors[status?.toLowerCase()] || '#6B7280';
  };

  const getDaysRemaining = (trialEndsAt: string | null) => {
    if (!trialEndsAt) return null;
    const endDate = new Date(trialEndsAt);
    const today = new Date();
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  const userData = profileData?.user;
  const brokerData = profileData?.broker;
  const daysRemaining = getDaysRemaining(brokerData?.trial_ends_at || null);

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
        <Text style={styles.headerTitle}>Mi Perfil</Text>
        <View style={styles.headerPlaceholder} />
      </ImageBackground>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#573CFF']} />
        }
      >
        {error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchProfile}>
              <Text style={styles.retryButtonText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Avatar y Nombre */}
            <View style={styles.profileHeader}>
              <View style={styles.avatarLarge}>
                <Ionicons name="person" size={50} color="#573CFF" />
              </View>
              <Text style={styles.profileName}>{userData?.nombre || user?.displayName || 'Usuario'}</Text>
              <Text style={styles.profileEmail}>{userData?.email || user?.email || ''}</Text>
              <View style={[styles.userTypeBadge, { backgroundColor: userData?.user_type === 'MASTER' ? '#8B5CF6' : '#3B82F6' }]}>
                <Text style={styles.userTypeText}>
                  {userData?.user_type === 'MASTER' ? 'Administrador' : 'Usuario'}
                </Text>
              </View>
            </View>

            {/* Membresía */}
            {brokerData && (
              <>
                <Text style={styles.sectionTitle}>Membresía</Text>
                <View style={styles.membershipCard}>
                  <View style={styles.membershipHeader}>
                    <View style={[styles.planBadge, { backgroundColor: getPlanColor(brokerData.plan) }]}>
                      <Ionicons name="diamond" size={16} color="#FFFFFF" />
                      <Text style={styles.planText}>{getPlanLabel(brokerData.plan)}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(brokerData.status) + '20' }]}>
                      <View style={[styles.statusDot, { backgroundColor: getStatusColor(brokerData.status) }]} />
                      <Text style={[styles.statusText, { color: getStatusColor(brokerData.status) }]}>
                        {getStatusLabel(brokerData.status)}
                      </Text>
                    </View>
                  </View>

                  {daysRemaining !== null && daysRemaining > 0 && (
                    <View style={styles.trialInfo}>
                      <Ionicons name="time-outline" size={20} color="#F59E0B" />
                      <Text style={styles.trialText}>
                        Te quedan <Text style={styles.trialDays}>{daysRemaining} días</Text> de prueba
                      </Text>
                    </View>
                  )}

                  {daysRemaining !== null && daysRemaining === 0 && (
                    <View style={styles.trialExpired}>
                      <Ionicons name="warning-outline" size={20} color="#EF4444" />
                      <Text style={styles.trialExpiredText}>Tu período de prueba ha terminado</Text>
                    </View>
                  )}
                </View>
              </>
            )}

            {/* Información de la Cuenta */}
            <Text style={styles.sectionTitle}>Información de la Cuenta</Text>
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <View style={styles.infoIconContainer}>
                  <Ionicons name="business-outline" size={20} color="#573CFF" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Empresa</Text>
                  <Text style={styles.infoValue}>{brokerData?.name || 'N/A'}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.infoIconContainer}>
                  <Ionicons name="mail-outline" size={20} color="#573CFF" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Correo Electrónico</Text>
                  <Text style={styles.infoValue}>{userData?.email || user?.email || 'N/A'}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.infoIconContainer}>
                  <Ionicons name="finger-print-outline" size={20} color="#573CFF" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>ID de Usuario</Text>
                  <Text style={styles.infoValue}>#{userData?.id || 'N/A'}</Text>
                </View>
              </View>

              <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                <View style={styles.infoIconContainer}>
                  <Ionicons name="key-outline" size={20} color="#573CFF" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>ID de Broker</Text>
                  <Text style={styles.infoValue}>#{brokerData?.id || userData?.broker_id || 'N/A'}</Text>
                </View>
              </View>
            </View>

            {/* Acciones */}
            <View style={styles.actionsSection}>
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="create-outline" size={20} color="#573CFF" />
                <Text style={styles.actionButtonText}>Editar Perfil</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="lock-closed-outline" size={20} color="#573CFF" />
                <Text style={styles.actionButtonText}>Cambiar Contraseña</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
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
    width: 38,
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
    paddingTop: 60,
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#573CFF15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileName: {
    fontSize: 24,
    fontFamily: 'Montserrat_700Bold',
    color: '#374151',
  },
  profileEmail: {
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
    color: '#6B7280',
    marginTop: 4,
  },
  userTypeBadge: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  userTypeText: {
    fontSize: 12,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#FFFFFF',
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#374151',
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 12,
  },
  membershipCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  membershipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  planText: {
    fontSize: 14,
    fontFamily: 'Montserrat_700Bold',
    color: '#FFFFFF',
    marginLeft: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Montserrat_600SemiBold',
  },
  trialInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    padding: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
  },
  trialText: {
    fontSize: 14,
    fontFamily: 'Montserrat_500Medium',
    color: '#92400E',
    marginLeft: 10,
  },
  trialDays: {
    fontFamily: 'Montserrat_700Bold',
  },
  trialExpired: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    padding: 12,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
  },
  trialExpiredText: {
    fontSize: 14,
    fontFamily: 'Montserrat_500Medium',
    color: '#991B1B',
    marginLeft: 10,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  infoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#573CFF10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoLabel: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#9CA3AF',
  },
  infoValue: {
    fontSize: 15,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#374151',
    marginTop: 2,
  },
  actionsSection: {
    marginHorizontal: 20,
    marginTop: 24,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  actionButtonText: {
    fontSize: 15,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#573CFF',
    marginLeft: 8,
  },
});

export default ProfileDetailScreen;
