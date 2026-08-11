import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import 'react-native-reanimated';
import { PaperProvider } from 'react-native-paper';
import * as Font from 'expo-font';
import { FontAwesome, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { WebAppFrame } from '@/components/web-app-frame';
import { AuthProvider, useAuth } from '@/context/AuthContext';

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootLayoutNav() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const colorScheme = useColorScheme();
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
          // On web, we load fonts but don't let a failure or timeout crash the app
          Font.loadAsync(fontsToLoad).catch(err => {
            console.warn('Web font loading failed silently:', err);
          });
          // Give it a small delay but don't block
          await new Promise(resolve => setTimeout(resolve, 500));
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
    return null; // Or a simple splash screen
  }

  return (
    <PaperProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          <Stack.Screen name="verify-email" options={{ title: 'Verify Email' }} />
          <Stack.Screen name="edit-profile" options={{ headerShown: false }} />
          <Stack.Screen name="select-contact" options={{ title: 'Select Contact' }} />
          <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </PaperProvider>
  );
}

import { Provider } from 'react-redux';
import { store } from '@/store';

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
