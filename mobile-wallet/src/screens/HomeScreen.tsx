import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import didService, { DIDInfo } from '../services/didService';
import { COLORS } from '../constants/config';
import DIDDetailScreen from './DIDDetailScreen';

export default function HomeScreen() {
  const [dids, setDids] = useState<DIDInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedDID, setSelectedDID] = useState<string | null>(null);

  useEffect(() => {
    loadDIDs();
  }, []);

  const loadDIDs = async () => {
    setLoading(true);
    try {
      const didList = await didService.listDIDs();
      setDids(didList);
    } catch (error) {
      console.error('Error loading DIDs:', error);
    } finally {
      setLoading(false);
    }
  };

  const createNewDID = async () => {
    setCreating(true);
    try {
      const newDID = await didService.createDID();
      console.log('Created DID:', newDID);
      await loadDIDs();
    } catch (error) {
      console.error('Error creating DID:', error);
    } finally {
      setCreating(false);
    }
  };

  // Dacă e selectat un DID, arată detail screen
  if (selectedDID) {
    return (
      <DIDDetailScreen
        did={selectedDID}
        onBack={() => setSelectedDID(null)}
      />
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>DID Wallet</Text>
      <Text style={styles.subtitle}>Your Decentralized Identifiers</Text>

      <TouchableOpacity
        style={styles.createButton}
        onPress={createNewDID}
        disabled={creating}
      >
        {creating ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Create New DID</Text>
        )}
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} />
      ) : (
        <ScrollView style={styles.didList}>
          {dids.length === 0 ? (
            <Text style={styles.emptyText}>
              No DIDs yet. Create your first one!
            </Text>
          ) : (
            dids.map((did, index) => (
              <TouchableOpacity
                key={did.did}
                style={styles.didCard}
                onPress={() => setSelectedDID(did.did)}
              >
                <Text style={styles.didLabel}>DID #{index + 1}</Text>
                <Text style={styles.didText} numberOfLines={1}>
                  {did.did}
                </Text>
                <Text style={styles.didAlias}>Alias: {did.alias}</Text>
                <Text style={styles.didKeys}>Keys: {did.keys.length}</Text>
                <Text style={styles.tapHint}>Tap for details →</Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
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
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 24,
  },
  createButton: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  didList: {
    flex: 1,
  },
  emptyText: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 16,
    marginTop: 40,
  },
  didCard: {
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  didLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  didText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  didAlias: {
    fontSize: 12,
    color: '#6b7280',
  },
  didKeys: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  tapHint: {
    fontSize: 12,
    color: COLORS.primary,
    marginTop: 8,
    fontWeight: '600',
  },
});