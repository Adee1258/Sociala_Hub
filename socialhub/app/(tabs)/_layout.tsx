import { Stack, useRouter, usePathname } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text } from 'react-native-paper';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function TabButton({
  name,
  icon,
  isActive,
  onPress,
}: {
  name: string;
  icon: 'house.fill' | 'play.rectangle.fill' | 'gamecontroller.fill' | 'message.fill';
  isActive: boolean;
  onPress: () => void;
}) {
  const color = isActive ? '#7C3AED' : '#64748B';

  return (
    <Pressable onPress={onPress} style={styles.tabButton}>
      <IconSymbol size={24} name={icon} color={color} />
      <Text style={[styles.tabLabel, { color }]}>{name}</Text>
      {isActive && <View style={styles.activeIndicator} />}
    </Pressable>
  );
}

function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 375;

  const getActiveTab = () => {
    if (pathname.includes('reels')) return 'reels';
    if (pathname.includes('games')) return 'games';
    if (pathname.includes('chat')) return 'chat';
    return 'feed';
  };

  const activeTab = getActiveTab();

  return (
    <View style={{ paddingTop: insets.top }}>
      {/* App Header */}
      <View style={[styles.appHeader, isSmallScreen && styles.appHeaderSmall]}>
        <Text style={[styles.appName, isSmallScreen && styles.appNameSmall]}>SocialHub</Text>
        <View style={styles.headerActions}>
          <Pressable 
            style={[styles.iconButton, isSmallScreen && styles.iconButtonSmall]}
            onPress={() => router.push('/(tabs)/search')}>
            <IconSymbol size={isSmallScreen ? 20 : 24} name="magnifyingglass" color="#0F172A" />
          </Pressable>
          <Pressable 
            style={[styles.iconButton, isSmallScreen && styles.iconButtonSmall]}
            onPress={() => router.push('/(tabs)/menu')}>
            <IconSymbol size={isSmallScreen ? 20 : 24} name="line.3.horizontal" color="#0F172A" />
          </Pressable>
        </View>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TabButton
          name="Feed"
          icon="house.fill"
          isActive={activeTab === 'feed'}
          onPress={() => router.replace('/(tabs)')}
        />
        <TabButton
          name="Reels"
          icon="play.rectangle.fill"
          isActive={activeTab === 'reels'}
          onPress={() => router.replace('/(tabs)/reels')}
        />
        <TabButton
          name="Chat"
          icon="message.fill"
          isActive={activeTab === 'chat'}
          onPress={() => router.replace('/(tabs)/chat')}
        />
        <TabButton
          name="Games"
          icon="gamecontroller.fill"
          isActive={activeTab === 'games'}
          onPress={() => router.replace('/(tabs)/games')}
        />
        <Pressable 
          style={styles.tabButton}
          onPress={() => router.push('/(tabs)/notifications')}>
          <IconSymbol size={24} name="bell.fill" color="#64748B" />
          <Text style={[styles.tabLabel, { color: '#64748B' }]}>Notify</Text>
          <View style={styles.badge} />
        </Pressable>
      </View>
    </View>
  );
}

export default function TabLayout() {
  const pathname = usePathname();
  const showHeader = !pathname.includes('profile');

  return (
    <View style={styles.container}>
      {showHeader && <AppHeader />}
      <View style={styles.screenContainer}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="reels" />
          <Stack.Screen name="games" />
          <Stack.Screen name="chat" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="search" />
          <Stack.Screen name="menu" />
          <Stack.Screen name="profile" />
        </Stack>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    minHeight: 56,
  },
  appHeaderSmall: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    minHeight: 48,
  },
  appName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#7C3AED',
  },
  appNameSmall: {
    fontSize: 18,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonSmall: {
    padding: 6,
    minWidth: 32,
    minHeight: 32,
    borderRadius: 8,
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingTop: 8,
    paddingBottom: 4,
    paddingHorizontal: 8,
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 14,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  tabButton: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    position: 'relative',
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    width: 20,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#7C3AED',
  },
  screenContainer: {
    flex: 1,
    overflow: 'hidden',
  },
});
