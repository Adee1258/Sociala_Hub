import React, { useEffect } from 'react';
import { View, StyleSheet, useWindowDimensions, Pressable, StatusBar } from 'react-native';
import { Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useDispatch } from 'react-redux';
import { resetSignupData } from '@/store/authSlice';
import { useAuth } from '@/context/AuthContext';
import { FontAwesome } from '@expo/vector-icons';
import Animated, {
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing
} from 'react-native-reanimated';

const PRIMARY = '#7C3AED';

const ConfettiPiece = ({ index, width, height }: { index: number, width: number, height: number }) => {
  const translateY = useSharedValue(-20);
  const translateX = useSharedValue(Math.random() * width);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(1);

  const colors = ['#7C3AED', '#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#EC4899'];
  const color = colors[index % colors.length];

  useEffect(() => {
    const duration = 2000 + Math.random() * 3000;
    const delay = Math.random() * 2000;

    translateY.value = withDelay(delay, withTiming(height + 20, {
      duration,
      easing: Easing.linear
    }));

    rotate.value = withDelay(delay, withRepeat(withTiming(360, { duration: 1000 }), -1));

    opacity.value = withDelay(delay + duration - 500, withTiming(0, { duration: 500 }));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { rotate: `${rotate.value}deg` }
    ],
    opacity: opacity.value,
    backgroundColor: color,
  }));

  return <Animated.View style={[styles.confetti, animatedStyle]} />;
};

export default function WelcomeScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { width, height } = useWindowDimensions();

  const { checkAuth, user } = useAuth();

  const handleStart = async () => {
    dispatch(resetSignupData());
    
    // Final check: if user is not in state, try to fetch it
    if (!user) {
      await checkAuth();
    }
    
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Confetti Rain */}
      {Array(40).fill(0).map((_, i) => (
        <ConfettiPiece key={i} index={i} width={width} height={height} />
      ))}

      <View style={styles.content}>
        {/* Top Bar with back arrow (non-functional for visual match) */}
        <Animated.View entering={FadeInUp.duration(400)} style={styles.topBar}>
          <Pressable onPress={() => {}} style={styles.backBtn}>
            <FontAwesome name="chevron-left" size={16} color="#1E293B" />
          </Pressable>
        </Animated.View>

        <View style={styles.centerBox}>
          {/* Success Icon */}
          <Animated.View entering={FadeInUp.duration(800)} style={styles.iconWrapper}>
            <View style={styles.iconCircle}>
              <FontAwesome name="check" size={48} color="#FFFFFF" />
            </View>
          </Animated.View>

          {/* Text Content */}
          <Animated.View entering={FadeInUp.delay(300).duration(800)} style={styles.textContainer}>
            <Text style={styles.title}>Welcome to{'\n'}Social Hub! 🎉</Text>
            <Text style={styles.description}>
              Your account has been created successfully.
            </Text>
          </Animated.View>
        </View>

        <View style={{ flex: 1 }} />

        {/* Action Button */}
        <Animated.View
          entering={FadeInDown.delay(600).duration(800)}
          style={[styles.buttonContainer, { maxWidth: Math.min(width - 48, 400) }]}
        >
          <Pressable
            style={({ pressed }) => [
              styles.startBtn,
              {
                opacity: pressed ? 0.9 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              },
            ]}
            onPress={handleStart}
          >
            <Text style={styles.startBtnText}>Get Started</Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  confetti: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 2,
    zIndex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 40,
    zIndex: 10,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    marginBottom: 40,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.5, // slightly faded since it's the end screen
  },
  centerBox: {
    flex: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapper: {
    marginBottom: 32,
  },
  iconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  textContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#1E293B',
    textAlign: 'center',
    lineHeight: 40,
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  description: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '500',
    maxWidth: 260,
    lineHeight: 22,
  },
  buttonContainer: {
    width: '100%',
    alignSelf: 'center',
  },
  startBtn: {
    width: '100%',
    height: 56,
    borderRadius: 14,
    backgroundColor: PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  startBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
