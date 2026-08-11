import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Modal,
  Animated,
  Easing,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useAuth } from '@/context/AuthContext';
import { IconSymbol } from '@/components/ui/icon-symbol';
import apiService from '@/services/api';
import * as Haptics from 'expo-haptics';

// ----------------------------------------------------
// Trivia Game Questions Data
// ----------------------------------------------------
const TRIVIA_QUESTIONS = [
  {
    question: 'Which framework powers React Native cross-platform apps?',
    options: ['React JS', 'Flutter', 'Vue JS', 'Angular'],
    answer: 0,
  },
  {
    question: 'What is the maximum character limit for a SocialHub post?',
    options: ['280', '500', '2,000', 'Unlimited'],
    answer: 2,
  },
  {
    question: 'Which technology provides real-time chat in SocialHub?',
    options: ['Socket.io', 'GraphQL', 'REST API', 'FTP'],
    answer: 0,
  },
  {
    question: 'What do you earn in SocialHub by completing daily tasks?',
    options: ['Gems only', 'Coins & XP', 'Followers', 'Nothing'],
    answer: 1,
  },
  {
    question: 'Which cloud platform handles media uploads in SocialHub?',
    options: ['Cloudinary', 'Dropbox', 'Google Drive', 'OneDrive'],
    answer: 0,
  },
];

// Memory game card symbols
const CARD_SYMBOLS = ['🚀', '👾', '🔥', '⚡', '💎', '🎮'];
const SIMON_COLORS = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B']; // Red, Blue, Green, Yellow

