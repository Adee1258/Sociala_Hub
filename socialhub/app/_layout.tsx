import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import 'react-native-reanimated';
import { PaperProvider } from 'react-native-paper';
import * as Font from 'expo-font';
import { FontAwesome, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';

import { WebAppFrame } from '@/components/web-app-frame';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { Provider } from 'react-redux';
import { store } from '@/store';

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootLayoutNav() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [fontError, setFontError] = useState(false);

  useEffect(() => {
    async function loadFonts() {
      try {
        const fontsToLoad = {
          ...FontAwesome.font,
          ...MaterialCommunityIcons.font,
          ...MaterialIcons.font,
        };

        if (Platform.OS === 'web') {
          Font.loadAsync(fontsToLoad).catch(err => {
            console.warn('Web font loading failed silently:', err);
          });
        } else {
          await Font.loadAsync(fontsToLoad);
        }

        setFontsLoaded(true);
      } catch (e) {
        console.warn('Font loading failed, continuing anyway...', e);
        setFontError(true);
        setFontsLoaded(true);
      }
    }
    loadFonts();
  }, []);

  useEffect(() => {
    if (isAuthLoading || !fontsLoaded) return;

    const inAuthGroup = segments && segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [user, isAuthLoading, fontsLoaded, segments, router]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <PaperProvider>
      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        <Stack.Screen name="verify-email" options={{ title: 'Verify Email' }} />
        <Stack.Screen name="edit-profile" options={{ headerShown: false }} />
        <Stack.Screen name="select-contact" options={{ title: 'Select Contact' }} />
        <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="user/[id]" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </PaperProvider>
  );
}

export default function RootLayout() {
  return (
    <Provider store={store}>
      <WebAppFrame>
        <AuthProvider>
          <RootLayoutNav />
        </AuthProvider>
      </WebAppFrame>
    </Provider>
  );
}
