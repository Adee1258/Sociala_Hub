import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  Pressable,
  Alert,
  Image,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  Platform,
  TouchableOpacity,
  TextInput,
  Modal
} from 'react-native';
import { Surface, Text, Avatar, ProgressBar, IconButton } from 'react-native-paper';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import apiService from '@/services/api';
import { createVexoraInstance, onProcessMessage } from '@/ai/profile.handlers';
import type { VexoraAI } from '@/ai/profile.vexora';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome, MaterialCommunityIcons, Feather, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  useAnimatedScrollHandler,
  withRepeat,
  withSequence,
  withTiming
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');
const HEADER_HEIGHT = 220;

// Dynamic themes selection as seen in the Customize Profile widget
const THEMES = [
  { id: 'default', name: 'Violet Breeze', colors: ['#7C3AED', '#A855F7', '#EC4899'] as [string, string, string], primary: '#7C3AED' },
  { id: 'sunset', name: 'Sunset Glow', colors: ['#FF5E62', '#FF9966', '#FFD97D'] as [string, string, string], primary: '#FF5E62' },
  { id: 'ocean', name: 'Ocean Mist', colors: ['#00B4DB', '#0083B0', '#6DD5FA'] as [string, string, string], primary: '#0083B0' },
  { id: 'forest', name: 'Aurora Green', colors: ['#11998e', '#38ef7d', '#A8F29A'] as [string, string, string], primary: '#11998e' },
  { id: 'cyberpunk', name: 'Cyber Neon', colors: ['#F107A3', '#7B2CBF', '#3A0CA3'] as [string, string, string], primary: '#F107A3' }
];

const formatCount = (count: number) => {
  if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
  if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
  return count.toString();
};

type ProfileTab = 'posts' | 'reels' | 'insights' | 'security';

