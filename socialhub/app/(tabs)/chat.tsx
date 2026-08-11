import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Dimensions,
  ScrollView,
  TextInput,
  Animated,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Text, Avatar, FAB, Badge, ActivityIndicator, Menu, IconButton } from 'react-native-paper';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import apiService from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

type ChatTab = 'chats' | 'status' | 'calls';

// Sample call log entries for Calls tab
const sampleCalls = [
  { id: '1', name: 'Ali Hassan', type: 'audio', direction: 'incoming', time: '2 min ago', duration: '5:23', missed: false },
  { id: '2', name: 'Sara Khan', type: 'video', direction: 'outgoing', time: '1 hr ago', duration: '12:07', missed: false },
  { id: '3', name: 'Ahmed Raza', type: 'audio', direction: 'incoming', time: 'Yesterday', duration: '', missed: true },
];

export default function ChatListScreen() {
  const [activeTab, setActiveTab] = useState<ChatTab>('chats');
  const [conversations, setConversations] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const searchInputRef = useRef<TextInput>(null);
  const searchAnim = useRef(new Animated.Value(0)).current;

  const { user, socket } = useAuth();
  const router = useRouter();

  // Load pinned chats from AsyncStorage
  useEffect(() => {
    AsyncStorage.getItem('pinnedChats').then(val => {
      if (val) setPinnedIds(JSON.parse(val));
    });
  }, []);

  const savePinned = async (ids: string[]) => {
    setPinnedIds(ids);
    await AsyncStorage.setItem('pinnedChats', JSON.stringify(ids));
  };

  const togglePin = (id: string) => {
    const newPinned = pinnedIds.includes(id)
      ? pinnedIds.filter(p => p !== id)
      : [id, ...pinnedIds];
    savePinned(newPinned);
  };

  const fetchConversations = async () => {
    try {
      const data = await apiService.getConversations();
      setConversations(data);
    } catch (error) {
      console.error('Fetch conversations error:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (socket) {
      socket.on('user_status_changed', ({ userId, isOnline }: { userId: string; isOnline: boolean }) => {
        setConversations(prev =>
          prev.map(conv => {
            if (!conv.isGroup) {
              const updatedParticipants = conv.participants.map((p: any) =>
                p.user?._id === userId || p.user?.id === userId ? { ...p, user: { ...p.user, isOnline } } : p
              );
              return { ...conv, participants: updatedParticipants };
            }
            return conv;
          })
        );
      });

      socket.on('receive_message', (data: any) => {
        setConversations(prev =>
          prev.map(conv =>
            conv.id === data.conversationId || conv._id === data.conversationId
              ? { ...conv, lastMessage: data.message, updatedAt: new Date().toISOString() }
              : conv
          )
        );
      });

      return () => {
        socket.off('user_status_changed');
        socket.off('receive_message');
      };
    }
  }, [socket]);

  useFocusEffect(
    useCallback(() => {
      fetchConversations();
    }, [])
  );

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchConversations();
  };

  const openSearch = () => {
    setIsSearching(true);
    Animated.timing(searchAnim, { toValue: 1, duration: 250, useNativeDriver: false }).start(() => {
      searchInputRef.current?.focus();
    });
  };

  const closeSearch = () => {
    setIsSearching(false);
    setSearchQuery('');
    Animated.timing(searchAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  };

  const getRecipient = (conv: any) => {
    if (!conv.participants) return null;
    const me = user?.id || user?._id;
    const participant = conv.participants.find(
      (p: any) => p.user?.id !== me && p.user?._id !== me
    );
    return participant?.user || conv.participants[0]?.user;
  };

  const getDisplayName = (conv: any) => {
    if (conv.isGroup) return conv.groupName || 'Group Chat';
    const rec = getRecipient(conv);
    if (!rec) return 'Unknown';
    return `${rec.firstName || ''} ${rec.lastName || ''}`.trim();
  };

  const getLastMessageText = (conv: any) => {
    const msg = conv.lastMessage;
    if (!msg) return 'Say hello! 👋';
    if (msg.text) return msg.text;
    if (msg.media?.length) return '📷 Media';
    return 'No messages yet';
  };

  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery) return true;
    const name = getDisplayName(conv).toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  const pinnedConvs = filteredConversations.filter(c => pinnedIds.includes(c.id || c._id));
  const unpinnedConvs = filteredConversations.filter(c => !pinnedIds.includes(c.id || c._id));

  const renderChatItem = ({ item }: { item: any }) => {
    const convId = item.id || item._id;
    const isPinned = pinnedIds.includes(convId);
    const recipient = getRecipient(item);
    const displayName = getDisplayName(item);
    const lastMsg = getLastMessageText(item);
    const time = item.updatedAt
      ? new Date(item.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';
    const isOnline = !item.isGroup && recipient?.isOnline;

    return (
      <Pressable
        style={({ pressed }) => [styles.chatItem, pressed && styles.chatItemPressed]}
        onPress={() => router.push(`/chat/${convId}` as any)}
        onLongPress={() => {
          Alert.alert(
            displayName,
            'Chat options',
            [
              { text: isPinned ? 'Unpin Chat' : 'Pin Chat', onPress: () => togglePin(convId) },
              { text: 'Delete Chat', style: 'destructive', onPress: () => {} },
              { text: 'Cancel', style: 'cancel' },
            ]
          );
        }}
      >
        {/* Avatar with status ring */}
        <View style={styles.avatarWrapper}>
          <LinearGradient
            colors={isOnline ? ['#7C3AED', '#EC4899', '#F59E0B'] : ['transparent', 'transparent']}
            style={[styles.statusRing, !isOnline && { padding: 0 }]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={[styles.avatarInner, { borderColor: isOnline ? '#0F172A' : 'transparent' }]}>
              {(recipient?.profilePicture || item.groupPicture) ? (
                <Avatar.Image
                  size={50}
                  source={{ uri: recipient?.profilePicture || item.groupPicture }}
                />
              ) : (
                <Avatar.Text
                  size={50}
                  label={displayName.substring(0, 2).toUpperCase()}
                  style={{ backgroundColor: '#4C1D95' }}
                  labelStyle={{ color: '#E9D5FF', fontWeight: '800' }}
                />
              )}
            </View>
          </LinearGradient>
          {isOnline && <View style={styles.onlineDot} />}
          {isPinned && (
            <View style={styles.pinBadge}>
              <MaterialCommunityIcons name="pin" size={10} color="#FFF" />
            </View>
          )}
        </View>

        {/* Chat info */}
        <View style={styles.chatInfo}>
          <View style={styles.chatHeaderRow}>
            <Text style={styles.chatName} numberOfLines={1}>
              {displayName}
              {item.isGroup && (
                <Text style={styles.groupBadge}>  👥</Text>
              )}
            </Text>
            <Text style={[styles.chatTime, { color: item.unread > 0 ? '#A78BFA' : '#64748B' }]}>
              {time}
            </Text>
          </View>
          <View style={styles.chatFooterRow}>
            <Text style={[styles.lastMessage, item.unread > 0 && styles.unreadMsg]} numberOfLines={1}>
              {lastMsg}
            </Text>
            {item.unread > 0 && (
              <Badge style={styles.unreadBadge}>{item.unread > 99 ? '99+' : item.unread}</Badge>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  // ── Status Tab ──────────────────────────────────────────────────────
  const renderStatus = () => (
    <ScrollView style={styles.fill} showsVerticalScrollIndicator={false}>
      {/* My status */}
      <TouchableOpacity style={styles.myStatusRow} activeOpacity={0.7}>
        <View style={styles.addStatusWrapper}>
          <Avatar.Image size={56} source={{ uri: user?.profilePicture || 'https://i.pravatar.cc/150?u=me' }} />
          <View style={styles.addStatusIcon}>
            <MaterialCommunityIcons name="plus" size={14} color="#FFF" />
          </View>
        </View>
        <View style={{ marginLeft: 15 }}>
          <Text style={styles.myStatusTitle}>My Status</Text>
          <Text style={styles.myStatusSub}>Tap to add status update</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.sectionDivider} />
      <Text style={styles.sectionLabel}>RECENT UPDATES</Text>

      {/* Placeholder status items */}
      {[
        { name: 'Sara Khan', time: '5 min ago', color: '#7C3AED' },
        { name: 'Ahmed Raza', time: '1 hr ago', color: '#EC4899' },
        { name: 'Bilal Asif', time: '3 hr ago', color: '#F59E0B' },
      ].map((s, i) => (
        <TouchableOpacity key={i} style={styles.statusItem} activeOpacity={0.7}>
          <LinearGradient colors={[s.color, '#EC4899']} style={styles.statusRingGradient}>
            <View style={styles.statusAvatarInner}>
              <Avatar.Text size={46} label={s.name.substring(0, 2).toUpperCase()} style={{ backgroundColor: s.color + '99' }} />
            </View>
          </LinearGradient>
          <View style={{ marginLeft: 15 }}>
            <Text style={styles.statusName}>{s.name}</Text>
            <Text style={styles.statusTime}>{s.time}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  // ── Calls Tab ───────────────────────────────────────────────────────
  const renderCalls = () => (
    <ScrollView style={styles.fill} showsVerticalScrollIndicator={false}>
      {/* Create call link */}
      <TouchableOpacity style={styles.callLinkRow} activeOpacity={0.8}>
        <View style={styles.callLinkIcon}>
          <MaterialCommunityIcons name="link-variant" size={22} color="#A78BFA" />
        </View>
        <View>
          <Text style={styles.callLinkTitle}>Create call link</Text>
          <Text style={styles.callLinkSub}>Share a link for your SocialHub call</Text>
        </View>
      </TouchableOpacity>

      <Text style={styles.sectionLabel}>RECENT</Text>

      {sampleCalls.map(call => (
        <View key={call.id} style={styles.callItem}>
          <Avatar.Text
            size={50}
            label={call.name.substring(0, 2).toUpperCase()}
            style={{ backgroundColor: call.missed ? '#4B1D1D' : '#1D1B4B' }}
            labelStyle={{ color: call.missed ? '#FCA5A5' : '#C4B5FD' }}
          />
          <View style={styles.callInfo}>
            <Text style={[styles.callName, call.missed && { color: '#EF4444' }]}>{call.name}</Text>
            <View style={styles.callMeta}>
              <Ionicons
                name={
                  call.missed ? 'call-outline' :
                  call.direction === 'incoming' ? 'arrow-down-outline' : 'arrow-up-outline'
                }
                size={14}
                color={call.missed ? '#EF4444' : '#64748B'}
              />
              <MaterialCommunityIcons
                name={call.type === 'video' ? 'video-outline' : 'phone-outline'}
                size={13}
                color="#64748B"
                style={{ marginLeft: 4 }}
              />
              <Text style={styles.callTime}>{call.time}</Text>
              {call.duration ? <Text style={styles.callDuration}> · {call.duration}</Text> : null}
            </View>
          </View>
          <IconButton
            icon={call.type === 'video' ? 'video' : 'phone'}
            iconColor="#A78BFA"
            size={22}
            onPress={() => Alert.alert('Call', `Calling ${call.name}...`)}
          />
        </View>
      ))}
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Premium Header ──────────────────────────────────────────── */}
      <LinearGradient colors={['#0F172A', '#1E1B4B']} style={styles.header}>
        {isSearching ? (
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#A78BFA" />
            <TextInput
              ref={searchInputRef}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search conversations..."
              placeholderTextColor="#64748B"
              style={styles.searchInput}
              autoFocus
            />
            <Pressable onPress={closeSearch}>
              <Ionicons name="close" size={22} color="#A78BFA" />
            </Pressable>
          </View>
        ) : (
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.headerTitle}>Messages</Text>
              <Text style={styles.headerSub}>
                {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
              </Text>
            </View>
            <View style={styles.headerActions}>
              <Pressable style={styles.headerIconBtn} onPress={openSearch}>
                <Ionicons name="search" size={22} color="#A78BFA" />
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
                <Menu.Item
                  onPress={() => { setMenuVisible(false); router.push('/select-contact' as any); }}
                  title="New Chat"
                  leadingIcon="message-plus-outline"
                  titleStyle={styles.menuItem}
                />
                <Menu.Item onPress={() => setMenuVisible(false)} title="New Group" leadingIcon="account-group-outline" titleStyle={styles.menuItem} />
                <Menu.Item onPress={() => setMenuVisible(false)} title="Starred Messages" leadingIcon="star-outline" titleStyle={styles.menuItem} />
                <Menu.Item onPress={() => setMenuVisible(false)} title="Settings" leadingIcon="cog-outline" titleStyle={styles.menuItem} />
              </Menu>
            </View>
          </View>
        )}

        {/* ── Tab Bar ─────────────────────────────────────────────── */}
        <View style={styles.tabBar}>
          {(['chats', 'status', 'calls'] as ChatTab[]).map(tab => (
            <Pressable
              key={tab}
              style={[styles.tabItem, activeTab === tab && styles.activeTabItem]}
              onPress={() => setActiveTab(tab)}
            >
              <MaterialCommunityIcons
                name={tab === 'chats' ? 'message-text-outline' : tab === 'status' ? 'circle-outline' : 'phone-outline'}
                size={18}
                color={activeTab === tab ? '#A78BFA' : '#64748B'}
              />
              <Text style={[styles.tabLabel, activeTab === tab && styles.activeTabLabel]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
              {tab === 'chats' && conversations.length > 0 && (
                <View style={styles.tabCountBadge}>
                  <Text style={styles.tabCountText}>{conversations.length}</Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>
      </LinearGradient>

      {/* ── Content ────────────────────────────────────────────────── */}
      {activeTab === 'chats' && (
        <View style={styles.fill}>
          {isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator color="#7C3AED" size="large" />
            </View>
          ) : (
            <FlatList
              data={[
                ...pinnedConvs.map(c => ({ ...c, _sectionPin: true })),
                ...unpinnedConvs,
              ]}
              renderItem={({ item, index }) => {
                const isFirstPinned = item._sectionPin && index === 0;
                const isFirstUnpinned = !item._sectionPin && (pinnedConvs.length === 0 ? index === 0 : index === pinnedConvs.length);
                return (
                  <>
                    {isFirstPinned && (
                      <View style={styles.sectionHeaderRow}>
                        <MaterialCommunityIcons name="pin" size={14} color="#A78BFA" />
                        <Text style={styles.sectionHeaderText}>PINNED</Text>
                      </View>
                    )}
                    {isFirstUnpinned && pinnedConvs.length > 0 && (
                      <View style={styles.sectionHeaderRow}>
                        <MaterialCommunityIcons name="message-text-outline" size={14} color="#64748B" />
                        <Text style={[styles.sectionHeaderText, { color: '#64748B' }]}>ALL CHATS</Text>
                      </View>
                    )}
                    {renderChatItem({ item })}
                  </>
                );
              }}
              keyExtractor={(item) => item.id || item._id}
              contentContainerStyle={[styles.listContent, !filteredConversations.length && styles.emptyList]}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={['#7C3AED']} tintColor="#7C3AED" />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <MaterialCommunityIcons name="message-text-outline" size={70} color="#1E1B4B" />
                  <Text style={styles.emptyTitle}>No conversations yet</Text>
                  <Text style={styles.emptySubtitle}>Start a new chat by tapping the button below</Text>
                </View>
              }
            />
          )}

          <FAB
            icon="message-plus"
            style={styles.fab}
            color="#FFF"
            onPress={() => router.push('/select-contact' as any)}
          />
        </View>
      )}

      {activeTab === 'status' && renderStatus()}
      {activeTab === 'calls' && renderCalls()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  fill: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // ── Header ──────────────────────────────────────────────────────────
  header: {
    paddingTop: 50,
    paddingBottom: 0,
    paddingHorizontal: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#F1F5F9',
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(124,58,237,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContent: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
  },
  menuItem: {
    color: '#F1F5F9',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: '#F1F5F9',
    fontSize: 16,
  },
  // ── Tab Bar ─────────────────────────────────────────────────────────
  tabBar: {
    flexDirection: 'row',
    marginTop: 6,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabItem: {
    borderBottomColor: '#7C3AED',
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  activeTabLabel: {
    color: '#A78BFA',
  },
  tabCountBadge: {
    backgroundColor: '#7C3AED',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: 'center',
  },
  tabCountText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },
  // ── Chat List ────────────────────────────────────────────────────────
  listContent: {
    paddingBottom: 120,
    backgroundColor: '#0F172A',
  },
  emptyList: {
    flexGrow: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#0F172A',
    gap: 6,
  },
  sectionHeaderText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#A78BFA',
    letterSpacing: 1,
  },
  chatItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  chatItemPressed: {
    backgroundColor: '#1E1B4B',
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 14,
  },
  statusRing: {
    borderRadius: 33,
    padding: 2,
  },
  avatarInner: {
    borderRadius: 27,
    borderWidth: 2,
    overflow: 'hidden',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#0F172A',
  },
  pinBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#7C3AED',
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatInfo: {
    flex: 1,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1E293B',
    paddingBottom: 12,
  },
  chatHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F1F5F9',
    flex: 1,
  },
  groupBadge: {
    fontSize: 13,
  },
  chatTime: {
    fontSize: 11,
    color: '#64748B',
  },
  chatFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: 14,
    color: '#64748B',
    flex: 1,
    marginRight: 8,
  },
  unreadMsg: {
    color: '#CBD5E1',
    fontWeight: '600',
  },
  unreadBadge: {
    backgroundColor: '#7C3AED',
    fontSize: 11,
  },
  // ── FAB ─────────────────────────────────────────────────────────────
  fab: {
    position: 'absolute',
    margin: 20,
    right: 0,
    bottom: 20,
    backgroundColor: '#7C3AED',
    borderRadius: 18,
  },
  // ── Empty state ──────────────────────────────────────────────────────
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#334155',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  // ── Status Tab ───────────────────────────────────────────────────────
  myStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    backgroundColor: '#0F172A',
  },
  addStatusWrapper: {
    position: 'relative',
  },
  addStatusIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#10B981',
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  myStatusTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  myStatusSub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  sectionDivider: {
    height: 8,
    backgroundColor: '#1E293B',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 1.2,
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: '#0F172A',
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  statusRingGradient: {
    borderRadius: 30,
    padding: 2.5,
  },
  statusAvatarInner: {
    borderRadius: 26,
    borderWidth: 2.5,
    borderColor: '#0F172A',
    overflow: 'hidden',
  },
  statusName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  statusTime: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  // ── Calls Tab ────────────────────────────────────────────────────────
  callLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    gap: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1E293B',
  },
  callLinkIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(124,58,237,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  callLinkTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  callLinkSub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  callItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1E293B',
  },
  callInfo: {
    flex: 1,
  },
  callName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  callMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  callTime: {
    fontSize: 13,
    color: '#64748B',
    marginLeft: 4,
  },
  callDuration: {
    fontSize: 13,
    color: '#64748B',
  },
});
