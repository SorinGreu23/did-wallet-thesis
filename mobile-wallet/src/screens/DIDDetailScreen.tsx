import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import didService, { DIDInfo } from '../services/didService';
import { COLORS } from '../constants/config';

interface Props {
  did: string;
  onBack: () => void;
}

export default function DIDDetailScreen({ did, onBack }: Props) {
  const [didInfo, setDidInfo] = useState<DIDInfo | null>(null);
  const [resolution, setResolution] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDIDDetails();
  }, []);

  const loadDIDDetails = async () => {
    setLoading(true);
    try {
      const info = await didService.getDID(did);
      setDidInfo(info);

      const resolved = await didService.resolveDID(did);
      setResolution(resolved);
    } catch (error) {
      console.error('Error loading DID details:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied!', `${label} copied to clipboard`);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!didInfo) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>DID not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>DID Details</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* DID Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Identifier</Text>
          <TouchableOpacity
            style={styles.copyableField}
            onPress={() => copyToClipboard(didInfo.did, 'DID')}
          >
            <Text style={styles.fieldLabel}>DID</Text>
            <Text style={styles.fieldValue}>{didInfo.did}</Text>
            <Text style={styles.copyHint}>Tap to copy</Text>
          </TouchableOpacity>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Provider</Text>
            <Text style={styles.fieldValue}>{didInfo.provider}</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Alias</Text>
            <Text style={styles.fieldValue}>{didInfo.alias || 'N/A'}</Text>
          </View>
        </View>

        {/* Keys Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cryptographic Keys</Text>
          {didInfo.keys.map((key, index) => (
            <View key={key.kid} style={styles.keyCard}>
              <Text style={styles.keyTitle}>Key #{index + 1}</Text>
              
              <TouchableOpacity
                style={styles.copyableField}
                onPress={() => copyToClipboard(key.kid, 'Key ID')}
              >
                <Text style={styles.fieldLabel}>Key ID (kid)</Text>
                <Text style={styles.fieldValueMono} numberOfLines={2}>
                  {key.kid}
                </Text>
                <Text style={styles.copyHint}>Tap to copy</Text>
              </TouchableOpacity>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Type</Text>
                <Text style={styles.fieldValue}>{key.type}</Text>
              </View>

              <TouchableOpacity
                style={styles.copyableField}
                onPress={() => copyToClipboard(key.publicKeyHex, 'Public Key')}
              >
                <Text style={styles.fieldLabel}>Public Key (Hex)</Text>
                <Text style={styles.fieldValueMono} numberOfLines={3}>
                  {key.publicKeyHex}
                </Text>
                <Text style={styles.copyHint}>Tap to copy</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* DID Document Section */}
        {resolution?.didDocument && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>DID Document</Text>
            <TouchableOpacity
              style={styles.copyableField}
              onPress={() =>
                copyToClipboard(
                  JSON.stringify(resolution.didDocument, null, 2),
                  'DID Document'
                )
              }
            >
              <Text style={styles.fieldLabel}>Full Document (JSON)</Text>
              <ScrollView
                horizontal
                style={styles.jsonContainer}
                showsHorizontalScrollIndicator={false}
              >
                <Text style={styles.jsonText}>
                  {JSON.stringify(resolution.didDocument, null, 2)}
                </Text>
              </ScrollView>
              <Text style={styles.copyHint}>Tap to copy</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    marginBottom: 8,
  },
  backButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 12,
  },
  field: {
    marginBottom: 16,
  },
  copyableField: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
    fontWeight: '600',
  },
  fieldValue: {
    fontSize: 14,
    color: COLORS.text,
  },
  fieldValueMono: {
    fontSize: 12,
    color: COLORS.text,
    fontFamily: 'Courier',
  },
  copyHint: {
    fontSize: 11,
    color: COLORS.primary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  keyCard: {
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  keyTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 12,
  },
  jsonContainer: {
    maxHeight: 200,
  },
  jsonText: {
    fontSize: 11,
    fontFamily: 'Courier',
    color: COLORS.text,
  },
  errorText: {
    textAlign: 'center',
    color: '#ef4444',
    fontSize: 16,
    marginTop: 40,
  },
});