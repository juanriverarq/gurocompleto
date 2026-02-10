import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ImageBackground,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Renovacion, registrarContactoRenovacion, procesarRenovacion, ContactoData } from '../services/renovacionesService';

const CONTACTO_TIPOS: { key: ContactoData['tipo']; label: string; icon: string }[] = [
  { key: 'llamada', label: 'Llamada', icon: 'call-outline' },
  { key: 'whatsapp', label: 'WhatsApp', icon: 'logo-whatsapp' },
  { key: 'email', label: 'Email', icon: 'mail-outline' },
  { key: 'presencial', label: 'Presencial', icon: 'person-outline' },
  { key: 'sms', label: 'SMS', icon: 'chatbubble-outline' },
];

const CONTACTO_RESULTADOS: { key: ContactoData['resultado']; label: string }[] = [
  { key: 'exitoso', label: 'Exitoso' },
  { key: 'no_contesta', label: 'No contesta' },
  { key: 'no_disponible', label: 'No disponible' },
  { key: 'solicita_info', label: 'Solicita info' },
  { key: 'no_interesado', label: 'No interesado' },
  { key: 'rebotado', label: 'Rebotado' },
];

const RenovacionDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const item: Renovacion = route.params?.renovacion;

  const [showContactModal, setShowContactModal] = useState(false);
  const [contactTipo, setContactTipo] = useState<ContactoData['tipo']>('llamada');
  const [contactResultado, setContactResultado] = useState<ContactoData['resultado']>('exitoso');
  const [contactObs, setContactObs] = useState('');
  const [saving, setSaving] = useState(false);
  const [renovando, setRenovando] = useState(false);

  const dias = item.diasVencimiento ?? item.dias_vencimiento ?? 0;

  const getEstadoColor = (estado: string) => {
    switch (estado?.toUpperCase()) {
      case 'VENCIDO': return '#EF4444';
      case 'CRITICO': return '#F59E0B';
      case 'PENDIENTE': return '#3B82F6';
      case 'RENOVADO': return '#10B981';
      default: return '#6B7280';
    }
  };

  const getPrioridadColor = (p: string) => {
    switch (p?.toUpperCase()) {
      case 'CRITICA': return '#EF4444';
      case 'ALTA': return '#F59E0B';
      case 'MEDIA': return '#3B82F6';
      case 'BAJA': return '#10B981';
      default: return '#6B7280';
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const diasText = dias < 0
    ? `Venció hace ${Math.abs(dias)} días`
    : dias === 0 ? 'Vence hoy' : `Vence en ${dias} días`;

  const estadoColor = getEstadoColor(item.estado);
  const prioridadColor = getPrioridadColor(item.prioridad);
  const polizaId = item.poliza_id || Number(item.id);

  const handleRegistrarContacto = async () => {
    if (!contactObs.trim()) {
      Alert.alert('Error', 'Escribe una observación del contacto');
      return;
    }
    setSaving(true);
    try {
      const res = await registrarContactoRenovacion(polizaId, {
        tipo: contactTipo,
        resultado: contactResultado,
        observaciones: contactObs.trim(),
      });
      if (res.success) {
        Alert.alert('Éxito', 'Contacto registrado correctamente');
        setShowContactModal(false);
        setContactObs('');
      } else {
        Alert.alert('Error', res.message || 'No se pudo registrar');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || err.message || 'Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const handleRenovar = () => {
    Alert.alert(
      'Procesar Renovación',
      `¿Deseas procesar la renovación de la póliza ${item.numeroPoliza || item.numero_poliza}?\n\nEsto creará una nueva póliza con los mismos datos y marcará la actual como renovada.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Renovar', style: 'default', onPress: async () => {
            setRenovando(true);
            try {
              const res = await procesarRenovacion(polizaId);
              if (res.success) {
                Alert.alert('Éxito', 'Póliza renovada exitosamente', [
                  { text: 'OK', onPress: () => navigation.goBack() }
                ]);
              } else {
                Alert.alert('Error', res.message || 'No se pudo renovar');
              }
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.message || err.message || 'Error de conexión');
            } finally {
              setRenovando(false);
            }
          }
        },
      ]
    );
  };

  const renderInfoRow = (icon: string, label: string, value: string, valueColor?: string) => (
    <View style={styles.infoRow}>
      <View style={styles.infoLeft}>
        <Ionicons name={icon as any} size={18} color="#9CA3AF" />
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={[styles.infoValue, valueColor ? { color: valueColor } : {}]} numberOfLines={2}>{value}</Text>
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
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.headerTitle}>Detalle Renovación</Text>
          </View>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate('PolizaDetail', { polizaId })}>
            <Ionicons name="document-text-outline" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </ImageBackground>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Estado + Prioridad badges */}
        <View style={styles.badgeRow}>
          <View style={[styles.statusBadge, { backgroundColor: `${estadoColor}15` }]}>
            <View style={[styles.statusDot, { backgroundColor: estadoColor }]} />
            <Text style={[styles.statusText, { color: estadoColor }]}>{item.estado}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${prioridadColor}15` }]}>
            <Ionicons name="flag" size={12} color={prioridadColor} />
            <Text style={[styles.statusText, { color: prioridadColor }]}>Prioridad {item.prioridad}</Text>
          </View>
        </View>

        {/* Días countdown */}
        <View style={[styles.countdownCard, { borderLeftColor: estadoColor }]}>
          <Ionicons name="time-outline" size={24} color={estadoColor} />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={[styles.countdownDays, { color: estadoColor }]}>{diasText}</Text>
            <Text style={styles.countdownDate}>Vencimiento: {formatDate(item.fechaVencimiento)}</Text>
          </View>
        </View>

        {/* Info de la póliza */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información de la Póliza</Text>
          <View style={styles.infoCard}>
            {renderInfoRow('document-text-outline', 'Nº Póliza', item.numeroPoliza || item.numero_poliza || 'N/A')}
            {renderInfoRow('person-outline', 'Cliente', item.cliente || 'N/A')}
            {renderInfoRow('card-outline', 'Documento', item.dni_cliente || 'N/A')}
            {renderInfoRow('business-outline', 'Aseguradora', item.aseguradora || 'N/A')}
            {renderInfoRow('shield-outline', 'Ramo', item.ramo || item.tipoSeguro || 'N/A')}
            {item.placa && renderInfoRow('car-outline', 'Placa', item.placa)}
            {renderInfoRow('cash-outline', 'Prima', formatCurrency(item.valorPrima || item.prima_neta || 0), '#10B981')}
            {renderInfoRow('people-outline', 'Agente', item.agente || 'N/A')}
            {renderInfoRow('calendar-outline', 'Último contacto', formatDate(item.ultimoContacto))}
          </View>
        </View>

        {/* Observaciones */}
        {item.observaciones && item.observaciones !== 'Sin observaciones' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Observaciones</Text>
            <View style={styles.obsCard}>
              <Text style={styles.obsText}>{item.observaciones}</Text>
            </View>
          </View>
        )}

        {/* Action buttons */}
        {item.estado?.toUpperCase() !== 'RENOVADO' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Acciones</Text>

            <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} onPress={() => setShowContactModal(true)}>
              <View style={[styles.actionIconWrap, { backgroundColor: '#EEF2FF' }]}>
                <Ionicons name="call-outline" size={20} color="#573CFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionTitle}>Registrar Contacto</Text>
                <Text style={styles.actionSub}>Llamada, WhatsApp, email, etc.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.renovarBtn, renovando && { opacity: 0.6 }]}
              activeOpacity={0.7}
              onPress={handleRenovar}
              disabled={renovando}
            >
              {renovando ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="refresh" size={20} color="#FFFFFF" />
                  <Text style={styles.renovarBtnText}>Procesar Renovación</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtn}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('PolizaDetail', { polizaId })}
            >
              <View style={[styles.actionIconWrap, { backgroundColor: '#F0FDF4' }]}>
                <Ionicons name="document-text-outline" size={20} color="#10B981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionTitle}>Ver Póliza Completa</Text>
                <Text style={styles.actionSub}>Documentos, pagos, detalles</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Modal Registrar Contacto */}
      <Modal visible={showContactModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Registrar Contacto</Text>
              <TouchableOpacity onPress={() => setShowContactModal(false)}>
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalLabel}>Tipo de contacto</Text>
              <View style={styles.chipRow}>
                {CONTACTO_TIPOS.map((t) => (
                  <TouchableOpacity
                    key={t.key}
                    style={[styles.chip, contactTipo === t.key && styles.chipActive]}
                    onPress={() => setContactTipo(t.key)}
                  >
                    <Ionicons name={t.icon as any} size={14} color={contactTipo === t.key ? '#FFF' : '#6B7280'} />
                    <Text style={[styles.chipText, contactTipo === t.key && styles.chipTextActive]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalLabel}>Resultado</Text>
              <View style={styles.chipRow}>
                {CONTACTO_RESULTADOS.map((r) => (
                  <TouchableOpacity
                    key={r.key}
                    style={[styles.chip, contactResultado === r.key && styles.chipActive]}
                    onPress={() => setContactResultado(r.key)}
                  >
                    <Text style={[styles.chipText, contactResultado === r.key && styles.chipTextActive]}>{r.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalLabel}>Observaciones *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Describe el resultado del contacto..."
                placeholderTextColor="#9CA3AF"
                value={contactObs}
                onChangeText={setContactObs}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={[styles.modalSaveBtn, saving && { opacity: 0.6 }]}
                onPress={handleRegistrarContacto}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSaveBtnText}>Guardar Contacto</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    paddingTop: 54, paddingBottom: 16, paddingHorizontal: 20,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: {
    width: 38, height: 38, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 17, fontFamily: 'Montserrat_700Bold', color: '#FFFFFF', letterSpacing: -0.3 },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 16, paddingHorizontal: 20 },

  badgeRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 12, gap: 6,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, fontFamily: 'Montserrat_700Bold' },

  countdownCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 16, padding: 16, borderLeftWidth: 4, marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  countdownDays: { fontSize: 16, fontFamily: 'Montserrat_700Bold' },
  countdownDate: { fontSize: 12, fontFamily: 'Montserrat_400Regular', color: '#9CA3AF', marginTop: 2 },

  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontFamily: 'Montserrat_700Bold', color: '#573CFF', letterSpacing: 0.5, marginBottom: 10, textTransform: 'uppercase' },

  infoCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  infoLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoLabel: { fontSize: 13, fontFamily: 'Montserrat_500Medium', color: '#6B7280' },
  infoValue: { fontSize: 13, fontFamily: 'Montserrat_600SemiBold', color: '#0d0d0d', textAlign: 'right', maxWidth: '50%' },

  obsCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  obsText: { fontSize: 13, fontFamily: 'Montserrat_400Regular', color: '#374151', lineHeight: 20 },

  actionBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 14, padding: 14, marginBottom: 10, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  actionIconWrap: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  actionTitle: { fontSize: 14, fontFamily: 'Montserrat_600SemiBold', color: '#0d0d0d' },
  actionSub: { fontSize: 11, fontFamily: 'Montserrat_400Regular', color: '#9CA3AF', marginTop: 1 },

  renovarBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#573CFF', borderRadius: 14, paddingVertical: 16, marginBottom: 10, gap: 10,
    shadowColor: '#573CFF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },
  renovarBtnText: { fontSize: 15, fontFamily: 'Montserrat_700Bold', color: '#FFFFFF' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, maxHeight: '85%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontFamily: 'Montserrat_700Bold', color: '#0d0d0d' },
  modalLabel: { fontSize: 13, fontFamily: 'Montserrat_600SemiBold', color: '#374151', marginBottom: 8, marginTop: 16 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6',
  },
  chipActive: { backgroundColor: '#573CFF' },
  chipText: { fontSize: 13, fontFamily: 'Montserrat_500Medium', color: '#6B7280' },
  chipTextActive: { color: '#FFFFFF' },
  modalInput: {
    backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, fontSize: 14,
    fontFamily: 'Montserrat_400Regular', color: '#374151', minHeight: 100,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  modalSaveBtn: {
    backgroundColor: '#573CFF', borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 20,
  },
  modalSaveBtnText: { fontSize: 15, fontFamily: 'Montserrat_700Bold', color: '#FFFFFF' },
});

export default RenovacionDetailScreen;
