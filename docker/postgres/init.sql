-- This script runs once on first initialization of the postgres container.
-- It creates the per-service databases. The default database (did_wallet)
-- is already created by the POSTGRES_DB environment variable.

CREATE DATABASE did_identity;
CREATE DATABASE did_accreditation;
CREATE DATABASE did_blockchainsync;
CREATE DATABASE did_credential;
