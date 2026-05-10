import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  StatusBar,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme, LIGHT_COLORS, DARK_COLORS } from '../context/ThemeContext';
import CredentialsScreen from './CredentialsScreen';

// ─── Animated dark-mode toggle ────────────────────────────────────────────────

function ThemeToggle() {
  const { isDark, toggleTheme, colors } = useTheme();
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim  = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.parallel([
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 380,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.spring(scaleAnim, {
          toValue: 0.65,
          damping: 8,
          stiffness: 320,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          damping: 10,
          stiffness: 260,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => rotateAnim.setValue(0));

    toggleTheme();
  };

  const rotate = rotateAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.8}
      style={[styles.toggleBtn, { backgroundColor: colors.primaryLight }]}
    >
      <Animated.View style={{ transform: [{ rotate }, { scale: scaleAnim }] }}>
        <Feather
          name={isDark ? 'sun' : 'moon'}
          size={18}
          color={colors.primary}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { colors, themeAnim } = useTheme();

  const bgColor = themeAnim.interpolate({
    inputRange: [0, 1], outputRange: [LIGHT_COLORS.background, DARK_COLORS.background],
  });
  const surfaceColor = themeAnim.interpolate({
    inputRange: [0, 1], outputRange: [LIGHT_COLORS.surface, DARK_COLORS.surface],
  });
  const borderColor = themeAnim.interpolate({
    inputRange: [0, 1], outputRange: [LIGHT_COLORS.border, DARK_COLORS.border],
  });

  return (
    <Animated.View style={[styles.safe, { backgroundColor: bgColor }]}>
      <StatusBar
        barStyle={colors.text === '#111827' ? 'dark-content' : 'light-content'}
        backgroundColor="transparent"
        translucent
      />

      {/* Top bar */}
      <Animated.View
        style={[styles.topBar, { backgroundColor: surfaceColor, borderBottomColor: borderColor }]}
      >
        <View style={styles.topBarLeft}>
          <View style={[styles.topBarStarBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.topBarStar}>★</Text>
          </View>
          <View>
            <Text style={[styles.topBarTitle, { color: colors.text }]}>EU Identity Wallet</Text>
            <Text style={[styles.topBarSub, { color: colors.textMuted }]}>Decentralised · Verifiable</Text>
          </View>
        </View>
        <ThemeToggle />
      </Animated.View>

      {/* Credentials */}
      <CredentialsScreen />
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? ((StatusBar.currentHeight ?? 0) + 12) : 68,
    paddingBottom: 18,
    borderBottomWidth: 1,
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  topBarStarBadge: {
    width: 44, height: 44, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  topBarStar: { color: '#FFD700', fontSize: 18, fontWeight: '700' },
  topBarTitle: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  topBarSub:   { fontSize: 12, marginTop: 3 },

  toggleBtn: {
    width: 44, height: 44, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
});
