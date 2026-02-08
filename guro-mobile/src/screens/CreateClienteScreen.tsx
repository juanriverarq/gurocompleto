import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { createCliente, CreateClienteData } from '../services/clientesService';

const TIPOS_DOC_PERSONA = ['CC', 'CE', 'TI', 'PP', 'RC'];
const TIPOS_DOC_EMPRESA = ['NIT'];
const GENEROS = [
  { label: 'Masculino', value: 'M' },
  { label: 'Femenino', value: 'F' },
  { label: 'Otro', value: 'O' },
];
const ESTADOS = [
  { label: 'Activo', value: 'active' },
  { label: 'Inactivo', value: 'inactive' },
  { label: 'Prospecto', value: 'prospect' },
];

const CreateClienteScreen: React.FC = () => {
  const navigation = useNavigation();
  const [saving, setSaving] = useState(false);

  // Picker modal
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTitle, setPickerTitle] = useState('');
  const [pickerOptions, setPickerOptions] = useState<{ label: string; value: string }[]>([]);
  const [pickerCallback, setPickerCallback] = useState<((val: string) => void) | null>(null);

  // Step: 0=tipo, 1=datos, 2=contacto, 3=adicional
  const [step, setStep] = useState(0);

  // Tipo
  const [clientType, setClientType] = useState<'persona' | 'empresa'>('persona');

  // Persona
  const [nombre, setNombre] = useState('');
  const [apellidos, setApellidos] = useState('');

  // Empresa
  const [empresa, setEmpresa] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [representanteLegal, setRepresentanteLegal] = useState('');

  // Documento
  const [tipoDocumento, setTipoDocumento] = useState('CC');
  const [documento, setDocumento] = useState('');

  // Contacto
  const [email, setEmail] = useState('');
  const [celular, setCelular] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [departamento, setDepartamento] = useState('');

  // Adicional
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [genero, setGenero] = useState('');
  const [actividad, setActividad] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [estado, setEstado] = useState('active');

  const openPicker = (title: string, options: { label: string; value: string }[], callback: (val: string) => void) => {
    setPickerTitle(title);
    setPickerOptions(options);
    setPickerCallback(() => callback);
    setPickerVisible(true);
  };

  const validateStep = (): boolean => {
    if (step === 0) {
      return true; // just type selection
    }
    if (step === 1) {
      if (clientType === 'persona') {
        if (!nombre.trim()) { Alert.alert('Error', 'El nombre es obligatorio'); return false; }
        if (!apellidos.trim()) { Alert.alert('Error', 'Los apellidos son obligatorios'); return false; }
      } else {
        if (!empresa.trim()) { Alert.alert('Error', 'El nombre de la empresa es obligatorio'); return false; }
      }
      if (!documento.trim()) { Alert.alert('Error', 'El documento es obligatorio'); return false; }
      return true;
    }
    if (step === 2) {
      if (!email.trim()) { Alert.alert('Error', 'El correo es obligatorio'); return false; }
      if (!celular.trim()) { Alert.alert('Error', 'El celular es obligatorio'); return false; }
      if (!direccion.trim()) { Alert.alert('Error', 'La direccion es obligatoria'); return false; }
      return true;
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep()) {
      if (step === 0) {
        // Reset tipo documento when switching type
        setTipoDocumento(clientType === 'empresa' ? 'NIT' : 'CC');
      }
      setStep(step + 1);
    }
  };

  const handleSave = async () => {
    if (!validateStep()) return;

    setSaving(true);
    try {
      const data: CreateClienteData = {
        client_type: clientType,
        tipo_documento: tipoDocumento,
        documento: documento.trim(),
        email_principal: email.trim(),
        celular_principal: celular.trim(),
        direccion: direccion.trim(),
        estado: estado,
      };

      if (clientType === 'persona') {
        data.nombre = nombre.trim();
        data.apellidos = apellidos.trim();
      } else {
        data.empresa = empresa.trim();
        data.razon_social = razonSocial.trim() || empresa.trim();
        if (representanteLegal.trim()) data.representante_legal = representanteLegal.trim();
      }

      if (telefono.trim()) data.telefono_secundario = telefono.trim();
      if (ciudad.trim()) data.ciudad = ciudad.trim();
      if (departamento.trim()) data.departamento = departamento.trim();
      if (fechaNacimiento.trim()) data.fecha_nacimiento = fechaNacimiento.trim();
      if (genero) data.genero = genero;
      if (actividad.trim()) data.actividad = actividad.trim();
      if (observaciones.trim()) data.observaciones = observaciones.trim();

      const result = await createCliente(data);

      if (result.success) {
        Alert.alert('Exito', 'Cliente creado exitosamente', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      } else {
        const errorMsg = result.code === 'DUPLICATE_DOCUMENT'
          ? 'Ya existe un cliente con este documento'
          : result.message || 'Error al crear el cliente';
        Alert.alert('Error', errorMsg);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err.message || 'Error de conexion';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const steps = ['Tipo', 'Datos', 'Contacto', 'Adicional'];

  const renderStepIndicator = () => (
    <View style={styles.stepContainer}>
      {steps.map((s, i) => (
        <View key={i} style={styles.stepItem}>
          <View style={[styles.stepCircle, i <= step && styles.stepCircleActive]}>
            {i < step ? (
              <Ionicons name="checkmark" size={14} color="#FFFFFF" />
            ) : (
              <Text style={[styles.stepNumber, i <= step && styles.stepNumberActive]}>{i + 1}</Text>
            )}
          </View>
          <Text style={[styles.stepLabel, i <= step && styles.stepLabelActive]}>{s}</Text>
          {i < steps.length - 1 && <View style={[styles.stepLine, i < step && styles.stepLineActive]} />}
        </View>
      ))}
    </View>
  );

  const renderSelectField = (label: string, value: string, placeholder: string, options: { label: string; value: string }[], onSelect: (val: string) => void) => (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity style={styles.selectField} onPress={() => openPicker(label, options, onSelect)}>
        <Text style={value ? styles.selectText : styles.selectPlaceholder}>
          {value ? (options.find(o => o.value === value)?.label || value) : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
      </TouchableOpacity>
    </View>
  );

  const renderTextField = (label: string, value: string, onChangeText: (t: string) => void, placeholder: string, options?: { keyboardType?: any; multiline?: boolean; required?: boolean }) => (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>
        {label}
        {options?.required && <Text style={{ color: '#EF4444' }}> *</Text>}
      </Text>
      <TextInput
        style={[styles.textField, options?.multiline && styles.textFieldMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#D1D5DB"
        keyboardType={options?.keyboardType || 'default'}
        multiline={options?.multiline}
        numberOfLines={options?.multiline ? 3 : 1}
        autoCapitalize={options?.keyboardType === 'email-address' ? 'none' : 'sentences'}
      />
    </View>
  );

  // Step 0: Tipo de cliente
  const renderStep0 = () => (
    <View>
      <Text style={styles.stepTitle}>Tipo de Cliente</Text>
      <Text style={styles.stepSubtitle}>Selecciona el tipo de cliente</Text>

      <TouchableOpacity
        style={[styles.typeCard, clientType === 'persona' && styles.typeCardActive]}
        onPress={() => setClientType('persona')}
        activeOpacity={0.7}
      >
        <View style={[styles.typeIconContainer, clientType === 'persona' && styles.typeIconActive]}>
          <Ionicons name="person" size={28} color={clientType === 'persona' ? '#FFFFFF' : '#6172FD'} />
        </View>
        <View style={styles.typeInfo}>
          <Text style={[styles.typeTitle, clientType === 'persona' && styles.typeTitleActive]}>Persona Natural</Text>
          <Text style={styles.typeDesc}>Cliente individual con nombre y apellidos</Text>
        </View>
        <View style={[styles.typeRadio, clientType === 'persona' && styles.typeRadioActive]}>
          {clientType === 'persona' && <View style={styles.typeRadioDot} />}
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.typeCard, clientType === 'empresa' && styles.typeCardActive]}
        onPress={() => setClientType('empresa')}
        activeOpacity={0.7}
      >
        <View style={[styles.typeIconContainer, clientType === 'empresa' && styles.typeIconActive]}>
          <Ionicons name="business" size={28} color={clientType === 'empresa' ? '#FFFFFF' : '#8B5CF6'} />
        </View>
        <View style={styles.typeInfo}>
          <Text style={[styles.typeTitle, clientType === 'empresa' && styles.typeTitleActive]}>Empresa</Text>
          <Text style={styles.typeDesc}>Cliente empresarial con razon social y NIT</Text>
        </View>
        <View style={[styles.typeRadio, clientType === 'empresa' && styles.typeRadioActive]}>
          {clientType === 'empresa' && <View style={styles.typeRadioDot} />}
        </View>
      </TouchableOpacity>
    </View>
  );

  // Step 1: Datos principales
  const renderStep1 = () => (
    <View>
      {clientType === 'persona' ? (
        <>
          {renderTextField('Nombres *', nombre, setNombre, 'Nombres del cliente', { required: true })}
          {renderTextField('Apellidos *', apellidos, setApellidos, 'Apellidos del cliente', { required: true })}
        </>
      ) : (
        <>
          {renderTextField('Nombre Empresa *', empresa, setEmpresa, 'Nombre de la empresa', { required: true })}
          {renderTextField('Razon Social', razonSocial, setRazonSocial, 'Razon social (si difiere)')}
          {renderTextField('Representante Legal', representanteLegal, setRepresentanteLegal, 'Nombre del representante')}
        </>
      )}

      <View style={styles.rowFields}>
        <View style={{ flex: 1, marginRight: 8 }}>
          {renderSelectField(
            'Tipo Doc.',
            tipoDocumento,
            'CC',
            (clientType === 'empresa' ? TIPOS_DOC_EMPRESA : TIPOS_DOC_PERSONA).map(t => ({ label: t, value: t })),
            setTipoDocumento
          )}
        </View>
        <View style={{ flex: 2 }}>
          {renderTextField('Documento *', documento, setDocumento, 'Numero de documento', { keyboardType: 'numeric', required: true })}
        </View>
      </View>
    </View>
  );

  // Step 2: Contacto
  const renderStep2 = () => (
    <View>
      {renderTextField('Correo Electronico *', email, setEmail, 'correo@ejemplo.com', { keyboardType: 'email-address', required: true })}
      {renderTextField('Celular *', celular, setCelular, 'Numero de celular', { keyboardType: 'phone-pad', required: true })}
      {renderTextField('Telefono Secundario', telefono, setTelefono, 'Telefono fijo (opcional)', { keyboardType: 'phone-pad' })}
      {renderTextField('Direccion *', direccion, setDireccion, 'Direccion principal', { required: true })}
      <View style={styles.rowFields}>
        <View style={{ flex: 1, marginRight: 8 }}>
          {renderTextField('Ciudad', ciudad, setCiudad, 'Ciudad')}
        </View>
        <View style={{ flex: 1, marginLeft: 8 }}>
          {renderTextField('Departamento', departamento, setDepartamento, 'Departamento')}
        </View>
      </View>
    </View>
  );

  // Step 3: Adicional
  const renderStep3 = () => (
    <View>
      {clientType === 'persona' && (
        <>
          {renderTextField('Fecha de Nacimiento', fechaNacimiento, setFechaNacimiento, 'YYYY-MM-DD')}
          {renderSelectField('Genero', genero, 'Seleccionar', GENEROS, setGenero)}
        </>
      )}
      {renderTextField('Actividad / Ocupacion', actividad, setActividad, 'Actividad economica')}
      {renderSelectField('Estado', estado, 'Seleccionar', ESTADOS, setEstado)}
      {renderTextField('Observaciones', observaciones, setObservaciones, 'Notas adicionales...', { multiline: true })}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nuevo Cliente</Text>
        <View style={{ width: 36 }} />
      </View>

      {renderStepIndicator()}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
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
          {step > 0 && (
            <TouchableOpacity style={styles.btnSecondary} onPress={() => setStep(step - 1)}>
              <Ionicons name="chevron-back" size={18} color="#6172FD" />
              <Text style={styles.btnSecondaryText}>Anterior</Text>
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }} />
          {step < 3 ? (
            <TouchableOpacity style={styles.btnPrimary} onPress={handleNext}>
              <Text style={styles.btnPrimaryText}>Siguiente</Text>
              <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.btnPrimary, styles.btnSave, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                  <Text style={styles.btnPrimaryText}>Crear Cliente</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Picker Modal */}
      <Modal visible={pickerVisible} transparent animationType="slide">
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>{pickerTitle}</Text>
              <TouchableOpacity onPress={() => setPickerVisible(false)}>
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={pickerOptions}
              keyExtractor={(item, i) => `${item.value}-${i}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerOption}
                  onPress={() => {
                    pickerCallback?.(item.value);
                    setPickerVisible(false);
                  }}
                >
                  <Text style={styles.pickerOptionText}>{item.label}</Text>
                </TouchableOpacity>
              )}
              style={{ maxHeight: 300 }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  header: {
    height: 95,
    backgroundColor: '#6172FD',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 8,
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
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Montserrat_700Bold',
    color: '#FFFFFF',
  },
  // Steps
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCircleActive: {
    backgroundColor: '#6172FD',
  },
  stepNumber: {
    fontSize: 12,
    fontFamily: 'Montserrat_700Bold',
    color: '#9CA3AF',
  },
  stepNumberActive: {
    color: '#FFFFFF',
  },
  stepLabel: {
    fontSize: 10,
    fontFamily: 'Montserrat_500Medium',
    color: '#9CA3AF',
    marginLeft: 4,
  },
  stepLabelActive: {
    color: '#6172FD',
  },
  stepLine: {
    width: 20,
    height: 2,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 6,
  },
  stepLineActive: {
    backgroundColor: '#6172FD',
  },
  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 20,
  },
  // Type selection
  stepTitle: {
    fontSize: 18,
    fontFamily: 'Montserrat_700Bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  stepSubtitle: {
    fontSize: 13,
    fontFamily: 'Montserrat_400Regular',
    color: '#9CA3AF',
    marginBottom: 16,
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  typeCardActive: {
    borderColor: '#6172FD',
    backgroundColor: '#F5F3FF',
  },
  typeIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeIconActive: {
    backgroundColor: '#6172FD',
  },
  typeInfo: {
    flex: 1,
    marginLeft: 14,
  },
  typeTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#374151',
  },
  typeTitleActive: {
    color: '#6172FD',
  },
  typeDesc: {
    fontSize: 12,
    fontFamily: 'Montserrat_400Regular',
    color: '#9CA3AF',
    marginTop: 2,
  },
  typeRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeRadioActive: {
    borderColor: '#6172FD',
  },
  typeRadioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#6172FD',
  },
  // Fields
  fieldContainer: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#374151',
    marginBottom: 6,
  },
  textField: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Montserrat_400Regular',
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  textFieldMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  selectField: {
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
  selectText: {
    fontSize: 15,
    fontFamily: 'Montserrat_400Regular',
    color: '#1F2937',
  },
  selectPlaceholder: {
    fontSize: 15,
    fontFamily: 'Montserrat_400Regular',
    color: '#D1D5DB',
  },
  rowFields: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  // Bottom bar
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
  btnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    gap: 4,
  },
  btnSecondaryText: {
    fontSize: 14,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#6172FD',
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#6172FD',
    gap: 6,
  },
  btnSave: {
    backgroundColor: '#22C55E',
  },
  btnPrimaryText: {
    fontSize: 14,
    fontFamily: 'Montserrat_700Bold',
    color: '#FFFFFF',
  },
  // Picker Modal
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  pickerContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
    maxHeight: '50%',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  pickerTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#1F2937',
  },
  pickerOption: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  pickerOptionText: {
    fontSize: 15,
    fontFamily: 'Montserrat_500Medium',
    color: '#374151',
  },
});

export default CreateClienteScreen;
