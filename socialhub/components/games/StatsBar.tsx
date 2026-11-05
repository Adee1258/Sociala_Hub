import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

interface StatsBarProps {
  coins: number;
  streakCount: number;
  level: number;
  xp: number;
}

export default function StatsBar({ coins, streakCount, level, xp }: StatsBarProps) {
  // Subtle pulsing glow on the coins
  const pulse = useSharedValue(1);

  React.useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1.08, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const coinPulse = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  // XP progress within current level (10000 XP per level)
  const xpProgress = Math.min(xp / 10000, 1);

  return (
    <View style={styles.statsCard}>
      <View style={styles.statBox}>
        <Animated.Text style={[styles.statEmoji, coinPulse]}>🪙</Animated.Text>
        <Text style={styles.statVal}>{coins.toLocaleString()}</Text>
        <Text style={styles.statLabel}>Coins</Text>
      </View>

      <View style={styles.statDivider} />

      <View style={styles.statBox}>
        <Text style={styles.statEmoji}>🔥</Text>
        <Text style={styles.statVal}>{streakCount}d</Text>
        <Text style={styles.statLabel}>Streak</Text>
      </View>

      <View style={styles.statDivider} />

      <View style={styles.statBox}>
        <Text style={styles.statEmoji}>⚡</Text>
        <Text style={styles.statVal}>Lvl {level}</Text>
        <View style={styles.xpBarBg}>
          <View style={[styles.xpBarFill, { width: `${xpProgress * 100}%` }]} />
        </View>
        <Text style={styles.statLabel}>{xp.toLocaleString()} XP</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#7C3AED',
    borderRadius: 20,
    padding: 18,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statEmoji: {
    fontSize: 22,
  },
  statVal: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },
  statLabel: {
    fontSize: 11,
    color: '#DDD6FE',
    marginTop: 1,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  xpBarBg: {
    width: 50,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    marginTop: 4,
    overflow: 'hidden',
  },
  xpBarFill: {
    height: '100%',
    backgroundColor: '#FDE68A',
    borderRadius: 2,
  },
});
