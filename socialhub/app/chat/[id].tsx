import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Dimensions,
  TouchableOpacity,
  Animated,
  Modal,
  ScrollView,
} from 'react-native';
import { Text, Avatar, Menu } from 'react-native-paper';
import { useLocalSearchParams, useRouter, Stack, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/context/AuthContext';
import apiService from '@/services/api';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';

const { width, height } = Dimensions.get('window');

const QUICK_EMOJIS = ['❤️', '😂', '😮', '😢', '👍', '🙏'];
const CHAT_WALLPAPER_COLORS: [string, string][] = [
  ['#0F172A', '#1E1B4B'],
  ['#0A0A0A', '#1C1C2E'],
  ['#042F2E', '#134E4A'],
  ['#1A0533', '#2D0066'],
  ['#1C0A00', '#3D1500'],
];

export default function IndividualChatScreen() {
  const { id } = useLocalSearchParams();
  const { user, socket } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [conversation, setConversation] = useState<any>(null);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  // Voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const timerRef = useRef<any>(null);
  const recordingAnim = useRef(new Animated.Value(1)).current;

  // Reply
  const [replyTo, setReplyTo] = useState<any>(null);

  // Context menu (long-press)
  const [contextMsg, setContextMsg] = useState<any>(null);
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const contextMenuAnim = useRef(new Animated.Value(0)).current;

  // Emoji picker
  const [emojiPickerMsg, setEmojiPickerMsg] = useState<any>(null);

  // Pinned message
  const [pinnedMessage, setPinnedMessage] = useState<any>(null);
  const [showPinned, setShowPinned] = useState(true);

  // Wallpaper
  const [wallpaperIndex, setWallpaperIndex] = useState(0);
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);

  // Disappearing messages
  const [disappearing, setDisappearing] = useState(false);

  // In-chat search
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [searchIndex, setSearchIndex] = useState(0);

  // Call UI
  const [callActive, setCallActive] = useState(false);
  const [callType, setCallType] = useState<'audio' | 'video'>('audio');
  const [callDuration, setCallDuration] = useState(0);
  const callTimerRef = useRef<any>(null);

  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  // ── Sound cleanup ────────────────────────────────────────────────────
  useEffect(() => {
    return sound ? () => { sound.unloadAsync(); } : undefined;
  }, [sound]);

  // ── Recording animation ─────────────────────────────────────────────
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(recordingAnim, { toValue: 1.3, duration: 600, useNativeDriver: true }),
          Animated.timing(recordingAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      recordingAnim.stopAnimation();
      recordingAnim.setValue(1);
    }
  }, [isRecording]);

  // ── Audio playback ───────────────────────────────────────────────────
  const playAudio = async (uri: string, messageId: string) => {
    try {
      if (playingId === messageId) {
        await sound?.pauseAsync();
        setPlayingId(null);
        return;
      }
      if (sound) await sound.unloadAsync();
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true }
      );
      setSound(newSound);
      setPlayingId(messageId);
      newSound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish) setPlayingId(null);
      });
    } catch (error) {
      Alert.alert('Error', 'Could not play audio');
    }
  };

  // ── Recording ────────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status === 'granted') {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        setRecording(recording);
        setIsRecording(true);
        setRecordingDuration(0);
        timerRef.current = setInterval(() => setRecordingDuration(prev => prev + 1), 1000);
      } else {
        Alert.alert('Permission Denied', 'Please grant microphone access.');
      }
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      await recording?.stopAndUnloadAsync();
      const uri = recording?.getURI();
      setRecording(null);
      if (uri) sendVoiceMessage(uri);
    } catch (err) {
      console.error('Failed to stop recording', err);
    }
  };

  const cancelRecording = async () => {
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      await recording?.stopAndUnloadAsync();
    } catch (_) {}
    setRecording(null);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // ── Send voice ────────────────────────────────────────────────────────
  const sendVoiceMessage = async (uri: string) => {
    try {
      const tempId = Date.now().toString();
      const optimistic = {
        id: tempId,
        text: '🎤 Voice Message',
        senderId: user?.id || user?._id,
        sender: { id: user?.id || user?._id },
        media: [{ url: uri, type: 'audio' }],
        createdAt: new Date().toISOString(),
        sending: true,
      };
      setMessages(prev => [...prev, optimistic]);
      flatListRef.current?.scrollToEnd({ animated: true });

      const formData = new FormData() as any;
      formData.append('audio', {
        uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
        type: 'audio/m4a',
        name: `voice_${tempId}.m4a`,
      });
      formData.append('conversationId', id);

      const response = await apiService.uploadVoiceMessage(formData);
      setMessages(prev => prev.map(m => m.id === tempId ? { ...response, id: response.id } : m));

      if (socket && recipient) {
        socket.emit('send_message', { recipientId: recipient.id || recipient._id, conversationId: id, message: response });
      }
    } catch (error) {
      console.error('Voice message upload error:', error);
      Alert.alert('Error', 'Failed to send voice message');
    }
  };

  // ── Fetch messages ────────────────────────────────────────────────────
  const fetchMessages = async () => {
    try {
      const data = await apiService.getMessages(id as string);
      setMessages(data);
      const convs = await apiService.getConversations();
      const currentConv = convs.find((c: any) => c.id === id || c._id === id);
      if (currentConv) setConversation(currentConv);
    } catch (error) {
      console.error('Fetch messages error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchMessages(); }, [id]));

  // ── Socket listeners ──────────────────────────────────────────────────
  useEffect(() => {
    if (socket) {
      socket.on('receive_message', (data: any) => {
        if (data.conversationId === id) {
          setMessages(prev => [...prev, data.message]);
          flatListRef.current?.scrollToEnd({ animated: true });
        }
      });

      socket.on('user_typing', (data: any) => {
        if (data.conversationId === id) {
          setIsTyping(true);
          setTimeout(() => setIsTyping(false), 3000);
        }
      });

      socket.on('message_reaction', (data: any) => {
        if (data.conversationId === id) {
          setMessages(prev => prev.map(m =>
            (m.id === data.messageId || m._id === data.messageId)
              ? { ...m, reactions: data.reactions }
              : m
          ));
        }
      });

      socket.on('message_deleted', (data: any) => {
        if (data.conversationId === id) {
          setMessages(prev => prev.filter(m => m.id !== data.messageId && m._id !== data.messageId));
        }
      });

      socket.on('user_status_changed', ({ userId, isOnline }: any) => {
        if (recipient && (recipient.id === userId || recipient._id === userId)) {
          setConversation((prev: any) => {
            if (!prev) return prev;
            const updatedParticipants = prev.participants.map((p: any) =>
              (p.user?.id === userId || p.user?._id === userId)
                ? { ...p, user: { ...p.user, isOnline } }
                : p
            );
            return { ...prev, participants: updatedParticipants };
          });
        }
      });

      return () => {
        socket.off('receive_message');
        socket.off('user_typing');
        socket.off('message_reaction');
        socket.off('message_deleted');
        socket.off('user_status_changed');
      };
    }
  }, [socket, id]);

  // ── Send text message ─────────────────────────────────────────────────
  const sendMessage = async () => {
    if (inputText.trim() === '') return;

    const tempId = Date.now().toString();
    const optimistic: any = {
      id: tempId,
      text: inputText,
      senderId: user?.id || user?._id,
      sender: { id: user?.id || user?._id },
      createdAt: new Date().toISOString(),
      sending: true,
      replyToId: replyTo?.id || replyTo?._id,
      replyToText: replyTo?.text,
    };

    setMessages(prev => [...prev, optimistic]);
    const textToSend = inputText;
    setInputText('');
    setReplyTo(null);
    flatListRef.current?.scrollToEnd({ animated: true });

    try {
      const response = await apiService.sendMessage({
        conversationId: id as string,
        text: textToSend,
        replyToId: replyTo?.id || replyTo?._id,
        replyToText: replyTo?.text,
      });

      setMessages(prev => prev.map(m => m.id === tempId ? { ...response } : m));

      if (socket && recipient) {
        socket.emit('send_message', {
          recipientId: recipient.id || recipient._id,
          conversationId: id,
          message: response,
        });
      }

      // Auto-delete if disappearing messages is on (15s demo)
      if (disappearing) {
        setTimeout(() => {
          setMessages(prev => prev.filter(m => m.id !== (response.id || response._id)));
        }, 15000);
      }
    } catch (error) {
      console.error('Send message error:', error);
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, failed: true } : m));
    }
  };

  // ── Typing indicator ──────────────────────────────────────────────────
  const handleTyping = (text: string) => {
    setInputText(text);
    if (socket && recipient) {
      socket.emit('typing', { recipientId: recipient.id || recipient._id, conversationId: id });
    }
  };

  // ── Media send ────────────────────────────────────────────────────────
  const handleAttachment = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const tempId = Date.now().toString();
      const optimistic = {
        id: tempId,
        text: asset.type === 'video' ? '🎥 Video' : '📷 Photo',
        senderId: user?.id || user?._id,
        sender: { id: user?.id || user?._id },
        media: [{ url: asset.uri, type: asset.type || 'image' }],
        createdAt: new Date().toISOString(),
        sending: true,
      };
      setMessages(prev => [...prev, optimistic]);
      flatListRef.current?.scrollToEnd({ animated: true });

      try {
        const formData = new FormData() as any;
        formData.append('file', {
          uri: asset.uri,
          type: asset.type === 'video' ? 'video/mp4' : 'image/jpeg',
          name: `media_${tempId}.${asset.type === 'video' ? 'mp4' : 'jpg'}`,
        });
        formData.append('conversationId', id);
        const response = await apiService.uploadChatMedia(formData);
        setMessages(prev => prev.map(m => m.id === tempId ? { ...response } : m));
        if (socket && recipient) {
          socket.emit('send_message', {
            recipientId: recipient.id || recipient._id,
            conversationId: id,
            message: response,
          });
        }
      } catch (err) {
        console.error('Media upload failed', err);
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, failed: true } : m));
      }
    }
  };

  const handleCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.granted) {
      const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const tempId = Date.now().toString();
        setMessages(prev => [...prev, {
          id: tempId,
          text: '📷 Photo',
          senderId: user?.id || user?._id,
          sender: { id: user?.id || user?._id },
          media: [{ url: asset.uri, type: 'image' }],
          createdAt: new Date().toISOString(),
          sending: true,
        }]);
        flatListRef.current?.scrollToEnd({ animated: true });
        // Upload logic same as handleAttachment...
      }
    }
  };

  // ── React to message ──────────────────────────────────────────────────
  const reactToMessage = async (msg: any, emoji: string) => {
    const msgId = msg.id || msg._id;
    try {
      const response = await apiService.reactToMessage(msgId, emoji);
      setMessages(prev => prev.map(m =>
        (m.id === msgId || m._id === msgId) ? { ...m, reactions: response.reactions } : m
      ));
      if (socket && recipient) {
        socket.emit('send_reaction', {
          recipientId: recipient.id || recipient._id,
          conversationId: id,
          messageId: msgId,
          reactions: response.reactions,
        });
      }
    } catch (err) {
      console.error('Reaction failed', err);
    }
    setEmojiPickerMsg(null);
    setContextMenuVisible(false);
  };

  // ── Delete message ─────────────────────────────────────────────────────
  const deleteMessage = async (msg: any) => {
    const msgId = msg.id || msg._id;
    if (msg.senderId !== (user?.id || user?._id)) {
      Alert.alert('Cannot delete', 'You can only delete your own messages');
      return;
    }
    Alert.alert('Delete Message', 'This will be deleted for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await apiService.deleteMessage(msgId);
            setMessages(prev => prev.filter(m => m.id !== msgId && m._id !== msgId));
            if (socket && recipient) {
              socket.emit('delete_message', {
                recipientId: recipient.id || recipient._id,
                conversationId: id,
                messageId: msgId,
              });
            }
          } catch (err) {
            Alert.alert('Error', 'Failed to delete message');
          }
        }
      }
    ]);
    setContextMenuVisible(false);
  };

  // ── Pin message ────────────────────────────────────────────────────────
  const pinMessage = (msg: any) => {
    setPinnedMessage(msg);
    setShowPinned(true);
    setContextMenuVisible(false);
  };

  // ── Call ────────────────────────────────────────────────────────────────
  const startCall = (type: 'audio' | 'video') => {
    setCallType(type);
    setCallActive(true);
    setCallDuration(0);
    callTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);

    if (socket && recipient) {
      socket.emit('call_user', {
        targetUserId: recipient.id || recipient._id,
        callerId: user?.id || user?._id,
        callerName: `${user?.firstName} ${user?.lastName}`,
        callerAvatar: user?.profilePicture,
        callType: type,
        channelId: `${id}_${Date.now()}`,
      });
    }
  };

  const endCall = () => {
    setCallActive(false);
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    if (socket && recipient) {
      socket.emit('end_call', { targetUserId: recipient.id || recipient._id });
    }
  };

  // ── Context menu open ─────────────────────────────────────────────────
  const openContextMenu = (msg: any) => {
    setContextMsg(msg);
    setContextMenuVisible(true);
    Animated.spring(contextMenuAnim, { toValue: 1, useNativeDriver: true, bounciness: 8 }).start();
  };

  const closeContextMenu = () => {
    Animated.timing(contextMenuAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setContextMenuVisible(false);
      setContextMsg(null);
    });
  };

  // ── In-chat search ─────────────────────────────────────────────────────
  const doSearch = (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) { setSearchResults([]); return; }
    const results: number[] = [];
    messages.forEach((m, i) => {
      if (m.text?.toLowerCase().includes(q.toLowerCase())) results.push(i);
    });
    setSearchResults(results);
    setSearchIndex(0);
    if (results.length > 0) {
      flatListRef.current?.scrollToIndex({ index: results[0], animated: true });
    }
  };

  const navigateSearch = (dir: 'up' | 'down') => {
    if (!searchResults.length) return;
    const next = dir === 'down'
      ? (searchIndex + 1) % searchResults.length
      : (searchIndex - 1 + searchResults.length) % searchResults.length;
    setSearchIndex(next);
    flatListRef.current?.scrollToIndex({ index: searchResults[next], animated: true });
  };

  // ── Helpers ────────────────────────────────────────────────────────────
  const getRecipient = (participants: any[]) => {
    if (!participants) return null;
    if (participants.length === 1) return participants[0]?.user || participants[0];
    const me = user?.id || user?._id;
    return participants.find(p => (p.user?.id !== me && p.user?._id !== me))?.user
      || participants.find(p => (p.id !== me && p._id !== me));
  };

  const recipient = conversation?.isGroup
    ? null
    : getRecipient(conversation?.participants);

  const recipientName = conversation?.isGroup
    ? (conversation?.groupName || 'Group')
    : `${recipient?.firstName || 'User'} ${recipient?.lastName || ''}`.trim();

  const isOnline = !conversation?.isGroup && recipient?.isOnline;

  // ── Render reaction summary ───────────────────────────────────────────
  const renderReactions = (msg: any) => {
    if (!msg.reactions || Object.keys(msg.reactions).length === 0) return null;
    const reactionGroups: Record<string, number> = {};
    Object.values(msg.reactions as Record<string, string>).forEach(emoji => {
      reactionGroups[emoji] = (reactionGroups[emoji] || 0) + 1;
    });
    return (
      <View style={styles.reactionsRow}>
        {Object.entries(reactionGroups).map(([emoji, count]) => (
          <TouchableOpacity
            key={emoji}
            style={styles.reactionPill}
            onPress={() => reactToMessage(msg, emoji)}
          >
            <Text style={styles.reactionEmoji}>{emoji}</Text>
            {count > 1 && <Text style={styles.reactionCount}>{count}</Text>}
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // ── Render a single message ───────────────────────────────────────────
  const renderMessage = ({ item, index }: { item: any; index: number }) => {
    const msgId = item.id || item._id;
    const isMe = item.senderId === (user?.id || user?._id)
      || item.sender?.id === (user?.id || user?._id)
      || item.sender?._id === (user?.id || user?._id);
    const time = new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isAudio = item.media && item.media[0]?.type === 'audio';
    const isImage = item.media && (item.media[0]?.type === 'image');
    const isHighlighted = searchMode && searchResults[searchIndex] === index;

    return (
      <Pressable
        onLongPress={() => openContextMenu(item)}
        delayLongPress={300}
      >
        <View style={[
          styles.msgRow,
          isMe ? styles.myMsgRow : styles.otherMsgRow,
          isHighlighted && styles.highlightedMsg,
        ]}>

          {/* Bubble */}
          <View style={[styles.bubbleContainer, isMe ? styles.myBubbleContainer : styles.otherBubbleContainer]}>
            {/* Reply preview */}
            {item.replyToText && (
              <View style={[styles.replyPreview, isMe ? styles.myReplyPreview : styles.otherReplyPreview]}>
                <View style={styles.replyBar} />
                <Text style={styles.replyText} numberOfLines={2}>{item.replyToText}</Text>
              </View>
            )}

            {/* Bubble content */}
            {isMe ? (
              <LinearGradient
                colors={['#7C3AED', '#6D28D9']}
                style={[styles.bubble, styles.myBubble]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                {renderBubbleContent(item, isMe, isAudio, isImage, time)}
              </LinearGradient>
            ) : (
              <View style={[styles.bubble, styles.otherBubble]}>
                {renderBubbleContent(item, isMe, isAudio, isImage, time)}
              </View>
            )}

            {/* Status indicator for my messages */}
            {isMe && (
              <View style={styles.statusRow}>
                {item.sending && <MaterialCommunityIcons name="clock-outline" size={13} color="#64748B" />}
                {item.failed && <MaterialCommunityIcons name="alert-circle-outline" size={13} color="#EF4444" />}
                {!item.sending && !item.failed && (
                  <MaterialCommunityIcons
                    name={item.isRead ? 'check-all' : item.readBy?.length > 0 ? 'check-all' : 'check'}
                    size={15}
                    color={item.isRead || item.readBy?.length > 0 ? '#A78BFA' : '#64748B'}
                  />
                )}
              </View>
            )}
          </View>

          {/* Reactions */}
          {renderReactions(item)}
        </View>
      </Pressable>
    );
  };

  const renderBubbleContent = (item: any, isMe: boolean, isAudio: boolean, isImage: boolean, time: string) => (
    <>
      {isAudio ? (
        <View style={styles.audioRow}>
          <TouchableOpacity
            style={styles.playBtn}
            onPress={() => playAudio(item.media[0].url, item.id || item._id)}
          >
            <MaterialCommunityIcons
              name={playingId === (item.id || item._id) ? 'pause' : 'play'}
              size={20}
              color="#FFF"
            />
          </TouchableOpacity>
          <View style={styles.waveform}>
            {Array.from({ length: 20 }, (_, i) => (
              <View
                key={i}
                style={[
                  styles.wavBar,
                  {
                    height: [8, 14, 10, 18, 12, 16, 9, 20, 13, 17, 11, 15, 8, 19, 10, 16, 12, 14, 9, 18][i],
                    backgroundColor: playingId === (item.id || item._id)
                      ? '#A78BFA'
                      : isMe ? 'rgba(255,255,255,0.5)' : '#475569',
                  },
                ]}
              />
            ))}
          </View>
          <Text style={[styles.audioDur, { color: isMe ? 'rgba(255,255,255,0.7)' : '#94A3B8' }]}>
            {formatDuration(0)}
          </Text>
        </View>
      ) : isImage ? (
        <View>
          {/* Show image placeholder (full image picker media) */}
          <View style={styles.imagePlaceholder}>
            <MaterialCommunityIcons name="image" size={40} color={isMe ? 'rgba(255,255,255,0.5)' : '#475569'} />
            <Text style={{ color: isMe ? 'rgba(255,255,255,0.7)' : '#94A3B8', fontSize: 12 }}>Photo</Text>
          </View>
        </View>
      ) : (
        <Text style={[styles.msgText, isMe && styles.myMsgText]}>{item.text}</Text>
      )}

      {/* Time row */}
      <View style={[styles.timeRow, isMe ? styles.myTimeRow : styles.otherTimeRow]}>
        {item.disappearing && (
          <MaterialCommunityIcons name="timer-outline" size={11} color={isMe ? 'rgba(255,255,255,0.6)' : '#64748B'} />
        )}
        <Text style={[styles.timeText, isMe && styles.myTimeText]}>{time}</Text>
      </View>
    </>
  );

  // ── Loading ────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* ── Header ───────────────────────────────────────────────────── */}
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: '',
          headerStyle: { backgroundColor: '#1E1B4B' },
          headerShadowVisible: false,
          headerLeft: () => (
            <View style={styles.headerLeft}>
              <Pressable onPress={() => router.back()} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={24} color="#F1F5F9" />
              </Pressable>
              <Pressable style={styles.headerAvatarWrapper} onPress={() => {}}>
                {recipient?.profilePicture ? (
                  <Avatar.Image size={38} source={{ uri: recipient.profilePicture }} />
                ) : (
                  <Avatar.Text
                    size={38}
                    label={recipientName.substring(0, 2).toUpperCase()}
                    style={{ backgroundColor: '#4C1D95' }}
                    labelStyle={{ color: '#E9D5FF', fontWeight: '800' }}
                  />
                )}
                {isOnline && <View style={styles.headerOnlineDot} />}
              </Pressable>
              <View style={styles.headerMeta}>
                <Text style={styles.headerName} numberOfLines={1}>{recipientName}</Text>
                <Text style={[styles.headerStatus, isOnline && { color: '#A78BFA' }]}>
                  {isTyping ? '✍️ typing...' : isOnline ? 'online' : 'offline'}
                </Text>
              </View>
            </View>
          ),
          headerRight: () =>
            searchMode ? (
              <View style={styles.headerSearchBar}>
                <TextInput
                  value={searchQuery}
                  onChangeText={doSearch}
                  placeholder="Search messages..."
                  placeholderTextColor="#64748B"
                  style={styles.headerSearchInput}
                  autoFocus
                />
                <Pressable onPress={() => navigateSearch('up')}>
                  <Ionicons name="chevron-up" size={20} color="#A78BFA" />
                </Pressable>
                <Pressable onPress={() => navigateSearch('down')}>
                  <Ionicons name="chevron-down" size={20} color="#A78BFA" />
                </Pressable>
                <Pressable onPress={() => { setSearchMode(false); setSearchQuery(''); setSearchResults([]); }}>
                  <Ionicons name="close" size={22} color="#A78BFA" />
                </Pressable>
              </View>
            ) : (
              <View style={styles.headerRight}>
                <Pressable style={styles.headerIconBtn} onPress={() => startCall('video')}>
                  <Ionicons name="videocam" size={22} color="#A78BFA" />
                </Pressable>
                <Pressable style={styles.headerIconBtn} onPress={() => startCall('audio')}>
                  <Ionicons name="call" size={20} color="#A78BFA" />
                </Pressable>
                <Menu
                  visible={menuVisible}
                  onDismiss={() => setMenuVisible(false)}
                  contentStyle={styles.menuContent}
                  anchor={
                    <Pressable style={styles.headerIconBtn} onPress={() => setMenuVisible(true)}>
                      <MaterialCommunityIcons name="dots-vertical" size={22} color="#A78BFA" />
                    </Pressable>
                  }
                >
                  <Menu.Item onPress={() => { setMenuVisible(false); setSearchMode(true); }} title="Search Messages" leadingIcon="magnify" titleStyle={styles.menuItemText} />
                  <Menu.Item onPress={() => { setMenuVisible(false); setShowWallpaperPicker(true); }} title="Change Wallpaper" leadingIcon="palette-outline" titleStyle={styles.menuItemText} />
                  <Menu.Item
                    onPress={() => { setMenuVisible(false); setDisappearing(d => !d); }}
                    title={disappearing ? 'Turn Off Disappearing' : 'Disappearing Messages'}
                    leadingIcon="timer-outline"
                    titleStyle={[styles.menuItemText, disappearing && { color: '#A78BFA' }]}
                  />
                  <Menu.Item onPress={() => { setMenuVisible(false); Alert.alert('Block', `Block ${recipientName}?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Block', style: 'destructive', onPress: () => {} }]); }} title="Block" leadingIcon="block-helper" titleStyle={[styles.menuItemText, { color: '#EF4444' }]} />
                  <Menu.Item onPress={() => { setMenuVisible(false); Alert.alert('Clear Chat', 'Clear all messages?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear', style: 'destructive', onPress: () => setMessages([]) }]); }} title="Clear Chat" leadingIcon="delete-outline" titleStyle={[styles.menuItemText, { color: '#EF4444' }]} />
                </Menu>
              </View>
            ),
        }}
      />

      {/* ── Pinned message banner ─────────────────────────────────────── */}
      {pinnedMessage && showPinned && (
        <View style={styles.pinnedBanner}>
          <MaterialCommunityIcons name="pin" size={16} color="#A78BFA" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.pinnedLabel}>Pinned Message</Text>
            <Text style={styles.pinnedText} numberOfLines={1}>{pinnedMessage.text}</Text>
          </View>
          <Pressable onPress={() => setShowPinned(false)}>
            <Ionicons name="close" size={18} color="#64748B" />
          </Pressable>
        </View>
      )}

      {/* ── Disappearing indicator ───────────────────────────────────── */}
      {disappearing && (
        <View style={styles.disappearingBanner}>
          <MaterialCommunityIcons name="timer-outline" size={14} color="#F59E0B" />
          <Text style={styles.disappearingText}>Disappearing messages on · 15 seconds</Text>
        </View>
      )}

      {/* ── Chat Background & Messages ───────────────────────────────── */}
      <LinearGradient
        colors={CHAT_WALLPAPER_COLORS[wallpaperIndex]}
        style={styles.chatArea}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id || item._id || Math.random().toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          getItemLayout={(_, index) => ({ length: 80, offset: 80 * index, index })}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={styles.emptyChatText}>No messages yet{'\n'}Say hello! 👋</Text>
            </View>
          }
        />

        {/* Typing indicator */}
        {isTyping && (
          <View style={styles.typingContainer}>
            <View style={styles.typingBubble}>
              <View style={styles.dotRow}>
                {[0, 1, 2].map(i => (
                  <View key={i} style={[styles.typingDot, { opacity: 0.4 + i * 0.3 }]} />
                ))}
              </View>
            </View>
          </View>
        )}
      </LinearGradient>

      {/* ── Reply preview ─────────────────────────────────────────────── */}
      {replyTo && (
        <View style={styles.replyingTo}>
          <View style={styles.replyToBar} />
          <View style={{ flex: 1 }}>
            <Text style={styles.replyingToLabel}>Replying to</Text>
            <Text style={styles.replyingToText} numberOfLines={1}>{replyTo.text || '🎤 Voice Message'}</Text>
          </View>
          <Pressable onPress={() => setReplyTo(null)} style={{ padding: 8 }}>
            <Ionicons name="close" size={20} color="#64748B" />
          </Pressable>
        </View>
      )}

      {/* ── Input bar ─────────────────────────────────────────────────── */}
      <View style={styles.inputArea}>
        {isRecording ? (
          <View style={styles.recordingBar}>
            <Pressable onPress={cancelRecording} style={styles.cancelRecBtn}>
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
            </Pressable>
            <View style={styles.recordingInfo}>
              <Animated.View style={[styles.recDot, { transform: [{ scale: recordingAnim }] }]} />
              <Text style={styles.recTimer}>{formatDuration(recordingDuration)}</Text>
              <Text style={styles.recSlide}>◀ Slide to cancel</Text>
            </View>
            <Pressable onPress={stopRecording} style={styles.sendRecBtn}>
              <LinearGradient colors={['#7C3AED', '#6D28D9']} style={styles.sendRecGrad}>
                <MaterialCommunityIcons name="send" size={20} color="#FFF" />
              </LinearGradient>
            </Pressable>
          </View>
        ) : (
          <View style={styles.inputRow}>
            <View style={styles.inputWrapper}>
              <Pressable style={styles.emojiBtn} onPress={() => {}}>
                <MaterialCommunityIcons name="emoticon-happy-outline" size={22} color="#64748B" />
              </Pressable>

              <TextInput
                ref={inputRef}
                placeholder="Message..."
                value={inputText}
                onChangeText={handleTyping}
                style={styles.textInput}
                multiline
                placeholderTextColor="#475569"
              />

              <View style={styles.inputActions}>
                <Pressable onPress={handleAttachment} style={styles.inputIconBtn}>
                  <MaterialCommunityIcons name="paperclip" size={21} color="#64748B" />
                </Pressable>
                {!inputText && (
                  <Pressable onPress={handleCamera} style={styles.inputIconBtn}>
                    <MaterialCommunityIcons name="camera-outline" size={21} color="#64748B" />
                  </Pressable>
                )}
              </View>
            </View>

            <Pressable
              style={styles.sendBtn}
              onPress={inputText ? sendMessage : undefined}
              onLongPress={!inputText ? startRecording : undefined}
            >
              <LinearGradient
                colors={['#7C3AED', '#6D28D9']}
                style={styles.sendGradient}
              >
                <MaterialCommunityIcons
                  name={inputText ? 'send' : 'microphone'}
                  size={22}
                  color="#FFF"
                />
              </LinearGradient>
            </Pressable>
          </View>
        )}
      </View>

      {/* ── Context Menu Modal ────────────────────────────────────────── */}
      <Modal visible={contextMenuVisible} transparent animationType="none" onRequestClose={closeContextMenu}>
        <Pressable style={styles.contextOverlay} onPress={closeContextMenu}>
          <Animated.View style={[
            styles.contextMenu,
            {
              opacity: contextMenuAnim,
              transform: [{ scale: contextMenuAnim }],
            }
          ]}>
            {/* Quick emoji reactions */}
            <View style={styles.quickEmojiRow}>
              {QUICK_EMOJIS.map(emoji => (
                <Pressable key={emoji} style={styles.quickEmojiBtn} onPress={() => reactToMessage(contextMsg, emoji)}>
                  <Text style={styles.quickEmoji}>{emoji}</Text>
                </Pressable>
              ))}
              <Pressable style={styles.quickEmojiBtn} onPress={() => {}}>
                <MaterialCommunityIcons name="plus" size={20} color="#94A3B8" />
              </Pressable>
            </View>

            <View style={styles.contextDivider} />

            {/* Action items */}
            {[
              { icon: 'reply', label: 'Reply', action: () => { setReplyTo(contextMsg); closeContextMenu(); } },
              { icon: 'content-copy', label: 'Copy', action: () => { Alert.alert('Copied!', contextMsg?.text || ''); closeContextMenu(); } },
              { icon: 'pin-outline', label: 'Pin', action: () => pinMessage(contextMsg) },
              { icon: 'star-outline', label: 'Star', action: () => { Alert.alert('Starred!', 'Message starred.'); closeContextMenu(); } },
              { icon: 'share-outline', label: 'Forward', action: () => { Alert.alert('Forward', 'Select a contact to forward to.'); closeContextMenu(); } },
            ].map(item => (
              <Pressable key={item.label} style={styles.contextItem} onPress={item.action}>
                <MaterialCommunityIcons name={item.icon as any} size={20} color="#C4B5FD" />
                <Text style={styles.contextLabel}>{item.label}</Text>
              </Pressable>
            ))}

            {/* Delete (only for own messages) */}
            {contextMsg?.senderId === (user?.id || user?._id) && (
              <Pressable style={styles.contextItem} onPress={() => deleteMessage(contextMsg)}>
                <MaterialCommunityIcons name="delete-outline" size={20} color="#EF4444" />
                <Text style={[styles.contextLabel, { color: '#EF4444' }]}>Delete</Text>
              </Pressable>
            )}
          </Animated.View>
        </Pressable>
      </Modal>

      {/* ── Wallpaper Picker Modal ────────────────────────────────────── */}
      <Modal visible={showWallpaperPicker} transparent animationType="fade" onRequestClose={() => setShowWallpaperPicker(false)}>
        <View style={styles.wallpaperModal}>
          <View style={styles.wallpaperSheet}>
            <Text style={styles.wallpaperTitle}>Chat Wallpaper</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 16 }}>
              {CHAT_WALLPAPER_COLORS.map((colors, i) => (
                <Pressable
                  key={i}
                  onPress={() => { setWallpaperIndex(i); setShowWallpaperPicker(false); }}
                  style={[styles.wallpaperOption, wallpaperIndex === i && styles.wallpaperSelected]}
                >
                  <LinearGradient colors={colors} style={styles.wallpaperSwatch} />
                  {wallpaperIndex === i && (
                    <View style={styles.wallpaperCheck}>
                      <Ionicons name="checkmark" size={14} color="#FFF" />
                    </View>
                  )}
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={styles.wallpaperClose} onPress={() => setShowWallpaperPicker(false)}>
              <Text style={{ color: '#A78BFA', fontWeight: '700' }}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ── Active Call Overlay ───────────────────────────────────────── */}
      {callActive && (
        <View style={styles.callOverlay}>
          <LinearGradient colors={['#1E1B4B', '#0F172A']} style={styles.callScreen}>
            <Text style={styles.callName}>{recipientName}</Text>
            <Text style={styles.callStatus}>
              {callType === 'video' ? '📹 Video call' : '📞 Voice call'} · {formatDuration(callDuration)}
            </Text>

            <Avatar.Text
              size={100}
              label={recipientName.substring(0, 2).toUpperCase()}
              style={{ backgroundColor: '#4C1D95', marginVertical: 40 }}
              labelStyle={{ color: '#E9D5FF', fontSize: 36, fontWeight: '800' }}
            />

            <View style={styles.callControls}>
              {[
                { icon: 'microphone-off', label: 'Mute', color: '#334155' },
                { icon: 'volume-high', label: 'Speaker', color: '#334155' },
                { icon: callType === 'video' ? 'video-off' : 'camera-off', label: 'Camera', color: '#334155' },
              ].map(ctrl => (
                <View key={ctrl.label} style={styles.callCtrl}>
                  <Pressable style={[styles.callCtrlBtn, { backgroundColor: ctrl.color }]}>
                    <MaterialCommunityIcons name={ctrl.icon as any} size={26} color="#FFF" />
                  </Pressable>
                  <Text style={styles.callCtrlLabel}>{ctrl.label}</Text>
                </View>
              ))}
            </View>

            <Pressable style={styles.endCallBtn} onPress={endCall}>
              <LinearGradient colors={['#DC2626', '#991B1B']} style={styles.endCallGrad}>
                <Ionicons name="call" size={30} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
              </LinearGradient>
            </Pressable>
          </LinearGradient>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' },
  // ── Header ───────────────────────────────────────────────────────────
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: width * 0.5 },
  backBtn: { padding: 4 },
  headerAvatarWrapper: { position: 'relative' },
  headerOnlineDot: { position: 'absolute', bottom: 0, right: 0, width: 11, height: 11, borderRadius: 6, backgroundColor: '#10B981', borderWidth: 2, borderColor: '#1E1B4B' },
  headerMeta: { flex: 1 },
  headerName: { fontSize: 16, fontWeight: '800', color: '#F1F5F9' },
  headerStatus: { fontSize: 12, color: '#64748B' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  headerIconBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  menuContent: { backgroundColor: '#1E293B', borderRadius: 16 },
  menuItemText: { color: '#F1F5F9' },
  headerSearchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, width: width * 0.55 },
  headerSearchInput: { flex: 1, color: '#F1F5F9', fontSize: 14, borderBottomWidth: 1, borderBottomColor: '#7C3AED', paddingVertical: 4 },
  // ── Banners ──────────────────────────────────────────────────────────
  pinnedBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E1B4B', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#312E81' },
  pinnedLabel: { fontSize: 11, fontWeight: '800', color: '#A78BFA', letterSpacing: 0.5 },
  pinnedText: { fontSize: 13, color: '#94A3B8', marginTop: 2 },
  disappearingBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1C1A00', paddingHorizontal: 16, paddingVertical: 7 },
  disappearingText: { fontSize: 12, color: '#F59E0B' },
  // ── Chat area ────────────────────────────────────────────────────────
  chatArea: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 20 },
  emptyChat: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyChatText: { color: '#334155', fontSize: 16, textAlign: 'center', lineHeight: 26 },
  // ── Message rows ─────────────────────────────────────────────────────
  msgRow: { marginBottom: 4, flexDirection: 'column' },
  myMsgRow: { alignItems: 'flex-end' },
  otherMsgRow: { alignItems: 'flex-start' },
  highlightedMsg: { backgroundColor: 'rgba(124,58,237,0.15)', borderRadius: 12 },
  bubbleContainer: { maxWidth: '80%' },
  myBubbleContainer: { alignItems: 'flex-end' },
  otherBubbleContainer: { alignItems: 'flex-start' },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6, overflow: 'hidden' },
  myBubble: { borderTopRightRadius: 4, minWidth: 80 },
  otherBubble: { backgroundColor: '#1E293B', borderTopLeftRadius: 4, minWidth: 80 },
  // ── Reply preview inside bubble ──────────────────────────────────────
  replyPreview: { flexDirection: 'row', borderRadius: 8, marginBottom: 6, overflow: 'hidden', maxWidth: '100%' },
  myReplyPreview: { backgroundColor: 'rgba(0,0,0,0.25)' },
  otherReplyPreview: { backgroundColor: 'rgba(255,255,255,0.08)' },
  replyBar: { width: 3, backgroundColor: '#A78BFA' },
  replyText: { flex: 1, paddingHorizontal: 8, paddingVertical: 5, fontSize: 12, color: '#94A3B8' },
  // ── Text & time ──────────────────────────────────────────────────────
  msgText: { fontSize: 15, color: '#CBD5E1', lineHeight: 22 },
  myMsgText: { color: '#F1F5F9' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  myTimeRow: { justifyContent: 'flex-end' },
  otherTimeRow: { justifyContent: 'flex-start' },
  timeText: { fontSize: 11, color: '#64748B' },
  myTimeText: { color: 'rgba(255,255,255,0.5)' },
  statusRow: { alignSelf: 'flex-end', marginTop: 2, marginRight: 4 },
  // ── Audio ────────────────────────────────────────────────────────────
  audioRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 200 },
  playBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  waveform: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2 },
  wavBar: { width: 2.5, borderRadius: 2 },
  audioDur: { fontSize: 11 },
  // ── Image placeholder ────────────────────────────────────────────────
  imagePlaceholder: { width: 160, height: 120, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', gap: 6 },
  // ── Reactions ────────────────────────────────────────────────────────
  reactionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4, marginBottom: 4 },
  reactionPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#334155' },
  reactionEmoji: { fontSize: 14 },
  reactionCount: { fontSize: 11, color: '#94A3B8', marginLeft: 3 },
  // ── Typing ───────────────────────────────────────────────────────────
  typingContainer: { paddingHorizontal: 16, paddingBottom: 8 },
  typingBubble: { backgroundColor: '#1E293B', borderRadius: 18, borderTopLeftRadius: 4, padding: 12, alignSelf: 'flex-start' },
  dotRow: { flexDirection: 'row', gap: 5 },
  typingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#7C3AED' },
  // ── Reply strip ──────────────────────────────────────────────────────
  replyingTo: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E1B4B', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#312E81' },
  replyToBar: { width: 3, height: '100%', backgroundColor: '#7C3AED', borderRadius: 2, marginRight: 10 },
  replyingToLabel: { fontSize: 11, fontWeight: '800', color: '#A78BFA' },
  replyingToText: { fontSize: 13, color: '#94A3B8', marginTop: 2 },
  // ── Input area ───────────────────────────────────────────────────────
  inputArea: { backgroundColor: '#0F172A', paddingHorizontal: 10, paddingVertical: 8, paddingBottom: Platform.OS === 'ios' ? 24 : 10, borderTopWidth: 0.5, borderTopColor: '#1E293B' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  inputWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 28, paddingLeft: 4, paddingRight: 8, minHeight: 48, maxHeight: 150 },
  emojiBtn: { padding: 8 },
  textInput: { flex: 1, color: '#F1F5F9', fontSize: 15, paddingVertical: 10, maxHeight: 120 } as any,
  inputActions: { flexDirection: 'row', alignItems: 'center' },
  inputIconBtn: { padding: 8 },
  sendBtn: { width: 48, height: 48 },
  sendGradient: { flex: 1, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  // ── Recording bar ────────────────────────────────────────────────────
  recordingBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4 },
  cancelRecBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center' },
  recordingInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1E293B', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 12 },
  recDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#EF4444' },
  recTimer: { fontSize: 16, fontWeight: '700', color: '#F1F5F9' },
  recSlide: { fontSize: 13, color: '#64748B' },
  sendRecBtn: { width: 48, height: 48 },
  sendRecGrad: { flex: 1, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  // ── Context menu ─────────────────────────────────────────────────────
  contextOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  contextMenu: { backgroundColor: '#1E293B', borderRadius: 20, width: '100%', overflow: 'hidden', elevation: 20, shadowColor: '#7C3AED', shadowOpacity: 0.3, shadowRadius: 20 },
  quickEmojiRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 16, paddingHorizontal: 8 },
  quickEmojiBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center' },
  quickEmoji: { fontSize: 22 },
  contextDivider: { height: 1, backgroundColor: '#334155' },
  contextItem: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingVertical: 16 },
  contextLabel: { fontSize: 16, color: '#F1F5F9', fontWeight: '600' },
  // ── Wallpaper picker ─────────────────────────────────────────────────
  wallpaperModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  wallpaperSheet: { backgroundColor: '#1E293B', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  wallpaperTitle: { fontSize: 18, fontWeight: '800', color: '#F1F5F9', textAlign: 'center' },
  wallpaperOption: { marginRight: 12, borderRadius: 14, overflow: 'hidden', position: 'relative' },
  wallpaperSelected: { borderWidth: 3, borderColor: '#7C3AED' },
  wallpaperSwatch: { width: 80, height: 120, borderRadius: 12 },
  wallpaperCheck: { position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 11, backgroundColor: '#7C3AED', justifyContent: 'center', alignItems: 'center' },
  wallpaperClose: { alignItems: 'center', marginTop: 20 },
  // ── Call overlay ─────────────────────────────────────────────────────
  callOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 },
  callScreen: { flex: 1, alignItems: 'center', paddingTop: 80 },
  callName: { fontSize: 28, fontWeight: '900', color: '#F1F5F9' },
  callStatus: { fontSize: 15, color: '#A78BFA', marginTop: 8 },
  callControls: { flexDirection: 'row', gap: 32, marginBottom: 50 },
  callCtrl: { alignItems: 'center', gap: 10 },
  callCtrlBtn: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
  callCtrlLabel: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
  endCallBtn: { width: 72, height: 72 },
  endCallGrad: { flex: 1, borderRadius: 36, justifyContent: 'center', alignItems: 'center' },
});