export default function ProfileScreen() {
  const { user, isLoading, logout, updateUser, socket } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Custom theme selector state
  const [currentTheme, setCurrentTheme] = useState(THEMES[0]);

  // Selected Profile Frame circle
  const [selectedFrame, setSelectedFrame] = useState<string | null>(null);

  // AI Assistant Chat States
  const [isAiModalVisible, setIsAiModalVisible] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'ai'; text: string; actionId?: string | null }>>([]);
  const [inputText, setInputText] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [isRewardClaiming, setIsRewardClaiming] = useState(false);

  // Story Highlights Modal States
  const [isHighlightModalVisible, setIsHighlightModalVisible] = useState(false);
  const [newHighlightTitle, setNewHighlightTitle] = useState('');
  const [newHighlightImage, setNewHighlightImage] = useState('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=150');

  // Cover photo upload state
  const [coverUploading, setCoverUploading] = useState(false);
  // Avatar upload state
  const [avatarUploading, setAvatarUploading] = useState(false);

  const chatScrollRef = useRef<ScrollView>(null);

  // Vexora Instance Ref
  const vexoraRef = useRef<VexoraAI | null>(null);

  useEffect(() => {
    if (user && !vexoraRef.current) {
      createVexoraInstance(user).then(instance => {
        vexoraRef.current = instance;
      });
    }
  }, [user?._id]);

  useEffect(() => {
    if (user && vexoraRef.current) {
      vexoraRef.current.updateUser(user);
    }
  }, [user]);

  const scrollY = useSharedValue(0);

  // Breathing Animation for AI Icon
  const breathingPulse = useSharedValue(1);
  useEffect(() => {
    breathingPulse.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 1500 }),
        withTiming(1, { duration: 1500 })
      ),
      -1,
      true
    );
  }, []);

  const animatedFabStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathingPulse.value }],
    shadowOpacity: interpolate(breathingPulse.value, [1, 1.1], [0.15, 0.4])
  }));

  // Initialize welcome message when AI modal opens
  useEffect(() => {
    if (user && isAiModalVisible && chatMessages.length === 0) {
      const name = user.firstName || 'there';
      setChatMessages([
        {
          sender: 'ai',
          text: `Hello ${name}, I'm **Vexora** — your AI Profile Assistant.\n\nI speak **English** and **اردو** — just chat in whichever language you prefer and I'll follow along.\n\nHere's what I can help you with:\n\n• **Bio** — personalized bio options for your profession\n• **Profile Audit** — score & improvement tips\n• **Hashtags** — niche-specific tag strategy\n• **Content Ideas** — engagement-focused posts\n• **Theme** — customize your profile appearance\n• **Direct Edits** — update bio, name, location & more\n\nHow can I assist you today?`,
        }
      ]);
    }
  }, [isAiModalVisible]);

  // Load custom Theme and Frame styles from persistent DB on mount or user change
  useEffect(() => {
    if (user) {
      if (user.profileTheme) {
        const matched = THEMES.find(t => t.id === user.profileTheme);
        if (matched) setCurrentTheme(matched);
      }
      if (user.profileFrame) {
        setSelectedFrame(user.profileFrame);
      }
    }
  }, [user?.profileTheme, user?.profileFrame]);

  // Dynamic highlights from user profile (DB-backed)
  const highlights = user?.highlights || [];

  // Highlight preset images for picker modal
  const highlightPresets = [
    { title: 'Travel', image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=150' },
    { title: 'Moments', image: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150' },
    { title: 'Friends', image: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=150' },
    { title: 'Food', image: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=150' },
    { title: 'Sports', image: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=150' },
    { title: 'Music', image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150' },
    { title: 'Nature', image: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=150' },
    { title: 'Work', image: 'https://images.unsplash.com/photo-1497215842964-222b430dc094?w=150' },
  ];

  // Add a new highlight to the user's profile
  const handleAddHighlight = async () => {
    if (!newHighlightTitle.trim()) {
      Alert.alert('Error', 'Please enter a title for your highlight');
      return;
    }
    try {
      const response = await apiService.addHighlight({ title: newHighlightTitle.trim(), image: newHighlightImage });
      if (response && response.success && updateUser) {
        updateUser(response.user);
      }
      setNewHighlightTitle('');
      setIsHighlightModalVisible(false);
    } catch (error) {
      console.error('Add highlight error:', error);
      Alert.alert('Error', 'Failed to add highlight');
    }
  };



  const fetchProfileData = async () => {
    try {
      const response = await apiService.getCurrentUser();
      if (response && response.posts) {
        setUserPosts(response.posts);
      }
      if (response && response.user && updateUser) {
        updateUser(response.user);
      }
    } catch (error) {
      console.error('Fetch profile data error:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchProfileData();
    }, [])
  );

  const onRefresh = async () => {
    setIsRefreshing(true);
    await fetchProfileData();
    setIsRefreshing(false);
  };

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const headerStyle = useAnimatedStyle(() => {
    const height = interpolate(
      scrollY.value,
      [-HEADER_HEIGHT, 0],
      [HEADER_HEIGHT * 2, HEADER_HEIGHT],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(
      scrollY.value,
      [0, HEADER_HEIGHT / 2],
      [1, 0.85],
      Extrapolation.CLAMP
    );
    return { height, opacity };
  });

  const handleLogout = () => {
    const performLogout = async () => {
      try {
        await logout();
      } catch (error) {
        console.error('Profile: Logout execution error:', error);
        Alert.alert('Error', 'Failed to logout. Please try again.');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to logout?')) {
        performLogout();
      }
    } else {
      Alert.alert('Logout', 'Are you sure you want to logout?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: performLogout },
      ]);
    }
  };

  // Facebook-style cover photo picker + upload
  const handleChangeCover = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Needed', 'Please allow access to your photo library to change the cover photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.85,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      const uri = result.assets[0].uri;
      setCoverUploading(true);

      try {
        const response = await apiService.updateProfile({ profileCover: uri });
        if (response?.success && updateUser) {
          updateUser(response.user);
        }
      } catch (err: any) {
        Alert.alert('Upload Failed', err?.message || 'Could not upload cover photo. Please try again.');
      } finally {
        setCoverUploading(false);
      }
    } catch (err) {
      console.error('Cover picker error:', err);
      setCoverUploading(false);
    }
  };

  // Tap avatar to change profile picture directly from profile screen
  const handleChangeAvatar = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Needed', 'Please allow access to your photo library.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      const uri = result.assets[0].uri;
      setAvatarUploading(true);

      try {
        const response = await apiService.updateProfile({ profilePicture: uri });
        if (response?.success && updateUser) {
          updateUser(response.user);
        }
      } catch (err: any) {
        Alert.alert('Upload Failed', err?.message || 'Could not upload profile picture. Please try again.');
      } finally {
        setAvatarUploading(false);
      }
    } catch (err) {
      console.error('Avatar picker error:', err);
      setAvatarUploading(false);
    }
  };

  // Full-Stack Custom Theme Selector Persistence
  const handleThemeSelect = async (themeItem: typeof THEMES[0]) => {
    setCurrentTheme(themeItem);
    try {
      const response = await apiService.saveProfileSettings({ profileTheme: themeItem.id });
      if (response && response.success && updateUser) {
        updateUser(response.user);
      }
    } catch (error) {
      console.error('Failed to persist profile theme:', error);
    }
  };

  // Full-Stack Avatar Frame Customizer Persistence
  const handleFrameSelect = async (frameColor: string | null) => {
    setSelectedFrame(frameColor);
    try {
      const response = await apiService.saveProfileSettings({ profileFrame: frameColor });
      if (response && response.success && updateUser) {
        updateUser(response.user);
      }
    } catch (error) {
      console.error('Failed to persist profile frame:', error);
    }
  };

  // ─── BOSS LEVEL AI ENGINE ────────────────────────────────────────────────────

  // Pending edit — what AI wants to do before user approves
  const [pendingEdit, setPendingEdit] = React.useState<{ field: string; value: string } | null>(null);

  // ─── handleSendMessage with Vexora AI Integration ────────────
  const handleSendMessage = async (textToSend = inputText) => {
    if (!textToSend.trim() || !vexoraRef.current) return;

    setChatMessages(prev => [...prev, { sender: 'user' as const, text: textToSend }]);
    setInputText('');
    setIsAiTyping(true);

    try {
      const result = await onProcessMessage(vexoraRef.current, textToSend);

      // ── If Vexora returned 'confirm' intent AND we have pendingEdit — apply it ──
      if (result.intent === 'confirm' && pendingEdit) {
        setIsAiTyping(false);
        await handleAiAction('confirm_edit', true);
        return;
      }

      // ── If Vexora returned 'cancel' intent — cancel pending ──
      if (result.intent === 'cancel' && pendingEdit) {
        setPendingEdit(null);
        setChatMessages(prev => [...prev, { sender: 'ai' as const, text: result.text }]);
        setIsAiTyping(false);
        return;
      }

      // Theme change — needs confirm button
      if (result.intent === 'theme_change' && result.themeId) {
        setChatMessages(prev => [...prev, {
          sender: 'ai' as const,
          text: result.text,
          actionId: `apply_theme_${result.themeId}`
        }]);
        return;
      }

      // Has pending edit (bio select / direct field edit / seo bio) — needs confirm button
      if (result.pendingEdit) {
        setPendingEdit(result.pendingEdit);
        setChatMessages(prev => [...prev, {
          sender: 'ai' as const,
          text: result.text,
          actionId: 'confirm_edit'
        }]);
        return;
      }

      // isGathering — AI asked a clarifying question, no action buttons needed
      // just show the message as normal AI response
      setChatMessages(prev => [...prev, { sender: 'ai' as const, text: result.text }]);

    } catch (err: any) {
      setChatMessages(prev => [...prev, {
        sender: 'ai' as const,
        text: 'Kuch masla ho gaya. Dobara try karo.'
      }]);
    } finally {
      setIsAiTyping(false);
    }
  };

  // ─── BOSS LEVEL handleAiAction ───────────────────────────────────────────────
  const handleAiAction = async (actionId: string, approved: boolean) => {
    if (!approved) {
      setChatMessages(prev => [...prev, { sender: 'user' as const, text: 'No, cancel.' }]);
      setChatMessages(prev => [...prev, { sender: 'ai' as const, text: "No problem! I won't make any changes. Let me know if you need anything else 😊" }]);
      setPendingEdit(null);
      return;
    }

    setChatMessages(prev => [...prev, { sender: 'user' as const, text: 'Yes, apply it!' }]);
    setIsAiTyping(true);

    try {
      // ── Direct profile field edit ──────────────────────────────────────────
      if (actionId === 'confirm_edit' && pendingEdit) {
        const { field, value } = pendingEdit;

        if (field === 'bio') {
          const res = await apiService.updateProfile({ bio: value });
          if (res?.success && updateUser) updateUser(res.user);
          setChatMessages(prev => [...prev, {
            sender: 'ai' as const,
            text: `✅ Bio updated successfully!\n\nNew bio: "${value}"\n\nYour profile is live with the new bio! 🚀\n\n---\n💡 **Aur improve kar sakte hain:**\n• Hashtags chahiye? **"hashtags do"** likho\n• Post ideas? **"post ideas do"** likho\n• Profile audit? **"profile check karo"** likho`
          }]);
        }
        else if (field === 'name') {
          const parts = value.trim().split(/\s+/);
          const firstName = parts[0];
          const lastName = parts.slice(1).join(' ') || '';
          const res = await apiService.updateProfile({ firstName, lastName });
          if (res?.success && updateUser) updateUser(res.user);
          setChatMessages(prev => [...prev, { sender: 'ai' as const, text: `✅ Display name updated to **${value}**! Looking great 🎉` }]);
        }
        else if (field === 'username') {
          const res = await apiService.updateProfile({ username: value.toLowerCase() });
          if (res?.success && updateUser) updateUser(res.user);
          setChatMessages(prev => [...prev, { sender: 'ai' as const, text: `✅ Username changed to **@${value}**! Your new handle is live 🔥` }]);
        }
        else if (field === 'website') {
          const res = await apiService.updateProfile({ website: value });
          if (res?.success && updateUser) updateUser(res.user);
          setChatMessages(prev => [...prev, { sender: 'ai' as const, text: `✅ Website link added: **${value}** — visitors can now find your work! 🔗` }]);
        }
        else if (field === 'address') {
          const res = await apiService.updateProfile({ address: value });
          if (res?.success && updateUser) updateUser(res.user);
          setChatMessages(prev => [...prev, { sender: 'ai' as const, text: `✅ Location updated to **${value}**! Your profile now shows your city 📍` }]);
        }
        setPendingEdit(null);
      }

      // ── Theme apply ────────────────────────────────────────────────────────
      else if (actionId.startsWith('apply_theme_')) {
        const themeId = actionId.replace('apply_theme_', '');
        const target = THEMES.find(x => x.id === themeId) || THEMES[0];
        await handleThemeSelect(target);
        setChatMessages(prev => [...prev, { sender: 'ai' as const, text: `✅ **${target.name}** theme applied! Your profile gradient is now live 🎨` }]);
      }

    } catch (err: any) {
      const msg = err?.message?.toLowerCase() || '';
      if (msg.includes('120 days') || msg.includes('username')) {
        setChatMessages(prev => [...prev, { sender: 'ai' as const, text: `⚠️ Username can only be changed once every 120 days. Try a different field!` }]);
      } else {
        setChatMessages(prev => [...prev, { sender: 'ai' as const, text: `❌ Update failed: ${err?.message || 'Something went wrong. Please try again.'}` }]);
      }
    } finally {
      setIsAiTyping(false);
    }
  };

  // Gamified XP / Coin claim transaction in MongoDB
  const handleClaimTodayReward = async () => {
    if (user?.todayRewardClaimed) {
      Alert.alert('Reward Claimed', 'You have already claimed today\'s reward! Please come back tomorrow for more coins and XP.');
      return;
    }

    try {
      setIsRewardClaiming(true);
      const response = await apiService.saveProfileSettings({ claimTodayReward: true });

      if (response && response.success) {
        if (updateUser) updateUser(response.user);

        if (response.didLevelUp) {
          Alert.alert(
            '🎉 Level Up!',
            `Awesome work! You gained +${response.gainedXp} XP and leveled up to Level ${response.level}! A new achievement badge has been unlocked in your trophy room!`,
            [{ text: 'Woohoo!' }]
          );
        } else {
          Alert.alert(
            '🎁 Reward Claimed!',
            `You received 50 Coins and +${response.gainedXp} XP in real-time! Keep up the daily streak to climb faster!`
          );
        }
      }
    } catch (error) {
      console.error('Claim rewards error:', error);
      Alert.alert('Claim Failed', 'Could not complete reward claim transaction.');
    } finally {
      setIsRewardClaiming(false);
    }
  };

  useEffect(() => {
    if (chatScrollRef.current) {
      setTimeout(() => {
        chatScrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [chatMessages, isAiTyping]);

  // Display fields
  const usernameDisplay = user?.username || '';
  const bioDisplay = user?.bio || '';
  const displayName = user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : '';

  const initials = useMemo(() => {
    if (user?.firstName) {
      const firstInitial = user.firstName.charAt(0);
      const lastInitial = user.lastName ? user.lastName.charAt(0) : '';
      return `${firstInitial}${lastInitial}`.toUpperCase();
    }
    return '?';
  }, [user?.firstName, user?.lastName]);

  const activeThemeAccent = currentTheme.primary;

  if (isLoading || !user) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={{ marginTop: 10, color: '#64748B' }}>Loading Profile...</Text>
      </View>
    );
  }

  const displayPosts = userPosts;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── FIXED Top Nav — always above scroll, never blocked ── */}
      <View style={styles.fixedTopNav} pointerEvents="box-none">
        <Pressable
          style={styles.topNavBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialCommunityIcons name="chevron-left" size={28} color="#FFF" />
        </Pressable>
        <View style={styles.topNavRight}>
          <Pressable
            style={styles.topNavBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialCommunityIcons name="magnify" size={24} color="#FFF" />
          </Pressable>
          <Pressable
            style={styles.topNavBtn}
            onPress={() => setActiveTab('security')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="shield" size={22} color="#FFF" />
          </Pressable>
          <Pressable
            style={styles.topNavBtn}
            onPress={handleLogout}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialCommunityIcons name="logout" size={22} color="#FFF" />
          </Pressable>
        </View>
      </View>

      {/* ── Facebook-style Cover Photo ── */}
      <Animated.View style={[styles.headerBg, headerStyle]}>
        {user?.profileCover ? (
          /* User has uploaded a cover — show it */
          <Image
            source={{ uri: user.profileCover }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
          />
        ) : (
          /* No cover — show theme gradient (matches user's selected theme) */
          <LinearGradient
            colors={currentTheme.colors as [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
        )}

        {/* Subtle dark overlay only when cover photo exists */}
        {user?.profileCover && (
          <LinearGradient
            colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.45)']}
            style={StyleSheet.absoluteFillObject}
          />
        )}

        {/* Camera button — bottom right, Facebook style */}
        <TouchableOpacity
          style={styles.coverCameraBtn}
          onPress={handleChangeCover}
          disabled={coverUploading}
          activeOpacity={0.8}
        >
          {coverUploading ? (
            <ActivityIndicator size={16} color="#FFF" />
          ) : (
            <MaterialCommunityIcons name="camera-plus" size={18} color="#FFF" />
          )}
        </TouchableOpacity>
      </Animated.View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
      >
        {/* Profile Stats & Identity Section */}
        <View style={styles.profileDetailsCard}>
          <View style={styles.avatarMainRow}>
            {/* Tappable Avatar — tap to change profile picture */}
            <TouchableOpacity
              onPress={handleChangeAvatar}
              disabled={avatarUploading}
              activeOpacity={0.85}
              style={styles.avatarTouchable}
            >
              <View style={[
                styles.avatarFrameWrapper,
                selectedFrame ? { borderColor: selectedFrame, borderWidth: 4 } : { borderColor: '#E2E8F0', borderWidth: 2 }
              ]}>
                {avatarUploading ? (
                  <View style={[styles.avatarLoadingOverlay, { backgroundColor: activeThemeAccent }]}>
                    <ActivityIndicator color="#FFF" size="small" />
                  </View>
                ) : user?.profilePicture ? (
                  <Avatar.Image size={96} source={{ uri: user.profilePicture }} />
                ) : (
                  <Avatar.Text
                    size={96}
                    label={initials}
                    style={{ backgroundColor: activeThemeAccent }}
                  />
                )}
                {/* Online Green Badge */}
                <View style={styles.onlineStatusBadge} />
              </View>
              {/* Camera badge on avatar */}
              <View style={styles.avatarCameraBadge}>
                <MaterialCommunityIcons name="camera" size={14} color="#FFF" />
              </View>
            </TouchableOpacity>

            {/* Edit Profile Button */}
            <TouchableOpacity
              style={[styles.editProfileBtn, { borderColor: activeThemeAccent }]}
              onPress={() => router.push('/edit-profile' as any)}
            >
              <Text style={[styles.editProfileBtnText, { color: activeThemeAccent }]}>Edit Profile</Text>
            </TouchableOpacity>
          </View>

          {/* Name & Handle Badges */}
          <View style={styles.nameHeaderGroup}>
            <View style={styles.displayRow}>
              <Text style={styles.displayNameText}>{displayName || 'New User'}</Text>
              {user?.isVerified && <MaterialCommunityIcons name="check-decagram" size={22} color="#3B82F6" style={styles.verifiedTick} />}
            </View>
            <View style={styles.handleAndProRow}>
              <Text style={styles.handleText}>@{usernameDisplay}</Text>
            </View>
          </View>

          {/* Stats Bar */}
          <View style={styles.statisticsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNumText}>{user?.postsCount || 0}</Text>
              <Text style={styles.statSubText}>Posts</Text>
            </View>
            <View style={styles.dividerBar} />
            <View style={styles.statBox}>
              <Text style={styles.statNumText}>{formatCount(user?.followersCount || 0)}</Text>
              <Text style={styles.statSubText}>Followers</Text>
            </View>
            <View style={styles.dividerBar} />
            <View style={styles.statBox}>
              <Text style={styles.statNumText}>{formatCount(user?.followingCount || 0)}</Text>
              <Text style={styles.statSubText}>Following</Text>
            </View>
          </View>

          {/* Bio Description Details */}
          {bioDisplay ? (
            <Text style={styles.bioTextContent}>{bioDisplay}</Text>
          ) : (
            <Text style={[styles.bioTextContent, { color: '#94A3B8', fontStyle: 'italic' }]}>No bio yet</Text>
          )}

          {/* Location / Calendar / Website metadata rows — Dynamic from DB */}
          <View style={styles.metaDataList}>
            {(user?.address) && (
              <View style={styles.metaItem}>
                <MaterialCommunityIcons name="map-marker-outline" size={18} color="#64748B" />
                <Text style={styles.metaItemText}>{user.address}</Text>
              </View>
            )}
            {(user?.dateOfBirth) && (
              <View style={styles.metaItem}>
                <Feather name="calendar" size={16} color="#64748B" />
                <Text style={styles.metaItemText}>Born {user.dateOfBirth.day} {user.dateOfBirth.month} {user.dateOfBirth.year}</Text>
              </View>
            )}
            {(user?.website) && (
              <TouchableOpacity style={styles.metaItem} onPress={() => Alert.alert('Link', user.website || '')}>
                <Feather name="link" size={16} color={activeThemeAccent} />
                <Text style={[styles.metaItemText, { color: activeThemeAccent, fontWeight: '700' }]}>
                  {user.website}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Story Highlights Scroll row */}
          <View style={styles.highlightsContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.highlightsList}>
              {/* [+] New Highlight button */}
              <TouchableOpacity style={styles.highlightItemContainer} onPress={() => setIsHighlightModalVisible(true)}>
                <View style={styles.addHighlightCircle}>
                  <Feather name="plus" size={26} color="#475569" />
                </View>
                <Text style={styles.highlightTitle}>New</Text>
              </TouchableOpacity>

              {highlights.map((item: any, index: number) => (
                <View key={item._id || item.title + index} style={styles.highlightItemContainer}>
                  <Surface style={styles.highlightImageCircle} elevation={2}>
                    <Image source={{ uri: item.image }} style={styles.highlightThumb} />
                  </Surface>
                  <Text style={styles.highlightTitle} numberOfLines={1}>{item.title}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* Dynamic Theme Gradient Banner */}
        <LinearGradient
          colors={currentTheme.colors as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.slidingThemeAccent}
        />

        {/* Premium Sliding Segmented Tab Bar */}
        <View style={styles.premiumSegmentTabBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScrollContent}>
            {[
              { key: 'posts', label: 'Posts', icon: 'grid-large' as const },
              { key: 'reels', label: 'Reels', icon: 'play-box-multiple-outline' as const },
              { key: 'insights', label: 'Insights', icon: 'chart-box-outline' as const },
              { key: 'security', label: 'Security & Theme', icon: 'shield-check-outline' as const }
            ].map(tab => {
              const isSelected = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[
                    styles.segmentTabBtn,
                    isSelected && { borderBottomColor: activeThemeAccent, borderBottomWidth: 3 }
                  ]}
                  onPress={() => setActiveTab(tab.key as ProfileTab)}
                >
                  <MaterialCommunityIcons
                    name={tab.icon}
                    size={20}
                    color={isSelected ? activeThemeAccent : '#94A3B8'}
                  />
                  <Text style={[
                    styles.segmentTabText,
                    isSelected ? { color: activeThemeAccent, fontWeight: '800' } : { color: '#64748B' }
                  ]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* RENDER CONTENT PANELS ACCORDING TO TABS */}

        {/* TAB 1 & 2: POSTS & REELS GRIDS */}
        {(activeTab === 'posts' || activeTab === 'reels') && (
          <View style={styles.gridContentContainer}>
            {displayPosts.filter(item => {
              if (activeTab === 'reels') return item.isReel;
              return !item.isReel;
            }).length > 0 ? (
              <View style={styles.gridPostsRow}>
                {displayPosts
                  .filter(item => (activeTab === 'reels' ? item.isReel : !item.isReel))
                  .map((post, idx) => (
                    <View key={post._id || post.id || idx} style={styles.gridPostItem}>
                      <Surface style={styles.postThumbnailSurface} elevation={3}>
                        <Image source={{ uri: post.image || (post.media && post.media[0]?.url) || 'https://images.unsplash.com/photo-1472214222541-d510753a8707?q=80&w=400' }} style={styles.postThumbnailImage} />
                        {post.isReel && (
                          <View style={styles.reelOverlayIcon}>
                            <FontAwesome name="play" size={12} color="#FFF" />
                          </View>
                        )}
                      </Surface>
                    </View>
                  ))}
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="image-off-outline" size={48} color="#CBD5E1" />
                <Text style={styles.emptyText}>No posts to show</Text>
              </View>
            )}
          </View>
        )}

        {/* TAB 3: INSIGHTS */}
        {activeTab === 'insights' && (
          <View style={styles.insightsTabContainer}>
            {/* Streak & Rewards Widget */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeadingText}>Streak & Rewards</Text>
            </View>
            <Surface style={styles.insightStatsCard} elevation={2}>
              <View style={styles.streakStatusRow}>
                <View style={styles.streakDetails}>
                  <MaterialCommunityIcons name="fire" size={36} color="#FF6B6B" />
                  <View>
                    <Text style={styles.streakCountVal}>{user?.streakCount || 0}</Text>
                    <Text style={styles.streakCountLabel}>Day Streak</Text>
                  </View>
                </View>

                {/* CLAIM REWARD TRANSACTION WRAPPER */}
                <TouchableOpacity
                  style={styles.streakRewardDetails}
                  onPress={handleClaimTodayReward}
                  disabled={isRewardClaiming}
                >
                  <Text style={styles.streakRewardVal}>Today's Reward</Text>
                  <View style={[
                    styles.rewardBubble,
                    user?.todayRewardClaimed && { backgroundColor: '#F1F5F9' }
                  ]}>
                    <FontAwesome
                      name="database"
                      size={16}
                      color={user?.todayRewardClaimed ? '#94A3B8' : '#F59E0B'}
                    />
                    <Text style={[
                      styles.rewardText,
                      user?.todayRewardClaimed ? { color: '#94A3B8' } : { color: '#D97706' }
                    ]}>
                      {user?.todayRewardClaimed ? 'Claimed' : '50 Coins'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
              <Text style={styles.weeklyProgressLabel}>Weekly Progress ({user?.weeklyProgress || 0}%)</Text>
              <View style={styles.streakDotsRow}>
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => {
                  const activeCount = Math.floor(((user?.weeklyProgress || 0) / 100) * 7);
                  const isDayDone = i < activeCount;
                  return (
                    <View key={day + i} style={styles.streakDayItem}>
                      <View style={[
                        styles.streakDayCircle,
                        isDayDone ? { backgroundColor: '#10B981' } : { backgroundColor: '#E2E8F0' }
                      ]}>
                        {isDayDone && <Feather name="check" size={12} color="#FFF" />}
                      </View>
                      <Text style={styles.streakDayText}>{day}</Text>
                    </View>
                  );
                })}
              </View>
            </Surface>

            {/* Profile Overview (With Dynamic DB Values) */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeadingText}>Profile Overview</Text>
              <Text style={styles.sectionLinkText}>This Month</Text>
            </View>
            <View style={styles.overviewGraphsContainer}>
              <Surface style={styles.graphSmallCard} elevation={2}>
                <View style={styles.graphTextHeader}>
                  <Text style={styles.graphHeadingLabel}>Profile Views</Text>
                  {user?.profileViewsGrowth ? <Text style={styles.graphPercentageGains}>+{user.profileViewsGrowth}%</Text> : null}
                </View>
                <Text style={styles.graphBoldVal}>{formatCount(user?.profileViews || 0)}</Text>
                <View style={styles.visualBarGraphWrapper}>
                  {(user?.profileViewsChart || [0, 0, 0, 0, 0, 0, 0]).map((h: number, i: number) => (
                    <View key={i} style={[styles.graphVisualColumn, { height: Math.max(h, 2), backgroundColor: activeThemeAccent }]} />
                  ))}
                </View>
              </Surface>

              <Surface style={styles.graphSmallCard} elevation={2}>
                <View style={styles.graphTextHeader}>
                  <Text style={styles.graphHeadingLabel}>Engagement</Text>
                  {user?.engagementGrowth ? <Text style={styles.graphPercentageGains}>+{user.engagementGrowth}%</Text> : null}
                </View>
                <Text style={styles.graphBoldVal}>{formatCount(user?.engagement || 0)}</Text>
                <View style={styles.visualBarGraphWrapper}>
                  {(user?.engagementChart || [0, 0, 0, 0, 0, 0, 0]).map((h: number, i: number) => (
                    <View key={i} style={[styles.graphVisualColumn, { height: Math.max(h, 2), backgroundColor: '#10B981' }]} />
                  ))}
                </View>
              </Surface>
            </View>

            {/* Audience Top Countries */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeadingText}>Audience Overview</Text>
            </View>
            <Surface style={styles.audienceStatsCard} elevation={2}>
              <Text style={styles.audienceStatsSubTitle}>Top Countries</Text>
              {(user?.topCountries && user.topCountries.length > 0) ? user.topCountries.map((country: any) => (
                <View key={country.name} style={styles.countryMeterRow}>
                  <Text style={styles.countryIconText}>{country.code} <Text style={styles.countryNameLabel}>{country.name}</Text></Text>
                  <View style={styles.countrySliderWrapper}>
                    <ProgressBar progress={country.percentage / 100} color={activeThemeAccent} style={styles.countrySlider} />
                  </View>
                  <Text style={styles.countryPercentLabel}>{country.percentage}%</Text>
                </View>
              )) : (
                <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                  <MaterialCommunityIcons name="earth" size={36} color="#CBD5E1" />
                  <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '600', marginTop: 8 }}>No audience data yet</Text>
                </View>
              )}
            </Surface>

            {/* Achievements Collection Panel */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeadingText}>Achievements</Text>
              <Text style={styles.sectionLinkText}>View All</Text>
            </View>
            <Surface style={styles.achievementsCard} elevation={2}>
              {(user?.achievements && user.achievements.length > 0) ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgeMedalsHorizontal}>
                  {user.achievements.map((badgeName: string) => {
                    let badgeIcon = 'trophy';
                    let badgeColor = '#F59E0B';
                    if (badgeName.includes('Streak')) { badgeIcon = 'fire'; badgeColor = '#FF6B6B'; }
                    else if (badgeName.includes('Level')) { badgeIcon = 'crown'; badgeColor = '#7C3AED'; }
                    else if (badgeName.includes('Verified')) { badgeIcon = 'shield-check'; badgeColor = '#3B82F6'; }
                    return (
                      <View key={badgeName} style={styles.medalCollectionItem}>
                        <LinearGradient colors={['#F8FAFC', '#E2E8F0']} style={styles.medalInnerCircle}>
                          <MaterialCommunityIcons name={badgeIcon as any} size={28} color={badgeColor} />
                        </LinearGradient>
                        <Text style={styles.medalNameLabelText} numberOfLines={1}>{badgeName}</Text>
                      </View>
                    );
                  })}
                </ScrollView>
              ) : (
                <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                  <MaterialCommunityIcons name="trophy-outline" size={36} color="#CBD5E1" />
                  <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '600', marginTop: 8 }}>No achievements yet</Text>
                </View>
              )}
            </Surface>

            {/* Level & Rewards meter */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeadingText}>Level & Rewards</Text>
              <Text style={styles.sectionLinkText}>View All</Text>
            </View>
            <Surface style={styles.levelSystemCard} elevation={2}>
              <View style={styles.levelBannerRow}>
                <LinearGradient
                  colors={['#7C3AED', '#EC4899']}
                  style={styles.levelHexBadge}
                >
                  <MaterialCommunityIcons name="hexagon" size={44} color="#FFF" style={StyleSheet.absoluteFillObject} />
                  <Text style={styles.levelHexText}>{user?.level || 1}</Text>
                </LinearGradient>
                <View style={styles.levelInfoGroup}>
                  <Text style={styles.levelBoldTitle}>Level {user?.level || 1}</Text>
                  <Text style={styles.levelSubtitleLabel}>Explorer Creator Badge</Text>
                </View>
              </View>
              <ProgressBar progress={(user?.xp || 0) / 10000} color="#7C3AED" style={styles.levelProgressBar} />
              <View style={styles.levelStatusNumbers}>
                <Text style={styles.xpProgressLabelText}>{user?.xp || 0} / 10,000 XP</Text>
                <Text style={styles.xpProgressLabelText}>{Math.floor(((user?.xp || 0) / 10000) * 100)}%</Text>
              </View>
            </Surface>
          </View>
        )}

        {/* TAB 4: SECURITY & THEMES */}
        {activeTab === 'security' && (
          <View style={styles.securityTabContainer}>
            {/* Dynamic Customizable Theme Selectors */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeadingText}>Customize Profile Theme</Text>
            </View>
            <Surface style={styles.customizeThemesCard} elevation={2}>
              <Text style={styles.customizeWidgetsSubTitle}>Choose Accent Theme Gradient</Text>
              <View style={styles.themeSpheresRow}>
                {THEMES.map(themeItem => {
                  const isThemeSelected = currentTheme.id === themeItem.id;
                  return (
                    <TouchableOpacity
                      key={themeItem.id}
                      style={[
                        styles.themeGradientOutlineBorder,
                        isThemeSelected && { borderColor: themeItem.primary, borderWidth: 3 }
                      ]}
                      onPress={() => handleThemeSelect(themeItem)}
                    >
                      <LinearGradient
                        colors={themeItem.colors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.themeGradientSphere}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.selectedThemeNameLabel}>Active Theme: <Text style={{ color: activeThemeAccent, fontWeight: '800' }}>{currentTheme.name}</Text></Text>

              {/* Customize Profile Frames */}
              <Text style={[styles.customizeWidgetsSubTitle, { marginTop: 18 }]}>Select Profile Border Frame</Text>
              <View style={styles.frameCirclesRow}>
                {[
                  { key: 'none', label: 'None', color: '#E2E8F0' },
                  { key: 'violet', label: 'Violet', color: '#7C3AED' },
                  { key: 'sunset', label: 'Sunset', color: '#FF5E62' },
                  { key: 'emerald', label: 'Mint', color: '#10B981' },
                  { key: 'amber', label: 'Gold', color: '#F59E0B' }
                ].map(frame => (
                  <TouchableOpacity
                    key={frame.key}
                    style={[
                      styles.frameCircleSelect,
                      { borderColor: frame.color },
                      selectedFrame === frame.color && { borderWidth: 3 }
                    ]}
                    onPress={() => handleFrameSelect(frame.key === 'none' ? null : frame.color)}
                  >
                    <View style={[styles.frameCircleInnerBall, { backgroundColor: frame.color }]} />
                  </TouchableOpacity>
                ))}
              </View>
            </Surface>

            {/* Account Security Verification Checklist */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeadingText}>Account Security Status</Text>
              <Text style={styles.sectionLinkText}>Manage</Text>
            </View>
            <Surface style={styles.accountSecurityStatusCard} elevation={2}>
              {[
                { label: 'Phone Number Verified', info: user?.phoneNumber || 'Not provided', checked: !!user?.phoneNumber, icon: 'phone-check' },
                { label: 'Email Address Verified', info: user?.email || 'Not provided', checked: !!user?.emailVerified, icon: 'email-check' },
                { label: 'Biometric Access Enabled', info: 'Fingerprint authorization state', checked: !!user?.biometrics?.fingerprint, icon: 'fingerprint' },
                { label: 'Two-Factor Authentication', info: 'Double-shield secure active', checked: !!user?.twoFactorEnabled, icon: 'shield-lock' }
              ].map(sec => (
                <View key={sec.label} style={styles.securityChecklistItem}>
                  <View style={styles.securityTextInfoBlock}>
                    <MaterialCommunityIcons name={sec.icon as any} size={22} color="#475569" />
                    <View style={{ marginLeft: 12 }}>
                      <Text style={styles.securityMainText}>{sec.label}</Text>
                      <Text style={styles.securitySubInfoText}>{sec.info}</Text>
                    </View>
                  </View>
                  <View style={[
                    styles.securityVerifiedCheckBubble,
                    !sec.checked && { backgroundColor: '#CBD5E1' }
                  ]}>
                    <Feather name="check" size={14} color="#FFF" />
                  </View>
                </View>
              ))}
            </Surface>

            {/* Visitor History */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeadingText}>Recent Visitors</Text>
              <Text style={styles.sectionLinkText}>View All</Text>
            </View>
            <Surface style={styles.visitorCard} elevation={2}>
              {(user?.recentVisitors && user.recentVisitors.length > 0) ? (
                <View style={styles.visitorHeaderRow}>
                  {user.recentVisitors.slice(0, 4).map((visitor: any) => (
                    <View key={visitor._id || visitor.name} style={styles.visitorGridBubble}>
                      {visitor.profilePicture ? (
                        <Image source={{ uri: visitor.profilePicture }} style={styles.visitorAvatarThumb} />
                      ) : (
                        <View style={[styles.visitorAvatarThumb, { backgroundColor: activeThemeAccent, justifyContent: 'center', alignItems: 'center' }]}>
                          <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 16 }}>{visitor.firstName?.charAt(0) || '?'}</Text>
                        </View>
                      )}
                      <Text style={styles.visitorNameLabel} numberOfLines={1}>{visitor.firstName || 'User'}</Text>
                      <Text style={styles.visitorTimeLabel}>{visitor.time || 'recently'}</Text>
                    </View>
                  ))}
                  {user.recentVisitors.length > 4 && (
                    <View style={styles.visitorGridMoreBubble}>
                      <Text style={styles.visitorMoreText}>+{user.recentVisitors.length - 4}</Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                  <MaterialCommunityIcons name="account-eye-outline" size={36} color="#CBD5E1" />
                  <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '600', marginTop: 8 }}>No visitors yet</Text>
                </View>
              )}
            </Surface>
          </View>
        )}
      </Animated.ScrollView>

      {/* SMART AI FLOATING ACTION BUTTON */}
      {!isAiModalVisible && (
        <Animated.View style={[styles.aiFloatingBtnContainer, animatedFabStyle]}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setIsAiModalVisible(true)}
          >
            <LinearGradient
              colors={['#7C3AED', '#3A0CA3', '#F107A3']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.aiFloatingBtn}
            >
              <MaterialCommunityIcons name="robot-excited-outline" size={28} color="#FFF" />
              <View style={styles.aiFloatingBadge}>
                <View style={styles.aiFloatingPulse} />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* VEXORA AI CHAT MODAL */}
      {isAiModalVisible && (
        <View style={styles.aiChatModalBackdrop}>
          <Surface style={styles.aiChatSheetContainer} elevation={5}>

            {/* ── Vexora Header ── */}
            <LinearGradient
              colors={['#0F0628', '#2D0A6E', '#6D28D9']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.vexoraHeader}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                {/* Avatar */}
                <View style={styles.vexoraAvatarRing}>
                  <LinearGradient colors={['#EC4899', '#8B5CF6']} style={styles.vexoraAvatarGradient}>
                    <MaterialCommunityIcons name="robot-excited-outline" size={24} color="#FFF" />
                  </LinearGradient>
                  <View style={styles.vexoraOnlineDot} />
                </View>
                {/* Name & status */}
                <View style={{ marginLeft: 12 }}>
                  <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '800', letterSpacing: 0.5 }}>Vexora</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 }}>
                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#34D399' }} />
                    <Text style={{ color: '#C4B5FD', fontSize: 12, fontWeight: '500' }}>Online · AI Profile Assistant</Text>
                  </View>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <TouchableOpacity
                  onPress={async () => {
                    if (vexoraRef.current) {
                      await vexoraRef.current.clearHistory();
                      setChatMessages([]);
                      setPendingEdit(null);
                    }
                  }}
                  style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' }}
                >
                  <Feather name="trash-2" size={16} color="#FCA5A5" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setIsAiModalVisible(false); setChatMessages([]); setPendingEdit(null); }}
                  style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' }}
                >
                  <Feather name="x" size={18} color="#E2E8F0" />
                </TouchableOpacity>
              </View>
            </LinearGradient>

            {/* ── Quick Chips ── */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 48, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }} contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 9, gap: 8, flexDirection: 'row', alignItems: 'center' }}>
              {[
                { emoji: '✍️', label: 'Bio', cmd: 'suggest a bio' },
                { emoji: '📊', label: 'Audit', cmd: 'audit my profile' },
                { emoji: '🏷️', label: 'Hashtags', cmd: 'give me hashtags' },
                { emoji: '💡', label: 'Post Ideas', cmd: 'give me post ideas' },
                { emoji: '🔍', label: 'SEO', cmd: 'optimize my bio' },
                { emoji: '🎨', label: 'Theme', cmd: 'cyberpunk theme' },
                { emoji: '❓', label: 'Help', cmd: 'help' },
              ].map(c => (
                <TouchableOpacity
                  key={c.label}
                  onPress={() => handleSendMessage(c.cmd)}
                  activeOpacity={0.75}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, paddingVertical: 5, borderRadius: 16, backgroundColor: activeThemeAccent + '15', borderWidth: 1, borderColor: activeThemeAccent + '40', gap: 4 }}
                >
                  <Text style={{ fontSize: 13 }}>{c.emoji}</Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: activeThemeAccent }}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* ── Messages ── */}
            <ScrollView
              ref={chatScrollRef}
              style={styles.aiChatConversationScroll}
              contentContainerStyle={{ padding: 14, gap: 10 }}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: true })}
            >
              {chatMessages.map((msg, index) => {
                const isAi = msg.sender === 'ai';
                const showLabel = isAi && (index === 0 || chatMessages[index - 1]?.sender === 'user');
                return (
                  <View key={index} style={{ alignSelf: isAi ? 'flex-start' : 'flex-end', maxWidth: '94%' }}>
                    {showLabel && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4, marginLeft: 2 }}>
                        <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#EDE9FE', justifyContent: 'center', alignItems: 'center' }}>
                          <MaterialCommunityIcons name="robot-excited-outline" size={11} color="#7C3AED" />
                        </View>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#7C3AED' }}>Vexora</Text>
                      </View>
                    )}

                    {isAi ? (
                      /* AI bubble — white with subtle border */
                      <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, borderTopLeftRadius: 4, padding: 13, borderWidth: 1, borderColor: '#E8E3FF', shadowColor: '#7C3AED', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 }}>
                        {/* Markdown-style renderer */}
                        {msg.text.split('\n').map((line, li) => {
                          if (!line.trim()) return <View key={li} style={{ height: 5 }} />;

                          // Bold-only line: **text**
                          const boldMatch = line.match(/^\*\*(.+)\*\*$/);
                          if (boldMatch) return (
                            <Text key={li} style={{ fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 3 }}>
                              {boldMatch[1]}
                            </Text>
                          );

                          // Divider line ---
                          if (line.trim() === '---') return <View key={li} style={{ height: 1, backgroundColor: '#E2E8F0', marginVertical: 6 }} />;

                          // Helper: parse inline **bold** and *italic* in text
                          const parseInline = (text: string) => {
                            // Split on **bold** and *italic*
                            const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
                            return parts.map((p, pi) => {
                              if (p.startsWith('**') && p.endsWith('**')) {
                                return <Text key={pi} style={{ fontWeight: '800', color: '#0F172A' }}>{p.slice(2, -2)}</Text>;
                              }
                              if (p.startsWith('*') && p.endsWith('*')) {
                                return <Text key={pi} style={{ fontStyle: 'italic', color: '#1E293B' }}>{p.slice(1, -1)}</Text>;
                              }
                              return <Text key={pi} style={{ color: '#1E293B' }}>{p}</Text>;
                            });
                          };

                          // Bullet point
                          if (line.startsWith('•') || line.trimStart().startsWith('-')) {
                            const content = line.replace(/^[•\-]\s*/, '');
                            return (
                              <View key={li} style={{ flexDirection: 'row', marginBottom: 4, paddingLeft: 2 }}>
                                <Text style={{ color: activeThemeAccent, fontWeight: '900', marginRight: 6, fontSize: 14, marginTop: 1 }}>•</Text>
                                <Text style={{ flex: 1, fontSize: 13.5, color: '#1E293B', lineHeight: 20 }}>
                                  {parseInline(content)}
                                </Text>
                              </View>
                            );
                          }

                          // Numbered list
                          const numMatch = line.match(/^(\d+\.)\s*(.*)/);
                          if (numMatch) {
                            return (
                              <View key={li} style={{ flexDirection: 'row', marginBottom: 5 }}>
                                <Text style={{ color: activeThemeAccent, fontWeight: '800', marginRight: 6, fontSize: 13.5, minWidth: 22 }}>{numMatch[1]}</Text>
                                <Text style={{ flex: 1, fontSize: 13.5, color: '#1E293B', lineHeight: 20 }}>
                                  {parseInline(numMatch[2])}
                                </Text>
                              </View>
                            );
                          }

                          // Normal line
                          return (
                            <Text key={li} style={{ fontSize: 13.5, color: '#1E293B', lineHeight: 21, marginBottom: 2 }}>
                              {parseInline(line)}
                            </Text>
                          );
                        })}

                        {/* Action buttons */}
                        {msg.actionId && (
                          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                            <TouchableOpacity
                              onPress={() => handleAiAction(msg.actionId!, true)}
                              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: '#7C3AED', paddingVertical: 9, borderRadius: 10 }}
                            >
                              <Feather name="check" size={13} color="#FFF" />
                              <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 13 }}>Apply</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleAiAction(msg.actionId!, false)}
                              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: '#FEF2F2', paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: '#FECACA' }}
                            >
                              <Feather name="x" size={13} color="#EF4444" />
                              <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 13 }}>Cancel</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    ) : (
                      /* User bubble */
                      <LinearGradient
                        colors={currentTheme.colors as [string, string, ...string[]]}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={{ borderRadius: 16, borderBottomRightRadius: 4, paddingHorizontal: 14, paddingVertical: 10 }}
                      >
                        <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '500', lineHeight: 20 }}>{msg.text}</Text>
                      </LinearGradient>
                    )}
                  </View>
                );
              })}

              {isAiTyping && (
                <View style={{ alignSelf: 'flex-start', maxWidth: '55%' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4, marginLeft: 2 }}>
                    <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#EDE9FE', justifyContent: 'center', alignItems: 'center' }}>
                      <MaterialCommunityIcons name="robot-excited-outline" size={11} color="#7C3AED" />
                    </View>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#7C3AED' }}>Vexora</Text>
                  </View>
                  <View style={{ backgroundColor: '#FFF', borderRadius: 16, borderTopLeftRadius: 4, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#E8E3FF' }}>
                    <ActivityIndicator size="small" color="#7C3AED" />
                    <Text style={{ color: '#94A3B8', fontSize: 13, fontStyle: 'italic' }}>Thinking...</Text>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* ── Input ── */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9', backgroundColor: '#FAFBFF' }}>
              <TextInput
                style={{ flex: 1, height: 44, borderRadius: 22, backgroundColor: '#F1F5F9', paddingHorizontal: 18, fontSize: 14, color: '#0F172A', borderWidth: 1.5, borderColor: '#E8E3FF' }}
                placeholder="Ask Vexora anything..."
                placeholderTextColor="#94A3B8"
                value={inputText}
                onChangeText={setInputText}
                onSubmitEditing={() => handleSendMessage()}
                returnKeyType="send"
              />
              <TouchableOpacity
                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: inputText.trim() ? activeThemeAccent : '#CBD5E1', justifyContent: 'center', alignItems: 'center', elevation: 2 }}
                onPress={() => handleSendMessage()}
                disabled={!inputText.trim()}
              >
                <Ionicons name="send" size={17} color="#FFF" />
              </TouchableOpacity>
            </View>

          </Surface>
        </View>
      )}
      {/* ADD HIGHLIGHT MODAL */}
      <Modal
        visible={isHighlightModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsHighlightModalVisible(false)}
      >
        <View style={styles.highlightModalBackdrop}>
          <Surface style={styles.highlightModalSheet} elevation={5}>
            {/* Header */}
            <View style={styles.highlightModalHeader}>
              <Text style={styles.highlightModalTitle}>New Story Highlight</Text>
              <IconButton icon="close" size={22} onPress={() => setIsHighlightModalVisible(false)} style={{ margin: 0, backgroundColor: '#F1F5F9' }} />
            </View>

            {/* Title Input */}
            <TextInput
              style={styles.highlightTitleInput}
              placeholder="Enter highlight title..."
              placeholderTextColor="#94A3B8"
              value={newHighlightTitle}
              onChangeText={setNewHighlightTitle}
              maxLength={20}
            />

            {/* Preset Cover Image Picker */}
            <Text style={styles.highlightPickerLabel}>Choose Cover Image</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.highlightPresetsRow}>
              {highlightPresets.map((preset, idx) => (
                <TouchableOpacity
                  key={preset.title + idx}
                  style={[
                    styles.highlightPresetItem,
                    newHighlightImage === preset.image && { borderColor: '#7C3AED', borderWidth: 3 }
                  ]}
                  onPress={() => setNewHighlightImage(preset.image)}
                >
                  <Image source={{ uri: preset.image }} style={styles.highlightPresetThumb} />
                  <Text style={styles.highlightPresetLabel}>{preset.title}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Preview */}
            <View style={styles.highlightPreviewRow}>
              <Surface style={styles.highlightImageCircle} elevation={2}>
                <Image source={{ uri: newHighlightImage }} style={styles.highlightThumb} />
              </Surface>
              <Text style={styles.highlightPreviewTitle}>{newHighlightTitle || 'Preview'}</Text>
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={[styles.highlightSaveBtn, { backgroundColor: '#7C3AED' }]}
              onPress={handleAddHighlight}
            >
              <Text style={styles.highlightSaveBtnText}>Add Highlight</Text>
            </TouchableOpacity>
          </Surface>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  headerBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'visible',
  },
  coverImage: {
    width: '100%',
    height: '100%',
    opacity: 0.85,
  },
  fixedTopNav: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 36,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 999,
    elevation: 999,
  },
  topNavBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  topNavOverlay: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 44 : 32,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 10,
  },
  topNavRight: {
    flexDirection: 'row',
    gap: 8,
  },
  coverCameraBtn: {
    position: 'absolute',
    bottom: 12,
    right: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarTouchable: {
    position: 'relative',
  },
  avatarLoadingOverlay: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarCameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#475569',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
    zIndex: 2,
  },
  scrollContent: {
    paddingTop: HEADER_HEIGHT - 35,
  },
  profileDetailsCard: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingHorizontal: 22,
    paddingTop: 18,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 4,
  },
  avatarMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: -60,
  },
  avatarFrameWrapper: {
    padding: 3,
    borderRadius: 106,
    backgroundColor: '#FFF',
    position: 'relative',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  onlineStatusBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#10B981',
    borderWidth: 3.5,
    borderColor: '#FFF',
  },
  editProfileBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1.5,
    backgroundColor: '#FFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  editProfileBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  nameHeaderGroup: {
    marginTop: 16,
  },
  displayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  displayNameText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  verifiedTick: {
    marginTop: 2,
  },
  handleAndProRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  handleText: {
    fontSize: 15,
    color: '#64748B',
    fontWeight: '600',
  },
  proBadgeGradient: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  proBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  statisticsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 22,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statNumText: {
    fontSize: 19,
    fontWeight: '900',
    color: '#0F172A',
  },
  statSubText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '700',
    marginTop: 2,
  },
  dividerBar: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
  },
  bioTextContent: {
    marginTop: 18,
    fontSize: 14.5,
    lineHeight: 22,
    color: '#475569',
    fontWeight: '500',
  },
  metaDataList: {
    marginTop: 14,
    gap: 10,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  metaItemText: {
    fontSize: 13.5,
    color: '#64748B',
    fontWeight: '600',
  },
  highlightsContainer: {
    marginTop: 22,
    marginBottom: 16,
  },
  highlightsList: {
    gap: 16,
    paddingVertical: 4,
  },
  highlightItemContainer: {
    alignItems: 'center',
    width: 66,
  },
  addHighlightCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  highlightImageCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    padding: 2,
    backgroundColor: '#FFF',
  },
  highlightThumb: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
  },
  highlightTitle: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '700',
    marginTop: 6,
    textAlign: 'center',
  },
  slidingThemeAccent: {
    height: 6,
    width: '100%',
  },
  premiumSegmentTabBar: {
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  tabsScrollContent: {
    paddingHorizontal: 12,
  },
  segmentTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 15,
    gap: 8,
  },
  segmentTabText: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  gridContentContainer: {
    padding: 8,
    backgroundColor: '#F8FAFC',
  },
  gridPostsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gridPostItem: {
    width: (width - 32) / 3,
    aspectRatio: 1,
  },
  postThumbnailSurface: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#FFF',
  },
  postThumbnailImage: {
    width: '100%',
    height: '100%',
  },
  reelOverlayIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '700',
  },
  insightsTabContainer: {
    padding: 16,
    gap: 18,
  },
  aiCoachBannerCard: {
    borderRadius: 24,
    overflow: 'hidden',
    elevation: 3,
  },
  aiCoachBannerGradient: {
    padding: 20,
  },
  aiBannerInfoGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aiTextLayout: {
    flex: 1,
    marginRight: 10,
  },
  aiMiniHeader: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  betaBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    fontSize: 8.5,
    fontWeight: '900',
    overflow: 'hidden',
  },
  aiBannerDesc: {
    color: '#FFF',
    fontSize: 14.5,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 16,
  },
  askAiBtn: {
    backgroundColor: '#FFF',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    alignSelf: 'flex-start',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  askAiBtnText: {
    color: '#7C3AED',
    fontSize: 13,
    fontWeight: '800',
  },
  aiBotRobotImage: {
    width: 90,
    height: 100,
    borderRadius: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingHorizontal: 4,
  },
  sectionHeadingText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  sectionLinkText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#7C3AED',
  },
  insightStatsCard: {
    padding: 18,
    borderRadius: 22,
    backgroundColor: '#FFF',
  },
  streakStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 14,
  },
  streakDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  streakCountVal: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
  },
  streakCountLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  streakRewardDetails: {
    alignItems: 'flex-end',
  },
  streakRewardVal: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '800',
  },
  rewardBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    marginTop: 4,
  },
  rewardText: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  weeklyProgressLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginTop: 14,
    marginBottom: 8,
  },
  streakDotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  streakDayItem: {
    alignItems: 'center',
    gap: 6,
  },
  streakDayCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  streakDayText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
  },
  overviewGraphsContainer: {
    flexDirection: 'row',
    gap: 14,
  },
  graphSmallCard: {
    flex: 1,
    padding: 16,
    borderRadius: 22,
    backgroundColor: '#FFF',
  },
  graphTextHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  graphHeadingLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  graphPercentageGains: {
    fontSize: 11,
    fontWeight: '800',
    color: '#10B981',
  },
  graphBoldVal: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 4,
  },
  visualBarGraphWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 80,
    marginTop: 14,
  },
  graphVisualColumn: {
    width: 8,
    borderRadius: 4,
  },
  audienceStatsCard: {
    padding: 18,
    borderRadius: 22,
    backgroundColor: '#FFF',
  },
  audienceStatsSubTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 14,
  },
  countryMeterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  countryIconText: {
    width: 100,
    fontSize: 14,
  },
  countryNameLabel: {
    color: '#475569',
    fontWeight: '700',
  },
  countrySliderWrapper: {
    flex: 1,
    marginHorizontal: 12,
  },
  countrySlider: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
  },
  countryPercentLabel: {
    width: 32,
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'right',
  },
  achievementsCard: {
    paddingVertical: 18,
    paddingHorizontal: 12,
    borderRadius: 22,
    backgroundColor: '#FFF',
  },
  badgeMedalsHorizontal: {
    gap: 16,
    paddingHorizontal: 6,
  },
  medalCollectionItem: {
    alignItems: 'center',
    width: 80,
    gap: 8,
  },
  medalInnerCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  medalNameLabelText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#475569',
    textAlign: 'center',
  },
  levelSystemCard: {
    padding: 18,
    borderRadius: 22,
    backgroundColor: '#FFF',
  },
  levelBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  levelHexBadge: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  levelHexText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFF',
    zIndex: 2,
  },
  levelInfoGroup: {
    flex: 1,
  },
  levelBoldTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  levelSubtitleLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 1,
  },
  levelProgressBar: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F1F5F9',
    marginTop: 16,
  },
  levelStatusNumbers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  xpProgressLabelText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  securityTabContainer: {
    padding: 16,
    gap: 18,
  },
  customizeThemesCard: {
    padding: 18,
    borderRadius: 22,
    backgroundColor: '#FFF',
  },
  customizeWidgetsSubTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 12,
  },
  themeSpheresRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  themeGradientOutlineBorder: {
    padding: 3,
    borderRadius: 22,
    borderColor: 'transparent',
    borderWidth: 3,
  },
  themeGradientSphere: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  selectedThemeNameLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 4,
  },
  frameCirclesRow: {
    flexDirection: 'row',
    gap: 16,
  },
  frameCircleSelect: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 2,
  },
  frameCircleInnerBall: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    opacity: 0.8,
  },
  accountSecurityStatusCard: {
    padding: 14,
    borderRadius: 22,
    backgroundColor: '#FFF',
  },
  securityChecklistItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F1F5F9',
  },
  securityTextInfoBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  securityMainText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  securitySubInfoText: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 1,
  },
  securityVerifiedCheckBubble: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  visitorCard: {
    padding: 16,
    borderRadius: 22,
    backgroundColor: '#FFF',
  },
  visitorHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  visitorGridBubble: {
    alignItems: 'center',
    gap: 4,
    width: 60,
  },
  visitorAvatarThumb: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  visitorNameLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  visitorTimeLabel: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '800',
  },
  visitorGridMoreBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 0,
  },
  visitorMoreText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#64748B',
  },
  aiChatModalBackdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    zIndex: 999,
    justifyContent: 'flex-end',
  },
  aiChatSheetContainer: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    backgroundColor: '#FFF',
    height: '80%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  aiModalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  aiModalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  aiModalMascot: {
    width: 40,
    height: 40,
    borderRadius: 12,
  },
  aiModalTitleText: {
    fontSize: 16.5,
    fontWeight: '900',
    color: '#0F172A',
  },
  aiModalStatusText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '800',
    marginTop: 1,
  },
  aiCloseBtn: {
    margin: 0,
    backgroundColor: '#F1F5F9',
  },
  chatSuggestionsRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  suggestionsScrollContent: {
    paddingHorizontal: 20,
    gap: 10,
  },
  suggestionBubbleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: '#FFF',
  },
  suggestionBubbleText: {
    fontSize: 12,
    fontWeight: '800',
  },
  aiChatConversationScroll: {
    flex: 1,
  },
  aiChatConversationContent: {
    padding: 20,
    gap: 16,
  },
  chatMessageWrapper: {
    maxWidth: '82%',
  },
  chatMessageBubble: {
    padding: 14,
    borderRadius: 20,
  },
  chatAiBubbleBorder: {
    borderTopLeftRadius: 4,
    backgroundColor: '#F1F5F9',
  },
  chatUserBubbleBorder: {
    borderTopRightRadius: 4,
  },
  chatMessageText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  typingIndicatorBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  typingIndicatorText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
  },
  // ── Vexora Styles ──────────────────────────────────────────────────────────
  vexoraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  vexoraHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vexoraAvatarRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#F107A3',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  vexoraAvatarGradient: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vexoraOnlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#1E0A3C',
  },
  vexoraNameText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  vexoraPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  vexoraStatusText: {
    color: '#C4B5FD',
    fontSize: 11,
    fontWeight: '500',
  },
  vexoraCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vexoraChipsRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  vexoraChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    backgroundColor: '#FAFBFF',
    gap: 5,
  },
  vexoraChipIcon: {
    fontSize: 13,
  },
  vexoraChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  vexoraMsgAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vexoraSenderLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED',
    marginBottom: 3,
    marginLeft: 4,
  },
  vexoraAiBubble: {
    borderTopLeftRadius: 4,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  vexoraUserBubble: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 4,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  vexoraCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    alignSelf: 'flex-end',
  },
  vexoraCopyText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  vexoraActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  vexoraApproveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#10B981',
    paddingVertical: 8,
    borderRadius: 10,
  },
  vexoraDeclineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#FEF2F2',
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  vexoraActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  vexoraInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#EEF2FF',
    backgroundColor: '#FAFBFF',
  },
  vexoraInputBar: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 18,
    fontSize: 14,
    fontWeight: '500',
    color: '#0F172A',
    borderWidth: 1.5,
    borderColor: '#E0E7FF',
  },
  vexoraSendBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  chatInputBar: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 16,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  chatSendBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiFloatingBtnContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 80,
    right: 20,
    zIndex: 100,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  aiFloatingBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  aiFloatingBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  aiFloatingPulse: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
    backgroundColor: '#10B981',
    opacity: 0.5,
  },
  aiActionBtnsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  aiActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  aiActionBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  highlightModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  highlightModalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: '#FFF',
    paddingHorizontal: 22,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingTop: 20,
  },
  highlightModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  highlightModalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
  },
  highlightTitleInput: {
    height: 50,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 16,
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 16,
  },
  highlightPickerLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 10,
  },
  highlightPresetsRow: {
    gap: 12,
    paddingBottom: 16,
  },
  highlightPresetItem: {
    alignItems: 'center',
    width: 64,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    padding: 2,
  },
  highlightPresetThumb: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  highlightPresetLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
    marginTop: 4,
    textAlign: 'center',
  },
  highlightPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 8,
    marginBottom: 20,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
  },
  highlightPreviewTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  highlightSaveBtn: {
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightSaveBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
  },
});
