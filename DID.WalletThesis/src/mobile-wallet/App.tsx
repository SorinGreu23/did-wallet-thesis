import "react-native-get-random-values";
import "@ethersproject/shims";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { ThemeProvider, useTheme } from "./src/context/ThemeContext";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { SafeAreaProvider } from "react-native-safe-area-context";
import MainTabNavigator from "./src/screens/MainTabNavigator";
import UnlockSplashScreen from "./src/screens/UnlockSplashScreen";
import WelcomeScreen from "./src/screens/WelcomeScreen";

function AppNavigator() {
  const { isDark, colors } = useTheme();
  const { state, hasWallet, onAuthenticated, signOut } = useAuth();

  if (state === "loading") {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      {state === "authenticated" ? (
        <MainTabNavigator onSignOut={signOut} />
      ) : hasWallet ? (
        <UnlockSplashScreen onAuthenticated={onAuthenticated} />
      ) : (
        <WelcomeScreen onAuthenticated={onAuthenticated} />
      )}
      <StatusBar style={isDark ? "light" : "dark"} />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <AppNavigator />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
