import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
  StatusBar,
  Modal,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme, LIGHT_COLORS, DARK_COLORS } from '../context/ThemeContext';
import authService from '../services/authService';
import { PersonalWalletProfile, WalletProfile } from '../types/wallet';

// ─── helpers ──────────────────────────────────────────────────────────────────

function toDateOnly(iso: string | undefined): Date {
  if (!iso) return new Date(1990, 0, 1);
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDisplay(iso: string | undefined): string {
  if (!iso) return 'Not set';
  const d = toDateOnly(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function initials(first?: string, last?: string): string {
  return `${(first?.[0] ?? '').toUpperCase()}${(last?.[0] ?? '').toUpperCase()}`;
}

// ─── screen ───────────────────────────────────────────────────────────────────

export default function ProfileSettingsScreen() {
  const { colors, themeAnim } = useTheme();

  const [profile, setProfile] = useState<PersonalWalletProfile | null>(null);
  const [pickerDate, setPickerDate] = useState<Date>(new Date(1990, 0, 1));
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reload profile every time this tab is focused
  useFocusEffect(
    useCallback(() => {
      authService.getWalletProfile().then((p) => {
        if (p?.accountType === 'personal') {
          const personal = p as PersonalWalletProfile;
          setProfile(personal);
          setPickerDate(toDateOnly(personal.birthDate));
        }
      });
    }, []),
  );

  const bgColor = themeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [LIGHT_COLORS.background, DARK_COLORS.background],
  });

  const handleSave = async (dateToSave: Date) => {
    const iso = toIso(dateToSave);
    setSaving(true);
    try {
      await authService.updateWalletProfile({ birthDate: iso } as Partial<WalletProfile>);
      setProfile((prev) => prev ? { ...prev, birthDate: iso } : prev);
      Alert.alert('Saved', 'Your date of birth has been updated.');
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() - 1); // must be in the past

  // ── iOS: inline spinner inside a bottom sheet modal ──
  const [pendingDate, setPendingDate] = useState<Date>(pickerDate);

  const openPicker = () => {
    setPendingDate(pickerDate);
    setShowPicker(true);
  };

  return (
    <>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.container]}
      >
        <StatusBar
          barStyle={colors.text === '#111827' ? 'dark-content' : 'light-content'}
          backgroundColor="transparent"
          translucent
        />

        {/* ── Header / avatar ── */}
        <View style={[styles.heroSection, { backgroundColor: colors.primary }]}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitials}>
              {profile ? initials(profile.firstName, profile.lastName) : '?'}
            </Text>
          </View>
          <Text style={styles.heroName}>
            {profile ? `${profile.firstName} ${profile.lastName}` : '—'}
          </Text>
          <Text style={styles.heroSub}>{profile?.email ?? ''}</Text>
        </View>

        {/* ── Settings groups ── */}
        <View style={[styles.page, { backgroundColor: colors.background }]}>

          {/* Personal info group */}
          <Text style={[styles.groupLabel, { color: colors.textMuted }]}>PERSONAL INFORMATION</Text>
          <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>

            <View style={styles.row}>
              <View style={[styles.rowIcon, { backgroundColor: '#e8edfa' }]}>
                <Feather name="user" size={16} color={colors.primary} />
              </View>
              <View style={styles.rowBody}>
                <Text style={[styles.rowLabel, { color: colors.textMuted }]}>Full name</Text>
                <Text style={[styles.rowValue, { color: colors.text }]}>
                  {profile ? `${profile.firstName} ${profile.lastName}` : '—'}
                </Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <View style={styles.row}>
              <View style={[styles.rowIcon, { backgroundColor: '#fef3c7' }]}>
                <Feather name="mail" size={16} color="#d97706" />
              </View>
              <View style={styles.rowBody}>
                <Text style={[styles.rowLabel, { color: colors.textMuted }]}>Email</Text>
                <Text style={[styles.rowValue, { color: colors.text }]}>{profile?.email ?? '—'}</Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* Birth date row — tappable */}
            <TouchableOpacity
              style={styles.row}
              onPress={openPicker}
              activeOpacity={0.65}
              disabled={saving}
            >
              <View style={[styles.rowIcon, { backgroundColor: '#dcfce7' }]}>
                <Feather name="calendar" size={16} color="#16a34a" />
              </View>
              <View style={styles.rowBody}>
                <Text style={[styles.rowLabel, { color: colors.textMuted }]}>Date of birth</Text>
                <Text style={[styles.rowValue, { color: colors.text }]}>
                  {formatDisplay(profile?.birthDate)}
                </Text>
              </View>
              <View style={styles.rowTrailing}>
                {saving
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : <Feather name="chevron-right" size={18} color={colors.textMuted} />}
              </View>
            </TouchableOpacity>
          </View>

          <Text style={[styles.footerNote, { color: colors.textMuted }]}>
            Your date of birth is used exclusively for zero-knowledge age proofs and is never shared directly.
          </Text>
        </View>
      </ScrollView>

      {/* ── iOS date-picker bottom sheet ── */}
      <Modal
        visible={showPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPicker(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.pickerSheet, { backgroundColor: colors.surface }]}>
            {/* toolbar */}
            <View style={[styles.pickerToolbar, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => setShowPicker(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={[styles.pickerToolbarBtn, { color: colors.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.pickerToolbarTitle, { color: colors.text }]}>Date of Birth</Text>
              <TouchableOpacity
                onPress={() => {
                  setPickerDate(pendingDate);
                  setShowPicker(false);
                  handleSave(pendingDate);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.pickerToolbarBtn, { color: colors.primary, fontWeight: '700' }]}>Done</Text>
              </TouchableOpacity>
            </View>

            <View style={{ alignItems: 'center' }}>
              <DateTimePicker
                value={pendingDate}
                mode="date"
                display="spinner"
                maximumDate={maxDate}
                minimumDate={new Date(1900, 0, 1)}
                onChange={(_e, date) => { if (date) setPendingDate(date); }}
                style={{ width: '100%', height: 216, alignSelf: 'center' }}
                themeVariant={colors.text === '#111827' ? 'light' : 'dark'}
              />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flexGrow: 1 },

  // Hero / avatar
  heroSection: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 80 : (StatusBar.currentHeight ?? 0) + 36,
    paddingBottom: 36,
    gap: 6,
  },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatarInitials: { color: '#fff', fontSize: 32, fontWeight: '700' },
  heroName: { color: '#fff', fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  heroSub: { color: 'rgba(255,255,255,0.72)', fontSize: 14 },

  // Page body
  page: { flex: 1, paddingTop: 28, paddingHorizontal: 20, paddingBottom: 48 },

  groupLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginLeft: 4,
  },
  group: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 8,
  },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 56 },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    minHeight: 56,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowBody: { flex: 1 },
  rowLabel: { fontSize: 12, marginBottom: 2 },
  rowValue: { fontSize: 15, fontWeight: '500' },
  rowTrailing: { marginLeft: 8 },

  footerNote: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 8,
  },

  // Date picker modal
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  pickerSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34, // safe area
  },
  pickerToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickerToolbarTitle: { fontSize: 16, fontWeight: '600' },
  pickerToolbarBtn: { fontSize: 16 },
});
