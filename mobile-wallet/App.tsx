import 'react-native-get-random-values';
import '@ethersproject/shims';
import { StatusBar } from 'expo-status-bar';
import HomeScreen from './src/screens/HomeScreen';

export default function App() {
  return (
    <>
      <HomeScreen />
      <StatusBar style="auto" />
    </>
  );
}