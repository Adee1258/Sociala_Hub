import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withSpring,
  FadeIn
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { GAME_REWARDS } from './constants';

interface TapSpeedProps {
  onReward: (gameName: string, coins: number, xp: number) => void;
  onClose?: () => void;
}

export default function TapSpeed({ onReward, onClose }: TapSpeedProps) {
  const [gameState, setGameState] = useState<'idle' | 'active' | 'finished'>('idle');
  const [tapCount, setTapCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_REWARDS.tapSpeed.duration);
  const [tapsPerSec, setTapsPerSec] = useState(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Animations
  const buttonScale = useSharedValue(1);

  useEffect(() => {
    if (gameState === 'idle') {
      buttonScale.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 800 }),
          withTiming(1, { duration: 800 })
        ),
        -1,
        true
      );
    }
  }, [gameState]);

  useEffect(() => {
    if (gameState === 'active') {
      const elapsed = GAME_REWARDS.tapSpeed.duration - timeLeft;
      if (elapsed > 0) {
        setTapsPerSec(tapCount / elapsed);
      }
    }
  }, [tapCount, timeLeft]);

  const startGame = () => {
    setGameState('active');
    setTapCount(1);
    setTimeLeft(GAME_REWARDS.tapSpeed.duration);
    setTapsPerSec(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Stop pulsing and bounce
    buttonScale.value = 1;
    buttonScale.value = withSequence(
      withSpring(0.92, { damping: 10, stiffness: 400 }),
      withSpring(1, { damping: 10, stiffness: 400 })
    );

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          endGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const endGame = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setGameState('finished');
  };

  useEffect(() => {
    if (gameState === 'finished') {
      const coins = Math.min(GAME_REWARDS.tapSpeed.maxCoins, tapCount * GAME_REWARDS.tapSpeed.coinsPerTap);
      const xp = Math.min(GAME_REWARDS.tapSpeed.maxXp, tapCount * GAME_REWARDS.tapSpeed.xpPerTap);
      onReward('Tap Speed Frenzy', coins, xp);
    }
  }, [gameState]);

  const handleTap = () => {
    if (gameState === 'idle') {
      startGame();
    } else if (gameState === 'active') {
      setTapCount((prev) => prev + 1);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      buttonScale.value = 1;
      buttonScale.value = withSequence(
        withTiming(0.92, { duration: 50 }),
        withSpring(1, { damping: 10, stiffness: 400 })
      );
    }
  };

  const resetGame = () => {
    setGameState('idle');
    setTapCount(0);
    setTimeLeft(GAME_REWARDS.tapSpeed.duration);
    setTapsPerSec(0);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const animatedButtonStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: buttonScale.value }],
    };
  });

  return (
    <View style={styles.container}>
      {gameState === 'finished' ? (
        <Animated.View entering={FadeIn.duration(500)} style={styles.resultsBanner}>
          <Text style={styles.resultsTitle}>⚡ Total Taps: {tapCount}!</Text>
          <View style={styles.rewardContainer}>
            <Text style={styles.rewardText}>Coins: +{Math.min(GAME_REWARDS.tapSpeed.maxCoins, tapCount * GAME_REWARDS.tapSpeed.coinsPerTap)}</Text>
            <Text style={styles.rewardText}>XP: +{Math.min(GAME_REWARDS.tapSpeed.maxXp, tapCount * GAME_REWARDS.tapSpeed.xpPerTap)}</Text>
          </View>
          <Pressable style={styles.tryAgainButton} onPress={resetGame}>
            <Text style={styles.tryAgainText}>Try Again</Text>
          </Pressable>
          {onClose && (
            <Pressable style={[styles.tryAgainButton, styles.closeButton]} onPress={onClose}>
              <Text style={[styles.tryAgainText, styles.closeText]}>Close</Text>
            </Pressable>
          )}
        </Animated.View>
      ) : (
        <View style={styles.gameArea}>
          <Text style={[
            styles.timerText, 
            { color: timeLeft < 3 ? '#EF4444' : '#10B981' }
          ]}>
            ⏱️ Time Left: {timeLeft}s
          </Text>
          
          <View style={[
            styles.ringOuter,
            { borderColor: timeLeft < 3 ? '#EF4444' : '#E2E8F0' }
          ]}>
            <Pressable onPress={handleTap} style={styles.buttonWrapper}>
              <Animated.View style={[styles.tapButton, animatedButtonStyle]}>
                {gameState === 'idle' ? (
                  <Text style={styles.startText}>TAP TO START</Text>
                ) : (
                  <Text style={styles.countText}>{tapCount}</Text>
                )}
              </Animated.View>
            </Pressable>
          </View>
          
          {gameState === 'idle' ? (
            <Text style={styles.instructionText}>Tap as fast as you can!</Text>
          ) : (
            <Text style={styles.statsText}>{tapsPerSec.toFixed(1)} taps/sec</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  gameArea: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 30,
  },
  ringOuter: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  buttonWrapper: {
    width: 170,
    height: 170,
  },
  tapButton: {
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: '#7C3AED',
    borderWidth: 6,
    borderColor: '#C4B5FD',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  startText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  countText: {
    fontSize: 48,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  instructionText: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '500',
  },
  statsText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  resultsBanner: {
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  resultsTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 20,
  },
  rewardContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  rewardText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10B981',
    marginBottom: 8,
  },
  tryAgainButton: {
    backgroundColor: '#7C3AED',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  tryAgainText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeButton: {
    backgroundColor: 'transparent',
    marginTop: 12,
  },
  closeText: {
    color: '#64748B',
  }
});
