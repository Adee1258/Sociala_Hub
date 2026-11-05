import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';

interface DailyRewardProps {
  claimed: boolean;
  claiming: boolean;
  onClaim: () => void;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export default function DailyReward({ claimed, claiming, onClaim }: DailyRewardProps) {
  const shimmer = useSharedValue(0);
  const bounce = useSharedValue(1);

  React.useEffect(() => {
    if (!claimed) {
      // Subtle shimmer animation on unclaimed banner
      shimmer.value = withRepeat(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
      // Gentle bounce on the claim badge
      bounce.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 600 }),
          withTiming(1, { duration: 600 })
        ),
        -1,
        false
      );
    }
  }, [claimed]);

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: claimed ? 1 : bounce.value }],
  }));

  const bannerGlow = useAnimatedStyle(() => ({
    opacity: claimed ? 1 : 0.9 + shimmer.value * 0.1,
  }));

  return (
    <AnimatedTouchable
      style={[
        styles.dailyBanner,
        claimed && styles.dailyBannerClaimed,
        bannerGlow,
      ]}
      disabled={claimed || claiming}
      onPress={onClaim}
      activeOpacity={0.8}>
      <View style={styles.iconContainer}>
        <Text style={styles.giftIcon}>{claimed ? '✅' : '🎁'}</Text>
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.dailyTitle}>
          {claimed ? 'Daily Reward Claimed' : "Claim Today's Bonus"}
        </Text>
        <Text style={styles.dailySub}>
          {claimed ? 'Come back tomorrow for +150 Coins' : '+150 Coins & +500 XP'}
        </Text>
      </View>
      {claiming ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Animated.View style={[styles.claimBadge, badgeStyle]}>
          <Text style={[styles.claimBadgeText, claimed && styles.claimBadgeTextClaimed]}>
            {claimed ? '✓ Done' : 'Claim'}
          </Text>
        </Animated.View>
      )}
    </AnimatedTouchable>
  );
}

const styles = StyleSheet.create({
  dailyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  dailyBannerClaimed: {
    backgroundColor: '#64748B',
    shadowColor: '#64748B',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  giftIcon: {
    fontSize: 22,
  },
  textContainer: {
    flex: 1,
  },
  dailyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dailySub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  claimBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  claimBadgeText: {
    color: '#10B981',
    fontWeight: '800',
    fontSize: 13,
  },
  claimBadgeTextClaimed: {
    color: '#64748B',
  },
});
