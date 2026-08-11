import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, Pressable, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { Text, Avatar, Searchbar, Surface, IconButton } from 'react-native-paper';
import { useRouter, Stack } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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
      <Stack.Screen
        options={{
          title: 'Select contact',
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
        }}
      />

      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Search name or username"
          onChangeText={handleSearch}
          value={searchQuery}
          style={styles.searchBar}
          inputStyle={styles.searchInput}
          elevation={0}
        />
      </View>

      <FlatList
        data={filteredUsers}
        renderItem={renderUserItem}
        keyExtractor={(item) => item._id}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={['#7C3AED']} />
        }
        ListHeaderComponent={() => (
          <View>
            <Pressable style={styles.actionItem} onPress={() => { }}>
              <Surface style={styles.actionIcon} elevation={0}>
                <MaterialCommunityIcons name="group" size={24} color="#FFF" />
              </Surface>
              <Text style={styles.actionText}>New group</Text>
            </Pressable>

            <Pressable style={styles.actionItem} onPress={() => { }}>
              <Surface style={styles.actionIcon} elevation={0}>
                <MaterialCommunityIcons name="account-plus" size={24} color="#FFF" />
              </Surface>
              <Text style={styles.actionText}>New contact</Text>
            </Pressable>

            <Pressable style={styles.actionItem} onPress={() => startChat(currentUser?.id || currentUser?._id || '')}>
              <View style={styles.avatarContainer}>
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
                <Text style={styles.userName}>Message yourself (You)</Text>
                <Text style={styles.userBio}>Message yourself for notes/testing</Text>
              </View>
            </Pressable>

            <Text style={styles.sectionTitle}>Contacts on SocialHub</Text>
          </View>
        )}
        ListEmptyComponent={() => (
          isLoading ? (
            <ActivityIndicator style={{ marginTop: 50 }} color="#7C3AED" />
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No users found</Text>
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
    backgroundColor: '#FFF',
  },
  searchContainer: {
    paddingHorizontal: 15,
    paddingBottom: 10,
    backgroundColor: '#FFF',
  },
  searchBar: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    height: 45,
  },
  searchInput: {
    fontSize: 15,
    minHeight: 0,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  actionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    marginLeft: 15,
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
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
    marginLeft: 15,
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  userBio: {
    fontSize: 14,
    color: '#64748B',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#F8FAFC',
    marginTop: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 50,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 16,
  },
});
