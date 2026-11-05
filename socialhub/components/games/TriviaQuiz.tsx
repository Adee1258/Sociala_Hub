import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  FadeIn,
  withSpring
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { getRandomQuestions, TriviaQuestion, GAME_REWARDS, TRIVIA_TIME_PER_QUESTION } from './constants';

interface TriviaQuizProps {
  onReward: (gameName: string, coins: number, xp: number) => void;
}

const TOTAL_QUESTIONS = 5;

// Animated button for options
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const OptionButton = ({ 
  option, 
  index, 
  isSelected, 
  isCorrect, 
  isWrong, 
  showCorrect, 
  disabled, 
  onPress 
}: { 
  option: string;
  index: number;
  isSelected: boolean;
  isCorrect: boolean;
  isWrong: boolean;
  showCorrect: boolean;
  disabled: boolean;
  onPress: () => void;
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const handlePressIn = () => {
    if (!disabled) {
      scale.value = withTiming(0.95, { duration: 100 });
    }
  };

  const handlePressOut = () => {
    if (!disabled) {
      scale.value = withSpring(1);
    }
  };

  let bgStyle = styles.optionDefault;
  let textStyle = styles.optionTextDefault;
  let borderStyle = styles.optionBorderDefault;

  if (isSelected) {
    if (isCorrect) {
      bgStyle = styles.optionCorrect;
      borderStyle = styles.optionBorderCorrect;
      textStyle = styles.optionTextCorrect;
    } else if (isWrong) {
      bgStyle = styles.optionWrong;
      borderStyle = styles.optionBorderWrong;
      textStyle = styles.optionTextWrong;
    }
  } else if (showCorrect) {
    // Highlight the correct answer if the user picked wrong
    bgStyle = styles.optionCorrect;
    borderStyle = styles.optionBorderCorrect;
    textStyle = styles.optionTextCorrect;
  }

  return (
    <AnimatedPressable
      style={[styles.optionContainer, bgStyle, borderStyle, animatedStyle]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
    >
      <Text style={[styles.optionText, textStyle]}>{option}</Text>
    </AnimatedPressable>
  );
};

export default function TriviaQuiz({ onReward }: TriviaQuizProps) {
  const [questions, setQuestions] = useState<TriviaQuestion[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [score, setScore] = useState(0);
  
  const [timeLeft, setTimeLeft] = useState(TRIVIA_TIME_PER_QUESTION);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswering, setIsAnswering] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);

  const progressWidth = useSharedValue(0);

  // Initialize game
  const initGame = useCallback(() => {
    setQuestions(getRandomQuestions(TOTAL_QUESTIONS));
    setCurrentQIndex(0);
    setScore(0);
    setTimeLeft(TRIVIA_TIME_PER_QUESTION);
    setSelectedOption(null);
    setIsAnswering(false);
    setIsGameOver(false);
    progressWidth.value = 0;
  }, [progressWidth]);

  useEffect(() => {
    initGame();
  }, [initGame]);

  // Update progress bar when question changes
  useEffect(() => {
    if (questions.length > 0 && !isGameOver) {
      const progress = (currentQIndex / TOTAL_QUESTIONS) * 100;
      progressWidth.value = withTiming(progress, { duration: 300 });
    }
  }, [currentQIndex, questions, isGameOver, progressWidth]);

  // Timer logic
  useEffect(() => {
    if (isGameOver || isAnswering || questions.length === 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleTimeOut();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isGameOver, isAnswering, questions.length]);

  const handleTimeOut = useCallback(() => {
    setIsAnswering(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    
    // Auto advance
    setTimeout(() => {
      advanceQuestion();
    }, 1200);
  }, []);

  const handleAnswer = (index: number) => {
    if (isAnswering) return;
    
    setIsAnswering(true);
    setSelectedOption(index);

    const isCorrect = index === questions[currentQIndex].answer;
    
    if (isCorrect) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setScore((prev) => prev + 1);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    setTimeout(() => {
      advanceQuestion();
    }, 1200);
  };

  const advanceQuestion = () => {
    if (currentQIndex < TOTAL_QUESTIONS - 1) {
      setCurrentQIndex((prev) => prev + 1);
      setSelectedOption(null);
      setIsAnswering(false);
      setTimeLeft(TRIVIA_TIME_PER_QUESTION);
    } else {
      finishGame();
    }
  };

  const finishGame = () => {
    setIsGameOver(true);
    progressWidth.value = withTiming(100, { duration: 300 });
  };

  const handleClaimReward = () => {
    const coins = score * GAME_REWARDS.trivia.coinsPerCorrect;
    const xp = score * GAME_REWARDS.trivia.xpPerCorrect;
    onReward('Trivia Master', coins, xp);
  };

  const handlePlayAgain = () => {
    initGame();
  };

  const progressStyle = useAnimatedStyle(() => {
    return {
      width: `${progressWidth.value}%`,
    };
  });

  if (questions.length === 0) {
    return <View style={styles.container}><Text>Loading...</Text></View>;
  }

  if (isGameOver) {
    const coins = score * GAME_REWARDS.trivia.coinsPerCorrect;
    const xp = score * GAME_REWARDS.trivia.xpPerCorrect;
    const stars = '⭐'.repeat(score);

    return (
      <Animated.View entering={FadeIn} style={styles.resultsContainer}>
        <Text style={styles.resultsTitle}>Quiz Complete!</Text>
        
        <View style={styles.resultsBanner}>
          <Text style={styles.resultsScore}>Score: {score} / {TOTAL_QUESTIONS}</Text>
          <Text style={styles.stars}>{stars}</Text>
          
          <View style={styles.rewardsRow}>
            <Text style={styles.rewardText}>+{coins} Coins</Text>
            <Text style={styles.rewardText}>+{xp} XP</Text>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={() => {
            handleClaimReward();
            handlePlayAgain();
          }}
        >
          <Text style={styles.actionButtonText}>Play Again</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  const currentQ = questions[currentQIndex];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.progressText}>Question {currentQIndex + 1} of {TOTAL_QUESTIONS}</Text>
        <View style={styles.timerBadge}>
          <Text style={[styles.timerText, timeLeft < 5 && styles.timerTextDanger]}>
            ⏱️ {timeLeft}s
          </Text>
        </View>
      </View>

      <View style={styles.progressBarContainer}>
        <Animated.View style={[styles.progressBarFill, progressStyle]} />
      </View>

      <Text style={styles.questionText}>{currentQ.question}</Text>

      <View style={styles.optionsContainer}>
        {currentQ.options.map((option, index) => {
          const isSelected = selectedOption === index;
          const isCorrectAnswer = index === currentQ.answer;
          
          // Show correct answer if answered wrong or timed out
          const showCorrect = isAnswering && isCorrectAnswer;
          
          return (
            <OptionButton
              key={index}
              option={option}
              index={index}
              isSelected={isSelected}
              isCorrect={isSelected && isCorrectAnswer}
              isWrong={isSelected && !isCorrectAnswer}
              showCorrect={showCorrect}
              disabled={isAnswering}
              onPress={() => handleAnswer(index)}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  timerBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  timerText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  timerTextDanger: {
    color: '#EF4444',
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    marginBottom: 24,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#7C3AED',
    borderRadius: 3,
  },
  questionText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 24,
    lineHeight: 24,
  },
  optionsContainer: {
    gap: 12,
  },
  optionContainer: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionDefault: {
    backgroundColor: '#F1F5F9',
  },
  optionBorderDefault: {
    borderColor: 'transparent',
  },
  optionCorrect: {
    backgroundColor: '#D1FAE5',
  },
  optionBorderCorrect: {
    borderColor: '#10B981',
  },
  optionWrong: {
    backgroundColor: '#FEE2E2',
  },
  optionBorderWrong: {
    borderColor: '#EF4444',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  optionTextDefault: {
    color: '#1E293B',
  },
  optionTextCorrect: {
    color: '#065F46',
  },
  optionTextWrong: {
    color: '#991B1B',
  },
  resultsContainer: {
    padding: 16,
    alignItems: 'center',
  },
  resultsTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 20,
  },
  resultsBanner: {
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
  },
  resultsScore: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  stars: {
    fontSize: 24,
    marginBottom: 16,
  },
  rewardsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  rewardText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
  },
  actionButton: {
    backgroundColor: '#7C3AED',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
