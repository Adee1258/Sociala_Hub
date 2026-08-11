import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export function WebAppFrame({
  children,
  backgroundColor = '#FFFFFF',
}: {
  children: React.ReactNode;
  backgroundColor?: string;
}) {
  if (Platform.OS !== 'web') return <>{children}</>;

  return (
    <View style={[styles.page, { backgroundColor }]}>
      <View style={styles.phoneOuter}>
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0.34)', 'rgba(255,255,255,0.06)', 'rgba(0,0,0,0.20)']}
          locations={[0, 0.45, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.metalRail}
        />
        <View style={styles.phoneOuterInner}>
          <View style={styles.phoneBody}>
            <View style={styles.screen}>
              <View pointerEvents="none" style={styles.dynamicIslandOverlay}>
                <View style={styles.dynamicIsland}>
                  <View style={styles.dynamicIslandShine} />
                  <View style={styles.dynamicIslandLens} />
                  <View style={styles.dynamicIslandCamera} />
                </View>
              </View>
              {children}
            </View>
          </View>
        </View>
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0.20)', 'rgba(255,255,255,0.00)']}
          locations={[0, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.topGloss}
        />
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(0,0,0,0.00)', 'rgba(0,0,0,0.22)']}
          locations={[0, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.bottomShade}
        />
        <View pointerEvents="none" style={styles.deviceHighlightLeft} />
        <View pointerEvents="none" style={styles.deviceHighlightRight} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  phoneOuter: {
    width: 460,
    height: 932,
    borderRadius: 66,
    backgroundColor: '#8A8780',
    padding: 4,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 18 },
    elevation: 18,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  metalRail: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 66,
  },
  phoneOuterInner: {
    flex: 1,
    borderRadius: 62,
    backgroundColor: '#2D2C2A',
    padding: 0,
  },
  phoneBody: {
    flex: 1,
    borderRadius: 60,
    backgroundColor: '#121216',
    padding: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  dynamicIslandOverlay: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  dynamicIsland: {
    height: 32,
    width: 124,
    borderRadius: 999,
    backgroundColor: '#0B0B0E',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  dynamicIslandShine: {
    position: 'absolute',
    top: 2,
    left: 10,
    right: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  dynamicIslandLens: {
    position: 'absolute',
    right: 22,
    top: 11,
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#12121A',
    borderWidth: 1,
    borderColor: 'rgba(120,170,255,0.20)',
  },
  dynamicIslandCamera: {
    position: 'absolute',
    left: 24,
    top: 12,
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(20,20,28,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  screen: {
    flex: 1,
    borderRadius: 52,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  topGloss: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: 10,
    height: 120,
    borderTopLeftRadius: 58,
    borderTopRightRadius: 58,
  },
  bottomShade: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    height: 160,
    borderBottomLeftRadius: 58,
    borderBottomRightRadius: 58,
  },
  deviceHighlightLeft: {
    position: 'absolute',
    left: 6,
    top: 40,
    bottom: 40,
    width: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  deviceHighlightRight: {
    position: 'absolute',
    right: 6,
    top: 60,
    bottom: 60,
    width: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.07)',
  },
});
