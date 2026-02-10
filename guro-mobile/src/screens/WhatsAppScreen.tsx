import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  ImageBackground,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getConversations, WhatsAppConversation } from '../services/whatsappService';
import { RootStackParamList } from '../navigation/AppNavigator';
import LoadingSpinner from '../components/LoadingSpinner';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const WhatsAppScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchConversations = useCallback(async (pageNum: number = 1, isRefresh: boolean = false, isPolling: boolean = false) => {
    try {
      if (!isPolling) setError(null);
      const response = await getConversations({ 
        page: pageNum, 
        per_page: 20,
        search: search || undefined 
      });
      console.log('Conversations response:', JSON.stringify(response.data?.[0], null, 2));
      
      if (isRefresh || pageNum === 1) {
        setConversations(response.data || []);
      } else {
        setConversations(prev => [...prev, ...(response.data || [])]);
      }
      setHasMore(response.current_page < response.last_page);
      setPage(response.current_page);
    } catch (err: any) {
      if (!isPolling) setError(err.message || 'Error de conexión');
    } finally {
      if (!isPolling) {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    }
  }, [search]);

  // Initial fetch
  useEffect(() => {
    fetchConversations(1);
  }, [fetchConversations]);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchConversations(1, false, true);
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchConversations]);

  const onRefresh = () => {
    setRefreshing(true);
    setPage(1);
    fetchConversations(1, true);
  };

  const onSearch = () => {
    setLoading(true);
    setPage(1);
    fetchConversations(1, true);
  };

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      setLoadingMore(true);
      fetchConversations(page + 1);
    }
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Ayer';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('es-CO', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'open':
      case 'active':
        return '#10B981';
      case 'pending':
        return '#F59E0B';
      case 'closed':
      case 'resolved':
        return '#6B7280';
      default:
        return '#573CFF';
    }
  };

  const getContactName = (conversation: WhatsAppConversation) => {
    return conversation.contact_name || conversation.contact_push_name || conversation.phone || 'Sin nombre';
  };

  const handleConversationPress = (conversation: WhatsAppConversation) => {
    navigation.navigate('WhatsAppChat', {
      conversationId: conversation.id,
      contactName: getContactName(conversation),
      phone: conversation.phone,
    });
  };

  const renderConversation = ({ item }: { item: WhatsAppConversation }) => (
    <TouchableOpacity style={styles.conversationCard} onPress={() => handleConversationPress(item)}>
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={24} color="#573CFF" />
        </View>
        {item.unread_count > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>
              {item.unread_count > 99 ? '99+' : item.unread_count}
            </Text>
          </View>
        )}
      </View>
      
      <View style={styles.conversationInfo}>
        <View style={styles.conversationHeader}>
          <Text style={styles.contactName} numberOfLines={1}>
            {getContactName(item)}
          </Text>
          <Text style={styles.timeText}>{formatTime(item.last_message_at)}</Text>
        </View>
        
        <View style={styles.conversationPreview}>
          {(() => {
            const lastMsg = item.latest_message || item.last_message || item.lastMessage;
            const msgType = lastMsg?.message_type || lastMsg?.type;
            const content = item.last_message_preview || lastMsg?.content || 'Sin mensajes';
            
            if (msgType === 'audio') {
              return (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="mic" size={14} color="#9CA3AF" style={{ marginRight: 4 }} />
                  <Text style={[styles.previewText, item.unread_count > 0 && styles.previewTextUnread]} numberOfLines={1}>
                    Audio
                  </Text>
                </View>
              );
            }
            if (msgType === 'image') {
              return (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="camera" size={14} color="#9CA3AF" style={{ marginRight: 4 }} />
                  <Text style={[styles.previewText, item.unread_count > 0 && styles.previewTextUnread]} numberOfLines={1}>
                    Foto
                  </Text>
                </View>
              );
            }
            if (msgType === 'document') {
              return (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="document" size={14} color="#9CA3AF" style={{ marginRight: 4 }} />
                  <Text style={[styles.previewText, item.unread_count > 0 && styles.previewTextUnread]} numberOfLines={1}>
                    Documento
                  </Text>
                </View>
              );
            }
            if (msgType === 'video') {
              return (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="videocam" size={14} color="#9CA3AF" style={{ marginRight: 4 }} />
                  <Text style={[styles.previewText, item.unread_count > 0 && styles.previewTextUnread]} numberOfLines={1}>
                    Video
                  </Text>
                </View>
              );
            }
            return (
              <Text style={[styles.previewText, item.unread_count > 0 && styles.previewTextUnread]} numberOfLines={1}>
                {content}
              </Text>
            );
          })()}
        </View>
        
        <View style={styles.conversationMeta}>
          {item.department && (
            <View style={[styles.departmentBadge, { backgroundColor: (item.department.color || '#573CFF') + '20' }]}>
              <Text style={[styles.departmentText, { color: item.department.color || '#573CFF' }]}>
                {item.department.name}
              </Text>
            </View>
          )}
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading && !refreshing) {
    return <LoadingSpinner />;
  }

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
        <Text style={styles.headerTitle}>WhatsApp Inbox</Text>
        <View style={styles.headerPlaceholder} />
      </ImageBackground>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search-outline" size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar conversación..."
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={onSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => { setSearch(''); onSearch(); }}>
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="chatbubbles-outline" size={48} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchConversations(1, true)}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderConversation}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#573CFF']} />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.loadingMore}>
                <ActivityIndicator size="small" color="#573CFF" />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={64} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>Sin conversaciones</Text>
              <Text style={styles.emptyText}>No hay conversaciones de WhatsApp</Text>
            </View>
          }
        />
      )}
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
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#374151',
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
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  conversationCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#573CFF15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#573CFF',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  unreadText: {
    fontSize: 10,
    fontFamily: 'Montserrat_700Bold',
    color: '#FFFFFF',
  },
  conversationInfo: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  contactName: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#374151',
    marginRight: 8,
  },
  timeText: {
    fontSize: 11,
    fontFamily: 'Montserrat_400Regular',
    color: '#9CA3AF',
  },
  conversationPreview: {
    marginBottom: 6,
  },
  previewText: {
    fontSize: 13,
    fontFamily: 'Montserrat_400Regular',
    color: '#6B7280',
  },
  previewTextUnread: {
    fontFamily: 'Montserrat_600SemiBold',
    color: '#374151',
  },
  conversationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  departmentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  departmentText: {
    fontSize: 10,
    fontFamily: 'Montserrat_500Medium',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  loadingMore: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 18,
    fontFamily: 'Montserrat_700Bold',
    color: '#374151',
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
    color: '#9CA3AF',
  },
});

export default WhatsAppScreen;
