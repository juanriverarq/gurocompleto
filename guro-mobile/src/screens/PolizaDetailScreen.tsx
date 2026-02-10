import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ImageBackground,
  Modal,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { getPolizaById, updatePoliza, UpdatePolizaData, getPolizaDocuments, getDocumentSignedUrlFresh, PolizaDocument } from '../services/polizasService';
import LoadingSpinner from '../components/LoadingSpinner';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import DateTimePicker from '@react-native-community/datetimepicker';

type PolizaDetailRouteParams = {
  PolizaDetail: {
    polizaId: number;
  };
};

const PolizaDetailScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<PolizaDetailRouteParams, 'PolizaDetail'>>();
  const { polizaId } = route.params;
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [poliza, setPoliza] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editData, setEditData] = useState<UpdatePolizaData>({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerField, setDatePickerField] = useState<'fecha_inicio' | 'fecha_fin' | 'fecha_expedicion' | 'fecha_recepcion'>('fecha_inicio');
  const [tempDate, setTempDate] = useState(new Date());
  const [documents, setDocuments] = useState<PolizaDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [openingDoc, setOpeningDoc] = useState<string | null>(null);

  const fetchPoliza = async () => {
    try {
      setError(null);
      const response = await getPolizaById(polizaId);
      if (response.success) {
        setPoliza(response.data);
      } else {
        setError(response.message || 'Error al cargar póliza');
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchDocuments = async () => {
    setLoadingDocs(true);
    const docs = await getPolizaDocuments(polizaId);
    setDocuments(docs);
    setLoadingDocs(false);
  };

  useEffect(() => {
    fetchPoliza();
    fetchDocuments();
  }, [polizaId]);

  const openDocument = async (doc: PolizaDocument) => {
    setOpeningDoc(doc.path);
    try {
      // Try to get a fresh signed URL
      const freshUrl = await getDocumentSignedUrlFresh(polizaId, doc.path);
      const url = freshUrl || doc.url;
      if (url) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'No se pudo obtener la URL del documento');
      }
    } catch (err: any) {
      Alert.alert('Error', 'No se pudo abrir el documento');
    } finally {
      setOpeningDoc(null);
    }
  };

  const getDocIcon = (contentType: string): string => {
    if (contentType?.includes('pdf')) return 'document-text';
    if (contentType?.includes('image')) return 'image';
    if (contentType?.includes('word') || contentType?.includes('doc')) return 'document';
    if (contentType?.includes('sheet') || contentType?.includes('excel') || contentType?.includes('csv')) return 'grid';
    return 'attach';
  };

  const getDocIconColor = (contentType: string): string => {
    if (contentType?.includes('pdf')) return '#EF4444';
    if (contentType?.includes('image')) return '#3B82F6';
    if (contentType?.includes('word') || contentType?.includes('doc')) return '#2563EB';
    if (contentType?.includes('sheet') || contentType?.includes('excel') || contentType?.includes('csv')) return '#22C55E';
    return '#6B7280';
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchPoliza();
    fetchDocuments();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value || 0);
  };

  const getStatusColor = (estado: string) => {
    switch (estado?.toLowerCase()) {
      case 'active':
      case 'activa':
        return '#10B981';
      case 'expired':
      case 'vencida':
        return '#EF4444';
      case 'cancelled':
      case 'cancelada':
        return '#6B7280';
      case 'pending':
      case 'pendiente':
        return '#F59E0B';
      default:
        return '#6B7280';
    }
  };

  const getStatusLabel = (estado: string) => {
    switch (estado?.toLowerCase()) {
      case 'active':
        return 'Activa';
      case 'expired':
        return 'Vencida';
      case 'cancelled':
        return 'Cancelada';
      case 'pending':
        return 'Pendiente';
      default:
        return estado || 'N/A';
    }
  };

  const [generatingPdf, setGeneratingPdf] = useState(false);

  const startEditing = () => {
    if (poliza) {
      setEditData({
        numero_poliza: poliza.numero_poliza || '',
        fecha_inicio: poliza.fecha_inicio || '',
        fecha_fin: poliza.fecha_fin || '',
        fecha_expedicion: poliza.fecha_expedicion || '',
        fecha_recepcion: poliza.fecha_recepcion || '',
        prima_neta: poliza.prima_neta || 0,
        prima_total: poliza.prima_total || 0,
        comision: poliza.comision || 0,
        porcentaje_comision: poliza.porcentaje_comision || 0,
        valor_asegurado: poliza.valor_asegurado || 0,
        observaciones: poliza.observaciones || '',
        descripcion: poliza.descripcion || '',
      });
      setIsEditing(true);
    }
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditData({});
  };

  const saveChanges = async () => {
    if (!poliza) return;
    
    setSaving(true);
    try {
      const response = await updatePoliza(poliza.id, editData);
      if (response.success) {
        setPoliza(response.data);
        setIsEditing(false);
        Alert.alert('Éxito', 'Póliza actualizada correctamente');
      } else {
        Alert.alert('Error', response.message || 'Error al actualizar póliza');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof UpdatePolizaData, value: string | number) => {
    setEditData(prev => ({ ...prev, [field]: value }));
  };

  const formatDateStr = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const openDatePicker = (field: 'fecha_inicio' | 'fecha_fin' | 'fecha_expedicion' | 'fecha_recepcion') => {
    setDatePickerField(field);
    const currentVal = editData[field] as string;
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
    updateField(datePickerField, formatDateStr(date));
    if (Platform.OS === 'android') setShowDatePicker(false);
  };

  const confirmIOSDate = () => {
    updateField(datePickerField, formatDateStr(tempDate));
    setShowDatePicker(false);
  };

  const generatePdfResumen = async () => {
    if (!poliza) return;
    
    setGeneratingPdf(true);
    
    try {
      const logoHtml = `<div style="display: flex; align-items: center; gap: 8px;">
                <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #8B5CF6 0%, #635bff 100%); border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                  <span style="color: white; font-size: 20px; font-weight: bold;">G</span>
                </div>
                <span style="font-size: 28px; font-weight: 700; color: #635bff; letter-spacing: -1px;">GURO</span>
              </div>`;
      
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            @page { margin: 0; size: A4; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
              color: #1f2937; 
              background: #fff;
              line-height: 1.5;
            }
            .page { padding: 50px; }
            .header { 
              display: flex; 
              justify-content: space-between; 
              align-items: flex-start; 
              margin-bottom: 40px; 
              padding-bottom: 25px; 
              border-bottom: 2px solid #e5e7eb; 
            }
            .logo-container { display: flex; align-items: center; }
            .header-right { text-align: right; }
            .doc-title { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 5px; }
            .doc-date { font-size: 13px; color: #9ca3af; }
            
            .hero { 
              background: linear-gradient(135deg, #635bff 0%, #8b5cf6 100%); 
              color: white; 
              padding: 30px; 
              border-radius: 16px; 
              margin-bottom: 35px;
              position: relative;
              overflow: hidden;
            }
            .hero::after {
              content: '';
              position: absolute;
              top: -50%;
              right: -20%;
              width: 300px;
              height: 300px;
              background: rgba(255,255,255,0.1);
              border-radius: 50%;
            }
            .hero-content { position: relative; z-index: 1; }
            .poliza-label { font-size: 11px; opacity: 0.8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; }
            .poliza-number { font-size: 32px; font-weight: 700; margin-bottom: 15px; }
            .client-info { display: flex; justify-content: space-between; align-items: flex-end; }
            .client-name { font-size: 18px; font-weight: 500; }
            .client-doc { font-size: 14px; opacity: 0.8; margin-top: 3px; }
            .status-badge { 
              display: inline-block; 
              padding: 8px 20px; 
              border-radius: 30px; 
              font-size: 12px; 
              font-weight: 600; 
              text-transform: uppercase;
              letter-spacing: 1px;
              background: rgba(255,255,255,0.2);
            }
            
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; margin-bottom: 30px; }
            .card { 
              background: #f9fafb; 
              border-radius: 12px; 
              padding: 20px;
            }
            .card-title { 
              font-size: 11px; 
              color: #635bff; 
              text-transform: uppercase; 
              letter-spacing: 1.5px; 
              font-weight: 600;
              margin-bottom: 15px;
              padding-bottom: 10px;
              border-bottom: 1px solid #e5e7eb;
            }
            .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
            .info-row:last-child { border-bottom: none; }
            .info-label { font-size: 12px; color: #6b7280; }
            .info-value { font-size: 13px; font-weight: 600; color: #1f2937; text-align: right; }
            
            .values-section { margin-bottom: 30px; }
            .values-title { 
              font-size: 11px; 
              color: #635bff; 
              text-transform: uppercase; 
              letter-spacing: 1.5px; 
              font-weight: 600;
              margin-bottom: 15px;
            }
            .values-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
            .value-card { 
              background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
              border-radius: 12px; 
              padding: 20px; 
              text-align: center;
            }
            .value-card.highlight { background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); }
            .value-amount { font-size: 20px; font-weight: 700; color: #1f2937; margin-bottom: 5px; }
            .value-card.highlight .value-amount { color: #059669; }
            .value-label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
            
            .notes-section { 
              background: #fffbeb; 
              border-radius: 12px; 
              padding: 20px; 
              margin-bottom: 30px;
              border-left: 4px solid #f59e0b;
            }
            .notes-title { font-size: 12px; font-weight: 600; color: #92400e; margin-bottom: 10px; }
            .notes-text { font-size: 13px; color: #78350f; line-height: 1.6; }
            
            .footer { 
              margin-top: 50px; 
              padding-top: 25px; 
              border-top: 1px solid #e5e7eb; 
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .footer-text { font-size: 11px; color: #9ca3af; }
            .footer-brand { display: flex; align-items: center; gap: 10px; }
            .footer-brand svg { width: 60px; height: 24px; }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="header">
              <div class="logo-container">
                ${logoHtml}
              </div>
              <div class="header-right">
                <div class="doc-title">Resumen de Póliza</div>
                <div class="doc-date">${new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
              </div>
            </div>

            <div class="hero">
              <div class="hero-content">
                <div class="poliza-label">Número de Póliza</div>
                <div class="poliza-number">${poliza.numero_poliza || 'N/A'}</div>
                <div class="client-info">
                  <div>
                    <div class="client-name">${poliza.nombre_completo_cliente || `${poliza.nombres_cliente || ''} ${poliza.apellidos_cliente || ''}`.trim() || 'Cliente no especificado'}</div>
                    <div class="client-doc">${poliza.dni_cliente ? `Doc: ${poliza.dni_cliente}` : ''}</div>
                  </div>
                  <div class="status-badge">${getStatusLabel(poliza.estado)}</div>
                </div>
              </div>
            </div>

            <div class="grid">
              <div class="card">
                <div class="card-title">Información del Seguro</div>
                <div class="info-row">
                  <span class="info-label">Aseguradora</span>
                  <span class="info-value">${poliza.aseguradora || 'N/A'}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Ramo</span>
                  <span class="info-value">${poliza.ramo_nombre || poliza.ramo_principal || 'N/A'}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Producto</span>
                  <span class="info-value">${poliza.subramo || poliza.tipo_poliza || 'N/A'}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Asesor</span>
                  <span class="info-value">${poliza.vendedor || 'N/A'}</span>
                </div>
              </div>

              <div class="card">
                <div class="card-title">Vigencia</div>
                <div class="info-row">
                  <span class="info-label">Fecha Inicio</span>
                  <span class="info-value">${poliza.fecha_inicio || 'N/A'}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Fecha Fin</span>
                  <span class="info-value">${poliza.fecha_fin || 'N/A'}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Expedición</span>
                  <span class="info-value">${poliza.fecha_expedicion || 'N/A'}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Recepción</span>
                  <span class="info-value">${poliza.fecha_recepcion || 'N/A'}</span>
                </div>
              </div>
            </div>

            <div class="values-section">
              <div class="values-title">Valores de la Póliza</div>
              <div class="values-grid">
                <div class="value-card">
                  <div class="value-amount">${formatCurrency(poliza.prima_neta)}</div>
                  <div class="value-label">Prima Neta</div>
                </div>
                <div class="value-card">
                  <div class="value-amount">${formatCurrency(poliza.total || poliza.prima_total)}</div>
                  <div class="value-label">Prima Total</div>
                </div>
                <div class="value-card highlight">
                  <div class="value-amount">${formatCurrency(poliza.comision)}</div>
                  <div class="value-label">Comisión (${poliza.porcentaje_comision || 0}%)</div>
                </div>
              </div>
            </div>

            ${poliza.valor_riesgo_asegurado ? `
            <div class="card" style="margin-bottom: 30px;">
              <div class="card-title">Valor Asegurado</div>
              <div style="font-size: 24px; font-weight: 700; color: #635bff;">${formatCurrency(poliza.valor_riesgo_asegurado)}</div>
            </div>
            ` : ''}

            ${poliza.riesgo || poliza.observaciones ? `
            <div class="notes-section">
              ${poliza.riesgo ? `<div class="notes-title">Descripción del Riesgo</div><div class="notes-text">${poliza.riesgo}</div>` : ''}
              ${poliza.riesgo && poliza.observaciones ? '<div style="height: 15px;"></div>' : ''}
              ${poliza.observaciones ? `<div class="notes-title">Observaciones</div><div class="notes-text">${poliza.observaciones}</div>` : ''}
            </div>
            ` : ''}

            <div class="footer">
              <div class="footer-text">Documento generado automáticamente • www.guro.co</div>
              <div class="footer-brand">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <div style="width: 20px; height: 20px; background: linear-gradient(135deg, #8B5CF6 0%, #635bff 100%); border-radius: 4px; display: flex; align-items: center; justify-content: center;">
                    <span style="color: white; font-size: 12px; font-weight: bold;">G</span>
                  </div>
                  <span style="font-size: 16px; font-weight: 700; color: #635bff;">GURO</span>
                </div>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Resumen de Póliza',
          UTI: 'com.adobe.pdf'
        });
      } else {
        Alert.alert('Éxito', 'PDF generado correctamente');
      }
    } catch (error) {
      console.log('Error generating PDF:', error);
      Alert.alert('Error', 'No se pudo generar el PDF');
    } finally {
      setGeneratingPdf(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
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
          <Text style={styles.headerTitle}>Detalle de Póliza</Text>
          <View style={styles.headerPlaceholder} />
        </ImageBackground>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchPoliza}>
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
        <Text style={styles.headerTitle}>{isEditing ? 'Editar Póliza' : 'Detalle de Póliza'}</Text>
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
      </ImageBackground>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          !isEditing ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#573CFF']} /> : undefined
        }
      >
        {isEditing ? (
          <>
            {/* Formulario de Edición */}
            <Text style={styles.sectionTitle}>Número de Póliza</Text>
            <View style={styles.editFormCard}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Número de Póliza</Text>
                <TextInput
                  style={styles.textInput}
                  value={editData.numero_poliza}
                  onChangeText={(text) => updateField('numero_poliza', text)}
                  placeholder="Número de póliza"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>

            <Text style={styles.sectionTitle}>Fechas</Text>
            <View style={styles.editFormCard}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Fecha Inicio</Text>
                <TouchableOpacity style={styles.dateField} onPress={() => openDatePicker('fecha_inicio')}>
                  <Text style={editData.fecha_inicio ? styles.dateFieldText : styles.dateFieldPlaceholder}>
                    {editData.fecha_inicio || 'Seleccionar fecha'}
                  </Text>
                  <Ionicons name="calendar-outline" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Fecha Fin</Text>
                <TouchableOpacity style={styles.dateField} onPress={() => openDatePicker('fecha_fin')}>
                  <Text style={editData.fecha_fin ? styles.dateFieldText : styles.dateFieldPlaceholder}>
                    {editData.fecha_fin || 'Seleccionar fecha'}
                  </Text>
                  <Ionicons name="calendar-outline" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Fecha Expedición</Text>
                <TouchableOpacity style={styles.dateField} onPress={() => openDatePicker('fecha_expedicion')}>
                  <Text style={editData.fecha_expedicion ? styles.dateFieldText : styles.dateFieldPlaceholder}>
                    {editData.fecha_expedicion || 'Seleccionar fecha'}
                  </Text>
                  <Ionicons name="calendar-outline" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Fecha Recepción</Text>
                <TouchableOpacity style={styles.dateField} onPress={() => openDatePicker('fecha_recepcion')}>
                  <Text style={editData.fecha_recepcion ? styles.dateFieldText : styles.dateFieldPlaceholder}>
                    {editData.fecha_recepcion || 'Seleccionar fecha'}
                  </Text>
                  <Ionicons name="calendar-outline" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Valores</Text>
            <View style={styles.editFormCard}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Prima Neta</Text>
                <TextInput
                  style={styles.textInput}
                  value={String(editData.prima_neta || '')}
                  onChangeText={(text) => updateField('prima_neta', parseFloat(text) || 0)}
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Prima Total</Text>
                <TextInput
                  style={styles.textInput}
                  value={String(editData.prima_total || '')}
                  onChangeText={(text) => updateField('prima_total', parseFloat(text) || 0)}
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Comisión</Text>
                <TextInput
                  style={styles.textInput}
                  value={String(editData.comision || '')}
                  onChangeText={(text) => updateField('comision', parseFloat(text) || 0)}
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>% Comisión</Text>
                <TextInput
                  style={styles.textInput}
                  value={String(editData.porcentaje_comision || '')}
                  onChangeText={(text) => updateField('porcentaje_comision', parseFloat(text) || 0)}
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Valor Asegurado</Text>
                <TextInput
                  style={styles.textInput}
                  value={String(editData.valor_asegurado || '')}
                  onChangeText={(text) => updateField('valor_asegurado', parseFloat(text) || 0)}
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                />
              </View>
            </View>

            <Text style={styles.sectionTitle}>Descripción del Riesgo</Text>
            <View style={styles.editFormCard}>
              <View style={[styles.inputGroup, { marginBottom: 0 }]}>
                <TextInput
                  style={styles.textInputMultiline}
                  value={editData.descripcion}
                  onChangeText={(text) => updateField('descripcion', text)}
                  placeholder="Descripción del riesgo asegurado..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={4}
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
                  placeholder="Observaciones adicionales..."
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
        <View style={styles.mainCard}>
          <View style={styles.mainCardHeader}>
            <Text style={styles.polizaNumber}>{poliza?.numero_poliza || 'Sin número'}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(poliza?.estado) }]}>
              <Text style={styles.statusText}>{getStatusLabel(poliza?.estado)}</Text>
            </View>
          </View>
          <Text style={styles.clientName}>{poliza?.nombre_completo_cliente || `${poliza?.nombres_cliente || ''} ${poliza?.apellidos_cliente || ''}`.trim() || 'Cliente no especificado'}</Text>
          <Text style={styles.clientDocument}>{poliza?.dni_cliente || poliza?.cliente_documento || ''}</Text>
        </View>

        {/* Información General */}
        <Text style={styles.sectionTitle}>Información General</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Aseguradora</Text>
              <Text style={styles.infoValue}>{poliza?.aseguradora || 'N/A'}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Ramo</Text>
              <Text style={styles.infoValue}>{poliza?.ramo_nombre || poliza?.ramo_principal || poliza?.ramo || 'N/A'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Subramo</Text>
              <Text style={styles.infoValue}>{poliza?.subramo || poliza?.tipo_poliza || 'N/A'}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Vendedor</Text>
              <Text style={styles.infoValue}>{poliza?.vendedor || 'N/A'}</Text>
            </View>
          </View>
        </View>

        {/* Fechas */}
        <Text style={styles.sectionTitle}>Fechas</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Fecha Inicio</Text>
              <Text style={styles.infoValue}>{poliza?.fecha_inicio || 'N/A'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Fecha Fin</Text>
              <Text style={styles.infoValue}>{poliza?.fecha_fin || 'N/A'}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Fecha Expedición</Text>
              <Text style={styles.infoValue}>{poliza?.fecha_expedicion || 'N/A'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Fecha Recepción</Text>
              <Text style={styles.infoValue}>{poliza?.fecha_recepcion || 'N/A'}</Text>
            </View>
          </View>
        </View>

        {/* Valores */}
        <Text style={styles.sectionTitle}>Valores</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Prima Neta</Text>
              <Text style={[styles.infoValue, styles.valueHighlight]}>
                {formatCurrency(poliza?.prima_neta)}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Prima Total</Text>
              <Text style={styles.infoValue}>{formatCurrency(poliza?.prima_total)}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Comisión</Text>
              <Text style={[styles.infoValue, styles.valueSuccess]}>
                {formatCurrency(poliza?.comision)}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>% Comisión</Text>
              <Text style={styles.infoValue}>{poliza?.porcentaje_comision || 0}%</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Valor Asegurado</Text>
              <Text style={styles.infoValue}>{formatCurrency(poliza?.valor_asegurado)}</Text>
            </View>
          </View>
        </View>

        {/* Descripción / Riesgo */}
        {poliza?.descripcion && (
          <>
            <Text style={styles.sectionTitle}>Descripción del Riesgo</Text>
            <View style={styles.infoCard}>
              <Text style={styles.descriptionText}>{poliza.descripcion}</Text>
            </View>
          </>
        )}

        {/* Observaciones */}
        {poliza?.observaciones && (
          <>
            <Text style={styles.sectionTitle}>Observaciones</Text>
            <View style={styles.infoCard}>
              <Text style={styles.descriptionText}>{poliza.observaciones}</Text>
            </View>
          </>
        )}

        {/* Documentos */}
        <Text style={styles.sectionTitle}>Documentos</Text>
        {loadingDocs ? (
          <View style={styles.docsLoading}>
            <ActivityIndicator size="small" color="#573CFF" />
            <Text style={styles.docsLoadingText}>Cargando documentos...</Text>
          </View>
        ) : documents.length > 0 ? (
          <View style={styles.documentsCard}>
            {documents.map((doc, index) => {
              const iconName = getDocIcon(doc.contentType);
              const iconColor = getDocIconColor(doc.contentType);
              const isOpening = openingDoc === doc.path;
              return (
                <TouchableOpacity
                  key={`${doc.path}-${index}`}
                  style={[styles.documentItem, index === documents.length - 1 && { borderBottomWidth: 0 }]}
                  onPress={() => openDocument(doc)}
                  disabled={isOpening}
                  activeOpacity={0.7}
                >
                  <View style={[styles.documentIconContainer, { backgroundColor: `${iconColor}15` }]}>
                    <Ionicons name={iconName as any} size={22} color={iconColor} />
                  </View>
                  <View style={styles.documentInfo}>
                    <Text style={styles.documentName} numberOfLines={1}>{doc.name}</Text>
                    <Text style={styles.documentMeta}>
                      {doc.type && doc.type !== 'otro' ? `${doc.type} · ` : ''}
                      {formatFileSize(doc.size)}
                      {doc.uploaded_at ? ` · ${new Date(doc.uploaded_at).toLocaleDateString('es-CO')}` : ''}
                    </Text>
                  </View>
                  {isOpening ? (
                    <ActivityIndicator size="small" color="#573CFF" />
                  ) : (
                    <Ionicons name="open-outline" size={18} color="#9CA3AF" />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.noDocsContainer}>
            <Ionicons name="folder-open-outline" size={36} color="#D1D5DB" />
            <Text style={styles.noDocsText}>Sin documentos adjuntos</Text>
          </View>
        )}

        {/* Botón Generar PDF */}
        <TouchableOpacity 
          style={styles.pdfButton} 
          onPress={generatePdfResumen}
          disabled={generatingPdf}
        >
          {generatingPdf ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="document-text-outline" size={22} color="#FFFFFF" />
              <Text style={styles.pdfButtonText}>Generar Resumen PDF</Text>
            </>
          )}
        </TouchableOpacity>
          </>
        )}

      </ScrollView>

      {/* Date Picker */}
      {showDatePicker && Platform.OS === 'ios' && (
        <Modal transparent animationType="slide">
          <View style={styles.datePickerOverlay}>
            <View style={styles.datePickerContainer}>
              <View style={styles.datePickerHeader}>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text style={styles.datePickerAction}>Cancelar</Text>
                </TouchableOpacity>
                <Text style={styles.datePickerTitle}>
                  {datePickerField === 'fecha_inicio' ? 'Fecha Inicio' : datePickerField === 'fecha_fin' ? 'Fecha Fin' : datePickerField === 'fecha_expedicion' ? 'Fecha Expedición' : 'Fecha Recepción'}
                </Text>
                <TouchableOpacity onPress={confirmIOSDate}>
                  <Text style={styles.datePickerAction}>Listo</Text>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 120,
  },
  mainCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  mainCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  polizaNumber: {
    fontSize: 20,
    fontFamily: 'Montserrat_700Bold',
    color: '#573CFF',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#FFFFFF',
  },
  clientName: {
    fontSize: 18,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#374151',
  },
  clientDocument: {
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
    color: '#6B7280',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#374151',
    marginBottom: 12,
    marginTop: 8,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoItem: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#9CA3AF',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 15,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#374151',
  },
  valueHighlight: {
    color: '#573CFF',
  },
  valueSuccess: {
    color: '#10B981',
  },
  descriptionText: {
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
    color: '#374151',
    lineHeight: 22,
  },
  documentsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  documentIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#573CFF15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  documentInfo: {
    flex: 1,
    marginLeft: 12,
  },
  documentName: {
    fontSize: 14,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#374151',
  },
  documentMeta: {
    fontSize: 12,
    fontFamily: 'Montserrat_400Regular',
    color: '#9CA3AF',
    marginTop: 2,
  },
  docsLoading: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
  },
  docsLoadingText: {
    marginTop: 8,
    fontSize: 13,
    fontFamily: 'Montserrat_400Regular',
    color: '#9CA3AF',
  },
  noDocsContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  noDocsText: {
    marginTop: 8,
    fontSize: 14,
    fontFamily: 'Montserrat_500Medium',
    color: '#D1D5DB',
  },
  pdfButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#573CFF',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    marginTop: 20,
    marginBottom: 20,
    shadowColor: '#573CFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  pdfButtonText: {
    fontSize: 16,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#FFFFFF',
    marginLeft: 10,
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
    marginBottom: 16,
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
  dateField: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dateFieldText: {
    fontSize: 15,
    fontFamily: 'Montserrat_500Medium',
    color: '#374151',
  },
  dateFieldPlaceholder: {
    fontSize: 15,
    fontFamily: 'Montserrat_500Medium',
    color: '#9CA3AF',
  },
  datePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  datePickerContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  datePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  datePickerTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#1F2937',
  },
  datePickerAction: {
    fontSize: 16,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#573CFF',
  },
});

export default PolizaDetailScreen;
