import React, { useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import authService from "../services/authService";
import didService from "../services/didService";
import { PersonalWalletProfile, WalletProfile } from "../types/wallet";

function toDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

interface Props {
  navigation: {
    goBack: () => void;
    setOptions: (options: Record<string, unknown>) => void;
  };
}

export default function EditPersonalProfileScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const [profile, setProfile] = useState<PersonalWalletProfile | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [birthDate, setBirthDate] = useState(new Date(1990, 0, 1));
  const [showAndroidDatePicker, setShowAndroidDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: "Edit personal information",
      headerBackTitle: "Profile",
      headerTintColor: colors.primary,
      headerStyle: { backgroundColor: colors.surface },
      headerTitleStyle: { color: colors.text },
    });
  }, [colors, navigation]);

  useEffect(() => {
    authService.getWalletProfile().then((storedProfile) => {
      if (storedProfile?.accountType !== "personal") {
        setLoading(false);
        return;
      }
      const personal = storedProfile as PersonalWalletProfile;
      setProfile(personal);
      setFirstName(personal.firstName);
      setLastName(personal.lastName);
      setEmail(personal.email);
      setBirthDate(toDate(personal.birthDate));
      setLoading(false);
    });
  }, []);

  const validation = useMemo(() => {
    if (!firstName.trim()) return "First name is required.";
    if (!lastName.trim()) return "Last name is required.";
    if (!email.trim()) return "Email is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return "Enter a valid email address.";
    }
    return null;
  }, [email, firstName, lastName]);

  const hasChanges = useMemo(() => {
    if (!profile) return false;
    return (
      firstName.trim() !== profile.firstName ||
      lastName.trim() !== profile.lastName ||
      email.trim() !== profile.email ||
      toIso(birthDate) !== profile.birthDate
    );
  }, [birthDate, email, firstName, lastName, profile]);

  const save = async () => {
    if (!profile || validation) {
      if (validation) Alert.alert("Check your information", validation);
      return;
    }

    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();
    const cleanEmail = email.trim();
    const cleanBirthDate = toIso(birthDate);

    setSaving(true);
    try {
      await didService.updateRegisteredProfile(
        profile.did,
        profile.walletAddress,
        `${cleanFirstName} ${cleanLastName}`,
        cleanEmail,
      );
      await authService.updateWalletProfile({
        firstName: cleanFirstName,
        lastName: cleanLastName,
        email: cleanEmail,
        birthDate: cleanBirthDate,
      } as Partial<WalletProfile>);
      navigation.goBack();
    } catch (error) {
      Alert.alert(
        "Could not save changes",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        <Text
          selectable
          style={[styles.intro, { color: colors.textSecondary }]}
        >
          Keep your identity details current. Name and email are synced to the
          identity service; date of birth remains encrypted on this device.
        </Text>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            NAME
          </Text>
          <View
            style={[
              styles.group,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Field
              label="First name"
              value={firstName}
              onChangeText={setFirstName}
              placeholder="First name"
              colors={colors}
              autoCapitalize="words"
              textContentType="givenName"
            />
            <Divider color={colors.border} />
            <Field
              label="Last name"
              value={lastName}
              onChangeText={setLastName}
              placeholder="Last name"
              colors={colors}
              autoCapitalize="words"
              textContentType="familyName"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            CONTACT
          </Text>
          <View
            style={[
              styles.group,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="name@example.com"
              colors={colors}
              autoCapitalize="none"
              keyboardType="email-address"
              textContentType="emailAddress"
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeadingRow}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
              DATE OF BIRTH
            </Text>
            <View
              style={[
                styles.requiredBadge,
                { backgroundColor: colors.primaryLight },
              ]}
            >
              <Text style={[styles.requiredText, { color: colors.primary }]}>
                Required
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.dateCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            {Platform.OS === "ios" ? (
              <DateTimePicker
                value={birthDate}
                mode="date"
                display="inline"
                maximumDate={new Date()}
                minimumDate={new Date(1900, 0, 1)}
                onChange={(_event, date) => {
                  if (date) setBirthDate(date);
                }}
                themeVariant={colors.text === "#111827" ? "light" : "dark"}
                style={styles.datePicker}
              />
            ) : (
              <TouchableOpacity
                style={styles.androidDateRow}
                onPress={() => setShowAndroidDatePicker(true)}
                activeOpacity={0.75}
              >
                <View>
                  <Text
                    style={[styles.fieldLabel, { color: colors.textMuted }]}
                  >
                    Selected date
                  </Text>
                  <Text
                    style={[styles.androidDateValue, { color: colors.text }]}
                  >
                    {birthDate.toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </Text>
                </View>
                <Feather name="calendar" size={19} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>
          {showAndroidDatePicker ? (
            <DateTimePicker
              value={birthDate}
              mode="date"
              display="default"
              maximumDate={new Date()}
              minimumDate={new Date(1900, 0, 1)}
              onChange={(_event, date) => {
                setShowAndroidDatePicker(false);
                if (date) setBirthDate(date);
              }}
            />
          ) : null}
          <View style={styles.privacyHint}>
            <Feather name="lock" size={14} color={colors.textMuted} />
            <Text
              selectable
              style={[styles.hintText, { color: colors.textMuted }]}
            >
              Used locally for privacy-preserving age proofs.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          { backgroundColor: colors.surface, borderTopColor: colors.border },
        ]}
      >
        {validation && hasChanges ? (
          <Text selectable style={styles.errorText}>
            {validation}
          </Text>
        ) : null}
        <TouchableOpacity
          onPress={save}
          disabled={saving || !hasChanges || Boolean(validation)}
          style={[
            styles.saveButton,
            {
              backgroundColor:
                saving || !hasChanges || validation
                  ? colors.border
                  : colors.primary,
            },
          ]}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Save profile changes"
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text
              style={[
                styles.saveButtonText,
                {
                  color: !hasChanges || validation ? colors.textMuted : "#fff",
                },
              ]}
            >
              Save changes
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  colors,
  ...props
}: React.ComponentProps<typeof TextInput> & { label: string; colors: any }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
        {label}
      </Text>
      <TextInput
        {...props}
        style={[styles.input, { color: colors.text }]}
        placeholderTextColor={colors.textMuted}
        autoCorrect={false}
        returnKeyType="done"
      />
    </View>
  );
}

function Divider({ color }: { color: string }) {
  return <View style={[styles.divider, { backgroundColor: color }]} />;
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { padding: 20, paddingBottom: 32, gap: 24 },
  intro: { fontSize: 14, lineHeight: 20 },
  section: { gap: 8 },
  sectionHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    paddingHorizontal: 4,
  },
  requiredBadge: { borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4 },
  requiredText: { fontSize: 11, fontWeight: "700" },
  group: { borderWidth: 1, borderRadius: 16, overflow: "hidden" },
  field: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 9 },
  fieldLabel: { fontSize: 12, marginBottom: 3 },
  input: { minHeight: 32, paddingVertical: 2, fontSize: 16 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
  dateCard: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
    padding: 8,
  },
  datePicker: { width: "100%", alignSelf: "center" },
  androidDateRow: {
    minHeight: 64,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  androidDateValue: { fontSize: 16, fontWeight: "600", marginTop: 3 },
  privacyHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 4,
  },
  hintText: { flex: 1, fontSize: 12, lineHeight: 17 },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 28 : 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  errorText: { color: "#dc2626", fontSize: 12, textAlign: "center" },
  saveButton: {
    height: 50,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: { fontSize: 16, fontWeight: "700" },
});
