import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  RefreshControl,
  Linking,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { getClienteById, updateCliente, UpdateClienteData } from '../services/clientesService';
import LoadingSpinner from '../components/LoadingSpinner';

type ClienteDetailRouteParams = {
  ClienteDetail: {
    clienteId: number;
  };
};

interface ClienteDetail {
  id: number;
  nombre: string;
  apellidos: string;
  cuit: string;
  tipo_documento: string;
  email_principal: string;
  celular_principal: string;
  telefono: string;
  ciudad: string;
  estado: string;
  client_type: string;
  empresa: string;
  domicilio_principal: string;
  fecha_nacimiento: string;
  observaciones: string;
}

const ClienteDetailScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<ClienteDetailRouteParams, 'ClienteDetail'>>();
  const { clienteId } = route.params;
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cliente, setCliente] = useState<ClienteDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editData, setEditData] = useState<UpdateClienteData>({});

  const fetchCliente = async () => {
    try {
      setError(null);
      const response = await getClienteById(clienteId);
      if (response.success) {
        setCliente(response.data);
      } else {
        setError(response.message || 'Error al cargar cliente');
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCliente();
  }, [clienteId]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCliente();
  };

  const getClienteName = () => {
    if (!cliente) return 'Cliente';
    if (cliente.client_type === 'empresa' && cliente.empresa) {
      return cliente.empresa;
    }
    return `${cliente.nombre || ''} ${cliente.apellidos || ''}`.trim() || 'Sin nombre';
  };

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const handleEmail = (email: string) => {
    Linking.openURL(`mailto:${email}`);
  };

  const handleWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    Linking.openURL(`https://wa.me/${cleanPhone}`);
  };

  const startEditing = () => {
    if (cliente) {
      setEditData({
        nombre: cliente.nombre || '',
        apellidos: cliente.apellidos || '',
        email_principal: cliente.email_principal || '',
        celular_principal: cliente.celular_principal || '',
        telefono: cliente.telefono || '',
        domicilio_principal: cliente.domicilio_principal || '',
        ciudad: cliente.ciudad || '',
        fecha_nacimiento: cliente.fecha_nacimiento || '',
        observaciones: cliente.observaciones || '',
        empresa: cliente.empresa || '',
      });
      setIsEditing(true);
    }
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditData({});
  };

  const saveChanges = async () => {
    if (!cliente) return;
    
    setSaving(true);
    try {
      const response = await updateCliente(cliente.id, editData);
      if (response.success) {
        setCliente(response.data);
        setIsEditing(false);
        Alert.alert('Éxito', 'Cliente actualizado correctamente');
      } else {
        Alert.alert('Error', response.message || 'Error al actualizar cliente');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof UpdateClienteData, value: string) => {
    setEditData(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Detalle Cliente</Text>
          <View style={styles.headerPlaceholder} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchCliente}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={isEditing ? cancelEditing : () => navigation.goBack()}
        >
          <Ionicons name={isEditing ? "close" : "arrow-back"} size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditing ? 'Editar Cliente' : 'Detalle Cliente'}</Text>
        {isEditing ? (
          <TouchableOpacity style={styles.saveButton} onPress={saveChanges} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="checkmark" size={24} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.editButton} onPress={startEditing}>
            <Ionicons name="create-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          !isEditing ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6172FD']} /> : undefined
        }
      >
        {isEditing ? (
          <>
            {/* Formulario de Edición */}
            <Text style={styles.sectionTitle}>Información Personal</Text>
            <View style={styles.editFormCard}>
              {cliente?.client_type !== 'empresa' && (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Nombre</Text>
                    <TextInput
                      style={styles.textInput}
                      value={editData.nombre}
                      onChangeText={(text) => updateField('nombre', text)}
                      placeholder="Nombre"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Apellidos</Text>
                    <TextInput
                      style={styles.textInput}
                      value={editData.apellidos}
                      onChangeText={(text) => updateField('apellidos', text)}
                      placeholder="Apellidos"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                </>
              )}
              {cliente?.client_type === 'empresa' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Empresa</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editData.empresa}
                    onChangeText={(text) => updateField('empresa', text)}
                    placeholder="Nombre de la empresa"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
              )}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Fecha de Nacimiento</Text>
                <TextInput
                  style={styles.textInput}
                  value={editData.fecha_nacimiento}
                  onChangeText={(text) => updateField('fecha_nacimiento', text)}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>

            <Text style={styles.sectionTitle}>Información de Contacto</Text>
            <View style={styles.editFormCard}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={styles.textInput}
                  value={editData.email_principal}
                  onChangeText={(text) => updateField('email_principal', text)}
                  placeholder="correo@ejemplo.com"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Celular</Text>
                <TextInput
                  style={styles.textInput}
                  value={editData.celular_principal}
                  onChangeText={(text) => updateField('celular_principal', text)}
                  placeholder="3001234567"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="phone-pad"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Teléfono</Text>
                <TextInput
                  style={styles.textInput}
                  value={editData.telefono}
                  onChangeText={(text) => updateField('telefono', text)}
                  placeholder="6011234567"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            <Text style={styles.sectionTitle}>Dirección</Text>
            <View style={styles.editFormCard}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Dirección</Text>
                <TextInput
                  style={styles.textInput}
                  value={editData.domicilio_principal}
                  onChangeText={(text) => updateField('domicilio_principal', text)}
                  placeholder="Calle 123 #45-67"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Ciudad</Text>
                <TextInput
                  style={styles.textInput}
                  value={editData.ciudad}
                  onChangeText={(text) => updateField('ciudad', text)}
                  placeholder="Bogotá"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>

            <Text style={styles.sectionTitle}>Observaciones</Text>
            <View style={styles.editFormCard}>
              <View style={[styles.inputGroup, { marginBottom: 0 }]}>
                <TextInput
                  style={styles.textInputMultiline}
                  value={editData.observaciones}
                  onChangeText={(text) => updateField('observaciones', text)}
                  placeholder="Notas adicionales sobre el cliente..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={4}
                />
              </View>
            </View>
          </>
        ) : (
          <>
        {/* Header Card */}
        <View style={styles.profileCard}>
          <View style={[styles.avatarLarge, { 
            backgroundColor: cliente?.client_type === 'empresa' ? '#8B5CF620' : '#6172FD20' 
          }]}>
            <Ionicons 
              name={cliente?.client_type === 'empresa' ? 'business' : 'person'} 
              size={50} 
              color={cliente?.client_type === 'empresa' ? '#8B5CF6' : '#6172FD'} 
            />
          </View>
          <Text style={styles.clienteName}>{getClienteName()}</Text>
          <View style={[styles.typeBadge, { 
            backgroundColor: cliente?.client_type === 'empresa' ? '#8B5CF620' : '#10B98120' 
          }]}>
            <Text style={[styles.typeText, { 
              color: cliente?.client_type === 'empresa' ? '#8B5CF6' : '#10B981' 
            }]}>
              {cliente?.client_type === 'empresa' ? 'Empresa' : 'Persona Natural'}
            </Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsRow}>
          {cliente?.celular_principal && (
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={() => handleCall(cliente.celular_principal)}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#10B98120' }]}>
                <Ionicons name="call" size={20} color="#10B981" />
              </View>
              <Text style={styles.actionLabel}>Llamar</Text>
            </TouchableOpacity>
          )}
          {cliente?.celular_principal && (
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={() => handleWhatsApp(cliente.celular_principal)}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#25D36620' }]}>
                <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
              </View>
              <Text style={styles.actionLabel}>WhatsApp</Text>
            </TouchableOpacity>
          )}
          {cliente?.email_principal && (
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={() => handleEmail(cliente.email_principal)}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#3B82F620' }]}>
                <Ionicons name="mail" size={20} color="#3B82F6" />
              </View>
              <Text style={styles.actionLabel}>Email</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Información de Contacto */}
        <Text style={styles.sectionTitle}>Información de Contacto</Text>
        <View style={styles.infoCard}>
          {cliente?.email_principal && (
            <View style={styles.infoRow}>
              <View style={styles.infoIconContainer}>
                <Ionicons name="mail-outline" size={20} color="#6172FD" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{cliente.email_principal}</Text>
              </View>
            </View>
          )}
          {cliente?.celular_principal && (
            <View style={styles.infoRow}>
              <View style={styles.infoIconContainer}>
                <Ionicons name="phone-portrait-outline" size={20} color="#6172FD" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Celular</Text>
                <Text style={styles.infoValue}>{cliente.celular_principal}</Text>
              </View>
            </View>
          )}
          {cliente?.telefono && (
            <View style={styles.infoRow}>
              <View style={styles.infoIconContainer}>
                <Ionicons name="call-outline" size={20} color="#6172FD" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Teléfono</Text>
                <Text style={styles.infoValue}>{cliente.telefono}</Text>
              </View>
            </View>
          )}
          {cliente?.domicilio_principal && (
            <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
              <View style={styles.infoIconContainer}>
                <Ionicons name="location-outline" size={20} color="#6172FD" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Dirección</Text>
                <Text style={styles.infoValue}>{cliente.domicilio_principal}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Información Personal */}
        <Text style={styles.sectionTitle}>Información Personal</Text>
        <View style={styles.infoCard}>
          {cliente?.cuit && (
            <View style={styles.infoRow}>
              <View style={styles.infoIconContainer}>
                <Ionicons name="card-outline" size={20} color="#6172FD" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>{cliente.tipo_documento || 'Documento'}</Text>
                <Text style={styles.infoValue}>{cliente.cuit}</Text>
              </View>
            </View>
          )}
          {cliente?.ciudad && (
            <View style={styles.infoRow}>
              <View style={styles.infoIconContainer}>
                <Ionicons name="business-outline" size={20} color="#6172FD" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Ciudad</Text>
                <Text style={styles.infoValue}>{cliente.ciudad}</Text>
              </View>
            </View>
          )}
          {cliente?.fecha_nacimiento && (
            <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
              <View style={styles.infoIconContainer}>
                <Ionicons name="calendar-outline" size={20} color="#6172FD" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Fecha de Nacimiento</Text>
                <Text style={styles.infoValue}>{cliente.fecha_nacimiento}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Observaciones */}
        {cliente?.observaciones && (
          <>
            <Text style={styles.sectionTitle}>Observaciones</Text>
            <View style={styles.infoCard}>
              <Text style={styles.observacionesText}>{cliente.observaciones}</Text>
            </View>
          </>
        )}
          </>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
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
    fontSize: 18,
    fontFamily: 'Montserrat_700Bold',
    color: '#FFFFFF',
    textAlign: 'center',
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  profileCard: {
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
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  clienteName: {
    fontSize: 22,
    fontFamily: 'Montserrat_700Bold',
    color: '#374151',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  typeBadge: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  typeText: {
    fontSize: 12,
    fontFamily: 'Montserrat_600SemiBold',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginTop: 16,
  },
  actionButton: {
    alignItems: 'center',
    marginHorizontal: 16,
  },
  actionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#6B7280',
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#374151',
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 12,
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
    backgroundColor: '#6172FD10',
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
  observacionesText: {
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
    color: '#374151',
    lineHeight: 22,
  },
  editButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editFormCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#6B7280',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Montserrat_500Medium',
    color: '#374151',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  textInputMultiline: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Montserrat_500Medium',
    color: '#374151',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 100,
    textAlignVertical: 'top',
  },
});

export default ClienteDetailScreen;
