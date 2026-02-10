import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  Linking,
  ImageBackground,
  Alert,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getEmpleado, updateEmpleado, deleteEmpleado, Empleado } from '../services/empleadosService';
import LoadingSpinner from '../components/LoadingSpinner';

const EmpleadoDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { empleadoId } = route.params;
  
  const [loading, setLoading] = useState(true);
  const [empleado, setEmpleado] = useState<Empleado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editData, setEditData] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchEmpleado();
  }, [empleadoId]);

  const fetchEmpleado = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getEmpleado(empleadoId);
      if (response.success) {
        setEmpleado(response.data);
      }
    } catch (err: any) {
      setError(err.message || 'Error al cargar el empleado');
    } finally {
      setLoading(false);
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

  const getTipoVinculacionLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      'tiempo_completo': 'Tiempo Completo',
      'medio_tiempo': 'Medio Tiempo',
      'freelance': 'Freelance',
      'contrato': 'Contrato',
      'practicante': 'Practicante',
    };
    return labels[tipo] || tipo;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CO', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const handleCall = (phone?: string) => {
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    }
  };

  const handleEmail = (email?: string) => {
    if (email) {
      Linking.openURL(`mailto:${email}`);
    }
  };

  const handleWhatsApp = (phone?: string) => {
    if (phone) {
      const cleanPhone = phone.replace(/\D/g, '');
      Linking.openURL(`https://wa.me/57${cleanPhone}`);
    }
  };

  const startEditing = () => {
    if (empleado) {
      setEditData({
        nombres: empleado.nombres || '',
        apellidos: empleado.apellidos || '',
        email: empleado.email || '',
        telefono: empleado.telefono || '',
        celular: empleado.celular || '',
        cargo: empleado.cargo || '',
        departamento: empleado.departamento || '',
        direccion: empleado.direccion || '',
        ciudad: empleado.ciudad || '',
        observaciones: empleado.observaciones || '',
      });
      setIsEditing(true);
    }
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditData({});
  };

  const saveChanges = async () => {
    if (!empleado) return;
    setSaving(true);
    try {
      const response = await updateEmpleado(empleado.id, editData);
      if (response.success) {
        setEmpleado(response.data);
        setIsEditing(false);
        Alert.alert('Éxito', 'Empleado actualizado correctamente');
      } else {
        Alert.alert('Error', response.message || 'Error al actualizar');
      }
    } catch (err: any) {
      const errors = err.response?.data?.errors;
      if (errors) {
        const errorList = Object.values(errors).flat().join('\n');
        Alert.alert('Error de validación', errorList);
      } else {
        Alert.alert('Error', err?.response?.data?.message || err.message || 'Error de conexión');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!empleado) return;
    Alert.alert(
      'Eliminar Empleado',
      `¿Estás seguro de eliminar a ${empleado.nombres} ${empleado.apellidos}? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive', onPress: async () => {
            try {
              const response = await deleteEmpleado(empleado.id);
              if (response.success) {
                Alert.alert('Éxito', 'Empleado eliminado correctamente', [
                  { text: 'OK', onPress: () => navigation.goBack() }
                ]);
              } else {
                Alert.alert('Error', response.message || 'No se pudo eliminar');
              }
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.message || err.message || 'Error de conexión');
            }
          }
        },
      ]
    );
  };

  const updateField = (field: string, value: string) => {
    setEditData(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error || !empleado) {
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
          <Text style={styles.headerTitle}>Detalle</Text>
          <View style={styles.headerPlaceholder} />
        </ImageBackground>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={styles.errorText}>{error || 'Empleado no encontrado'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchEmpleado}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ImageBackground
        source={require('../../assets/backgrounds/hero-gradient.png')}
        style={styles.header}
        imageStyle={{ transform: [{ scale: 2 }] }}
        resizeMode="cover"
      >
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={isEditing ? cancelEditing : () => navigation.goBack()}
        >
          <Ionicons name={isEditing ? "close" : "chevron-back"} size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditing ? 'Editar Empleado' : 'Detalle'}</Text>
        {isEditing ? (
          <TouchableOpacity style={styles.headerPlaceholder} onPress={saveChanges} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="checkmark" size={24} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.headerPlaceholder} onPress={startEditing}>
            <Ionicons name="create-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </ImageBackground>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarLargeText}>
              {empleado.nombres.charAt(0)}{empleado.apellidos.charAt(0)}
            </Text>
          </View>
          <Text style={styles.profileName}>{empleado.nombres} {empleado.apellidos}</Text>
          <Text style={styles.profileCargo}>{empleado.cargo || 'Sin cargo asignado'}</Text>
          
          <View style={styles.badgesRow}>
            <View style={[styles.estadoBadgeLarge, { backgroundColor: getEstadoColor(empleado.estado) + '20' }]}>
              <View style={[styles.estadoDot, { backgroundColor: getEstadoColor(empleado.estado) }]} />
              <Text style={[styles.estadoTextLarge, { color: getEstadoColor(empleado.estado) }]}>
                {getEstadoLabel(empleado.estado)}
              </Text>
            </View>
            {empleado.acceso_activo && (
              <View style={styles.accesoBadge}>
                <Ionicons name="key" size={14} color="#10B981" />
                <Text style={styles.accesoText}>Acceso activo</Text>
              </View>
            )}
          </View>

          {empleado.rol && (
            <View style={styles.rolContainer}>
              <Ionicons name="shield-checkmark" size={18} color="#573CFF" />
              <Text style={styles.rolName}>{empleado.rol.nombre}</Text>
            </View>
          )}

          {/* Quick Actions */}
          <View style={styles.quickActions}>
            {empleado.celular && (
              <TouchableOpacity style={styles.actionButton} onPress={() => handleCall(empleado.celular)}>
                <Ionicons name="call" size={20} color="#573CFF" />
              </TouchableOpacity>
            )}
            {empleado.celular && (
              <TouchableOpacity style={styles.actionButton} onPress={() => handleWhatsApp(empleado.celular)}>
                <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
              </TouchableOpacity>
            )}
            {empleado.email && (
              <TouchableOpacity style={styles.actionButton} onPress={() => handleEmail(empleado.email)}>
                <Ionicons name="mail" size={20} color="#573CFF" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Info Sections */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información Personal</Text>
          
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="card-outline" size={18} color="#573CFF" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Documento</Text>
              <Text style={styles.infoValue}>{empleado.tipo_documento} {empleado.numero_documento}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="mail-outline" size={18} color="#573CFF" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{empleado.email}</Text>
            </View>
          </View>

          {empleado.celular && (
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="phone-portrait-outline" size={18} color="#573CFF" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Celular</Text>
                <Text style={styles.infoValue}>{empleado.celular}</Text>
              </View>
            </View>
          )}

          {empleado.telefono && (
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="call-outline" size={18} color="#573CFF" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Teléfono</Text>
                <Text style={styles.infoValue}>{empleado.telefono}</Text>
              </View>
            </View>
          )}

          {empleado.fecha_nacimiento && (
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="calendar-outline" size={18} color="#573CFF" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Fecha de Nacimiento</Text>
                <Text style={styles.infoValue}>{formatDate(empleado.fecha_nacimiento)}</Text>
              </View>
            </View>
          )}

          {empleado.direccion && (
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="location-outline" size={18} color="#573CFF" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Dirección</Text>
                <Text style={styles.infoValue}>{empleado.direccion}{empleado.ciudad ? `, ${empleado.ciudad}` : ''}</Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información Laboral</Text>
          
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="person-outline" size={18} color="#573CFF" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Usuario</Text>
              <Text style={styles.infoValue}>{empleado.usuario}</Text>
            </View>
          </View>

          {empleado.departamento && (
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="business-outline" size={18} color="#573CFF" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Departamento</Text>
                <Text style={styles.infoValue}>{empleado.departamento}</Text>
              </View>
            </View>
          )}

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="briefcase-outline" size={18} color="#573CFF" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Tipo de Vinculación</Text>
              <Text style={styles.infoValue}>{getTipoVinculacionLabel(empleado.tipo_vinculacion)}</Text>
            </View>
          </View>

          {empleado.fecha_ingreso && (
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="calendar-outline" size={18} color="#573CFF" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Fecha de Ingreso</Text>
                <Text style={styles.infoValue}>{formatDate(empleado.fecha_ingreso)}</Text>
              </View>
            </View>
          )}
        </View>

        {empleado.observaciones && !isEditing && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Observaciones</Text>
            <Text style={styles.observaciones}>{empleado.observaciones}</Text>
          </View>
        )}

        {/* Edit Form */}
        {isEditing && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Editar Información</Text>
            
            <Text style={styles.editLabel}>Nombres</Text>
            <TextInput style={styles.editInput} value={editData.nombres} onChangeText={(v) => updateField('nombres', v)} placeholder="Nombres" placeholderTextColor="#9CA3AF" />

            <Text style={styles.editLabel}>Apellidos</Text>
            <TextInput style={styles.editInput} value={editData.apellidos} onChangeText={(v) => updateField('apellidos', v)} placeholder="Apellidos" placeholderTextColor="#9CA3AF" />

            <Text style={styles.editLabel}>Email</Text>
            <TextInput style={styles.editInput} value={editData.email} onChangeText={(v) => updateField('email', v)} placeholder="Email" placeholderTextColor="#9CA3AF" keyboardType="email-address" autoCapitalize="none" />

            <Text style={styles.editLabel}>Celular</Text>
            <TextInput style={styles.editInput} value={editData.celular} onChangeText={(v) => updateField('celular', v)} placeholder="Celular" placeholderTextColor="#9CA3AF" keyboardType="phone-pad" />

            <Text style={styles.editLabel}>Teléfono</Text>
            <TextInput style={styles.editInput} value={editData.telefono} onChangeText={(v) => updateField('telefono', v)} placeholder="Teléfono" placeholderTextColor="#9CA3AF" keyboardType="phone-pad" />

            <Text style={styles.editLabel}>Cargo</Text>
            <TextInput style={styles.editInput} value={editData.cargo} onChangeText={(v) => updateField('cargo', v)} placeholder="Cargo" placeholderTextColor="#9CA3AF" />

            <Text style={styles.editLabel}>Departamento</Text>
            <TextInput style={styles.editInput} value={editData.departamento} onChangeText={(v) => updateField('departamento', v)} placeholder="Departamento" placeholderTextColor="#9CA3AF" />

            <Text style={styles.editLabel}>Dirección</Text>
            <TextInput style={styles.editInput} value={editData.direccion} onChangeText={(v) => updateField('direccion', v)} placeholder="Dirección" placeholderTextColor="#9CA3AF" />

            <Text style={styles.editLabel}>Ciudad</Text>
            <TextInput style={styles.editInput} value={editData.ciudad} onChangeText={(v) => updateField('ciudad', v)} placeholder="Ciudad" placeholderTextColor="#9CA3AF" />

            <Text style={styles.editLabel}>Observaciones</Text>
            <TextInput style={[styles.editInput, { minHeight: 80, textAlignVertical: 'top' }]} value={editData.observaciones} onChangeText={(v) => updateField('observaciones', v)} placeholder="Observaciones" placeholderTextColor="#9CA3AF" multiline />
          </View>
        )}

        {/* Delete button */}
        {!isEditing && (
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={18} color="#EF4444" />
            <Text style={styles.deleteButtonText}>Eliminar empleado</Text>
          </TouchableOpacity>
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
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 120,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 16,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#573CFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarLargeText: {
    fontSize: 28,
    fontFamily: 'Montserrat_700Bold',
    color: '#FFFFFF',
  },
  profileName: {
    fontSize: 20,
    fontFamily: 'Montserrat_700Bold',
    color: '#1F2937',
    textAlign: 'center',
  },
  profileCargo: {
    fontSize: 14,
    fontFamily: 'Montserrat_500Medium',
    color: '#6B7280',
    marginTop: 4,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 10,
  },
  estadoBadgeLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  estadoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  estadoTextLarge: {
    fontSize: 13,
    fontFamily: 'Montserrat_600SemiBold',
  },
  accesoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  accesoText: {
    fontSize: 12,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#10B981',
  },
  rolContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  rolName: {
    fontSize: 14,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#573CFF',
  },
  quickActions: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 16,
  },
  actionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#374151',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#9CA3AF',
  },
  infoValue: {
    fontSize: 15,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#1F2937',
    marginTop: 2,
  },
  observaciones: {
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
    color: '#4B5563',
    lineHeight: 22,
  },
  editLabel: {
    fontSize: 12,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#374151',
    marginBottom: 6,
    marginTop: 14,
  },
  editInput: {
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
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginTop: 4,
    marginBottom: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  deleteButtonText: {
    fontSize: 14,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#EF4444',
  },
});

export default EmpleadoDetailScreen;
