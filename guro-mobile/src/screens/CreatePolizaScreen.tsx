import React, { useEffect, useState, useCallback } from 'react';
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
  ImageBackground,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import {
  createPoliza,
  CreatePolizaData,
  getAseguradoras,
  getRamos,
  getClientes,
  CatalogoItem,
} from '../services/polizasService';
import DateTimePicker from '@react-native-community/datetimepicker';

const ESTADOS = ['ACTIVA', 'COTIZACION', 'PENDIENTE', 'EXPEDICION'];
const FORMAS_PAGO = ['Contado', 'Credito', 'Financiado'];
const PERIODICIDADES = ['Mensual', 'Trimestral', 'Semestral', 'Anual'];
const TIPOS_DOC = ['CC', 'NIT', 'CE', 'TI', 'PP', 'RC'];

const CreatePolizaScreen: React.FC = () => {
  const navigation = useNavigation();
  const [saving, setSaving] = useState(false);
  const [aseguradoras, setAseguradoras] = useState<CatalogoItem[]>([]);
  const [ramos, setRamos] = useState<CatalogoItem[]>([]);
  const [loadingCatalogos, setLoadingCatalogos] = useState(true);

  // Picker modal state
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTitle, setPickerTitle] = useState('');
  const [pickerOptions, setPickerOptions] = useState<{ label: string; value: string }[]>([]);
  const [pickerCallback, setPickerCallback] = useState<((val: string) => void) | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');

  // Client selection
  const [clientesList, setClientesList] = useState<any[]>([]);
  const [clienteSearch, setClienteSearch] = useState('');
  const [clienteModalVisible, setClienteModalVisible] = useState(false);
  const [selectedClienteId, setSelectedClienteId] = useState<number | null>(null);
  const [loadingClientes, setLoadingClientes] = useState(false);

  // Date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerField, setDatePickerField] = useState<'expedicion' | 'inicio' | 'fin'>('expedicion');
  const [tempDate, setTempDate] = useState(new Date());

  // Step
  const [step, setStep] = useState(0); // 0=poliza, 1=cliente, 2=finanzas, 3=fechas

  // Form fields
  const [numeroPoliza, setNumeroPoliza] = useState('');
  const [aseguradora, setAseguradora] = useState('');
  const [ramoPrincipal, setRamoPrincipal] = useState('');
  const [subramo, setSubramo] = useState('');
  const [riesgo, setRiesgo] = useState('');
  const [estado, setEstado] = useState('ACTIVA');

  // Cliente
  const [nombresCliente, setNombresCliente] = useState('');
  const [apellidosCliente, setApellidosCliente] = useState('');
  const [dniCliente, setDniCliente] = useState('');
  const [tipoDocumento, setTipoDocumento] = useState('CC');
  const [telefonoCliente, setTelefonoCliente] = useState('');
  const [correoCliente, setCorreoCliente] = useState('');

  // Finanzas
  const [primaNeta, setPrimaNeta] = useState('');
  const [porcentajeIva, setPorcentajeIva] = useState('19');
  const [iva, setIva] = useState('');
  const [total, setTotal] = useState('');
  const [porcentajeComision, setPorcentajeComision] = useState('');
  const [comision, setComision] = useState('');
  const [formaPago, setFormaPago] = useState('');
  const [periodicidadPago, setPeriodicidadPago] = useState('');

  // Fechas
  const [fechaExpedicion, setFechaExpedicion] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [vendedor, setVendedor] = useState('');
  const [observaciones, setObservaciones] = useState('');

  useEffect(() => {
    loadCatalogos();
    loadClientes();
  }, []);

  const loadCatalogos = async () => {
    setLoadingCatalogos(true);
    const [aseg, ram] = await Promise.all([getAseguradoras(), getRamos()]);
    setAseguradoras(aseg);
    setRamos(ram);
    setLoadingCatalogos(false);
  };

  const loadClientes = async (search?: string) => {
    setLoadingClientes(true);
    const data = await getClientes(search);
    setClientesList(data);
    setLoadingClientes(false);
  };

  const selectCliente = (cliente: any) => {
    setSelectedClienteId(cliente.id);
    setNombresCliente(cliente.nombre || cliente.nombres || '');
    setApellidosCliente(cliente.apellidos || '');
    setDniCliente(cliente.cuit || cliente.dni || '');
    setTipoDocumento(cliente.tipo_documento || 'CC');
    setTelefonoCliente(cliente.celular_principal || cliente.telefono || '');
    setCorreoCliente(cliente.email_principal || '');
    setClienteModalVisible(false);
  };

  const formatDateStr = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const openDatePicker = (field: 'expedicion' | 'inicio' | 'fin') => {
    setDatePickerField(field);
    const currentVal = field === 'expedicion' ? fechaExpedicion : field === 'inicio' ? fechaInicio : fechaFin;
    if (currentVal) {
      const parts = currentVal.split('-');
      if (parts.length === 3) setTempDate(new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
      else setTempDate(new Date());
    } else {
      setTempDate(new Date());
    }
    setShowDatePicker(true);
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (event.type === 'dismissed') { setShowDatePicker(false); return; }
    const date = selectedDate || tempDate;
    setTempDate(date);
    const str = formatDateStr(date);
    if (datePickerField === 'expedicion') setFechaExpedicion(str);
    else if (datePickerField === 'inicio') setFechaInicio(str);
    else setFechaFin(str);
    if (Platform.OS === 'android') setShowDatePicker(false);
  };

  const confirmIOSDate = () => {
    const str = formatDateStr(tempDate);
    if (datePickerField === 'expedicion') setFechaExpedicion(str);
    else if (datePickerField === 'inicio') setFechaInicio(str);
    else setFechaFin(str);
    setShowDatePicker(false);
  };

  // Auto-calculate IVA and total
  useEffect(() => {
    const prima = parseFloat(primaNeta) || 0;
    const ivaP = parseFloat(porcentajeIva) || 0;
    const calculatedIva = prima * (ivaP / 100);
    setIva(calculatedIva > 0 ? calculatedIva.toFixed(0) : '');
    setTotal(prima > 0 ? (prima + calculatedIva).toFixed(0) : '');
  }, [primaNeta, porcentajeIva]);

  // Auto-calculate comision
  useEffect(() => {
    const prima = parseFloat(primaNeta) || 0;
    const comP = parseFloat(porcentajeComision) || 0;
    setComision(prima > 0 && comP > 0 ? (prima * (comP / 100)).toFixed(0) : '');
  }, [primaNeta, porcentajeComision]);

  const openPicker = (title: string, options: { label: string; value: string }[], callback: (val: string) => void) => {
    setPickerTitle(title);
    setPickerOptions(options);
    setPickerCallback(() => callback);
    setPickerSearch('');
    setPickerVisible(true);
  };

  const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const validateStep = (): boolean => {
    if (step === 0) {
      if (!numeroPoliza.trim()) { Alert.alert('Error', 'El numero de poliza es obligatorio'); return false; }
      if (!aseguradora.trim()) { Alert.alert('Error', 'La aseguradora es obligatoria'); return false; }
      if (!ramoPrincipal.trim()) { Alert.alert('Error', 'El ramo es obligatorio'); return false; }
      return true;
    }
    if (step === 1) {
      if (!nombresCliente.trim()) { Alert.alert('Error', 'El nombre del cliente es obligatorio'); return false; }
      if (!dniCliente.trim()) { Alert.alert('Error', 'El documento del cliente es obligatorio'); return false; }
      return true;
    }
    if (step === 2) {
      if (!primaNeta.trim() || parseFloat(primaNeta) <= 0) { Alert.alert('Error', 'La prima neta es obligatoria'); return false; }
      return true;
    }
    if (step === 3) {
      if (!fechaExpedicion.trim()) { Alert.alert('Error', 'La fecha de expedicion es obligatoria'); return false; }
      if (!fechaInicio.trim()) { Alert.alert('Error', 'La fecha de inicio es obligatoria'); return false; }
      if (!fechaFin.trim()) { Alert.alert('Error', 'La fecha de fin es obligatoria'); return false; }
      return true;
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep()) {
      setStep(step + 1);
    }
  };

  const handleSave = async () => {
    if (!validateStep()) return;

    setSaving(true);
    try {
      const data: CreatePolizaData = {
        numero_poliza: numeroPoliza.trim(),
        aseguradora: aseguradora.trim(),
        ramo_principal: ramoPrincipal.trim(),
        subramo: subramo.trim() || undefined,
        riesgo: riesgo.trim() || undefined,
        nombres_cliente: nombresCliente.trim(),
        apellidos_cliente: apellidosCliente.trim() || undefined,
        dni_cliente: dniCliente.trim(),
        tipo_documento: tipoDocumento,
        telefono_cliente: telefonoCliente.trim() || undefined,
        correo_cliente: correoCliente.trim() || undefined,
        prima_neta: parseFloat(primaNeta) || 0,
        porcentaje_iva: parseFloat(porcentajeIva) || 19,
        iva: parseFloat(iva) || undefined,
        total: parseFloat(total) || undefined,
        porcentaje_comision: parseFloat(porcentajeComision) || undefined,
        comision: parseFloat(comision) || undefined,
        forma_pago: formaPago || undefined,
        periodicidad_pago: periodicidadPago || undefined,
        vendedor: vendedor.trim() || undefined,
        observaciones: observaciones.trim() || undefined,
        fecha_expedicion: fechaExpedicion,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        estado: estado,
      };

      const result = await createPoliza(data);
      if (result.success) {
        Alert.alert('Exito', 'Poliza creada exitosamente', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      } else {
        const errorMsg = result.errors
          ? Object.values(result.errors).flat().join('\n')
          : result.message || 'Error al crear la poliza';
        Alert.alert('Error', errorMsg);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.errors
        ? Object.values(err.response.data.errors).flat().join('\n')
        : err.message || 'Error de conexion';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const filteredPickerOptions = pickerSearch.trim()
    ? pickerOptions.filter(o => o.label.toLowerCase().includes(pickerSearch.toLowerCase()))
    : pickerOptions;

  const steps = ['Poliza', 'Cliente', 'Finanzas', 'Fechas'];

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
          {value || placeholder}
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
      />
    </View>
  );

  const renderStep0 = () => (
    <View>
      {renderTextField('Numero de Poliza', numeroPoliza, setNumeroPoliza, 'Ej: POL-2025-001', { required: true })}
      {renderSelectField(
        'Aseguradora *',
        aseguradora,
        'Seleccionar aseguradora',
        aseguradoras.map(a => ({ label: a.nombre, value: a.nombre })),
        setAseguradora
      )}
      {renderSelectField(
        'Ramo *',
        ramoPrincipal,
        'Seleccionar ramo',
        ramos.map(r => ({ label: r.nombre, value: r.nombre })),
        setRamoPrincipal
      )}
      {renderTextField('Subramo', subramo, setSubramo, 'Opcional')}
      {renderTextField('Riesgo / Descripcion', riesgo, setRiesgo, 'Descripcion del riesgo', { multiline: true })}
      {renderSelectField(
        'Estado',
        estado,
        'Seleccionar estado',
        ESTADOS.map(e => ({ label: e, value: e })),
        setEstado
      )}
    </View>
  );

  const renderStep1 = () => (
    <View>
      {/* Select existing client button */}
      <TouchableOpacity 
        style={styles.selectClienteButton} 
        onPress={() => { setClienteSearch(''); setClienteModalVisible(true); }}
      >
        <Ionicons name="people-outline" size={18} color="#573CFF" />
        <Text style={styles.selectClienteButtonText}>
          {selectedClienteId ? 'Cambiar cliente seleccionado' : 'Seleccionar cliente existente'}
        </Text>
      </TouchableOpacity>

      {selectedClienteId && (
        <View style={styles.selectedClienteBadge}>
          <Ionicons name="checkmark-circle" size={16} color="#10B981" />
          <Text style={styles.selectedClienteText}>Cliente vinculado: {nombresCliente} {apellidosCliente}</Text>
        </View>
      )}

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>o ingresa manualmente</Text>
        <View style={styles.dividerLine} />
      </View>

      <View style={styles.rowFields}>
        <View style={{ flex: 1, marginRight: 8 }}>
          {renderSelectField(
            'Tipo Doc.',
            tipoDocumento,
            'CC',
            TIPOS_DOC.map(t => ({ label: t, value: t })),
            setTipoDocumento
          )}
        </View>
        <View style={{ flex: 2 }}>
          {renderTextField('Documento *', dniCliente, setDniCliente, 'Numero de documento', { keyboardType: 'numeric', required: true })}
        </View>
      </View>
      {renderTextField('Nombres *', nombresCliente, setNombresCliente, 'Nombres del cliente', { required: true })}
      {renderTextField('Apellidos', apellidosCliente, setApellidosCliente, 'Apellidos del cliente')}
      {renderTextField('Telefono', telefonoCliente, setTelefonoCliente, 'Telefono o celular', { keyboardType: 'phone-pad' })}
      {renderTextField('Correo', correoCliente, setCorreoCliente, 'correo@ejemplo.com', { keyboardType: 'email-address' })}
    </View>
  );

  const renderStep2 = () => (
    <View>
      {renderTextField('Prima Neta *', primaNeta, setPrimaNeta, '0', { keyboardType: 'numeric', required: true })}
      <View style={styles.rowFields}>
        <View style={{ flex: 1, marginRight: 8 }}>
          {renderTextField('% IVA', porcentajeIva, setPorcentajeIva, '19', { keyboardType: 'numeric' })}
        </View>
        <View style={{ flex: 1, marginLeft: 8 }}>
          {renderTextField('IVA', iva, setIva, 'Auto', { keyboardType: 'numeric' })}
        </View>
      </View>
      {renderTextField('Total', total, setTotal, 'Auto', { keyboardType: 'numeric' })}
      <View style={styles.rowFields}>
        <View style={{ flex: 1, marginRight: 8 }}>
          {renderTextField('% Comision', porcentajeComision, setPorcentajeComision, '0', { keyboardType: 'numeric' })}
        </View>
        <View style={{ flex: 1, marginLeft: 8 }}>
          {renderTextField('Comision', comision, setComision, 'Auto', { keyboardType: 'numeric' })}
        </View>
      </View>
      {renderSelectField(
        'Forma de Pago',
        formaPago,
        'Seleccionar',
        FORMAS_PAGO.map(f => ({ label: f, value: f })),
        setFormaPago
      )}
      {renderSelectField(
        'Periodicidad',
        periodicidadPago,
        'Seleccionar',
        PERIODICIDADES.map(p => ({ label: p, value: p })),
        setPeriodicidadPago
      )}
    </View>
  );

  const renderDateField = (label: string, value: string, field: 'expedicion' | 'inicio' | 'fin', required?: boolean) => (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>
        {label}
        {required && <Text style={{ color: '#EF4444' }}> *</Text>}
      </Text>
      <TouchableOpacity style={styles.selectField} onPress={() => openDatePicker(field)}>
        <Text style={value ? styles.selectText : styles.selectPlaceholder}>
          {value || 'Seleccionar fecha'}
        </Text>
        <Ionicons name="calendar-outline" size={18} color="#9CA3AF" />
      </TouchableOpacity>
    </View>
  );

  const renderStep3 = () => (
    <View>
      {renderDateField('Fecha Expedicion', fechaExpedicion, 'expedicion', true)}
      {renderDateField('Fecha Inicio', fechaInicio, 'inicio', true)}
      {renderDateField('Fecha Fin', fechaFin, 'fin', true)}
      
      {!fechaExpedicion && (
        <TouchableOpacity style={styles.todayButton} onPress={() => {
          const today = getTodayStr();
          setFechaExpedicion(today);
          setFechaInicio(today);
          const next = new Date();
          next.setFullYear(next.getFullYear() + 1);
          setFechaFin(formatDateStr(next));
        }}>
          <Ionicons name="calendar-outline" size={16} color="#573CFF" />
          <Text style={styles.todayButtonText}>Usar hoy + 1 ano</Text>
        </TouchableOpacity>
      )}

      {renderTextField('Vendedor', vendedor, setVendedor, 'Nombre del vendedor')}
      {renderTextField('Observaciones', observaciones, setObservaciones, 'Notas adicionales', { multiline: true })}
    </View>
  );

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
        <Text style={styles.headerTitle}>Nueva Poliza</Text>
        <View style={{ width: 38 }} />
      </ImageBackground>

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
          {loadingCatalogos ? (
            <View style={styles.loadingCatalogos}>
              <ActivityIndicator size="small" color="#573CFF" />
              <Text style={styles.loadingCatalogosText}>Cargando catalogos...</Text>
            </View>
          ) : (
            <>
              {step === 0 && renderStep0()}
              {step === 1 && renderStep1()}
              {step === 2 && renderStep2()}
              {step === 3 && renderStep3()}
            </>
          )}
        </ScrollView>

        <View style={styles.bottomBar}>
          {step > 0 && (
            <TouchableOpacity style={styles.btnSecondary} onPress={() => setStep(step - 1)}>
              <Ionicons name="chevron-back" size={18} color="#573CFF" />
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
                  <Text style={styles.btnPrimaryText}>Crear Poliza</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Client Selection Modal */}
      <Modal visible={clienteModalVisible} transparent animationType="slide">
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerContainer, { maxHeight: '70%' }]}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Seleccionar Cliente</Text>
              <TouchableOpacity onPress={() => setClienteModalVisible(false)}>
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>
            <View style={styles.pickerSearchContainer}>
              <Ionicons name="search" size={16} color="#9CA3AF" />
              <TextInput
                style={styles.pickerSearchInput}
                placeholder="Buscar por nombre o documento..."
                placeholderTextColor="#D1D5DB"
                value={clienteSearch}
                onChangeText={(text) => {
                  setClienteSearch(text);
                  loadClientes(text);
                }}
              />
            </View>
            {loadingClientes ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#573CFF" />
              </View>
            ) : (
              <FlatList
                data={clientesList}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.clienteOption}
                    onPress={() => selectCliente(item)}
                  >
                    <View style={styles.clienteOptionAvatar}>
                      <Ionicons name={item.client_type === 'empresa' ? 'business' : 'person'} size={18} color="#573CFF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.clienteOptionName}>
                        {item.client_type === 'empresa' && item.empresa ? item.empresa : `${item.nombre || ''} ${item.apellidos || ''}`.trim() || 'Sin nombre'}
                      </Text>
                      <Text style={styles.clienteOptionDoc}>{item.tipo_documento || 'CC'}: {item.cuit || 'N/A'}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={styles.pickerEmpty}>No se encontraron clientes</Text>
                }
                style={{ maxHeight: 350 }}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Date Picker */}
      {showDatePicker && Platform.OS === 'ios' && (
        <Modal transparent animationType="slide">
          <View style={styles.pickerOverlay}>
            <View style={[styles.pickerContainer, { paddingBottom: 20 }]}>
              <View style={styles.pickerHeader}>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text style={[styles.btnSecondaryText, { fontSize: 16 }]}>Cancelar</Text>
                </TouchableOpacity>
                <Text style={styles.pickerTitle}>
                  {datePickerField === 'expedicion' ? 'Fecha Expedicion' : datePickerField === 'inicio' ? 'Fecha Inicio' : 'Fecha Fin'}
                </Text>
                <TouchableOpacity onPress={confirmIOSDate}>
                  <Text style={[styles.btnSecondaryText, { fontSize: 16 }]}>Listo</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="spinner"
                onChange={onDateChange}
                style={{ height: 200 }}
              />
            </View>
          </View>
        </Modal>
      )}
      {showDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={tempDate}
          mode="date"
          display="default"
          onChange={onDateChange}
        />
      )}

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
            {pickerOptions.length > 6 && (
              <View style={styles.pickerSearchContainer}>
                <Ionicons name="search" size={16} color="#9CA3AF" />
                <TextInput
                  style={styles.pickerSearchInput}
                  placeholder="Buscar..."
                  placeholderTextColor="#D1D5DB"
                  value={pickerSearch}
                  onChangeText={setPickerSearch}
                />
              </View>
            )}
            <FlatList
              data={filteredPickerOptions}
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
              ListEmptyComponent={
                <Text style={styles.pickerEmpty}>Sin opciones</Text>
              }
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
    fontSize: 18,
    fontFamily: 'Montserrat_700Bold',
    color: '#FFFFFF',
  },
  // Steps
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
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
    backgroundColor: '#573CFF',
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
    color: '#573CFF',
  },
  stepLine: {
    width: 20,
    height: 2,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 6,
  },
  stepLineActive: {
    backgroundColor: '#573CFF',
  },
  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 20,
  },
  loadingCatalogos: {
    alignItems: 'center',
    paddingTop: 40,
  },
  loadingCatalogosText: {
    marginTop: 8,
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
    color: '#9CA3AF',
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
  todayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    marginBottom: 14,
  },
  todayButtonText: {
    fontSize: 13,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#573CFF',
  },
  // Bottom bar
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 34,
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
    color: '#573CFF',
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#573CFF',
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
    maxHeight: '60%',
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
  pickerSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pickerSearchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
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
  pickerEmpty: {
    textAlign: 'center',
    paddingVertical: 20,
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
    color: '#9CA3AF',
  },
  // Client selection
  selectClienteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#573CFF',
    borderStyle: 'dashed',
    backgroundColor: '#EEF2FF',
    marginBottom: 12,
  },
  selectClienteButtonText: {
    fontSize: 14,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#573CFF',
  },
  selectedClienteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  selectedClienteText: {
    fontSize: 13,
    fontFamily: 'Montserrat_500Medium',
    color: '#065F46',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#9CA3AF',
  },
  clienteOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  clienteOptionAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clienteOptionName: {
    fontSize: 15,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#1F2937',
  },
  clienteOptionDoc: {
    fontSize: 12,
    fontFamily: 'Montserrat_400Regular',
    color: '#9CA3AF',
    marginTop: 2,
  },
});

export default CreatePolizaScreen;
