import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

interface GameCardProps {
  icon: string;
  iconBg: string;
  title: string;
  description: string;
  maxReward: string;
  onPress: () => void;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export default function GameCard({
  icon,
  iconBg,
  title,
  description,
  maxReward,
  onPress,
}: GameCardProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  return (
    <AnimatedTouchable
      style={[styles.gameCard, animatedStyle]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}>
      <View style={[styles.gameIconBox, { backgroundColor: iconBg }]}>
        <Text style={styles.gameIcon}>{icon}</Text>
      </View>
      <View style={styles.gameInfo}>
        <Text style={styles.gameCardTitle}>{title}</Text>
        <Text style={styles.gameCardSub}>{description}</Text>
        <Text style={styles.gameCardReward}>Earn up to +{maxReward} Coins</Text>
      </View>
      <View style={styles.playTag}>
        <Text style={styles.playTagText}>Play</Text>
      </View>
    </AnimatedTouchable>
  );
}

const styles = StyleSheet.create({
  gameCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  gameIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  gameIcon: {
    fontSize: 26,
  },
  gameInfo: {
    flex: 1,
  },
  gameCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  gameCardSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  gameCardReward: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED',
    marginTop: 3,
  },
  playTag: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
  },
  playTagText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
