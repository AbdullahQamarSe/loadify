import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { LogBox } from 'react-native';

if (!__DEV__) {
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    console.log('Global error caught:', error);
  });
}

LogBox.ignoreAllLogs(true);


export default function PostAvailabilityRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/driverdashboard");
  }, [router]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#05070a" }}>
      <ActivityIndicator size="large" color="#c12443" />
    </View>
  );
}
