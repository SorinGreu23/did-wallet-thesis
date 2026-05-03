import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import authService from '../services/authService';
import { WalletProfile } from '../types/wallet';

// ── Tab screens (lazy imports to keep bundle splits clean) ────────────────────
import HomeScreen from './HomeScreen';
import WalletScreen from './WalletScreen';
import ActionsStubScreen from './ActionsStubScreen';

const Tab = createBottomTabNavigator();

interface MainTabNavigatorProps {
  onSignOut?: () => void;
}

export default function MainTabNavigator({ onSignOut }: MainTabNavigatorProps) {
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

  return (
      <NavigationContainer>
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
              fontWeight: '600',
            },
          }}
        >
          <Tab.Screen
            name="Identity"
            component={HomeScreen}
            options={{
              tabBarLabel: 'Identity',
              tabBarIcon: ({ color, size }) => (
                <Feather name="shield" size={size} color={color} />
              ),
            }}
          />

          <Tab.Screen
            name="Wallet"
            component={WalletScreen}
            options={{
              tabBarLabel: 'Wallet',
              tabBarIcon: ({ color, size }) => (
                <Feather name="credit-card" size={size} color={color} />
              ),
            }}
          />

          <Tab.Screen
            name="Actions"
            component={ActionsStubScreen}
            options={{
              tabBarLabel: 'Actions',
              tabBarIcon: ({ color, size }) => (
                <Feather name="zap" size={size} color={color} />
              ),
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
