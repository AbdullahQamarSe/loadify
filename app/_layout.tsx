import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useColorScheme } from '@/hooks/use-color-scheme';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="login" />
          <Stack.Screen name="driverdashboard" />
          <Stack.Screen name="driverprofile" />
          <Stack.Screen name="signup" />
          <Stack.Screen name="traderdashboard" />
          <Stack.Screen name="current" />
          <Stack.Screen name="request" />
          <Stack.Screen name="requests" />
          <Stack.Screen name="myloads" />
          <Stack.Screen name="partialtruck" />
          <Stack.Screen name="findtruck" />
          <Stack.Screen name="profile" />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
