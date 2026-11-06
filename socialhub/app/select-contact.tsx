import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  StatusBar,
  Platform,
} from 'react-native';
import { Text, Avatar } from 'react-native-paper';
import { useRouter, Stack } from 'expo-router';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import apiService from '@/services/api';
import { useAuth } from '@/context/AuthContext';

export default function SelectContactScreen() {
  const [users, setUsers] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { user: currentUser, socket } = useAuth();
  const router = useRouter();

  useEffect(() => {
    fetchUsers();
  }, [currentUser]);

  useEffect(() => {
    if (socket) {
      socket.on('user_status_changed', ({ userId, isOnline }: { userId: string, isOnline: boolean }) => {
        setUsers(prev => prev.map(u => u._id === userId ? { ...u, isOnline } : u));
        setFilteredUsers(prev => prev.map(u => u._id === userId ? { ...u, isOnline } : u));
      });

      return () => {
        socket.off('user_status_changed');
      };
    }
  }, [socket]);

  const fetchUsers = async () => {
    try {
      console.log('Fetching users from API...');
      const data = await apiService.getAllUsers();
      console.log('Users received:', data?.length);

      const currentUserId = currentUser?.id || currentUser?._id;
      console.log('Current User ID:', currentUserId);

      // Remove current user from general list
      const otherUsers = Array.isArray(data) ? data.filter((u: any) => u._id !== currentUserId) : [];
      setUsers(otherUsers);
      setFilteredUsers(otherUsers);
    } catch (error) {
      console.error('Fetch users error:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchUsers();
  }, [currentUser]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    const filtered = users.filter(u =>
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(query.toLowerCase()) ||
      u.username.toLowerCase().includes(query.toLowerCase())
    );
    setFilteredUsers(filtered);
  };

  const startChat = async (recipientId: string) => {
    if (!recipientId) {
      console.error('Cannot start chat: Recipient ID is missing');
      Alert.alert('Error', 'User information is missing');
      return;
    }

    try {
      console.log('Starting chat with:', recipientId);
      const conversation = await apiService.getOrCreateConversation(recipientId);
      console.log('Conversation obtained:', conversation?._id);

      if (conversation?._id) {
        router.replace(`/chat/${conversation._id}` as any);
      } else {
        throw new Error('No conversation ID returned');
      }
    } catch (error: any) {
      console.error('Start chat error:', error);
      Alert.alert('Chat Error', error.message || 'Failed to start conversation');
    }
  };

  const renderUserItem = ({ item }: { item: any }) => (
    <Pressable style={styles.userItem} onPress={() => startChat(item._id)}>
      <View style={styles.avatarContainer}>
        {item.profilePicture ? (
          <Avatar.Image size={50} source={{ uri: item.profilePicture }} />
        ) : (
          <Avatar.Text
            size={50}
            label={(item.firstName || 'U').substring(0, 2).toUpperCase()}
            style={{ backgroundColor: '#7C3AED' }}
          />
        )}
        {item.isOnline && <View style={styles.onlineIndicator} />}
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.firstName} {item.lastName}</Text>
        <Text style={styles.userBio}>@{item.username}</Text>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      {/* Custom Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={22} color="#0F172A" />
        </Pressable>
        <Text style={styles.headerTitle}>New Message</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search name or username..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={handleSearch}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => handleSearch('')}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        data={filteredUsers}
        renderItem={renderUserItem}
        keyExtractor={(item) => item._id}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={['#7C3AED']} tintColor="#7C3AED" />
        }
        ListHeaderComponent={() => (
          <View>
            {/* Quick actions */}
            <Pressable style={styles.actionItem} onPress={() => { }}>
              <View style={styles.actionIcon}>
                <MaterialCommunityIcons name="account-group" size={22} color="#FFF" />
              </View>
              <View style={styles.actionTextBlock}>
                <Text style={styles.actionText}>New Group</Text>
                <Text style={styles.actionSub}>Create a group conversation</Text>
              </View>
            </Pressable>

            <Pressable style={styles.actionItem} onPress={() => startChat(currentUser?.id || currentUser?._id || '')}>
              <View style={[styles.avatarContainer]}>
                {currentUser?.profilePicture ? (
                  <Avatar.Image size={50} source={{ uri: currentUser.profilePicture }} />
                ) : (
                  <Avatar.Text
                    size={50}
                    label={(currentUser?.firstName || 'M').substring(0, 2).toUpperCase()}
                    style={{ backgroundColor: '#7C3AED' }}
                  />
                )}
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>Note to self</Text>
                <Text style={styles.userBio}>Save notes and reminders</Text>
              </View>
            </Pressable>

            <Text style={styles.sectionTitle}>
              {searchQuery ? `Results for "${searchQuery}"` : 'People on SocialHub'}
            </Text>
          </View>
        )}
        ListEmptyComponent={() => (
          isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#7C3AED" />
              <Text style={styles.loadingText}>Finding people...</Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="account-search-outline" size={56} color="#E2E8F0" />
              <Text style={styles.emptyTitle}>No users found</Text>
              <Text style={styles.emptyText}>
                {searchQuery ? `No results for "${searchQuery}"` : 'No users available right now'}
              </Text>
            </View>
          )
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 44,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  // Search
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 46,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
    paddingVertical: 0,
  },
  // Actions
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
  },
  actionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionTextBlock: {
    marginLeft: 14,
    flex: 1,
  },
  actionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginLeft: 14,
  },
  actionSub: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  // User list
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  avatarContainer: {
    position: 'relative',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  userInfo: {
    marginLeft: 14,
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  userBio: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#F8FAFC',
    marginTop: 8,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  // Empty / Loading
  loadingContainer: {
    alignItems: 'center',
    marginTop: 60,
    gap: 12,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 15,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#334155',
    marginTop: 16,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
});
