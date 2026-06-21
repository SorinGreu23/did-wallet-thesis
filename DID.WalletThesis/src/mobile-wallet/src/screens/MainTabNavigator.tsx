import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";
import authService from "../services/authService";
import { WalletProfile } from "../types/wallet";

// ── Tab screens (lazy imports to keep bundle splits clean) ────────────────────
import IdentityStackNavigator from "./IdentityStackNavigator";
import WalletScreen from "./WalletScreen";
import ActionsStackNavigator from "./ActionsStackNavigator";
import ProfileStackNavigator from "./ProfileStackNavigator";

const Tab = createBottomTabNavigator();

export default function MainTabNavigator() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<WalletProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    authService.getWalletProfile().then((p) => {
      setProfile(p);
      setLoadingProfile(false);
    });
  }, []);

  if (loadingProfile) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const isPersonal = !profile || profile.accountType === "personal";

  const linking = {
    prefixes: ["didwallet://"],
    config: {
      screens: {
        Actions: {
          screens: {
            PresentationConsent: {
              path: "present",
              parse: { encodedRequest: (r: string) => r },
            },
          },
        },
      },
    },
  };

  return (
    <NavigationContainer linking={linking}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            height: 56 + insets.bottom,
            paddingBottom: insets.bottom,
            paddingTop: 8,
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "600",
          },
        }}
      >
        <Tab.Screen
          name="Identity"
          component={IdentityStackNavigator}
          options={{
            tabBarLabel: "Identity",
            tabBarIcon: ({ color, size }) => (
              <Feather name="shield" size={size} color={color} />
            ),
          }}
        />

        {isPersonal && (
          <Tab.Screen
            name="Wallet"
            component={WalletScreen}
            options={{
              tabBarLabel: "Wallet",
              tabBarIcon: ({ color, size }) => (
                <Feather name="credit-card" size={size} color={color} />
              ),
            }}
          />
        )}

        <Tab.Screen
          name="Actions"
          component={ActionsStackNavigator}
          options={{
            tabBarLabel: "Actions",
            tabBarIcon: ({ color, size }) => (
              <Feather name="zap" size={size} color={color} />
            ),
          }}
        />

        {isPersonal && (
          <Tab.Screen
            name="Profile"
            component={ProfileStackNavigator}
            options={{
              tabBarLabel: "Profile",
              tabBarIcon: ({ color, size }) => (
                <Feather name="user" size={size} color={color} />
              ),
            }}
          />
        )}
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
});
