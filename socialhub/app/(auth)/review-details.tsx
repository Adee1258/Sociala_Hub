import React from 'react';
import {
  View,
  StyleSheet,
  Platform,
  Pressable,
  ScrollView,
  useWindowDimensions,
  StatusBar,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { RootState } from '@/store';
import { FontAwesome } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

const PRIMARY = '#7C3AED';

export default function ReviewDetailsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  // Pick up all data collected
  const signupData = useSelector((state: RootState) => state.auth.phoneSignup);

  const handleNext = () => {
    router.push('/(auth)/terms' as any);
  };

  const handleEdit = () => {
    // Basic edit takes them back to profile setup
    router.push('/(auth)/profile-setup' as any);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Bar */}
        <Animated.View entering={FadeInUp.duration(400)} style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <FontAwesome name="chevron-left" size={16} color="#1E293B" />
          </Pressable>
        </Animated.View>

        {/* Title */}
        <Animated.View
          entering={FadeInUp.delay(100).duration(500)}
          style={[styles.titleSection, { maxWidth: Math.min(width - 48, 400) }]}
        >
          <Text style={styles.titleText}>Review your details</Text>
          <Text style={styles.subtitleText}>
            Please confirm your information before starting.
          </Text>
        </Animated.View>

        {/* Details Card */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(600)}
          style={[styles.cardSection, { maxWidth: Math.min(width - 48, 400) }]}
        >
          <View style={styles.detailsCard}>
            {/* Full Name */}
            <View style={styles.detailRow}>
              <View style={styles.iconBox}>
                <FontAwesome name="user-o" size={18} color="#94A3B8" />
              </View>
              <View style={styles.detailTextContainer}>
                <Text style={styles.detailLabel}>Full Name</Text>
                <Text style={styles.detailValue}>
                  {signupData.firstName} {signupData.lastName}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Username */}
            <View style={styles.detailRow}>
              <View style={styles.iconBox}>
                <Text style={styles.atIcon}>@</Text>
              </View>
              <View style={styles.detailTextContainer}>
                <Text style={styles.detailLabel}>Username</Text>
                <Text style={styles.detailValue}>
                  {signupData.username || 'Not set'}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Mobile Number */}
            <View style={styles.detailRow}>
              <View style={styles.iconBox}>
                <FontAwesome name="phone" size={18} color="#94A3B8" />
              </View>
              <View style={styles.detailTextContainer}>
                <Text style={styles.detailLabel}>Mobile Number</Text>
                <Text style={styles.detailValue}>
                  {signupData.countryCode} {signupData.phoneNumber}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.securityNotice}>
            <FontAwesome name="lock" size={14} color="#64748B" />
            <Text style={styles.securityText}>
              Your information is safe and secure with us.
            </Text>
          </View>
        </Animated.View>

        <View style={{ flex: 1 }} />

        {/* Action Buttons */}
        <Animated.View
          entering={FadeInDown.delay(300).duration(600)}
          style={[styles.actionsSection, { maxWidth: Math.min(width - 48, 400) }]}
        >
          <Pressable
            style={({ pressed }) => [
              styles.continueBtn,
              {
                opacity: pressed ? 0.9 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              },
            ]}
            onPress={handleNext}
          >
            <Text style={styles.continueBtnText}>Looks Good</Text>
          </Pressable>

          <Pressable onPress={handleEdit} style={styles.editBtn}>
            <Text style={styles.editBtnText}>Edit Details</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 40,
    alignItems: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    marginBottom: 28,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleSection: {
    width: '100%',
    alignItems: 'flex-start',
    marginBottom: 32,
  },
  titleText: {
    fontSize: 26,
    fontWeight: '900',
    color: '#1E293B',
    letterSpacing: -0.4,
  },
  subtitleText: {
    fontSize: 15,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 8,
    lineHeight: 22,
  },
  cardSection: {
    width: '100%',
  },
  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  iconBox: {
    width: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  atIcon: {
    fontSize: 20,
    fontWeight: '800',
    color: '#94A3B8',
  },
  detailTextContainer: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 15,
    color: '#1E293B',
    fontWeight: '700',
  },
  divider: {
    height: 1.5,
    backgroundColor: '#F1F5F9',
    marginLeft: 48,
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    gap: 8,
  },
  securityText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  actionsSection: {
    width: '100%',
    alignItems: 'center',
    marginTop: 32,
  },
  continueBtn: {
    width: '100%',
    height: 56,
    borderRadius: 14,
    backgroundColor: PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
    marginBottom: 16,
  },
  continueBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  editBtn: {
    paddingVertical: 12,
  },
  editBtnText: {
    color: PRIMARY,
    fontSize: 15,
    fontWeight: '700',
  },
});
