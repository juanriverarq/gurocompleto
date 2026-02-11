import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ScrollView,
  TextInput,
  ActivityIndicator,
  ImageBackground,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { getConversationMessages, WhatsAppMessage } from '../services/whatsappService';

type ProfileRouteParams = {
  WhatsAppContactProfile: {
    conversationId: number;
    contactName: string;
    phone: string;
  };
};

const NGROK_URL = 'https://hookless-kaylynn-greasily.ngrok-free.dev';

const getAccessibleMediaUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  const match = url.match(/whatsapp-media\/([^?]+)/);
  if (match) return `${NGROK_URL}/api/media/${match[1]}`;
  if (url.startsWith('/')) return NGROK_URL + url;
  if (url.includes('192.168.') || url.includes('localhost') || url.includes('127.0.0.1')) {
    return url.replace(/https?:\/\/(192\.168\.\d+\.\d+|localhost|127\.0\.0\.1)(:\d+)?/, NGROK_URL);
  }
  return url;
};

type TabType = 'media' | 'docs' | 'search';

const WhatsAppContactProfileScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<ProfileRouteParams, 'WhatsAppContactProfile'>>();
  const { conversationId, contactName, phone } = route.params;

  const [activeTab, setActiveTab] = useState<TabType>('media');
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchAllMessages = useCallback(async () => {
    try {
      const response = await getConversationMessages(conversationId, { per_page: 500 });
      const data = response.data || [];
      const mapped = data.map((msg: any) => ({
        ...msg,
        from_me: msg.direction === 'outgoing',
        type: msg.message_type || msg.type || 'text',
        body: msg.content || msg.body || '',
        media_url: msg.media?.url || msg.media_url || null,
      }));
      setMessages(mapped);
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    fetchAllMessages();
  }, [fetchAllMessages]);

  const mediaMessages = messages.filter(m => m.type === 'image');
  const docMessages = messages.filter(m => m.type === 'document');
  const audioMessages = messages.filter(m => m.type === 'audio');
  const filteredMessages = searchQuery.trim()
    ? messages.filter(m => (m.body || '').toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const renderMediaItem = ({ item }: { item: WhatsAppMessage }) => {
    const url = getAccessibleMediaUrl(item.media_url || (item as any).media?.url);
    if (!url) return null;
    return (
      <TouchableOpacity style={styles.mediaItem}>
        <Image source={{ uri: url }} style={styles.mediaThumb} resizeMode="cover" />
      </TouchableOpacity>
    );
  };

  const renderDocItem = ({ item }: { item: WhatsAppMessage }) => {
    const filename = (item as any).media?.filename || item.body || 'Documento';
    return (
      <View style={styles.docItem}>
        <View style={styles.docIconContainer}>
          <Ionicons name="document-text" size={24} color="#573CFF" />
        </View>
        <View style={styles.docInfo}>
          <Text style={styles.docName} numberOfLines={1}>{filename}</Text>
          <Text style={styles.docDate}>{formatDate(item.created_at)}</Text>
        </View>
      </View>
    );
  };

  const renderAudioItem = ({ item }: { item: WhatsAppMessage }) => {
    return (
      <View style={styles.docItem}>
        <View style={[styles.docIconContainer, { backgroundColor: '#FEF3C7' }]}>
          <Ionicons name="mic" size={24} color="#F59E0B" />
        </View>
        <View style={styles.docInfo}>
          <Text style={styles.docName}>Nota de voz</Text>
          <Text style={styles.docDate}>{formatDate(item.created_at)}</Text>
        </View>
      </View>
    );
  };

  const renderSearchResult = ({ item }: { item: WhatsAppMessage }) => {
    return (
      <View style={styles.searchResultItem}>
        <View style={styles.searchResultHeader}>
          <Text style={styles.searchResultSender}>{item.from_me ? 'Tú' : contactName}</Text>
          <Text style={styles.searchResultDate}>{formatDate(item.created_at)}</Text>
        </View>
        <Text style={styles.searchResultText} numberOfLines={3}>{item.body}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <ImageBackground
        source={require('../../assets/backgrounds/hero-gradient.webp')}
        style={styles.header}
        imageStyle={{ transform: [{ scale: 2 }] }}
        resizeMode="cover"
      >
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Info del contacto</Text>
      </ImageBackground>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarLargeText}>{(contactName || '?')[0].toUpperCase()}</Text>
          </View>
          <Text style={styles.profileName}>{contactName}</Text>
          <Text style={styles.profilePhone}>{phone}</Text>
          
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{messages.length}</Text>
              <Text style={styles.statLabel}>Mensajes</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{mediaMessages.length}</Text>
              <Text style={styles.statLabel}>Fotos</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{audioMessages.length}</Text>
              <Text style={styles.statLabel}>Audios</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{docMessages.length}</Text>
              <Text style={styles.statLabel}>Docs</Text>
            </View>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'media' && styles.tabActive]}
            onPress={() => setActiveTab('media')}
          >
            <Ionicons name="image" size={18} color={activeTab === 'media' ? '#573CFF' : '#9CA3AF'} />
            <Text style={[styles.tabText, activeTab === 'media' && styles.tabTextActive]}>Media</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'docs' && styles.tabActive]}
            onPress={() => setActiveTab('docs')}
          >
            <Ionicons name="document" size={18} color={activeTab === 'docs' ? '#573CFF' : '#9CA3AF'} />
            <Text style={[styles.tabText, activeTab === 'docs' && styles.tabTextActive]}>Docs</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'search' && styles.tabActive]}
            onPress={() => setActiveTab('search')}
          >
            <Ionicons name="search" size={18} color={activeTab === 'search' ? '#573CFF' : '#9CA3AF'} />
            <Text style={[styles.tabText, activeTab === 'search' && styles.tabTextActive]}>Buscar</Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#573CFF" />
          </View>
        ) : (
          <View style={styles.tabContent}>
            {activeTab === 'media' && (
              mediaMessages.length > 0 ? (
                <FlatList
                  data={mediaMessages}
                  renderItem={renderMediaItem}
                  keyExtractor={(item) => item.id.toString()}
                  numColumns={3}
                  scrollEnabled={false}
                  contentContainerStyle={styles.mediaGrid}
                />
              ) : (
                <View style={styles.emptyTab}>
                  <Ionicons name="image-outline" size={48} color="#D1D5DB" />
                  <Text style={styles.emptyTabText}>No hay fotos</Text>
                </View>
              )
            )}

            {activeTab === 'docs' && (
              [...docMessages, ...audioMessages].length > 0 ? (
                <View>
                  {docMessages.length > 0 && (
                    <FlatList
                      data={docMessages}
                      renderItem={renderDocItem}
                      keyExtractor={(item) => item.id.toString()}
                      scrollEnabled={false}
                    />
                  )}
                  {audioMessages.length > 0 && (
                    <>
                      <Text style={styles.sectionTitle}>Notas de voz</Text>
                      <FlatList
                        data={audioMessages}
                        renderItem={renderAudioItem}
                        keyExtractor={(item) => item.id.toString()}
                        scrollEnabled={false}
                      />
                    </>
                  )}
                </View>
              ) : (
                <View style={styles.emptyTab}>
                  <Ionicons name="document-outline" size={48} color="#D1D5DB" />
                  <Text style={styles.emptyTabText}>No hay documentos</Text>
                </View>
              )
            )}

            {activeTab === 'search' && (
              <View>
                <View style={styles.searchInputContainer}>
                  <Ionicons name="search" size={18} color="#9CA3AF" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Buscar en mensajes..."
                    placeholderTextColor="#9CA3AF"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoFocus
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                    </TouchableOpacity>
                  )}
                </View>
                {searchQuery.trim() ? (
                  filteredMessages.length > 0 ? (
                    <FlatList
                      data={filteredMessages}
                      renderItem={renderSearchResult}
                      keyExtractor={(item) => item.id.toString()}
                      scrollEnabled={false}
                    />
                  ) : (
                    <View style={styles.emptyTab}>
                      <Ionicons name="search-outline" size={48} color="#D1D5DB" />
                      <Text style={styles.emptyTabText}>Sin resultados</Text>
                    </View>
                  )
                ) : (
                  <View style={styles.emptyTab}>
                    <Ionicons name="chatbubbles-outline" size={48} color="#D1D5DB" />
                    <Text style={styles.emptyTabText}>Escribe para buscar mensajes</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F2F5',
  },
  header: {
    paddingTop: 54,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
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
    marginLeft: 12,
  },
  content: {
    flex: 1,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#573CFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#573CFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  avatarLargeText: {
    fontSize: 32,
    fontFamily: 'Montserrat_700Bold',
    color: '#FFFFFF',
  },
  profileName: {
    fontSize: 20,
    fontFamily: 'Montserrat_700Bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  profilePhone: {
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
    color: '#6B7280',
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 10,
    width: '100%',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontFamily: 'Montserrat_700Bold',
    color: '#573CFF',
  },
  statLabel: {
    fontSize: 11,
    fontFamily: 'Montserrat_500Medium',
    color: '#9CA3AF',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E5E7EB',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingTop: 4,
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#573CFF',
  },
  tabText: {
    fontSize: 13,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#9CA3AF',
  },
  tabTextActive: {
    color: '#573CFF',
  },
  tabContent: {
    backgroundColor: '#FFFFFF',
    minHeight: 300,
    paddingBottom: 40,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  mediaGrid: {
    padding: 2,
  },
  mediaItem: {
    flex: 1 / 3,
    aspectRatio: 1,
    padding: 2,
  },
  mediaThumb: {
    flex: 1,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
  },
  docItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  docIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  docInfo: {
    flex: 1,
    marginLeft: 12,
  },
  docName: {
    fontSize: 14,
    fontFamily: 'Montserrat_500Medium',
    color: '#374151',
  },
  docDate: {
    fontSize: 12,
    fontFamily: 'Montserrat_400Regular',
    color: '#9CA3AF',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#6B7280',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  emptyTab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTabText: {
    fontSize: 14,
    fontFamily: 'Montserrat_500Medium',
    color: '#9CA3AF',
    marginTop: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Montserrat_400Regular',
    color: '#374151',
    marginLeft: 8,
  },
  searchResultItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  searchResultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  searchResultSender: {
    fontSize: 13,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#573CFF',
  },
  searchResultDate: {
    fontSize: 11,
    fontFamily: 'Montserrat_400Regular',
    color: '#9CA3AF',
  },
  searchResultText: {
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
    color: '#374151',
    lineHeight: 20,
  },
});

export default WhatsAppContactProfileScreen;
