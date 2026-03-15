import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Clipboard,
} from "react-native";
import { DIDInfo } from "../services/didService";
import walletService from "../services/walletService";
import { COLORS } from "../constants/config";
import CredentialsScreen from "./CredentialsScreen";

export default function HomeScreen() {
  const [identity, setIdentity] = useState<DIDInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"identity" | "credentials">(
    "identity"
  );

  useEffect(() => {
    void loadIdentity();
  }, []);

  const loadIdentity = async () => {
    setLoading(true);
    try {
      const id = await walletService.getIdentity();
      setIdentity(id);
    } catch (error) {
      console.error("Error loading identity:", error);
      Alert.alert("Error", "Failed to load wallet identity.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (value: string, label: string) => {
    Clipboard.setString(value);
    Alert.alert("Copied", `${label} copied to clipboard.`);
  };


  return (
    <View style={styles.container}>
      <Text style={styles.title}>DID Wallet</Text>
      <Text style={styles.subtitle}>Your Decentralized Identity</Text>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "identity" && styles.activeTab]}
          onPress={() => setActiveTab("identity")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "identity" && styles.activeTabText,
            ]}
          >
            Identity
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === "credentials" && styles.activeTab,
          ]}
          onPress={() => setActiveTab("credentials")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "credentials" && styles.activeTabText,
            ]}
          >
            Credentials
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === "identity" ? (
        loading ? (
          <ActivityIndicator
            size="large"
            color={COLORS.primary}
            style={{ marginTop: 40 }}
          />
        ) : identity ? (
          <ScrollView style={styles.content}>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>DID</Text>
              <Text style={styles.didText} numberOfLines={2}>
                {identity.did}
              </Text>
              <TouchableOpacity
                style={styles.copyButton}
                onPress={() => copyToClipboard(identity.did, "DID")}
              >
                <Text style={styles.copyButtonText}>Copy DID</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardLabel}>Ethereum Address</Text>
              <Text style={styles.addressText}>
                {identity.ethereumAddress}
              </Text>
              <TouchableOpacity
                style={styles.copyButton}
                onPress={() =>
                  copyToClipboard(identity.ethereumAddress, "Address")
                }
              >
                <Text style={styles.copyButtonText}>Copy Address</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardLabel}>Keys</Text>
              {identity.keys.map((key) => (
                <View key={key.kid} style={styles.keyRow}>
                  <Text style={styles.keyType}>{key.type}</Text>
                  <Text style={styles.keyHex} numberOfLines={1}>
                    {key.publicKeyHex.slice(0, 20)}…
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>
        ) : null
      ) : (
        <CredentialsScreen />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#6b7280",
    marginBottom: 24,
  },
  tabs: {
    flexDirection: "row",
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: 16,
    color: "#6b7280",
  },
  activeTabText: {
    color: COLORS.primary,
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  card: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  didText: {
    fontSize: 13,
    fontFamily: "monospace",
    color: COLORS.text,
    marginBottom: 12,
  },
  addressText: {
    fontSize: 14,
    fontFamily: "monospace",
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 12,
  },
  copyButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  copyButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  keyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  keyType: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "600",
  },
  keyHex: {
    fontSize: 12,
    fontFamily: "monospace",
    color: "#9ca3af",
    flex: 1,
    textAlign: "right",
  },
});
