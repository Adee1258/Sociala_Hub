import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="email-entry" />
      <Stack.Screen name="password-create" />
      <Stack.Screen name="profile-setup" />
      <Stack.Screen name="email-verification" />
      <Stack.Screen name="phone-entry" />
      <Stack.Screen name="sms-otp" />
      <Stack.Screen name="profile-photo" />
      <Stack.Screen name="bio-setup" />
      <Stack.Screen name="biometrics" />
      <Stack.Screen name="review-details" />
      <Stack.Screen name="terms" />
      <Stack.Screen name="welcome" />
    </Stack>
  );
}
