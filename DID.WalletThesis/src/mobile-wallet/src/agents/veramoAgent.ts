import {
  createAgent,
  IResolver,
  IKeyManager,
  IDIDManager,
  IDataStore,
  TAgent,
  ICredentialPlugin,
} from "@veramo/core";
import { CredentialPlugin } from "@veramo/credential-w3c";
import { DIDManager } from "@veramo/did-manager";
import { KeyManager } from "@veramo/key-manager";
import { KeyManagementSystem, SecretBox } from "@veramo/kms-local";
import { DIDResolverPlugin } from "@veramo/did-resolver";
import { Resolver } from "did-resolver";
import { EthrDIDProvider } from "@veramo/did-provider-ethr";
import { getResolver as ethrDidResolver } from "ethr-did-resolver";
import {
  DataStore,
  DataStoreORM,
  DIDStore,
  Entities,
  KeyStore,
  PrivateKeyStore,
} from "@veramo/data-store";
import { DataSource } from "typeorm";
import { CONFIG } from "../constants/config";

import "react-native-get-random-values";
import "@ethersproject/shims";

const TX_CONTROL = new Set([
  "BEGIN TRANSACTION",
  "COMMIT",
  "ROLLBACK",
]);

function isTxControl(sql: string): boolean {
  const upper = sql.trim().toUpperCase();
  return (
    TX_CONTROL.has(upper) ||
    upper.startsWith("SAVEPOINT") ||
    upper.startsWith("RELEASE SAVEPOINT")
  );
}

/**
 * expo-sqlite v16 wraps every prepareAsync call in an implicit transaction.
 * TypeORM issues explicit BEGIN/COMMIT/ROLLBACK through prepareAsync, which
 * causes "cannot start a transaction within a transaction".
 *
 * Fix: wrap DataSource.createQueryRunner so every runner it hands out has
 * transaction-control SQL silently no-opped.
 */
function patchDataSource(ds: DataSource): void {
  const origCreate = ds.createQueryRunner.bind(ds);
  (ds as any).createQueryRunner = function (...args: any[]) {
    const qr = origCreate(...args);
    const origQuery = qr.query.bind(qr);
    qr.query = async function (
      query: string,
      parameters?: any[],
      useStructuredResult?: boolean,
    ): Promise<any> {
      if (isTxControl(query)) {
        return useStructuredResult
          ? { records: [], affected: 0, raw: [] }
          : [];
      }
      return origQuery(query, parameters, useStructuredResult as true);
    };
    return qr;
  };
}

const NETWORKS = [
  {
    name: "sepolia",
    chainId: CONFIG.ANVIL_CHAIN_ID,
    rpcUrl: CONFIG.ANVIL_RPC_URL,
  },
];

export type VeramoAgent = TAgent<
  IDIDManager & IKeyManager & IResolver & IDataStore & ICredentialPlugin
>;

let agentInstance: VeramoAgent | null = null;
let agentInitializationPromise: Promise<VeramoAgent> | null = null;

export const initializeAgent = async (secretKey: string): Promise<VeramoAgent> => {
  if (agentInstance) return agentInstance;
  if (agentInitializationPromise) return agentInitializationPromise;

  if (!secretKey || secretKey.length !== 64) {
    throw new Error("A valid 64-character hex secret key is required.");
  }

  agentInitializationPromise = (async () => {
    const dbConnection = new DataSource({
      type: "expo",
      driver: require("expo-sqlite"),
      database: "veramo.db",
      synchronize: true,
      logging: ["error", "info", "warn"],
      entities: Entities,
    });

    // Patch BEFORE initialize() — synchronize uses createQueryRunner()
    // and would otherwise fail with nested transaction errors.
    patchDataSource(dbConnection);

    await dbConnection.initialize();

    agentInstance = createAgent<
      IDIDManager & IKeyManager & IResolver & IDataStore & ICredentialPlugin
    >({
      plugins: [
        new KeyManager({
          store: new KeyStore(dbConnection),
          kms: {
            local: new KeyManagementSystem(
              new PrivateKeyStore(dbConnection, new SecretBox(secretKey))
            ),
          },
        }),
        new DIDManager({
          store: new DIDStore(dbConnection),
          defaultProvider: "did:ethr:sepolia",
          providers: {
            "did:ethr:sepolia": new EthrDIDProvider({
              defaultKms: "local",
              networks: NETWORKS,
            }),
          },
        }),
        new DIDResolverPlugin({
          resolver: new Resolver({
            ...ethrDidResolver({ networks: NETWORKS }),
          }),
        }),
        new DataStore(dbConnection),
        new DataStoreORM(dbConnection),
        new CredentialPlugin(),
      ],
    });

    return agentInstance;
  })();

  try {
    const agent = await agentInitializationPromise;
    agentInitializationPromise = null;
    return agent;
  } catch (error) {
    agentInitializationPromise = null;
    agentInstance = null;
    throw error;
  }
};

export const getAgent = () => {
  if (!agentInstance) {
    throw new Error("Agent not initialized. Call initializeAgent() first.");
  }
  return agentInstance;
};
