import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import authService from '../services/authService';
import { AccountType, WalletProfile } from '../types/wallet';

// ── Tab screens (lazy imports to keep bundle splits clean) ────────────────────
import HomeScreen from './HomeScreen';
import ActionsStubScreen from './ActionsStubScreen';

const Tab = createBottomTabNavigator();

interface MainTabNavigatorProps {
  onSignOut?: () => void;
}

export default function MainTabNavigator({ onSignOut }: MainTabNavigatorProps) {
  const { colors, isDark } = useTheme();
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

  const accountType: AccountType = profile?.accountType ?? 'personal';
  const showWalletTab = accountType === 'personal';

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarStyle: {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              borderTopWidth: 1,
              height: 64,
              paddingBottom: 10,
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

          {showWalletTab && (
            <Tab.Screen
              name="Wallet"
              component={WalletStubScreen}
              options={{
                tabBarLabel: 'Wallet',
                tabBarIcon: ({ color, size }) => (
                  <Feather name="credit-card" size={size} color={color} />
                ),
              }}
            />
          )}

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
    </SafeAreaProvider>
  );
}

// ── Wallet stub (Phase A placeholder for Phase D) ─────────────────────────────

function WalletStubScreen() {
  const { colors } = useTheme();
  return (
    <View style={[styles.stub, { backgroundColor: colors.background }]}>
      <Feather name="credit-card" size={40} color={colors.textMuted} />
      <Text style={[styles.stubTitle, { color: colors.text }]}>Wallet</Text>
      <Text style={[styles.stubBody, { color: colors.textSecondary }]}>
        Your issued credentials will appear here.{'\n'}Coming in Phase D.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stub: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  stubTitle: { fontSize: 20, fontWeight: '700' },
  stubBody: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
