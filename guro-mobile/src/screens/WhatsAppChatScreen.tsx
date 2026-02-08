import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  Image,
  Alert,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { getConversationMessages, sendMessage, sendMediaMessage, WhatsAppMessage } from '../services/whatsappService';
import LoadingSpinner from '../components/LoadingSpinner';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';

type ChatRouteParams = {
  WhatsAppChat: {
    conversationId: number;
    contactName: string;
    phone: string;
  };
};

const WhatsAppChatScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<ChatRouteParams, 'WhatsAppChat'>>();
  const { conversationId, contactName, phone } = route.params;
  
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const recordingInterval = useRef<NodeJS.Timeout | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedMsgId, setHighlightedMsgId] = useState<number | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<number | null>(null);
  const [audioProgress, setAudioProgress] = useState<number>(0);
  const [audioDurationMs, setAudioDurationMs] = useState<number>(0);
  const [audioPositionMs, setAudioPositionMs] = useState<number>(0);
  const [audioSpeed, setAudioSpeed] = useState<number>(1);
  const soundRef = useRef<Audio.Sound | null>(null);

  const lastMsgCountRef = useRef(0);

  const fetchMessages = useCallback(async (isPolling = false) => {
    try {
      if (!isPolling) setError(null);
      const response = await getConversationMessages(conversationId, { per_page: 100 });
      const messagesData = response.data || [];
      
      // Skip update if same count on polling (avoid unnecessary re-renders)
      if (isPolling && messagesData.length === lastMsgCountRef.current) return;
      lastMsgCountRef.current = messagesData.length;

      const mappedMessages = messagesData.map((msg: any) => ({
        ...msg,
        from_me: msg.direction === 'outgoing',
        body: msg.content || msg.body || '',
        type: msg.message_type || msg.type || 'text',
        media_url: msg.media?.url || msg.media_url || null,
      }));
      setMessages(mappedMessages);
    } catch (err: any) {
      if (!isPolling) {
        console.error('Error fetching messages:', err);
        setError(err.message || 'Error de conexión');
      }
    } finally {
      if (!isPolling) setLoading(false);
    }
  }, [conversationId]);

  // Initial fetch
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Auto-refresh every 3 seconds (pausar mientras se reproduce audio)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!playingAudioId) {
        fetchMessages(true);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [fetchMessages, playingAudioId]);

  const handleSend = async () => {
    if (!inputText.trim() || sending) return;
    
    const messageText = inputText.trim();
    setInputText('');
    setSending(true);
    
    // Agregar mensaje optimista
    const optimisticMessage: WhatsAppMessage = {
      id: Date.now(),
      conversation_id: conversationId,
      message_id: `temp-${Date.now()}`,
      from_me: true,
      type: 'text',
      body: messageText,
      media_url: null,
      media_type: null,
      status: 'sending',
      created_at: new Date().toISOString(),
    };
    
    setMessages(prev => [...prev, optimisticMessage]);
    
    try {
      await sendMessage(conversationId, messageText);
      // Recargar mensajes para obtener el mensaje real
      fetchMessages();
    } catch (err: any) {
      // Marcar mensaje como fallido
      setMessages(prev => prev.map(m => 
        m.id === optimisticMessage.id ? { ...m, status: 'failed' } : m
      ));
    } finally {
      setSending(false);
    }
  };

  const pickImage = async () => {
    setShowAttachMenu(false);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Necesitamos acceso a tu galería para enviar fotos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await sendMedia(result.assets[0].uri, 'image');
      }
    } catch (err) {
      Alert.alert('Error', 'No se pudo abrir la galería');
    }
  };

  const takePhoto = async () => {
    setShowAttachMenu(false);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Necesitamos acceso a tu cámara para tomar fotos');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await sendMedia(result.assets[0].uri, 'image');
      }
    } catch (err) {
      Alert.alert('Error', 'No se pudo abrir la cámara');
    }
  };

  const pickDocument = async () => {
    setShowAttachMenu(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        await sendMedia(result.assets[0].uri, 'document', result.assets[0].name);
      }
    } catch (err) {
      Alert.alert('Error', 'No se pudo seleccionar el documento');
    }
  };

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Necesitamos acceso al micrófono para grabar notas de voz');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(newRecording);
      setIsRecording(true);
      setRecordingDuration(0);

      recordingInterval.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Error starting recording:', err);
      Alert.alert('Error', 'No se pudo iniciar la grabación');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
        recordingInterval.current = null;
      }

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      setIsRecording(false);
      setRecordingDuration(0);

      if (uri) {
        await sendMedia(uri, 'audio');
      }
    } catch (err) {
      console.error('Error stopping recording:', err);
    }
  };

  const cancelRecording = async () => {
    if (!recording) return;

    try {
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
        recordingInterval.current = null;
      }

      await recording.stopAndUnloadAsync();
      setRecording(null);
      setIsRecording(false);
      setRecordingDuration(0);
    } catch (err) {
      console.error('Error canceling recording:', err);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const sendMedia = async (uri: string, type: 'image' | 'audio' | 'document', filename?: string) => {
    setSending(true);
    
    const optimisticMessage: WhatsAppMessage = {
      id: Date.now(),
      conversation_id: conversationId,
      message_id: `temp-${Date.now()}`,
      from_me: true,
      type: type,
      body: type === 'image' ? '[Imagen]' : type === 'audio' ? '[Audio]' : `[${filename || 'Documento'}]`,
      media_url: uri,
      media_type: type,
      status: 'sending',
      created_at: new Date().toISOString(),
    };
    
    setMessages(prev => [...prev, optimisticMessage]);
    
    try {
      await sendMediaMessage(conversationId, uri, type, filename);
      fetchMessages();
    } catch (err: any) {
      console.error('Error sending media:', err);
      setMessages(prev => prev.map(m => 
        m.id === optimisticMessage.id ? { ...m, status: 'failed' } : m
      ));
      Alert.alert('Error', 'No se pudo enviar el archivo');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Hoy';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Ayer';
    } else {
      return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
    }
  };

  const shouldShowDate = (currentMsg: WhatsAppMessage, prevMsg: WhatsAppMessage | null) => {
    if (!prevMsg) return true;
    const currentDate = new Date(currentMsg.created_at).toDateString();
    const prevDate = new Date(prevMsg.created_at).toDateString();
    return currentDate !== prevDate;
  };

  const getMessageStatus = (status: string) => {
    switch (status) {
      case 'sent':
        return <Ionicons name="checkmark" size={14} color="#9CA3AF" />;
      case 'delivered':
        return <Ionicons name="checkmark-done" size={14} color="#9CA3AF" />;
      case 'read':
        return <Ionicons name="checkmark-done" size={14} color="#6172FD" />;
      case 'sending':
        return <Ionicons name="time-outline" size={14} color="#9CA3AF" />;
      case 'failed':
        return <Ionicons name="alert-circle" size={14} color="#EF4444" />;
      default:
        return null;
    }
  };

  const formatMs = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const toggleSpeed = async () => {
    const speeds = [1, 1.5, 2];
    const nextIndex = (speeds.indexOf(audioSpeed) + 1) % speeds.length;
    const newSpeed = speeds[nextIndex];
    setAudioSpeed(newSpeed);
    if (soundRef.current) {
      await soundRef.current.setRateAsync(newSpeed, true);
    }
  };

  const seekAudio = async (ratio: number) => {
    if (soundRef.current && audioDurationMs > 0) {
      const position = Math.floor(ratio * audioDurationMs);
      await soundRef.current.setPositionAsync(position);
    }
  };

  const playAudio = async (messageId: number, audioUrl: string) => {
    try {
      if (playingAudioId === messageId && soundRef.current) {
        await soundRef.current.pauseAsync();
        setPlayingAudioId(null);
        return;
      }

      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      setAudioProgress(0);
      setAudioPositionMs(0);
      setAudioDurationMs(0);
      setAudioSpeed(1);

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true, rate: 1.0, shouldCorrectPitch: true },
        (status) => {
          if (status.isLoaded) {
            if (status.didJustFinish) {
              setPlayingAudioId(null);
              setAudioProgress(0);
              setAudioPositionMs(0);
            } else if (status.durationMillis) {
              setAudioDurationMs(status.durationMillis);
              setAudioPositionMs(status.positionMillis);
              setAudioProgress(status.positionMillis / status.durationMillis);
            }
          }
        }
      );

      soundRef.current = sound;
      setPlayingAudioId(messageId);
    } catch (err) {
      console.error('Error playing audio:', err);
      Alert.alert('Error', 'No se pudo reproducir el audio');
    }
  };

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  const getAccessibleMediaUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    
    const NGROK_URL = 'https://hookless-kaylynn-greasily.ngrok-free.dev';
    
    // Extraer el nombre del archivo de la URL
    const extractFilename = (mediaUrl: string): string | null => {
      const match = mediaUrl.match(/whatsapp-media\/([^?]+)/);
      return match ? match[1] : null;
    };
    
    const filename = extractFilename(url);
    if (filename) {
      // Usar el endpoint de API que sirve los archivos directamente
      return `${NGROK_URL}/api/media/${filename}`;
    }
    
    // Fallback: Si es una URL relativa, agregar el dominio
    if (url.startsWith('/')) {
      return NGROK_URL + url;
    }
    
    // Fallback: Reemplazar URL local por ngrok
    if (url.includes('192.168.') || url.includes('localhost') || url.includes('127.0.0.1')) {
      return url.replace(/https?:\/\/(192\.168\.\d+\.\d+|localhost|127\.0\.0\.1)(:\d+)?/, NGROK_URL);
    }
    return url;
  };

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return messages.filter(m => (m.body || '').toLowerCase().includes(q));
  }, [searchQuery, messages]);

  const scrollToMessage = useCallback((msgId: number) => {
    const index = messages.findIndex(m => m.id === msgId);
    if (index !== -1 && flatListRef.current) {
      flatListRef.current.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
      setHighlightedMsgId(msgId);
      setTimeout(() => setHighlightedMsgId(null), 2000);
    }
  }, [messages]);

  const renderMessageContent = (item: WhatsAppMessage) => {
    const messageType = item.type || item.media_type;
    const rawMediaUrl = item.media_url || (item as any).media?.url;
    const mediaUrl = getAccessibleMediaUrl(rawMediaUrl);

    if (messageType === 'audio' && mediaUrl) {
      const isPlaying = playingAudioId === item.id;
      const progress = isPlaying ? audioProgress : 0;
      const duration = isPlaying ? audioDurationMs : 0;
      const position = isPlaying ? audioPositionMs : 0;
      const speed = isPlaying ? audioSpeed : 1;
      const outgoing = item.from_me;
      
      return (
        <View style={styles.audioContainer}>
          <TouchableOpacity 
            style={[styles.audioPlayButton, outgoing ? styles.audioPlayButtonOutgoing : styles.audioPlayButtonIncoming]}
            onPress={() => playAudio(item.id, mediaUrl)}
          >
            <Ionicons 
              name={isPlaying ? "pause" : "play"} 
              size={20} 
              color={outgoing ? "#6172FD" : "#FFFFFF"} 
            />
          </TouchableOpacity>
          <View style={styles.audioRight}>
            <TouchableOpacity 
              activeOpacity={1}
              style={styles.audioSliderContainer}
              onPress={(e) => {
                const { locationX } = e.nativeEvent;
                const width = 180;
                const ratio = Math.max(0, Math.min(1, locationX / width));
                if (isPlaying) {
                  seekAudio(ratio);
                }
              }}
            >
              <View style={[styles.audioSliderTrack, { backgroundColor: outgoing ? 'rgba(255,255,255,0.3)' : '#E5E7EB' }]}>
                <View style={[
                  styles.audioSliderFill, 
                  { 
                    width: `${progress * 100}%`,
                    backgroundColor: outgoing ? '#FFFFFF' : '#6172FD',
                  }
                ]} />
                <View style={[
                  styles.audioSliderThumb,
                  { 
                    left: `${progress * 100}%`,
                    backgroundColor: outgoing ? '#FFFFFF' : '#6172FD',
                  }
                ]} />
              </View>
            </TouchableOpacity>
            <View style={styles.audioBottomRow}>
              <Text style={[styles.audioDuration, outgoing ? styles.audioDurationOutgoing : styles.audioDurationIncoming]}>
                {isPlaying ? formatMs(position) : '0:00'}
                {duration > 0 ? ` / ${formatMs(duration)}` : ''}
              </Text>
              {isPlaying && (
                <TouchableOpacity style={[styles.audioSpeedButton, { backgroundColor: outgoing ? 'rgba(255,255,255,0.25)' : 'rgba(97,114,253,0.15)' }]} onPress={toggleSpeed}>
                  <Text style={[styles.audioSpeedText, { color: outgoing ? '#FFFFFF' : '#6172FD' }]}>
                    {speed}x
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      );
    }

    if (messageType === 'image' && mediaUrl) {
      return (
        <TouchableOpacity activeOpacity={0.9} onPress={() => setPreviewImage(mediaUrl)}>
          <Image 
            source={{ uri: mediaUrl }} 
            style={styles.messageImage}
            resizeMode="contain"
          />
        </TouchableOpacity>
      );
    }

    if (messageType === 'document') {
      return (
        <TouchableOpacity style={styles.documentContainer}>
          <Ionicons name="document-outline" size={32} color={item.from_me ? "#FFFFFF" : "#6172FD"} />
          <Text style={[
            styles.documentName,
            item.from_me ? styles.messageTextRight : styles.messageTextLeft
          ]} numberOfLines={2}>
            {item.body || 'Documento'}
          </Text>
        </TouchableOpacity>
      );
    }

    // No mostrar texto placeholder para multimedia
    const hiddenBodies = ['[audio]', '[imagen]', '[image]', '[documento]', '[document]', '[video]'];
    if (hiddenBodies.includes((item.body || '').toLowerCase())) {
      return null;
    }

    return (
      <Text style={[
        styles.messageText,
        item.from_me ? styles.messageTextRight : styles.messageTextLeft
      ]}>
        {item.body}
      </Text>
    );
  };

  const renderMessage = useCallback(({ item, index }: { item: WhatsAppMessage; index: number }) => {
    const prevMessage = index > 0 ? messages[index - 1] : null;
    const showDate = shouldShowDate(item, prevMessage);
    const messageType = item.type || item.media_type || 'text';
    const isMedia = ['audio', 'image', 'document'].includes(messageType);
    const isHighlighted = highlightedMsgId === item.id;
    
    return (
      <View>
        {showDate && (
          <View style={styles.dateSeparator}>
            <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
          </View>
        )}
        <View style={[
          styles.messageContainer,
          item.from_me ? styles.messageContainerRight : styles.messageContainerLeft
        ]}>
          <View style={[
            styles.messageBubble,
            item.from_me ? styles.messageBubbleRight : styles.messageBubbleLeft,
            isMedia && styles.mediaBubble,
            isHighlighted && styles.highlightedBubble,
          ]}>
            {renderMessageContent(item)}
            <View style={styles.messageFooter}>
              <Text style={[
                styles.messageTime,
                item.from_me ? styles.messageTimeRight : styles.messageTimeLeft
              ]}>
                {formatTime(item.created_at)}
              </Text>
              {item.from_me && getMessageStatus(item.status)}
            </View>
          </View>
        </View>
      </View>
    );
  }, [messages, playingAudioId, audioProgress, audioDurationMs, audioPositionMs, audioSpeed, highlightedMsgId]);

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={styles.header}>
        {showSearch ? (
          <>
            <TouchableOpacity style={styles.backButton} onPress={() => { setShowSearch(false); setSearchQuery(''); }}>
              <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.searchBarContainer}>
              <Ionicons name="search" size={16} color="rgba(255,255,255,0.6)" />
              <TextInput
                style={styles.searchBarInput}
                placeholder="Buscar en el chat..."
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.6)" />
                </TouchableOpacity>
              )}
            </View>
            {searchQuery.trim().length > 0 && (
              <Text style={styles.searchCount}>{searchResults.length}</Text>
            )}
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.headerTouchable} 
              activeOpacity={0.7}
              onPress={() => navigation.navigate('WhatsAppContactProfile', { conversationId, contactName, phone })}
            >
              <View style={styles.headerAvatar}>
                <Text style={styles.headerAvatarText}>{(contactName || '?')[0].toUpperCase()}</Text>
              </View>
              <View style={styles.headerInfo}>
                <Text style={styles.headerName} numberOfLines={1}>{contactName}</Text>
                <Text style={styles.headerPhone}>{phone}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerSearchBtn} onPress={() => setShowSearch(true)}>
              <Ionicons name="search" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </>
        )}
      </View>

      {showSearch && searchQuery.trim().length > 0 && searchResults.length > 0 && (
        <View style={styles.searchResultsBar}>
          <FlatList
            data={searchResults}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => `sr-${item.id}`}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.searchResultChip}
                onPress={() => { setShowSearch(false); setSearchQuery(''); scrollToMessage(item.id); }}
              >
                <Text style={styles.searchResultChipText} numberOfLines={1}>
                  {(item.body || '').substring(0, 40)}
                </Text>
                <Text style={styles.searchResultChipDate}>{formatTime(item.created_at)}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      <View style={styles.chatContainer}>
        {error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => fetchMessages()}>
              <Text style={styles.retryButtonText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            initialNumToRender={20}
            maxToRenderPerBatch={15}
            windowSize={10}
            removeClippedSubviews={Platform.OS === 'android'}
            getItemLayout={undefined}
            onScrollToIndexFailed={(info) => {
              flatListRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true });
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbubble-outline" size={48} color="#9CA3AF" />
                <Text style={styles.emptyText}>No hay mensajes</Text>
              </View>
            }
          />
        )}
      </View>

      {isRecording ? (
        <View style={styles.recordingContainer}>
          <TouchableOpacity style={styles.cancelRecordButton} onPress={cancelRecording}>
            <Ionicons name="trash-outline" size={24} color="#EF4444" />
          </TouchableOpacity>
          <View style={styles.recordingInfo}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>Grabando {formatDuration(recordingDuration)}</Text>
          </View>
          <TouchableOpacity style={styles.stopRecordButton} onPress={stopRecording}>
            <Ionicons name="send" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.attachButton} onPress={() => setShowAttachMenu(true)}>
            <Ionicons name="add-circle-outline" size={28} color="#6172FD" />
          </TouchableOpacity>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              placeholder="Escribe un mensaje..."
              placeholderTextColor="#9CA3AF"
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={4096}
            />
          </View>
          {inputText.trim() ? (
            <TouchableOpacity 
              style={[styles.sendButton, sending && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="send" size={20} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.micButton} onPress={startRecording}>
              <Ionicons name="mic" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      )}

      <Modal
        visible={!!previewImage}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImage(null)}
      >
        <View style={styles.imagePreviewContainer}>
          <TouchableOpacity style={styles.imagePreviewClose} onPress={() => setPreviewImage(null)}>
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          {previewImage && (
            <Image
              source={{ uri: previewImage }}
              style={styles.imagePreviewFull}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {showAttachMenu && (
        <View style={styles.attachOverlay}>
          <Pressable style={styles.attachOverlayBg} onPress={() => setShowAttachMenu(false)} />
          <View style={styles.attachMenuContainer}>
            <View style={styles.attachMenu}>
              <Pressable 
                style={styles.attachOption} 
                onPress={() => {
                  console.log('📸 Camera button pressed');
                  takePhoto();
                }}
              >
                <View style={[styles.attachIconContainer, { backgroundColor: '#6172FD' }]}>
                  <Ionicons name="camera" size={24} color="#FFFFFF" />
                </View>
                <Text style={styles.attachOptionText}>Cámara</Text>
              </Pressable>
              <Pressable 
                style={styles.attachOption} 
                onPress={() => {
                  console.log('📷 Gallery button pressed');
                  pickImage();
                }}
              >
                <View style={[styles.attachIconContainer, { backgroundColor: '#10B981' }]}>
                  <Ionicons name="image" size={24} color="#FFFFFF" />
                </View>
                <Text style={styles.attachOptionText}>Galería</Text>
              </Pressable>
              <Pressable 
                style={styles.attachOption} 
                onPress={() => {
                  console.log('📄 Document button pressed');
                  pickDocument();
                }}
              >
                <View style={[styles.attachIconContainer, { backgroundColor: '#F59E0B' }]}>
                  <Ionicons name="document" size={24} color="#FFFFFF" />
                </View>
                <Text style={styles.attachOptionText}>Documento</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F2F5',
  },
  header: {
    height: 110,
    backgroundColor: '#6172FD',
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 12,
    paddingBottom: 12,
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
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2,
  },
  headerAvatarText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#FFFFFF',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 10,
  },
  headerName: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#FFFFFF',
  },
  headerPhone: {
    fontSize: 11,
    fontFamily: 'Montserrat_400Regular',
    color: 'rgba(255,255,255,0.75)',
    marginTop: 1,
  },
  headerTouchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
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
  chatContainer: {
    flex: 1,
    backgroundColor: '#ECE5DD',
  },
  messagesList: {
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  dateSeparator: {
    alignItems: 'center',
    marginVertical: 14,
  },
  dateText: {
    fontSize: 11,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#667781',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  messageContainer: {
    marginVertical: 1.5,
    maxWidth: '82%',
  },
  messageContainerLeft: {
    alignSelf: 'flex-start',
  },
  messageContainerRight: {
    alignSelf: 'flex-end',
  },
  messageBubble: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0.5 },
    shadowOpacity: 0.06,
    shadowRadius: 1.5,
    elevation: 1,
  },
  messageBubbleLeft: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 3,
  },
  messageBubbleRight: {
    backgroundColor: '#6172FD',
    borderTopRightRadius: 3,
  },
  messageText: {
    fontSize: 15,
    fontFamily: 'Montserrat_400Regular',
    lineHeight: 21,
  },
  messageTextLeft: {
    color: '#303030',
  },
  messageTextRight: {
    color: '#FFFFFF',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 3,
    gap: 3,
  },
  messageTime: {
    fontSize: 10,
    fontFamily: 'Montserrat_400Regular',
  },
  messageTimeLeft: {
    color: '#8696A0',
  },
  messageTimeRight: {
    color: 'rgba(255,255,255,0.65)',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    fontFamily: 'Montserrat_500Medium',
    color: '#9CA3AF',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 30,
    backgroundColor: '#F0F2F5',
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    maxHeight: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  textInput: {
    fontSize: 15,
    fontFamily: 'Montserrat_400Regular',
    color: '#303030',
    maxHeight: 100,
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#6172FD',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6172FD',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  sendButtonDisabled: {
    backgroundColor: '#B0B8C1',
    shadowOpacity: 0,
  },
  attachButton: {
    width: 46,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#6172FD',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6172FD',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  recordingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F0F2F5',
  },
  cancelRecordButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EF4444',
    marginRight: 8,
  },
  recordingText: {
    fontSize: 16,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#374151',
  },
  stopRecordButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6172FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  attachOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
  attachOverlayBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  attachMenuContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  attachMenu: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  attachOption: {
    alignItems: 'center',
  },
  attachIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  attachOptionText: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#374151',
  },
  audioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 230,
    paddingVertical: 6,
  },
  audioPlayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  audioPlayButtonOutgoing: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  audioPlayButtonIncoming: {
    backgroundColor: '#6172FD',
  },
  audioRight: {
    flex: 1,
  },
  audioSliderContainer: {
    height: 24,
    justifyContent: 'center',
  },
  audioSliderTrack: {
    height: 4,
    borderRadius: 2,
    position: 'relative',
  },
  audioSliderFill: {
    height: '100%',
    borderRadius: 2,
  },
  audioSliderThumb: {
    position: 'absolute',
    top: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: -6,
  },
  audioBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  audioDuration: {
    fontSize: 11,
    fontFamily: 'Montserrat_400Regular',
  },
  audioDurationOutgoing: {
    color: 'rgba(255,255,255,0.7)',
  },
  audioDurationIncoming: {
    color: '#9CA3AF',
  },
  audioSpeedButton: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  audioSpeedText: {
    fontSize: 12,
    fontFamily: 'Montserrat_700Bold',
  },
  messageImage: {
    width: 250,
    height: 300,
    borderRadius: 12,
  },
  documentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 180,
  },
  documentName: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Montserrat_500Medium',
    marginLeft: 10,
  },
  mediaBubble: {
    padding: 5,
    overflow: 'hidden',
  },
  highlightedBubble: {
    borderWidth: 2,
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingHorizontal: 12,
    marginHorizontal: 8,
    height: 38,
  },
  searchBarInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
    color: '#FFFFFF',
    marginLeft: 8,
    paddingVertical: 0,
  },
  searchCount: {
    fontSize: 13,
    fontFamily: 'Montserrat_600SemiBold',
    color: 'rgba(255,255,255,0.8)',
    marginRight: 4,
  },
  headerSearchBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchResultsBar: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchResultChip: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    maxWidth: 220,
  },
  searchResultChipText: {
    fontSize: 13,
    fontFamily: 'Montserrat_400Regular',
    color: '#374151',
  },
  searchResultChipDate: {
    fontSize: 10,
    fontFamily: 'Montserrat_400Regular',
    color: '#9CA3AF',
    marginTop: 2,
  },
  imagePreviewContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePreviewClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePreviewFull: {
    width: '100%',
    height: '80%',
  },
});

export default WhatsAppChatScreen;
