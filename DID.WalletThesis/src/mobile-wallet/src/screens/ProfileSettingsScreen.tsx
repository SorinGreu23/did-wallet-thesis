import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme } from "../context/ThemeContext";
import authService from "../services/authService";
import { PersonalWalletProfile } from "../types/wallet";

function formatBirthDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function initials(firstName?: string, lastName?: string): string {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
}

interface Props {
  navigation: {
    navigate: (screen: string) => void;
  };
}

export default function ProfileSettingsScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const [profile, setProfile] = useState<PersonalWalletProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      authService.getWalletProfile().then((storedProfile) => {
        if (!active) return;
        setProfile(
          storedProfile?.accountType === "personal"
            ? (storedProfile as PersonalWalletProfile)
            : null,
        );
        setLoading(false);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
    >
      <StatusBar
        barStyle={colors.text === "#111827" ? "dark-content" : "light-content"}
        backgroundColor="transparent"
        translucent
      />

      <View style={[styles.hero, { backgroundColor: colors.primary }]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {profile ? initials(profile.firstName, profile.lastName) : "?"}
          </Text>
        </View>
        <Text selectable style={styles.name}>
          {profile
            ? `${profile.firstName} ${profile.lastName}`
            : "Personal profile"}
        </Text>
        <Text selectable style={styles.email}>
          {profile?.email ?? ""}
        </Text>
      </View>

      <View style={styles.content}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            PERSONAL INFORMATION
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate("EditPersonalProfile")}
            style={[
              styles.editButton,
              { backgroundColor: colors.primaryLight },
            ]}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Edit personal information"
          >
            <Feather name="edit-2" size={14} color={colors.primary} />
            <Text style={[styles.editButtonText, { color: colors.primary }]}>
              Edit
            </Text>
          </TouchableOpacity>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <InfoRow
            icon="user"
            label="Full name"
            value={profile ? `${profile.firstName} ${profile.lastName}` : "—"}
            colors={colors}
          />
          <Divider color={colors.border} />
          <InfoRow
            icon="mail"
            label="Email"
            value={profile?.email ?? "—"}
            colors={colors}
          />
          <Divider color={colors.border} />
          <InfoRow
            icon="calendar"
            label="Date of birth"
            value={
              profile?.birthDate ? formatBirthDate(profile.birthDate) : "—"
            }
            colors={colors}
          />
        </View>

        <View
          style={[styles.privacyCard, { backgroundColor: colors.primaryLight }]}
        >
          <Feather name="shield" size={18} color={colors.primary} />
          <Text
            selectable
            style={[styles.privacyText, { color: colors.textSecondary }]}
          >
            Your date of birth stays encrypted on this device and is used for
            zero-knowledge age proofs. It is not sent to the identity service.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

function InfoRow({
  icon,
  label,
  value,
  colors,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  value: string;
  colors: any;
}) {
  return (
    <View style={styles.row}>
      <View style={[styles.icon, { backgroundColor: colors.primaryLight }]}>
        <Feather name={icon} size={16} color={colors.primary} />
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
        <Text selectable style={[styles.value, { color: colors.text }]}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function Divider({ color }: { color: string }) {
  return <View style={[styles.divider, { backgroundColor: color }]} />;
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { flexGrow: 1 },
  hero: {
    alignItems: "center",
    paddingTop:
      Platform.OS === "ios" ? 80 : (StatusBar.currentHeight ?? 0) + 36,
    paddingBottom: 34,
    paddingHorizontal: 24,
    gap: 6,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.22)",
    marginBottom: 8,
  },
  avatarText: { color: "#fff", fontSize: 32, fontWeight: "700" },
  name: { color: "#fff", fontSize: 22, fontWeight: "700" },
  email: { color: "rgba(255,255,255,0.74)", fontSize: 14 },
  content: { padding: 20, gap: 18 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  sectionTitle: { fontSize: 12, fontWeight: "700", letterSpacing: 0.6 },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
  },
  editButtonText: { fontSize: 13, fontWeight: "700" },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  row: {
    minHeight: 68,
    paddingHorizontal: 16,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowBody: { flex: 1, gap: 3 },
  label: { fontSize: 12 },
  value: { fontSize: 15, fontWeight: "600" },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 62 },
  privacyCard: {
    borderRadius: 14,
    padding: 15,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  privacyText: { flex: 1, fontSize: 13, lineHeight: 19 },
});
