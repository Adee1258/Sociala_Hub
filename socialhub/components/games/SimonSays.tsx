import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withSpring, 
  withSequence 
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { SIMON_COLORS, GAME_REWARDS } from './constants';

interface SimonSaysProps {
  onReward: (gameName: string, coins: number, xp: number) => void;
}

type GameState = 'playing_sequence' | 'waiting_input' | 'success' | 'game_over';

const HAPTICS_MAP = [
  Haptics.ImpactFeedbackStyle.Heavy,  // Red
  Haptics.ImpactFeedbackStyle.Medium, // Blue
  Haptics.ImpactFeedbackStyle.Light,  // Green
  Haptics.ImpactFeedbackStyle.Light,  // Yellow
];

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const ColorPad = ({ 
  color, 
  index, 
  onPress, 
  disabled, 
  isActive 
}: { 
  color: string, 
  index: number, 
  onPress: (i: number) => void, 
  disabled: boolean, 
  isActive: boolean 
}) => {
  const opacity = useSharedValue(0.5);
  const scale = useSharedValue(1.0);

  useEffect(() => {
    if (isActive) {
      opacity.value = withTiming(1.0, { duration: 150 });
      scale.value = withTiming(1.08, { duration: 150 });
    } else {
      opacity.value = withTiming(0.5, { duration: 150 });
      scale.value = withTiming(1.0, { duration: 150 });
    }
  }, [isActive, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [{ scale: scale.value }],
    };
  });

  const handlePressIn = () => {
    if (!disabled) {
      opacity.value = withTiming(1.0, { duration: 100 });
      scale.value = withTiming(0.95, { duration: 100 });
      Haptics.impactAsync(HAPTICS_MAP[index]);
    }
  };

  const handlePressOut = () => {
    if (!disabled) {
      opacity.value = withTiming(0.5, { duration: 150 });
      scale.value = withTiming(1.0, { duration: 150 });
    }
  };

  return (
    <AnimatedPressable
      style={[styles.pad, { backgroundColor: color }, animatedStyle]}
      onPress={() => onPress(index)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
    />
  );
};

export default function SimonSays({ onReward }: SimonSaysProps) {
  const [sequence, setSequence] = useState<number[]>([]);
  const [userStep, setUserStep] = useState(0);
  const [gameState, setGameState] = useState<GameState>('playing_sequence');
  const [score, setScore] = useState(0);
  const [activePad, setActivePad] = useState<number | null>(null);
  
  const scoreScale = useSharedValue(1);
  const scoreAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scoreScale.value }]
  }));

  const playSequence = async (seq: number[]) => {
    for (let i = 0; i < seq.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 300));
      
      setActivePad(seq[i]);
      Haptics.impactAsync(HAPTICS_MAP[seq[i]]);
      
      await new Promise(resolve => setTimeout(resolve, 400));
      setActivePad(null);
    }
    setGameState('waiting_input');
  };

  const startRound = useCallback((currentSequence: number[]) => {
    const nextColor = Math.floor(Math.random() * 4);
    const newSequence = [...currentSequence, nextColor];
    setSequence(newSequence);
    setUserStep(0);
    setGameState('playing_sequence');
    playSequence(newSequence);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      startRound([]);
    }, 300);
    return () => clearTimeout(timeout);
  }, [startRound]);

  const handlePadPress = (index: number) => {
    if (gameState !== 'waiting_input') return;

    if (index === sequence[userStep]) {
      // Correct tap
      if (userStep === sequence.length - 1) {
        // Round complete
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setGameState('success');
        const newScore = score + 1;
        setScore(newScore);
        
        scoreScale.value = withSequence(
          withSpring(1.3),
          withSpring(1)
        );

        setTimeout(() => {
          startRound(sequence);
        }, 1000);
      } else {
        // Move to next step
        setUserStep(prev => prev + 1);
      }
    } else {
      // Wrong tap
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setGameState('game_over');
      if (score > 0) {
        onReward('Simon Says', score * GAME_REWARDS.simonSays.coinsPerRound, score * GAME_REWARDS.simonSays.xpPerRound);
      }
    }
  };

  const handlePlayAgain = () => {
    setScore(0);
    startRound([]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Animated.Text style={[styles.scoreText, scoreAnimatedStyle]}>
          Round: {score}
        </Animated.Text>
        <Text style={styles.instructionText}>
          {gameState === 'playing_sequence' && '👀 Watch the sequence...'}
          {gameState === 'waiting_input' && '👇 Your turn! Repeat the sequence'}
          {gameState === 'success' && '✓ Correct!'}
          {gameState === 'game_over' && 'Game Over'}
        </Text>
      </View>

      <View style={styles.gameArea}>
        <View style={styles.padContainer}>
          {SIMON_COLORS.map((color, index) => (
            <ColorPad
              key={index}
              color={color}
              index={index}
              isActive={activePad === index}
              disabled={gameState !== 'waiting_input'}
              onPress={handlePadPress}
            />
          ))}
        </View>
      </View>

      {gameState === 'game_over' && (
        <View style={styles.gameOverBanner}>
          <Text style={styles.gameOverTitle}>❌ Wrong sequence!</Text>
          <Text style={styles.gameOverStats}>Final Score: {score} rounds</Text>
          {score > 0 && (
            <Text style={styles.earnedText}>
              Earned: {score * GAME_REWARDS.simonSays.coinsPerRound} Coins & {score * GAME_REWARDS.simonSays.xpPerRound} XP
            </Text>
          )}
          <Pressable style={styles.playAgainButton} onPress={handlePlayAgain}>
            <Text style={styles.playAgainText}>Play Again</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingTop: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  scoreText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#7C3AED',
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 14,
    color: '#64748B',
  },
  gameArea: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  padContainer: {
    width: 220,
    height: 220,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    alignContent: 'center',
  },
  pad: {
    width: 100,
    height: 100,
    borderRadius: 20,
  },
  gameOverBanner: {
    marginTop: 40,
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    width: '80%',
  },
  gameOverTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#EF4444',
    marginBottom: 8,
  },
  gameOverStats: {
    fontSize: 16,
    color: '#0F172A',
    marginBottom: 4,
  },
  earnedText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
    marginBottom: 16,
  },
  playAgainButton: {
    backgroundColor: '#7C3AED',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
  },
  playAgainText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
