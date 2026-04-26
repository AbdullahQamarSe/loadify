import { Redirect } from 'expo-router';
import { LogBox } from 'react-native';

if (!__DEV__) {
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    console.log('Global error caught:', error);
  });
}

LogBox.ignoreAllLogs(true);


export default function Index() {
  return <Redirect href="/login" />;
}
