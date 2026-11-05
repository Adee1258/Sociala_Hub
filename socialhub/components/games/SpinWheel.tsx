import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { WHEEL_SEGMENTS, WheelSegment } from './constants';

interface SpinWheelProps {
  onReward: (gameName: string, coins: number, xp: number) => void;
}

export default function SpinWheel({ onReward }: SpinWheelProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [result, setResult] = useState<WheelSegment | null>(null);

  const rotation = useSharedValue(0);

  const wheelStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

  const handleSpinEnd = (finalAngle: number) => {
    const degreesPerSegment = 360 / WHEEL_SEGMENTS.length;
    // Calculate winning segment. The top position is where the pointer is.
    // If the wheel rotates by `finalAngle`, the segment that was at 0 deg moves to `finalAngle`.
    // The segment that is now at 0 deg (top) is the one that started at `360 - (finalAngle % 360)`.
    const normalizedAngle = finalAngle % 360;
    
    // As per instruction logic (adjusting for correct top segment)
    const segmentIndex = Math.floor(normalizedAngle / degreesPerSegment);
    const actualSegmentIndex = (WHEEL_SEGMENTS.length - segmentIndex) % WHEEL_SEGMENTS.length;
    
    const wonSegment = WHEEL_SEGMENTS[actualSegmentIndex];
    
    setResult(wonSegment);
    setIsSpinning(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onReward('Spin & Win', wonSegment.coins, wonSegment.xp);
  };

  const handleSpin = () => {
    if (isSpinning) return;
    
    setResult(null);
    setIsSpinning(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const spins = 5 * 360;
    const randomExtraDegrees = Math.floor(Math.random() * 360);
    const finalAngle = rotation.value + spins + randomExtraDegrees;

    rotation.value = withTiming(
      finalAngle,
      {
        duration: 3500,
        easing: Easing.out(Easing.cubic),
      },
      (finished) => {
        if (finished) {
          runOnJS(handleSpinEnd)(finalAngle);
        }
      }
    );
  };

  const reset = () => {
    setResult(null);
  };

  const degreesPerSegment = 360 / WHEEL_SEGMENTS.length;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Spin & Win</Text>
      
      <View style={styles.wheelWrapper}>
        {/* Pointer Indicator */}
        <View style={styles.pointer} />
        
        {/* The Wheel */}
        <Animated.View style={[styles.wheel, wheelStyle]}>
          {WHEEL_SEGMENTS.map((segment, index) => {
            const angle = index * degreesPerSegment;
            return (
              <View
                key={index}
                style={[
                  styles.segmentContainer,
                  {
                    transform: [
                      { rotate: `${angle}deg` },
                      { translateY: -80 } // Push out towards the edge
                    ],
                  }
                ]}
              >
                <Text style={styles.segmentEmoji}>{segment.emoji}</Text>
                <Text style={styles.segmentLabel}>{segment.label}</Text>
              </View>
            );
          })}
        </Animated.View>
      </View>

      <Pressable
        style={[styles.spinButton, isSpinning && styles.spinButtonDisabled]}
        onPress={handleSpin}
        disabled={isSpinning}
      >
        <Text style={styles.spinButtonText}>
          {isSpinning ? 'SPINNING...' : 'SPIN WHEEL'}
        </Text>
      </Pressable>

      {result && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultText}>
            You won {result.emoji} {result.label}!
          </Text>
          <Pressable onPress={reset} style={styles.resetButton}>
            <Text style={styles.resetButtonText}>Spin Again</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 16,
  },
  wheelWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    position: 'relative',
    height: 260,
    width: 240,
  },
  pointer: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 15,
    borderRightWidth: 15,
    borderBottomWidth: 20,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#EF4444',
    transform: [{ rotate: '180deg' }],
    position: 'absolute',
    top: 0,
    zIndex: 10,
  },
  wheel: {
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: '#7C3AED',
    borderWidth: 6,
    borderColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginTop: 20,
  },
  segmentContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
    height: 60,
  },
  segmentEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  segmentLabel: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
    textAlign: 'center',
  },
  spinButton: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 22,
    width: '80%',
    alignItems: 'center',
  },
  spinButtonDisabled: {
    opacity: 0.6,
  },
  spinButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  resultContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  resultText: {
    color: '#10B981',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 12,
  },
  resetButton: {
    padding: 8,
  },
  resetButtonText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
});
