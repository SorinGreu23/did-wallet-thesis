import React, { useRef } from 'react';
import {
  Animated,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useRegistration } from '../context/RegistrationContext';
import { AccountType } from '../types/wallet';

interface AccountTypeChooserScreenProps {
  onChoose: (type: AccountType) => void;
  onBack: () => void;
}

interface CardConfig {
  type: AccountType;
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
  tag: string;
}

const CARDS: CardConfig[] = [
  {
    type: 'personal',
    icon: 'user',
    title: 'Personal',
    subtitle: 'For EU citizens — hold your identity card, diplomas, and credentials.',
    tag: 'No approval required',
  },
  {
    type: 'university',
    icon: 'book-open',
    title: 'Education',
    subtitle: 'For universities and schools — issue student cards and diplomas.',
    tag: 'Requires accreditation',
  },
  {
    type: 'enterprise',
    icon: 'briefcase',
    title: 'Enterprise',
    subtitle: 'For businesses — issue employee credentials and verify applicants.',
    tag: 'Requires business registry approval',
  },
];

export default function AccountTypeChooserScreen({
  onChoose,
  onBack,
}: AccountTypeChooserScreenProps) {
  const { colors } = useTheme();
  const { update } = useRegistration();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, damping: 18, stiffness: 140, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleChoose = (type: AccountType) => {
    update({ accountType: type });
    onChoose(type);
  };

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: colors.background, opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <StatusBar
        barStyle={colors.text === '#111827' ? 'dark-content' : 'light-content'}
        backgroundColor="transparent"
        translucent
      />

      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={[styles.badge, { backgroundColor: colors.primaryLight }]}>
          <Feather name="layers" size={20} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Choose account type</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Select the type that best describes your role in the EU identity ecosystem.
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.cards}
        showsVerticalScrollIndicator={false}
      >
        {CARDS.map((card) => (
          <TouchableOpacity
            key={card.type}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => handleChoose(card.type)}
            activeOpacity={0.8}
          >
            <View style={[styles.cardIcon, { backgroundColor: colors.primaryLight }]}>
              <Feather name={card.icon} size={22} color={colors.primary} />
            </View>
            <View style={styles.cardBody}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{card.title}</Text>
              <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                {card.subtitle}
              </Text>
              <View style={[styles.tag, { backgroundColor: colors.primaryLight }]}>
                <Text style={[styles.tagText, { color: colors.primary }]}>{card.tag}</Text>
              </View>
            </View>
            <Feather name="chevron-right" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  header: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  backBtn: {
    marginBottom: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  cards: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 14,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 4,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
