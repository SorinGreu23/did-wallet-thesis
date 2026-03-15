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
  migrations,
  PrivateKeyStore,
} from "@veramo/data-store";
import { DataSource } from "typeorm";
import { CONFIG } from "../constants/config";

import "react-native-get-random-values";
import "@ethersproject/shims";

const SECRET_KEY =
  "29739248cad1bd1a0fc4d9b75cd4d2990de535baf5caadfdf8d8f86664aa830c";

const NETWORKS = [
  {
    name: "sepolia",
    chainId: CONFIG.HARDHAT_CHAIN_ID,
    rpcUrl: CONFIG.HARDHAT_RPC_URL,
  },
];

export type VeramoAgent = TAgent<
  IDIDManager & IKeyManager & IResolver & IDataStore & ICredentialPlugin
>;

let agentInstance: VeramoAgent | null = null;

export const initializeAgent = async (): Promise<VeramoAgent> => {
  if (agentInstance) return agentInstance;

  const dbConnection = await new DataSource({
    type: "expo",
    driver: require("expo-sqlite"),
    database: "veramo.db",
    migrations,
    migrationsRun: true,
    logging: ["error", "info", "warn"],
    entities: Entities,
  }).initialize();

  agentInstance = createAgent<
    IDIDManager & IKeyManager & IResolver & IDataStore & ICredentialPlugin
  >({
    plugins: [
      new KeyManager({
        store: new KeyStore(dbConnection),
        kms: {
          local: new KeyManagementSystem(
            new PrivateKeyStore(dbConnection, new SecretBox(SECRET_KEY))
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
};

export const getAgent = () => {
  if (!agentInstance) {
    throw new Error("Agent not initialized. Call initializeAgent() first.");
  }
  return agentInstance;
};
