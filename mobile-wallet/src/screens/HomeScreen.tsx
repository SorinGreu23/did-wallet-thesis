import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { DIDInfo } from '../services/didService';
import walletService from '../services/walletService';
import { COLORS } from '../constants/config';
import DIDDetailScreen from './DIDDetailScreen';
import CredentialsScreen from './CredentialsScreen';

export default function HomeScreen() {
  const [dids, setDids] = useState<DIDInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedDID, setSelectedDID] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dids' | 'credentials'>('dids');
  const [activeDid, setActiveDid] = useState<string | null>(null);

  useEffect(() => {
    void loadDIDs();
  }, []);

  const loadDIDs = async () => {
    setLoading(true);
    try {
      const didList = await walletService.listDIDs();
      setDids(didList);
      const selected = await walletService.getActiveDid();
      setActiveDid(selected?.did ?? null);
    } catch (error) {
      console.error('Error loading DIDs:', error);
    } finally {
      setLoading(false);
    }
  };

  const createNewDID = async () => {
    setCreating(true);
    try {
      const newDID = await walletService.createDID();
      console.log('Created DID:', newDID);
      await loadDIDs();
    } catch (error) {
      console.error('Error creating DID:', error);
      Alert.alert('Error', 'Failed to create DID.');
    } finally {
      setCreating(false);
    }
  };

  const setAsActiveDid = async (did: string) => {
    try {
      await walletService.setActiveDid(did);
      setActiveDid(did);
      Alert.alert('Active DID updated', 'This DID will be used by default for wallet actions.');
    } catch (error) {
      console.error('Error setting active DID:', error);
      Alert.alert('Error', 'Failed to set active DID.');
    }
  };

  if (selectedDID) {
    return (
      <DIDDetailScreen
        did={selectedDID}
        onBack={() => {
          setSelectedDID(null);
          void loadDIDs();
        }}
      />
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>DID Wallet</Text>
      <Text style={styles.subtitle}>Your Decentralized Identity</Text>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'dids' && styles.activeTab]}
          onPress={() => setActiveTab('dids')}
        >
          <Text style={[styles.tabText, activeTab === 'dids' && styles.activeTabText]}>
            DIDs
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'credentials' && styles.activeTab]}
          onPress={() => setActiveTab('credentials')}
        >
          <Text style={[styles.tabText, activeTab === 'credentials' && styles.activeTabText]}>
            Credentials
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'dids' ? (
        <>
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
                <Text style={styles.emptyText}>No DIDs yet. Create your first one!</Text>
              ) : (
                dids.map((did, index) => (
                  <TouchableOpacity
                    key={did.did}
                    style={styles.didCard}
                    onPress={() => setSelectedDID(did.did)}
                  >
                    <View style={styles.didHeaderRow}>
                      <Text style={styles.didLabel}>DID #{index + 1}</Text>
                      {activeDid === did.did && <Text style={styles.activeBadge}>Active</Text>}
                    </View>
                    <Text style={styles.didText} numberOfLines={1}>
                      {did.did}
                    </Text>
                    <Text style={styles.didAlias}>Alias: {did.alias || 'N/A'}</Text>
                    <Text style={styles.didKeys}>Keys: {did.keys.length}</Text>
                    <View style={styles.cardActionsRow}>
                      <Text style={styles.tapHint}>Tap for details →</Text>
                      {activeDid !== did.did && (
                        <TouchableOpacity
                          style={styles.activeButton}
                          onPress={(event) => {
                            event.stopPropagation();
                            void setAsActiveDid(did.did);
                          }}
                        >
                          <Text style={styles.activeButtonText}>Set Active</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          )}
        </>
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
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 24,
  },
  tabs: {
    flexDirection: 'row',
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: 16,
    color: '#6b7280',
  },
  activeTabText: {
    color: COLORS.primary,
    fontWeight: '600',
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
  didHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  didLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  activeBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065f46',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
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
  cardActionsRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tapHint: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  activeButton: {
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  activeButtonText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },
});