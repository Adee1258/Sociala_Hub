import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, SafeAreaView, Alert, RefreshControl, StatusBar } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import apiService from '@/services/api';
import * as Haptics from 'expo-haptics';

// Game Components
import GameCard from '@/components/games/GameCard';
import StatsBar from '@/components/games/StatsBar';
import DailyReward from '@/components/games/DailyReward';
import LeaderboardSection from '@/components/games/LeaderboardSection';
import GameModal from '@/components/games/GameModal';
import MemoryMatch from '@/components/games/MemoryMatch';
import SpinWheel from '@/components/games/SpinWheel';
import TriviaQuiz from '@/components/games/TriviaQuiz';
import TapSpeed from '@/components/games/TapSpeed';
import SimonSays from '@/components/games/SimonSays';
import { GAME_REWARDS } from '@/components/games/constants';

export default function GamesScreen() {
  const { user, updateUser } = useAuth();

  const [stats, setStats] = useState({
    coins: user?.coins || 0,
    xp: user?.xp || 0,
    level: user?.level || 1,
    streakCount: user?.streakCount || 0,
    todayRewardClaimed: user?.todayRewardClaimed || false,
  });

  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [activeGame, setActiveGame] = useState<string | null>(null);
  const [activePeriod, setActivePeriod] = useState('alltime');

  const loadData = useCallback(async (period = 'alltime') => {
    try {
      setLoading(true);
      const [dailyRes, leadRes] = await Promise.all([
        apiService.getDailyStatus(),
        apiService.getLeaderboard(period),
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
    loadData(activePeriod);
  }, [loadData, activePeriod]);

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

  const handleGameReward = async (gameTitle: string, coins: number, xp: number, score: number = 0) => {
    try {
      const res = await apiService.playGameReward(gameTitle, coins, xp, score);
      if (res.success) {
        if (res.rewardLimitReached) {
          Alert.alert('Daily Limit Reached', res.message);
        }
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

  const closeGame = () => setActiveGame(null);

  const getGameComponent = () => {
    switch (activeGame) {
      case 'memoryMatch': return <MemoryMatch onReward={handleGameReward} />;
      case 'spinWheel': return <SpinWheel onReward={handleGameReward} />;
      case 'trivia': return <TriviaQuiz onReward={handleGameReward} />;
      case 'tapSpeed': return <TapSpeed onReward={handleGameReward} />;
      case 'simonSays': return <SimonSays onReward={handleGameReward} />;
      default: return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => loadData(activePeriod)} tintColor="#7C3AED" colors={['#7C3AED']} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Mini Games</Text>
            <Text style={styles.subtitle}>Play, earn coins & climb the leaderboard</Text>
          </View>
          <Text style={styles.headerEmoji}>🎮</Text>
        </View>

        <StatsBar
          coins={stats.coins}
          streakCount={stats.streakCount}
          level={stats.level}
          xp={stats.xp}
        />

        <DailyReward
          claimed={stats.todayRewardClaimed}
          claiming={claiming}
          onClaim={handleClaimDaily}
        />

        <Text style={styles.sectionTitle}>🎯 Choose a Game</Text>
        <View style={styles.gamesGrid}>
          {Object.entries(GAME_REWARDS).map(([key, config]) => (
            <GameCard
              key={key}
              icon={config.icon}
              iconBg={config.iconBg}
              title={config.name}
              description={config.description}
              maxReward={String(config.maxCoins)}
              onPress={() => setActiveGame(key)}
            />
          ))}
        </View>

        <LeaderboardSection 
          leaderboard={leaderboard} 
          loading={loading} 
          onRefresh={(period) => {
            setActivePeriod(period);
          }} 
        />
      </ScrollView>

      {/* Dynamic Game Modal */}
      <GameModal 
        visible={activeGame !== null} 
        title={activeGame ? GAME_REWARDS[activeGame as keyof typeof GAME_REWARDS]?.name : ''} 
        onClose={closeGame}
      >
        {getGameComponent()}
      </GameModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { padding: 16, paddingBottom: 32 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingTop: 4,
  },
  title: { fontSize: 26, fontWeight: '900', color: '#0F172A' },
  subtitle: { fontSize: 13, color: '#64748B', marginTop: 2 },
  headerEmoji: { fontSize: 38 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 12, marginTop: 4 },
  gamesGrid: { gap: 12, marginBottom: 24 },
});
