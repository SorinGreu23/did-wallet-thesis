import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import authService from '../services/authService';
import { AccountType } from '../types/wallet';

export default function ActionsStubScreen() {
  const { colors } = useTheme();
  const [accountType, setAccountType] = useState<AccountType>('personal');

  useEffect(() => {
    authService.getAccountType().then((t) => {
      if (t) setAccountType(t);
    });
  }, []);

  const items =
    accountType === 'personal'
      ? [
          { icon: 'user-check', label: 'Bachelor enrolment' },
          { icon: 'book', label: "Master's application" },
          { icon: 'briefcase', label: 'Job application' },
          { icon: 'globe', label: 'Foreign ID card' },
        ]
      : accountType === 'university'
      ? [
          { icon: 'user-check', label: 'Bachelor enrolment review' },
          { icon: 'book', label: "Master's application review" },
          { icon: 'award', label: 'Issue student card' },
        ]
      : [
          { icon: 'briefcase', label: 'Job application review' },
          { icon: 'award', label: 'Issue employee card' },
        ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Actions</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Use-case flows — available in Phase D.
      </Text>
      <View style={styles.list}>
        {items.map(({ icon, label }) => (
          <View
            key={label}
            style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.primaryLight }]}>
              <Feather name={icon as any} size={18} color={colors.primary} />
            </View>
            <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
            <View style={[styles.chip, { backgroundColor: colors.border }]}>
              <Text style={[styles.chipText, { color: colors.textMuted }]}>Soon</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 72, paddingHorizontal: 24 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 14, marginBottom: 24 },
  list: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { flex: 1, fontSize: 14, fontWeight: '500' },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  chipText: { fontSize: 11, fontWeight: '600' },
});
