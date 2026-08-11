import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { IconSymbol } from '@/components/ui/icon-symbol';

export function TopTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const activeColor = '#0F172A';
  const inactiveColor = '#64748B';

  return (
    <View>
      {/* App Header */}
      <View style={styles.appHeader}>
        <Text style={styles.appName}>SocialHub</Text>
        <View style={styles.headerActions}>
          <Pressable style={styles.iconButton}>
            <IconSymbol size={24} name="bell.fill" color="#0F172A" />
          </Pressable>
          <Pressable style={styles.iconButton}>
            <IconSymbol size={24} name="line.3.horizontal" color="#0F172A" />
          </Pressable>
        </View>
      </View>

      {/* Tab Bar */}
      <View style={styles.container}>
        <View style={styles.tabRow}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const isFocused = state.index === index;
            const color = isFocused ? activeColor : inactiveColor;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                style={styles.tabButton}>
                {options.tabBarIcon ? (
                  options.tabBarIcon({ focused: isFocused, color, size: 24 })
                ) : null}
                <Text style={[styles.tabLabel, { color }]}>
                  {options.title || route.name}
                </Text>
                {isFocused && <View style={styles.activeIndicator} />}
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  appName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#7C3AED',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingTop: 12,
    paddingHorizontal: 8,
  },
  tabRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  tabButton: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    position: 'relative',
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    width: 20,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#0F172A',
  },
});
