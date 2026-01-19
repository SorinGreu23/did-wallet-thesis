import {
  createAgent,
  IResolver,
  IKeyManager,
  IDIDManager,
  IDataStore,
  TAgent,
} from "@veramo/core";
import { DIDManager } from "@veramo/did-manager";
import { KeyManager } from "@veramo/key-manager";
import { KeyManagementSystem, SecretBox } from "@veramo/kms-local";
import { DIDResolverPlugin } from "@veramo/did-resolver";
import { Resolver } from "did-resolver";
import { getResolver as keyDidResolver } from "key-did-resolver";
import { KeyDIDProvider } from "@veramo/did-provider-key";
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

import "react-native-get-random-values";
import "@ethersproject/shims";

const SECRET_KEY =
  "29739248cad1bd1a0fc4d9b75cd4d2990de535baf5caadfdf8d8f86664aa830c";

export type VeramoAgent = TAgent<
  IDIDManager & IKeyManager & IResolver & IDataStore
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
    IDIDManager & IKeyManager & IResolver & IDataStore
  >({
    plugins: [
      new KeyManager({
        store: new KeyStore(dbConnection),
        kms: {
          local: new KeyManagementSystem(
            new PrivateKeyStore(dbConnection, new SecretBox(SECRET_KEY)),
          ),
        },
      }),
      new DIDManager({
        store: new DIDStore(dbConnection),
        defaultProvider: "did:key",
        providers: {
          "did:key": new KeyDIDProvider({
            defaultKms: "local",
          }),
        },
      }),
      new DIDResolverPlugin({
        resolver: new Resolver({
          ...keyDidResolver(),
        }),
      }),
      new DataStore(dbConnection),
      new DataStoreORM(dbConnection),
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
