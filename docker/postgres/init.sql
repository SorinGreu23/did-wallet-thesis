-- This script runs once on first initialization of the postgres container.
-- It creates the per-service databases. The default database (did_wallet)
-- is already created by the POSTGRES_DB environment variable.

-- DID.Identity service
CREATE DATABASE did_identity;

-- DID.Accreditation service
CREATE DATABASE did_accreditation;

-- DID.BlockchainSync worker
CREATE DATABASE did_blockchainsync;

-- DID.Credential service
CREATE DATABASE did_credential;