export default function GamesScreen() {
  const { user, updateUser } = useAuth();

  const [stats, setStats] = useState({
    coins: user?.coins || 150,
    xp: user?.xp || 2500,
    level: user?.level || 1,
    streakCount: user?.streakCount || 1,
    todayRewardClaimed: user?.todayRewardClaimed || false,
  });

  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);

  // Selected Game modal controller
  const [activeGame, setActiveGame] = useState<string | null>(null);

  // ----------------------------------------------------
  // Game 1: Memory Match State
  // ----------------------------------------------------
  const [memoryCards, setMemoryCards] = useState<any[]>([]);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [matchedPairs, setMatchedPairs] = useState<number>(0);
  const [memoryWon, setMemoryWon] = useState(false);

  // ----------------------------------------------------
  // Game 2: Spin & Win Wheel State
  // ----------------------------------------------------
  const [spinning, setSpinning] = useState(false);
  const [spinResult, setSpinResult] = useState<string | null>(null);
  const spinAnim = useRef(new Animated.Value(0)).current;

  // ----------------------------------------------------
  // Game 3: Trivia Quiz State
  // ----------------------------------------------------
  const [triviaIndex, setTriviaIndex] = useState(0);
  const [triviaScore, setTriviaScore] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [triviaFinished, setTriviaFinished] = useState(false);

  // ----------------------------------------------------
  // Game 4: Tap Speed Frenzy State
  // ----------------------------------------------------
  const [tapCount, setTapCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(10);
  const [tapGameActive, setTapGameActive] = useState(false);
  const [tapGameFinished, setTapGameFinished] = useState(false);
  const timerRef = useRef<any>(null);

  // ----------------------------------------------------
  // Game 5: Simon Says Color Sequence State
  // ----------------------------------------------------
  const [simonSequence, setSimonSequence] = useState<number[]>([]);
  const [userSequence, setUserSequence] = useState<number[]>([]);
  const [simonPlaying, setSimonPlaying] = useState(false);
  const [activePad, setActivePad] = useState<number | null>(null);
  const [simonScore, setSimonScore] = useState(0);
  const [simonGameOver, setSimonGameOver] = useState(false);

  // Load backend stats & leaderboard
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [dailyRes, leadRes] = await Promise.all([
        apiService.getDailyStatus(),
        apiService.getLeaderboard(),
      ]);

      if (dailyRes.success) {
        setStats((prev) => ({
          ...prev,
          coins: dailyRes.coins,
          xp: dailyRes.xp,
          level: dailyRes.level,
          streakCount: dailyRes.streakCount,
          todayRewardClaimed: dailyRes.todayRewardClaimed,
        }));
      }

      if (leadRes.success) {
        setLeaderboard(leadRes.leaderboard || []);
      }
    } catch (err) {
      console.error('Games data load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Claim Daily Login Bonus
  const handleClaimDaily = async () => {
    if (stats.todayRewardClaimed) return;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setClaiming(true);
    try {
      const res = await apiService.claimDailyReward();
      if (res.success) {
        setStats((prev) => ({
          ...prev,
          coins: res.user.coins,
          xp: res.user.xp,
          level: res.user.level,
          streakCount: res.user.streakCount,
          todayRewardClaimed: true,
        }));
        Alert.alert('🎉 Daily Bonus Claimed!', res.message);
        updateUser(res.user);
      }
    } catch (err: any) {
      Alert.alert('Notice', err.message || 'Already claimed today');
    } finally {
      setClaiming(false);
    }
  };

  // Helper: Award reward via API
  const awardGameReward = async (gameTitle: string, coins: number, xp: number) => {
    try {
      const res = await apiService.playGameReward(gameTitle, coins, xp);
      if (res.success) {
        setStats((prev) => ({
          ...prev,
          coins: res.user.coins,
          xp: res.user.xp,
          level: res.user.level,
        }));
        updateUser(res.user);
      }
    } catch (_e) {
      console.error('Reward error:', _e);
    }
  };

  // ----------------------------------------------------
  // GAME 1 LOGIC: Memory Match
  // ----------------------------------------------------
  const startMemoryGame = () => {
    const deck = [...CARD_SYMBOLS, ...CARD_SYMBOLS]
      .sort(() => Math.random() - 0.5)
      .map((symbol, index) => ({
        id: index,
        symbol,
        isFlipped: false,
        isMatched: false,
      }));
    setMemoryCards(deck);
    setFlippedIndices([]);
    setMatchedPairs(0);
    setMemoryWon(false);
    setActiveGame('memory');
  };

  const handleCardPress = async (index: number) => {
    if (flippedIndices.length === 2 || memoryCards[index].isFlipped || memoryCards[index].isMatched) return;

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newCards = [...memoryCards];
    newCards[index].isFlipped = true;
    setMemoryCards(newCards);

    const newFlipped = [...flippedIndices, index];
    setFlippedIndices(newFlipped);

    if (newFlipped.length === 2) {
      const [firstIdx, secondIdx] = newFlipped;
      if (newCards[firstIdx].symbol === newCards[secondIdx].symbol) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        newCards[firstIdx].isMatched = true;
        newCards[secondIdx].isMatched = true;
        setMemoryCards(newCards);
        setFlippedIndices([]);
        const updatedPairs = matchedPairs + 1;
        setMatchedPairs(updatedPairs);

        if (updatedPairs === CARD_SYMBOLS.length) {
          setMemoryWon(true);
          awardGameReward('Memory Match', 100, 300);
        }
      } else {
        setTimeout(() => {
          newCards[firstIdx].isFlipped = false;
          newCards[secondIdx].isFlipped = false;
          setMemoryCards([...newCards]);
          setFlippedIndices([]);
        }, 700);
      }
    }
  };

  // ----------------------------------------------------
  // GAME 2 LOGIC: Spin & Win Wheel
  // ----------------------------------------------------
  const startSpinWheel = () => {
    setSpinResult(null);
    setSpinning(false);
    spinAnim.setValue(0);
    setActiveGame('spin');
  };

  const handleSpinWheel = async () => {
    if (spinning) return;
    setSpinning(true);
    setSpinResult(null);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Random rotations (5 full spins + slice angle)
    const randomDegrees = 1800 + Math.floor(Math.random() * 360);

    Animated.timing(spinAnim, {
      toValue: randomDegrees,
      duration: 3500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(async () => {
      setSpinning(false);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Slice prize evaluation
      const finalAngle = randomDegrees % 360;
      let rewardCoins = 100;
      let rewardXp = 250;
      let resultText = '🎉 You won 100 Coins & 250 XP!';

      if (finalAngle < 60) {
        rewardCoins = 250;
        rewardXp = 500;
        resultText = '🌟 BIG WIN! 250 Coins & 500 XP!';
      } else if (finalAngle < 120) {
        rewardCoins = 50;
        rewardXp = 150;
        resultText = '🎁 50 Bonus Coins & 150 XP!';
      } else if (finalAngle < 240) {
        rewardCoins = 500;
        rewardXp = 800;
        resultText = '🔥 JACKPOT! 500 Coins & 800 XP!';
      }

      setSpinResult(resultText);
      awardGameReward('Spin & Win Wheel', rewardCoins, rewardXp);
    });
  };

  // ----------------------------------------------------
  // GAME 3 LOGIC: Trivia Master Quiz
  // ----------------------------------------------------
  const startTriviaGame = () => {
    setTriviaIndex(0);
    setTriviaScore(0);
    setSelectedOption(null);
    setTriviaFinished(false);
    setActiveGame('trivia');
  };

  const handleTriviaAnswer = async (optIdx: number) => {
    if (selectedOption !== null) return;
    setSelectedOption(optIdx);

    const isCorrect = optIdx === TRIVIA_QUESTIONS[triviaIndex].answer;
    if (isCorrect) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTriviaScore((s) => s + 1);
    } else {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    setTimeout(() => {
      if (triviaIndex + 1 < TRIVIA_QUESTIONS.length) {
        setTriviaIndex((i) => i + 1);
        setSelectedOption(null);
      } else {
        setTriviaFinished(true);
        const earnedCoins = (triviaScore + (isCorrect ? 1 : 0)) * 40;
        const earnedXp = (triviaScore + (isCorrect ? 1 : 0)) * 100;
        awardGameReward('Trivia Master', earnedCoins, earnedXp);
      }
    }, 1200);
  };

  // ----------------------------------------------------
  // GAME 4 LOGIC: Tap Speed Frenzy (10s)
  // ----------------------------------------------------
  const startTapSpeedGame = () => {
    setTapCount(0);
    setTimeLeft(10);
    setTapGameActive(false);
    setTapGameFinished(false);
    if (timerRef.current) clearInterval(timerRef.current);
    setActiveGame('tapspeed');
  };

  const startTapTimer = () => {
    setTapGameActive(true);
    setTapCount(1);
    setTimeLeft(10);

    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          setTapGameActive(false);
          setTapGameFinished(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  const handleTapBtn = async () => {
    if (!tapGameActive && !tapGameFinished) {
      startTapTimer();
      return;
    }
    if (tapGameActive) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setTapCount((c) => c + 1);
    }
  };

  useEffect(() => {
    if (tapGameFinished && tapCount > 0) {
      const earnedCoins = Math.min(300, tapCount * 4);
      const earnedXp = Math.min(600, tapCount * 10);
      awardGameReward('Tap Speed Frenzy', earnedCoins, earnedXp);
    }
  }, [tapGameFinished]);

  // ----------------------------------------------------
  // GAME 5 LOGIC: Simon Color Sequence Memory
  // ----------------------------------------------------
  const startSimonGame = () => {
    setSimonSequence([]);
    setUserSequence([]);
    setSimonScore(0);
    setSimonGameOver(false);
    setSimonPlaying(false);
    setActiveGame('simon');
    setTimeout(() => nextSimonRound([]), 300);
  };

  const nextSimonRound = (currentSeq: number[]) => {
    const nextColor = Math.floor(Math.random() * 4);
    const newSeq = [...currentSeq, nextColor];
    setSimonSequence(newSeq);
    setUserSequence([]);
    setSimonPlaying(true);
    playSimonSequence(newSeq);
  };

  const playSimonSequence = (seq: number[]) => {
    seq.forEach((colorIdx, i) => {
      setTimeout(() => {
        setActivePad(colorIdx);
        setTimeout(() => setActivePad(null), 400);
      }, (i + 1) * 700);
    });

    setTimeout(() => {
      setSimonPlaying(false);
    }, (seq.length + 1) * 700);
  };

  const handlePadPress = async (padIdx: number) => {
    if (simonPlaying || simonGameOver) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const newUserSeq = [...userSequence, padIdx];
    setUserSequence(newUserSeq);

    // Check if match
    const stepIdx = newUserSeq.length - 1;
    if (newUserSeq[stepIdx] !== simonSequence[stepIdx]) {
      // Game Over!
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setSimonGameOver(true);
      if (simonScore > 0) {
        awardGameReward('Simon Color Memory', simonScore * 50, simonScore * 120);
      }
      return;
    }

    if (newUserSeq.length === simonSequence.length) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const newScore = simonScore + 1;
      setSimonScore(newScore);
      setTimeout(() => nextSimonRound(simonSequence), 1000);
    }
  };

  // Main UI Render
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header Title */}
        <Text style={styles.title}>🎮 Mini Games Suite</Text>

        {/* Stats Dashboard Banner */}
        <View style={styles.statsCard}>
          <View style={styles.statBox}>
            <Text style={styles.statEmoji}>🪙</Text>
            <Text style={styles.statVal}>{stats.coins}</Text>
            <Text style={styles.statLabel}>Coins</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statBox}>
            <Text style={styles.statEmoji}>🔥</Text>
            <Text style={styles.statVal}>{stats.streakCount}d</Text>
            <Text style={styles.statLabel}>Streak</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statBox}>
            <Text style={styles.statEmoji}>⚡</Text>
            <Text style={styles.statVal}>Lvl {stats.level}</Text>
            <Text style={styles.statLabel}>{stats.xp} XP</Text>
          </View>
        </View>

        {/* Daily Reward Banner */}
        <TouchableOpacity
          style={[styles.dailyBanner, stats.todayRewardClaimed && styles.dailyBannerClaimed]}
          disabled={stats.todayRewardClaimed || claiming}
          onPress={handleClaimDaily}>
          <View style={{ flex: 1 }}>
            <Text style={styles.dailyTitle}>
              {stats.todayRewardClaimed ? '✅ Daily Reward Claimed' : '🎁 Claim Today’s Bonus'}
            </Text>
            <Text style={styles.dailySub}>
              {stats.todayRewardClaimed ? 'Come back tomorrow for +150 Coins' : '+150 Coins & +500 XP'}
            </Text>
          </View>
          {claiming ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <View style={styles.claimBadge}>
              <Text style={styles.claimBadgeText}>
                {stats.todayRewardClaimed ? 'Claimed' : 'Claim'}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* 5 Playable Games Grid */}
        <Text style={styles.sectionTitle}>🎯 Select a Game to Play & Earn</Text>

        <View style={styles.gamesGrid}>
          {/* Game 1: Memory Match */}
          <TouchableOpacity style={styles.gameCard} onPress={startMemoryGame}>
            <View style={[styles.gameIconBox, { backgroundColor: '#EDE9FE' }]}>
              <Text style={styles.gameIcon}>🧠</Text>
            </View>
            <View style={styles.gameInfo}>
              <Text style={styles.gameCardTitle}>Memory Match</Text>
              <Text style={styles.gameCardSub}>Flip & match emoji pairs</Text>
              <Text style={styles.gameCardReward}>Earn up to +100 Coins</Text>
            </View>
            <View style={styles.playTag}>
              <Text style={styles.playTagText}>Play</Text>
            </View>
          </TouchableOpacity>

          {/* Game 2: Spin & Win Wheel */}
          <TouchableOpacity style={styles.gameCard} onPress={startSpinWheel}>
            <View style={[styles.gameIconBox, { backgroundColor: '#FEF3C7' }]}>
              <Text style={styles.gameIcon}>🎡</Text>
            </View>
            <View style={styles.gameInfo}>
              <Text style={styles.gameCardTitle}>Spin & Win Wheel</Text>
              <Text style={styles.gameCardSub}>Spin for fortune prizes</Text>
              <Text style={styles.gameCardReward}>Earn up to +500 Coins</Text>
            </View>
            <View style={styles.playTag}>
              <Text style={styles.playTagText}>Play</Text>
            </View>
          </TouchableOpacity>

          {/* Game 3: Trivia Master Quiz */}
          <TouchableOpacity style={styles.gameCard} onPress={startTriviaGame}>
            <View style={[styles.gameIconBox, { backgroundColor: '#D1FAE5' }]}>
              <Text style={styles.gameIcon}>❓</Text>
            </View>
            <View style={styles.gameInfo}>
              <Text style={styles.gameCardTitle}>Trivia Master</Text>
              <Text style={styles.gameCardSub}>5-question tech quiz</Text>
              <Text style={styles.gameCardReward}>Earn up to +200 Coins</Text>
            </View>
            <View style={styles.playTag}>
              <Text style={styles.playTagText}>Play</Text>
            </View>
          </TouchableOpacity>

          {/* Game 4: Tap Speed Frenzy */}
          <TouchableOpacity style={styles.gameCard} onPress={startTapSpeedGame}>
            <View style={[styles.gameIconBox, { backgroundColor: '#FEE2E2' }]}>
              <Text style={styles.gameIcon}>⚡</Text>
            </View>
            <View style={styles.gameInfo}>
              <Text style={styles.gameCardTitle}>Tap Speed Frenzy</Text>
              <Text style={styles.gameCardSub}>10-sec fast tapping challenge</Text>
              <Text style={styles.gameCardReward}>Earn up to +300 Coins</Text>
            </View>
            <View style={styles.playTag}>
              <Text style={styles.playTagText}>Play</Text>
            </View>
          </TouchableOpacity>

          {/* Game 5: Simon Color Pattern */}
          <TouchableOpacity style={styles.gameCard} onPress={startSimonGame}>
            <View style={[styles.gameIconBox, { backgroundColor: '#E0F2FE' }]}>
              <Text style={styles.gameIcon}>🧩</Text>
            </View>
            <View style={styles.gameInfo}>
              <Text style={styles.gameCardTitle}>Simon Color Pattern</Text>
              <Text style={styles.gameCardSub}>Repeat color pad sequences</Text>
              <Text style={styles.gameCardReward}>Earn up to +250 Coins</Text>
            </View>
            <View style={styles.playTag}>
              <Text style={styles.playTagText}>Play</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Global Leaderboard Section */}
        <View style={styles.leaderboardSection}>
          <Text style={styles.sectionTitle}>🏆 Global Leaderboard</Text>

          {loading ? (
            <ActivityIndicator size="small" color="#7C3AED" style={{ marginVertical: 16 }} />
          ) : (
            leaderboard.map((item) => {
              const avatarUrl =
                item.profilePicture ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(item.firstName || item.username)}&background=EDE9FE&color=7C3AED`;

              const rankEmoji =
                item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : `#${item.rank}`;

              return (
                <View key={item.id} style={styles.leaderItem}>
                  <Text style={styles.rankText}>{rankEmoji}</Text>
                  <Image source={{ uri: avatarUrl }} style={styles.leaderAvatar} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.leaderName}>
                      {item.firstName} {item.lastName}
                    </Text>
                    <Text style={styles.leaderHandle}>@{item.username}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.leaderCoins}>🪙 {item.coins}</Text>
                    <Text style={styles.leaderLvl}>Lvl {item.level}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* ==================================================== */}
      {/* GAME MODAL POPUP FOR ALL 5 GAMES */}
      {/* ==================================================== */}
      <Modal visible={activeGame !== null} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalGameContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalGameTitle}>
                {activeGame === 'memory' && '🧠 Memory Match'}
                {activeGame === 'spin' && '🎡 Spin & Win Wheel'}
                {activeGame === 'trivia' && '❓ Trivia Master'}
                {activeGame === 'tapspeed' && '⚡ Tap Speed Frenzy'}
                {activeGame === 'simon' && '🧩 Simon Color Pattern'}
              </Text>
              <TouchableOpacity onPress={() => setActiveGame(null)}>
                <IconSymbol size={24} name="xmark" color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* ----------------------------------------------- */}
            {/* GAME 1: MEMORY MATCH UI */}
            {/* ----------------------------------------------- */}
            {activeGame === 'memory' && (
              <View style={styles.gameBox}>
                <Text style={styles.gameInstruction}>Flip & match all pair cards!</Text>
                <View style={styles.memoryGrid}>
                  {memoryCards.map((card, idx) => (
                    <TouchableOpacity
                      key={card.id}
                      style={[
                        styles.memoryCard,
                        (card.isFlipped || card.isMatched) && styles.memoryCardFlipped,
                        card.isMatched && styles.memoryCardMatched,
                      ]}
                      onPress={() => handleCardPress(idx)}>
                      <Text style={styles.memorySymbol}>
                        {card.isFlipped || card.isMatched ? card.symbol : '❓'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {memoryWon && (
                  <View style={styles.wonBanner}>
                    <Text style={styles.wonTitle}>🎉 Winner! +100 Coins & +300 XP</Text>
                    <TouchableOpacity style={styles.restartBtn} onPress={startMemoryGame}>
                      <Text style={styles.restartBtnText}>Play Again</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* ----------------------------------------------- */}
            {/* GAME 2: SPIN & WIN WHEEL UI */}
            {/* ----------------------------------------------- */}
            {activeGame === 'spin' && (
              <View style={styles.gameBoxCentered}>
                <Animated.View
                  style={[
                    styles.wheelDisc,
                    {
                      transform: [
                        {
                          rotate: spinAnim.interpolate({
                            inputRange: [0, 3600],
                            outputRange: ['0deg', '3600deg'],
                          }),
                        },
                      ],
                    },
                  ]}>
                  <Text style={styles.wheelSlice}>🌟 500 Coins</Text>
                  <Text style={styles.wheelSlice}>🎁 50 Coins</Text>
                  <Text style={styles.wheelSlice}>🔥 250 Coins</Text>
                  <Text style={styles.wheelSlice}>⚡ 100 Coins</Text>
                </Animated.View>

                <TouchableOpacity
                  style={styles.spinBtn}
                  onPress={handleSpinWheel}
                  disabled={spinning}>
                  <Text style={styles.spinBtnText}>{spinning ? 'Spinning...' : 'SPIN WHEEL'}</Text>
                </TouchableOpacity>

                {spinResult && <Text style={styles.spinResultText}>{spinResult}</Text>}
              </View>
            )}

            {/* ----------------------------------------------- */}
            {/* GAME 3: TRIVIA MASTER QUIZ UI */}
            {/* ----------------------------------------------- */}
            {activeGame === 'trivia' && (
              <View style={styles.gameBox}>
                {!triviaFinished ? (
                  <>
                    <Text style={styles.triviaProgress}>
                      Question {triviaIndex + 1} of {TRIVIA_QUESTIONS.length}
                    </Text>
                    <Text style={styles.triviaQuestion}>
                      {TRIVIA_QUESTIONS[triviaIndex].question}
                    </Text>

                    {TRIVIA_QUESTIONS[triviaIndex].options.map((opt, oIdx) => {
                      let btnStyle = styles.triviaOptBtn;
                      if (selectedOption !== null) {
                        if (oIdx === TRIVIA_QUESTIONS[triviaIndex].answer) {
                          btnStyle = [styles.triviaOptBtn, styles.triviaCorrectBtn] as any;
                        } else if (selectedOption === oIdx) {
                          btnStyle = [styles.triviaOptBtn, styles.triviaWrongBtn] as any;
                        }
                      }

                      return (
                        <TouchableOpacity
                          key={oIdx}
                          style={btnStyle}
                          onPress={() => handleTriviaAnswer(oIdx)}>
                          <Text style={styles.triviaOptText}>{opt}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </>
                ) : (
                  <View style={styles.wonBanner}>
                    <Text style={styles.wonTitle}>
                      Quiz Complete! Score: {triviaScore} / {TRIVIA_QUESTIONS.length}
                    </Text>
                    <Text style={{ marginTop: 4, color: '#166534', fontSize: 13 }}>
                      Earned +{triviaScore * 40} Coins & +{triviaScore * 100} XP!
                    </Text>
                    <TouchableOpacity style={styles.restartBtn} onPress={startTriviaGame}>
                      <Text style={styles.restartBtnText}>Play Again</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* ----------------------------------------------- */}
            {/* GAME 4: TAP SPEED FRENZY UI */}
            {/* ----------------------------------------------- */}
            {activeGame === 'tapspeed' && (
              <View style={styles.gameBoxCentered}>
                <Text style={styles.timerDisplay}>⏱️ Time Left: {timeLeft}s</Text>

                <TouchableOpacity style={styles.tapBigBtn} onPress={handleTapBtn}>
                  <Text style={styles.tapBigText}>
                    {!tapGameActive && !tapGameFinished ? 'TAP TO START' : tapCount}
                  </Text>
                </TouchableOpacity>

                {tapGameFinished && (
                  <View style={styles.wonBanner}>
                    <Text style={styles.wonTitle}>⚡ Total Taps: {tapCount}!</Text>
                    <Text style={{ color: '#166534', marginTop: 4 }}>
                      Earned +{Math.min(300, tapCount * 4)} Coins & +
                      {Math.min(600, tapCount * 10)} XP!
                    </Text>
                    <TouchableOpacity style={styles.restartBtn} onPress={startTapSpeedGame}>
                      <Text style={styles.restartBtnText}>Try Again</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* ----------------------------------------------- */}
            {/* GAME 5: SIMON COLOR PATTERN UI */}
            {/* ----------------------------------------------- */}
            {activeGame === 'simon' && (
              <View style={styles.gameBoxCentered}>
                <Text style={styles.simonScoreText}>Sequence Score: {simonScore}</Text>
                <Text style={styles.simonInstruction}>
                  {simonPlaying ? '👀 Watch sequence...' : '👇 Repeat the sequence!'}
                </Text>

                <View style={styles.simonGrid}>
                  {SIMON_COLORS.map((color, padIdx) => (
                    <TouchableOpacity
                      key={padIdx}
                      style={[
                        styles.simonPad,
                        { backgroundColor: color },
                        activePad === padIdx && styles.simonPadLit,
                      ]}
                      onPress={() => handlePadPress(padIdx)}
                    />
                  ))}
                </View>

                {simonGameOver && (
                  <View style={styles.wonBanner}>
                    <Text style={styles.wonTitle}>❌ Wrong sequence!</Text>
                    <Text style={{ color: '#166534', marginTop: 2 }}>
                      Final Score: {simonScore} (+{simonScore * 50} Coins)
                    </Text>
                    <TouchableOpacity style={styles.restartBtn} onPress={startSimonGame}>
                      <Text style={styles.restartBtnText}>Play Again</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 16,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#7C3AED',
    borderRadius: 20,
    padding: 18,
    alignItems: 'center',
    marginBottom: 16,
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
  },
  statLabel: {
    fontSize: 12,
    color: '#DDD6FE',
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dailyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  dailyBannerClaimed: {
    backgroundColor: '#64748B',
  },
  dailyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dailySub: {
    fontSize: 12,
    color: '#E6F4EA',
    marginTop: 2,
  },
  claimBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  claimBadgeText: {
    color: '#10B981',
    fontWeight: '800',
    fontSize: 13,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  gamesGrid: {
    gap: 12,
    marginBottom: 20,
  },
  gameCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  gameIconBox: {
    width: 50,
    height: 50,
    borderRadius: 25,
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
    marginTop: 2,
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
  leaderboardSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  leaderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  rankText: {
    fontSize: 16,
    fontWeight: '800',
    width: 32,
    color: '#475569',
  },
  leaderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EDE9FE',
  },
  leaderName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  leaderHandle: {
    fontSize: 12,
    color: '#94A3B8',
  },
  leaderCoins: {
    fontSize: 13,
    fontWeight: '700',
    color: '#D97706',
  },
  leaderLvl: {
    fontSize: 11,
    color: '#64748B',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 16,
  },
  modalGameContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalGameTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  gameBox: {
    marginTop: 12,
  },
  gameBoxCentered: {
    marginTop: 16,
    alignItems: 'center',
  },
  gameInstruction: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 12,
  },
  memoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  memoryCard: {
    width: '22%',
    aspectRatio: 1,
    backgroundColor: '#EDE9FE',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#C4B5FD',
  },
  memoryCardFlipped: {
    backgroundColor: '#FFFFFF',
    borderColor: '#7C3AED',
  },
  memoryCardMatched: {
    backgroundColor: '#D1FAE5',
    borderColor: '#10B981',
  },
  memorySymbol: {
    fontSize: 24,
  },
  wonBanner: {
    marginTop: 16,
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    padding: 14,
    borderRadius: 14,
  },
  wonTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#166534',
  },
  restartBtn: {
    marginTop: 8,
    backgroundColor: '#166534',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  restartBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  wheelDisc: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 6,
    borderColor: '#F59E0B',
    marginBottom: 20,
  },
  wheelSlice: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
    marginVertical: 4,
  },
  spinBtn: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  spinBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  spinResultText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#10B981',
    marginTop: 14,
  },
  triviaProgress: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7C3AED',
    marginBottom: 4,
  },
  triviaQuestion: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 16,
  },
  triviaOptBtn: {
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  triviaOptText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  triviaCorrectBtn: {
    backgroundColor: '#D1FAE5',
    borderColor: '#10B981',
    borderWidth: 1,
  },
  triviaWrongBtn: {
    backgroundColor: '#FEE2E2',
    borderColor: '#EF4444',
    borderWidth: 1,
  },
  timerDisplay: {
    fontSize: 20,
    fontWeight: '800',
    color: '#EF4444',
    marginBottom: 16,
  },
  tapBigBtn: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 6,
    borderColor: '#C4B5FD',
  },
  tapBigText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  simonScoreText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#7C3AED',
  },
  simonInstruction: {
    fontSize: 13,
    color: '#64748B',
    marginVertical: 8,
  },
  simonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 200,
    gap: 10,
    marginVertical: 12,
  },
  simonPad: {
    width: 90,
    height: 90,
    borderRadius: 16,
    opacity: 0.6,
  },
  simonPadLit: {
    opacity: 1,
    transform: [{ scale: 1.05 }],
  },
});
