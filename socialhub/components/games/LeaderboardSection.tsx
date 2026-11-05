import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeInDown } from 'react-native-reanimated';

interface LeaderboardUser {
  id: string;
  rank: number;
  username: string;
  firstName: string;
  lastName: string;
  profilePicture?: string;
  coins: number;
  level: number;
  xp?: number;
  streakCount?: number;
}

interface LeaderboardSectionProps {
  leaderboard: LeaderboardUser[];
  loading: boolean;
  onRefresh?: (period: string) => void;
}

const PERIODS = [
  { key: 'alltime', label: 'All Time' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'daily', label: 'Today' },
];

export default function LeaderboardSection({
  leaderboard,
  loading,
  onRefresh,
}: LeaderboardSectionProps) {
  const [activePeriod, setActivePeriod] = useState('alltime');

  const handlePeriodChange = (period: string) => {
    setActivePeriod(period);
    onRefresh?.(period);
  };

  const getRankDisplay = (rank: number) => {
    switch (rank) {
      case 1:
        return { emoji: '🥇', color: '#F59E0B' };
      case 2:
        return { emoji: '🥈', color: '#94A3B8' };
      case 3:
        return { emoji: '🥉', color: '#D97706' };
      default:
        return { emoji: `#${rank}`, color: '#64748B' };
    }
  };

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>🏆 Leaderboard</Text>
      </View>

      {/* Period Filter Tabs */}
      <View style={styles.periodTabs}>
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p.key}
            style={[
              styles.periodTab,
              activePeriod === p.key && styles.periodTabActive,
            ]}
            onPress={() => handlePeriodChange(p.key)}>
            <Text
              style={[
                styles.periodTabText,
                activePeriod === p.key && styles.periodTabTextActive,
              ]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Leaderboard List */}
      {loading ? (
        <ActivityIndicator
          size="small"
          color="#7C3AED"
          style={{ marginVertical: 24 }}
        />
      ) : leaderboard.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🎮</Text>
          <Text style={styles.emptyText}>No players yet for this period</Text>
        </View>
      ) : (
        leaderboard.map((item, index) => {
          const avatarUrl =
            item.profilePicture ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(
              item.firstName || item.username
            )}&background=EDE9FE&color=7C3AED`;

          const rankInfo = getRankDisplay(item.rank);
          const isTopThree = item.rank <= 3;

          return (
            <Animated.View
              key={item.id}
              entering={FadeInDown.delay(index * 60).duration(300)}
              style={[
                styles.leaderItem,
                isTopThree && styles.leaderItemTop,
                index === leaderboard.length - 1 && styles.leaderItemLast,
              ]}>
              {/* Rank */}
              <View style={[styles.rankBadge, isTopThree && { backgroundColor: rankInfo.color + '18' }]}>
                <Text style={[styles.rankText, isTopThree && { color: rankInfo.color }]}>
                  {rankInfo.emoji}
                </Text>
              </View>

              {/* Avatar */}
              <Image source={{ uri: avatarUrl }} style={styles.leaderAvatar} />

              {/* Name & Username */}
              <View style={styles.nameContainer}>
                <Text style={styles.leaderName} numberOfLines={1}>
                  {item.firstName} {item.lastName}
                </Text>
                <Text style={styles.leaderHandle}>@{item.username}</Text>
              </View>

              {/* Stats */}
              <View style={styles.statsContainer}>
                <Text style={styles.leaderCoins}>🪙 {item.coins.toLocaleString()}</Text>
                <Text style={styles.leaderLvl}>Lvl {item.level}</Text>
              </View>
            </Animated.View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  periodTabs: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 3,
    marginBottom: 14,
  },
  periodTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  periodTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  periodTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  periodTabTextActive: {
    color: '#7C3AED',
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  leaderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  leaderItemTop: {
    paddingVertical: 12,
  },
  leaderItemLast: {
    borderBottomWidth: 0,
  },
  rankBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  rankText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#475569',
  },
  leaderAvatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#EDE9FE',
  },
  nameContainer: {
    flex: 1,
    marginLeft: 10,
  },
  leaderName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  leaderHandle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 1,
  },
  statsContainer: {
    alignItems: 'flex-end',
  },
  leaderCoins: {
    fontSize: 13,
    fontWeight: '700',
    color: '#D97706',
  },
  leaderLvl: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
});
