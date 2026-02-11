import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getPendingPolicies, PolicyNotification } from '../services/notificationService';

const { height: screenHeight } = Dimensions.get('window');

interface NotificationsPopupProps {
  visible: boolean;
  onClose: () => void;
}

const NotificationsPopup: React.FC<NotificationsPopupProps> = ({ visible, onClose }) => {
  const [notifications, setNotifications] = useState<PolicyNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      fetchNotifications();
    }
  }, [visible]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getPendingPolicies();
      setNotifications(data);
    } catch (err: any) {
      console.error('Error fetching notifications:', err);
      setError('No se pudieron cargar las notificaciones');
    } finally {
      setLoading(false);
    }
  };

  const getNotificationIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case 'expiry_warning':
      case 'expiry':
        return 'calendar-outline';
      case 'renewal':
        return 'refresh-outline';
      case 'payment':
        return 'card-outline';
      default:
        return 'notifications-outline';
    }
  };

  const getNotificationColor = (daysUntilExpiry: number): string => {
    if (daysUntilExpiry <= 7) return '#EF4444';
    if (daysUntilExpiry <= 15) return '#F59E0B';
    if (daysUntilExpiry <= 30) return '#3B82F6';
    return '#10B981';
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const renderNotification = ({ item }: { item: PolicyNotification }) => {
    const color = getNotificationColor(item.days_until_expiry);
    
    return (
      <TouchableOpacity style={styles.notificationItem}>
        <View style={[styles.notificationIcon, { backgroundColor: color + '20' }]}>
          <Ionicons name={getNotificationIcon(item.notification_type)} size={20} color={color} />
        </View>
        <View style={styles.notificationContent}>
          <Text style={styles.notificationTitle} numberOfLines={1}>
            {item.client_name}
          </Text>
          <Text style={styles.notificationSubtitle} numberOfLines={1}>
            Póliza {item.policy_number}
          </Text>
          <View style={styles.notificationMeta}>
            <View style={[styles.daysTag, { backgroundColor: color + '20' }]}>
              <Text style={[styles.daysText, { color }]}>
                {item.days_until_expiry <= 0 
                  ? 'Vencida' 
                  : `${item.days_until_expiry} días`}
              </Text>
            </View>
            <Text style={styles.dateText}>{formatDate(item.expiry_date)}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIcon}>
        <Ionicons name="notifications-off-outline" size={48} color="#9CA3AF" />
      </View>
      <Text style={styles.emptyTitle}>Sin notificaciones</Text>
      <Text style={styles.emptyText}>
        No tienes pólizas próximas a vencer en este momento.
      </Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.overlayBackground} onPress={onClose} />
        <View style={styles.popup}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="notifications" size={22} color="#573CFF" />
              <Text style={styles.headerTitle}>Notificaciones</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Handle */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Content */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#573CFF" />
              <Text style={styles.loadingText}>Cargando notificaciones...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={fetchNotifications}>
                <Text style={styles.retryText}>Reintentar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={notifications}
              renderItem={renderNotification}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={renderEmpty}
              showsVerticalScrollIndicator={false}
            />
          )}

          {/* Footer */}
          {!loading && notifications.length > 0 && (
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                {notifications.length} póliza{notifications.length !== 1 ? 's' : ''} próxima{notifications.length !== 1 ? 's' : ''} a vencer
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlayBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  popup: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: screenHeight * 0.75,
    minHeight: screenHeight * 0.4,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Montserrat_700Bold',
    color: '#1F2937',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontFamily: 'Montserrat_500Medium',
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    fontFamily: 'Montserrat_500Medium',
    color: '#6B7280',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#573CFF',
    borderRadius: 8,
  },
  retryText: {
    fontSize: 14,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  notificationIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 14,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#1F2937',
    marginBottom: 2,
  },
  notificationSubtitle: {
    fontSize: 12,
    fontFamily: 'Montserrat_400Regular',
    color: '#6B7280',
    marginBottom: 6,
  },
  notificationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  daysTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  daysText: {
    fontSize: 11,
    fontFamily: 'Montserrat_600SemiBold',
  },
  dateText: {
    fontSize: 11,
    fontFamily: 'Montserrat_400Regular',
    color: '#9CA3AF',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    fontFamily: 'Montserrat_500Medium',
    color: '#6B7280',
  },
});

export default NotificationsPopup;
