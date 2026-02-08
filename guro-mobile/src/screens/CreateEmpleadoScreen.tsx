import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { createEmpleado, CreateEmpleadoData, getRolesBroker } from '../services/empleadosService';

const TIPOS_DOCUMENTO = [
  { key: 'cedula', label: 'Cédula de Ciudadanía' },
  { key: 'cedula_extranjeria', label: 'Cédula de Extranjería' },
  { key: 'pasaporte', label: 'Pasaporte' },
  { key: 'tarjeta_identidad', label: 'Tarjeta de Identidad' },
];

const ESTADOS = [
  { key: 'activo', label: 'Activo' },
  { key: 'inactivo', label: 'Inactivo' },
  { key: 'suspendido', label: 'Suspendido' },
  { key: 'retirado', label: 'Retirado' },
];

const TIPOS_VINCULACION = [
  { key: 'empleado', label: 'Empleado' },
  { key: 'contratista', label: 'Contratista' },
  { key: 'practicante', label: 'Practicante' },
  { key: 'temporal', label: 'Temporal' },
];

interface RolBroker {
  id: number;
  nombre: string;
  descripcion?: string;
}

const STEPS = [
  'Datos Personales',
  'Contacto y Acceso',
  'Datos Laborales',
  'Información Adicional',
];

const CreateEmpleadoScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState<RolBroker[]>([]);

  // Picker modal
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerOptions, setPickerOptions] = useState<{ key: string; label: string }[]>([]);
  const [pickerTitle, setPickerTitle] = useState('');
  const [pickerCallback, setPickerCallback] = useState<((key: string) => void) | null>(null);

  // Step 0 - Datos Personales
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [tipoDocumento, setTipoDocumento] = useState('cedula');
  const [numeroDocumento, setNumeroDocumento] = useState('');

  // Step 1 - Contacto y Acceso
  const [email, setEmail] = useState('');
  const [usuario, setUsuario] = useState('');
  const [telefono, setTelefono] = useState('');
  const [celular, setCelular] = useState('');

  // Step 2 - Datos Laborales
  const [cargo, setCargo] = useState('');
  const [departamento, setDepartamento] = useState('');
  const [tipoVinculacion, setTipoVinculacion] = useState('empleado');
  const [estado, setEstado] = useState('activo');
  const [rolId, setRolId] = useState<number | undefined>(undefined);
  const [fechaIngreso, setFechaIngreso] = useState('');

  // Step 3 - Información Adicional
  const [direccion, setDireccion] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [salario, setSalario] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [accesoActivo, setAccesoActivo] = useState(true);
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      const response = await getRolesBroker();
      if (response.success && response.data) {
        setRoles(response.data);
      }
    } catch (err) {
      // silently fail
    }
  };

  const openPicker = (
    title: string,
    options: { key: string; label: string }[],
    callback: (key: string) => void
  ) => {
    setPickerTitle(title);
    setPickerOptions(options);
    setPickerCallback(() => callback);
    setPickerVisible(true);
  };

  const getLabelForKey = (options: { key: string; label: string }[], key: string) => {
    return options.find(o => o.key === key)?.label || key;
  };

  const validateStep = (): boolean => {
    switch (step) {
      case 0:
        if (!nombres.trim()) { Alert.alert('Error', 'Ingrese los nombres'); return false; }
        if (!apellidos.trim()) { Alert.alert('Error', 'Ingrese los apellidos'); return false; }
        if (!numeroDocumento.trim()) { Alert.alert('Error', 'Ingrese el número de documento'); return false; }
        return true;
      case 1:
        if (!email.trim()) { Alert.alert('Error', 'Ingrese el email'); return false; }
        if (!/\S+@\S+\.\S+/.test(email)) { Alert.alert('Error', 'Ingrese un email válido'); return false; }
        if (!usuario.trim()) { Alert.alert('Error', 'Ingrese el nombre de usuario'); return false; }
        return true;
      case 2:
        return true;
      case 3:
        if (password && password.length < 8) { Alert.alert('Error', 'La contraseña debe tener al menos 8 caracteres'); return false; }
        if (password && password !== passwordConfirmation) { Alert.alert('Error', 'Las contraseñas no coinciden'); return false; }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep()) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    } else {
      navigation.goBack();
    }
  };

  const handleSave = async () => {
    if (!validateStep()) return;

    setSaving(true);
    try {
      const data: CreateEmpleadoData = {
        nombres: nombres.trim(),
        apellidos: apellidos.trim(),
        tipo_documento: tipoDocumento,
        numero_documento: numeroDocumento.trim(),
        email: email.trim(),
        usuario: usuario.trim(),
        estado,
        tipo_vinculacion: tipoVinculacion,
        acceso_activo: accesoActivo,
      };

      if (telefono.trim()) data.telefono = telefono.trim();
      if (celular.trim()) data.celular = celular.trim();
      if (cargo.trim()) data.cargo = cargo.trim();
      if (departamento.trim()) data.departamento = departamento.trim();
      if (rolId) data.rol_id = rolId;
      if (fechaIngreso.trim()) data.fecha_ingreso = fechaIngreso.trim();
      if (direccion.trim()) data.direccion = direccion.trim();
      if (ciudad.trim()) data.ciudad = ciudad.trim();
      if (fechaNacimiento.trim()) data.fecha_nacimiento = fechaNacimiento.trim();
      if (salario.trim()) data.salario = parseFloat(salario);
      if (observaciones.trim()) data.observaciones = observaciones.trim();
      if (password) {
        data.password = password;
        data.password_confirmation = passwordConfirmation;
      }

      await createEmpleado(data);
      Alert.alert('Éxito', 'Empleado creado correctamente', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Error al crear el empleado';
      const errors = err.response?.data?.errors;
      if (errors) {
        const errorList = Object.values(errors).flat().join('\n');
        Alert.alert('Error de validación', errorList);
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setSaving(false);
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {STEPS.map((label, i) => (
        <View key={i} style={styles.stepItem}>
          <View style={[styles.stepDot, i <= step && styles.stepDotActive]}>
            {i < step ? (
              <Ionicons name="checkmark" size={12} color="#FFFFFF" />
            ) : (
              <Text style={[styles.stepDotText, i <= step && styles.stepDotTextActive]}>{i + 1}</Text>
            )}
          </View>
          {i < STEPS.length - 1 && (
            <View style={[styles.stepLine, i < step && styles.stepLineActive]} />
          )}
        </View>
      ))}
    </View>
  );

  const renderStep0 = () => (
    <View>
      <Text style={styles.stepTitle}>Datos Personales</Text>
      <Text style={styles.stepSubtitle}>Información básica del empleado</Text>

      <Text style={styles.inputLabel}>Nombres *</Text>
      <TextInput style={styles.input} value={nombres} onChangeText={setNombres} placeholder="Ej: Juan Carlos" placeholderTextColor="#C4C4C4" />

      <Text style={styles.inputLabel}>Apellidos *</Text>
      <TextInput style={styles.input} value={apellidos} onChangeText={setApellidos} placeholder="Ej: Pérez López" placeholderTextColor="#C4C4C4" />

      <Text style={styles.inputLabel}>Tipo de Documento *</Text>
      <TouchableOpacity style={styles.pickerButton} onPress={() => openPicker('Tipo de Documento', TIPOS_DOCUMENTO, (k) => setTipoDocumento(k))}>
        <Text style={styles.pickerButtonText}>{getLabelForKey(TIPOS_DOCUMENTO, tipoDocumento)}</Text>
        <Ionicons name="chevron-down" size={20} color="#6B7280" />
      </TouchableOpacity>

      <Text style={styles.inputLabel}>Número de Documento *</Text>
      <TextInput style={styles.input} value={numeroDocumento} onChangeText={setNumeroDocumento} placeholder="Ej: 1234567890" placeholderTextColor="#C4C4C4" keyboardType="default" />
    </View>
  );

  const renderStep1 = () => (
    <View>
      <Text style={styles.stepTitle}>Contacto y Acceso</Text>
      <Text style={styles.stepSubtitle}>Datos de contacto y credenciales</Text>

      <Text style={styles.inputLabel}>Email *</Text>
      <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="correo@ejemplo.com" placeholderTextColor="#C4C4C4" keyboardType="email-address" autoCapitalize="none" />

      <Text style={styles.inputLabel}>Usuario *</Text>
      <TextInput style={styles.input} value={usuario} onChangeText={setUsuario} placeholder="nombre.usuario" placeholderTextColor="#C4C4C4" autoCapitalize="none" />

      <Text style={styles.inputLabel}>Teléfono</Text>
      <TextInput style={styles.input} value={telefono} onChangeText={setTelefono} placeholder="Ej: 6011234567" placeholderTextColor="#C4C4C4" keyboardType="phone-pad" />

      <Text style={styles.inputLabel}>Celular</Text>
      <TextInput style={styles.input} value={celular} onChangeText={setCelular} placeholder="Ej: 3001234567" placeholderTextColor="#C4C4C4" keyboardType="phone-pad" />
    </View>
  );

  const renderStep2 = () => (
    <View>
      <Text style={styles.stepTitle}>Datos Laborales</Text>
      <Text style={styles.stepSubtitle}>Información del puesto de trabajo</Text>

      <Text style={styles.inputLabel}>Cargo</Text>
      <TextInput style={styles.input} value={cargo} onChangeText={setCargo} placeholder="Ej: Asesor Comercial" placeholderTextColor="#C4C4C4" />

      <Text style={styles.inputLabel}>Departamento</Text>
      <TextInput style={styles.input} value={departamento} onChangeText={setDepartamento} placeholder="Ej: Ventas" placeholderTextColor="#C4C4C4" />

      <Text style={styles.inputLabel}>Tipo de Vinculación *</Text>
      <TouchableOpacity style={styles.pickerButton} onPress={() => openPicker('Tipo de Vinculación', TIPOS_VINCULACION, (k) => setTipoVinculacion(k))}>
        <Text style={styles.pickerButtonText}>{getLabelForKey(TIPOS_VINCULACION, tipoVinculacion)}</Text>
        <Ionicons name="chevron-down" size={20} color="#6B7280" />
      </TouchableOpacity>

      <Text style={styles.inputLabel}>Estado *</Text>
      <TouchableOpacity style={styles.pickerButton} onPress={() => openPicker('Estado', ESTADOS, (k) => setEstado(k))}>
        <Text style={styles.pickerButtonText}>{getLabelForKey(ESTADOS, estado)}</Text>
        <Ionicons name="chevron-down" size={20} color="#6B7280" />
      </TouchableOpacity>

      <Text style={styles.inputLabel}>Rol</Text>
      {roles.length > 0 ? (
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => openPicker(
            'Rol',
            [{ key: '', label: 'Sin rol asignado' }, ...roles.map(r => ({ key: r.id.toString(), label: r.nombre }))],
            (k) => setRolId(k ? parseInt(k) : undefined)
          )}
        >
          <Text style={styles.pickerButtonText}>
            {rolId ? roles.find(r => r.id === rolId)?.nombre || 'Seleccionar' : 'Sin rol asignado'}
          </Text>
          <Ionicons name="chevron-down" size={20} color="#6B7280" />
        </TouchableOpacity>
      ) : (
        <View style={[styles.input, { justifyContent: 'center' }]}>
          <Text style={{ color: '#9CA3AF', fontFamily: 'Montserrat_400Regular', fontSize: 14 }}>No hay roles disponibles</Text>
        </View>
      )}

      <Text style={styles.inputLabel}>Fecha de Ingreso</Text>
      <TextInput style={styles.input} value={fechaIngreso} onChangeText={setFechaIngreso} placeholder="YYYY-MM-DD" placeholderTextColor="#C4C4C4" />
    </View>
  );

  const renderStep3 = () => (
    <View>
      <Text style={styles.stepTitle}>Información Adicional</Text>
      <Text style={styles.stepSubtitle}>Datos complementarios y acceso</Text>

      <Text style={styles.inputLabel}>Dirección</Text>
      <TextInput style={styles.input} value={direccion} onChangeText={setDireccion} placeholder="Ej: Calle 123 #45-67" placeholderTextColor="#C4C4C4" />

      <Text style={styles.inputLabel}>Ciudad</Text>
      <TextInput style={styles.input} value={ciudad} onChangeText={setCiudad} placeholder="Ej: Bogotá" placeholderTextColor="#C4C4C4" />

      <Text style={styles.inputLabel}>Fecha de Nacimiento</Text>
      <TextInput style={styles.input} value={fechaNacimiento} onChangeText={setFechaNacimiento} placeholder="YYYY-MM-DD" placeholderTextColor="#C4C4C4" />

      <Text style={styles.inputLabel}>Salario</Text>
      <TextInput style={styles.input} value={salario} onChangeText={setSalario} placeholder="Ej: 2500000" placeholderTextColor="#C4C4C4" keyboardType="numeric" />

      <Text style={styles.inputLabel}>Observaciones</Text>
      <TextInput style={[styles.input, styles.textArea]} value={observaciones} onChangeText={setObservaciones} placeholder="Notas adicionales..." placeholderTextColor="#C4C4C4" multiline numberOfLines={3} textAlignVertical="top" />

      <View style={styles.switchRow}>
        <View style={styles.switchInfo}>
          <Ionicons name="key" size={20} color={accesoActivo ? '#10B981' : '#9CA3AF'} />
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.switchLabel}>Acceso al Sistema</Text>
            <Text style={styles.switchHint}>{accesoActivo ? 'El empleado podrá iniciar sesión' : 'Sin acceso al sistema'}</Text>
          </View>
        </View>
        <Switch
          value={accesoActivo}
          onValueChange={setAccesoActivo}
          trackColor={{ false: '#E5E7EB', true: '#6172FD' }}
          thumbColor="#FFFFFF"
        />
      </View>

      {accesoActivo && (
        <>
          <Text style={styles.inputLabel}>Contraseña</Text>
          <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Mínimo 8 caracteres" placeholderTextColor="#C4C4C4" secureTextEntry />

          <Text style={styles.inputLabel}>Confirmar Contraseña</Text>
          <TextInput style={styles.input} value={passwordConfirmation} onChangeText={setPasswordConfirmation} placeholder="Repetir contraseña" placeholderTextColor="#C4C4C4" secureTextEntry />
        </>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Nuevo Empleado</Text>
          <Text style={styles.headerSubtitle}>{STEPS[step]}</Text>
        </View>
        <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {renderStepIndicator()}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {step === 0 && renderStep0()}
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </ScrollView>

        <View style={styles.bottomBar}>
          <View style={styles.progressInfo}>
            <Text style={styles.progressText}>Paso {step + 1} de {STEPS.length}</Text>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${((step + 1) / STEPS.length) * 100}%` }]} />
            </View>
          </View>
          {step < STEPS.length - 1 ? (
            <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
              <Text style={styles.nextButtonText}>Siguiente</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.nextButton, styles.saveButton]} onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                  <Text style={styles.nextButtonText}>Guardar</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Picker Modal */}
      <Modal visible={pickerVisible} transparent animationType="slide" onRequestClose={() => setPickerVisible(false)}>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerModal}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>{pickerTitle}</Text>
              <TouchableOpacity onPress={() => setPickerVisible(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerList}>
              {pickerOptions.map((option) => (
                <TouchableOpacity
                  key={option.key}
                  style={styles.pickerOption}
                  onPress={() => {
                    if (pickerCallback) pickerCallback(option.key);
                    setPickerVisible(false);
                  }}
                >
                  <Text style={styles.pickerOptionText}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
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
  closeButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 30,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotActive: {
    backgroundColor: '#6172FD',
  },
  stepDotText: {
    fontSize: 11,
    fontFamily: 'Montserrat_700Bold',
    color: '#9CA3AF',
  },
  stepDotTextActive: {
    color: '#FFFFFF',
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 4,
  },
  stepLineActive: {
    backgroundColor: '#6172FD',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 20,
  },
  stepTitle: {
    fontSize: 20,
    fontFamily: 'Montserrat_700Bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  stepSubtitle: {
    fontSize: 13,
    fontFamily: 'Montserrat_400Regular',
    color: '#6B7280',
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#374151',
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
    fontFamily: 'Montserrat_500Medium',
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  textArea: {
    minHeight: 80,
    paddingTop: 12,
  },
  pickerButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pickerButtonText: {
    fontSize: 14,
    fontFamily: 'Montserrat_500Medium',
    color: '#1F2937',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  switchInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  switchLabel: {
    fontSize: 14,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#1F2937',
  },
  switchHint: {
    fontSize: 11,
    fontFamily: 'Montserrat_400Regular',
    color: '#9CA3AF',
    marginTop: 1,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 28,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  progressInfo: {
    flex: 1,
    marginRight: 12,
  },
  progressText: {
    fontSize: 11,
    fontFamily: 'Montserrat_500Medium',
    color: '#9CA3AF',
    marginBottom: 4,
  },
  progressBarBg: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#6172FD',
    borderRadius: 2,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6172FD',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  saveButton: {
    backgroundColor: '#10B981',
  },
  nextButtonText: {
    fontSize: 15,
    fontFamily: 'Montserrat_700Bold',
    color: '#FFFFFF',
  },
  // Picker Modal
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pickerModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '60%',
    paddingBottom: 30,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  pickerTitle: {
    fontSize: 18,
    fontFamily: 'Montserrat_700Bold',
    color: '#1F2937',
  },
  pickerList: {
    maxHeight: 300,
  },
  pickerOption: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  pickerOptionText: {
    fontSize: 15,
    fontFamily: 'Montserrat_500Medium',
    color: '#374151',
  },
});

export default CreateEmpleadoScreen;
