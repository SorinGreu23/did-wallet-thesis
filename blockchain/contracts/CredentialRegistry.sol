// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./AccreditationRegistry.sol";

/**
 * @title CredentialRegistry
 * @notice Registry for tracking verifiable credential status on-chain
 * @dev Validates issuer accreditation before recording credentials
 */
contract CredentialRegistry {
    // ============ State Variables ============

    /// @notice Reference to the Accreditation Registry contract
    AccreditationRegistry public immutable accreditationRegistry;

    /// @notice Credential records
    mapping(bytes32 => Credential) public credentials;

    /// @notice Credentials by holder (for lookup)
    mapping(address => bytes32[]) public credentialsByHolder;

    /// @notice Credentials by issuer (for lookup)
    mapping(address => bytes32[]) public credentialsByIssuer;

    /// @notice Required accreditation scope for credential issuance
    AccreditationRegistry.AccreditationScope public constant REQUIRED_ISSUER_SCOPE =
        AccreditationRegistry.AccreditationScope.Institution;

    struct Credential {
        bytes32 id;
        address issuer;
        address holder;
        bytes32 credentialHash;
        string credentialType;
        CredentialStatus status;
        uint256 issuedAt;
        uint256 expiresAt;
        bytes32 issuerAccreditationId;
        bool exists;
    }

    enum CredentialStatus {
        Active,
        Revoked,
        Suspended,
        Expired
    }

    // ============ Events ============

    event CredentialIssued(
        bytes32 indexed id,
        address indexed issuer,
        address indexed holder,
        string credentialType,
        bytes32 issuerAccreditationId
    );

    event CredentialRevoked(
        bytes32 indexed id,
        address indexed revokedBy,
        uint256 revokedAt,
        string reason
    );

    event CredentialSuspended(
        bytes32 indexed id,
        address indexed suspendedBy,
        uint256 suspendedAt,
        string reason
    );

    event CredentialReactivated(
        bytes32 indexed id,
        address indexed reactivatedBy,
        uint256 reactivatedAt
    );

    event CredentialStatusUpdated(
        bytes32 indexed id,
        CredentialStatus oldStatus,
        CredentialStatus newStatus
    );

    // ============ Errors ============

    error UnauthorizedIssuer();
    error InvalidAccreditation();
    error CredentialNotFound();
    error CredentialAlreadyExists();
    error CredentialRevoked();
    error CredentialExpired();
    error InvalidStatus();
    error Unauthorized();

    // ============ Constructor ============

    constructor(address _accreditationRegistry) {
        accreditationRegistry = AccreditationRegistry(_accreditationRegistry);
    }

    // ============ Core Functions ============

    /**
     * @notice Record a new credential on-chain
     * @param holder Address of the credential holder
     * @param credentialHash Hash of the full credential
     * @param credentialType Type of credential (e.g., "UniversityDegree")
     * @param issuerAccreditationId Accreditation ID of the issuer
     * @param expiresAt Expiration timestamp (0 for no expiration)
     * @return bytes32 ID of the recorded credential
     */
    function recordCredential(
        address holder,
        bytes32 credentialHash,
        string memory credentialType,
        bytes32 issuerAccreditationId,
        uint256 expiresAt
    ) external returns (bytes32) {
        // Validate issuer has valid institution-level accreditation
        _validateIssuerAuthorization(msg.sender, issuerAccreditationId);

        // Generate credential ID
        bytes32 credentialId = keccak256(abi.encodePacked(
            msg.sender,
            holder,
            credentialHash,
            credentialType,
            block.timestamp
        ));

        // Check if credential already exists
        if (credentials[credentialId].exists) {
            revert CredentialAlreadyExists();
        }

        // Create credential record
        credentials[credentialId] = Credential({
            id: credentialId,
            issuer: msg.sender,
            holder: holder,
            credentialHash: credentialHash,
            credentialType: credentialType,
            status: CredentialStatus.Active,
            issuedAt: block.timestamp,
            expiresAt: expiresAt,
            issuerAccreditationId: issuerAccreditationId,
            exists: true
        });

        // Update lookups
        credentialsByHolder[holder].push(credentialId);
        credentialsByIssuer[msg.sender].push(credentialId);

        emit CredentialIssued(
            credentialId,
            msg.sender,
            holder,
            credentialType,
            issuerAccreditationId
        );

        return credentialId;
    }

    /**
     * @notice Revoke a credential
     * @param credentialId ID of the credential to revoke
     * @param reason Reason for revocation
     */
    function revokeCredential(bytes32 credentialId, string memory reason) external {
        Credential storage cred = credentials[credentialId];

        if (!cred.exists) revert CredentialNotFound();
        if (cred.status == CredentialStatus.Revoked) revert CredentialRevoked();

        // Only issuer can revoke
        if (msg.sender != cred.issuer) revert Unauthorized();

        CredentialStatus oldStatus = cred.status;
        cred.status = CredentialStatus.Revoked;

        emit CredentialRevoked(credentialId, msg.sender, block.timestamp, reason);
        emit CredentialStatusUpdated(credentialId, oldStatus, CredentialStatus.Revoked);
    }

    /**
     * @notice Suspend a credential
     * @param credentialId ID of the credential to suspend
     * @param reason Reason for suspension
     */
    function suspendCredential(bytes32 credentialId, string memory reason) external {
        Credential storage cred = credentials[credentialId];

        if (!cred.exists) revert CredentialNotFound();
        if (cred.status == CredentialStatus.Revoked) revert CredentialRevoked();

        // Only issuer can suspend
        if (msg.sender != cred.issuer) revert Unauthorized();

        CredentialStatus oldStatus = cred.status;
        cred.status = CredentialStatus.Suspended;

        emit CredentialSuspended(credentialId, msg.sender, block.timestamp, reason);
        emit CredentialStatusUpdated(credentialId, oldStatus, CredentialStatus.Suspended);
    }

    /**
     * @notice Reactivate a suspended credential
     * @param credentialId ID of the credential to reactivate
     */
    function reactivateCredential(bytes32 credentialId) external {
        Credential storage cred = credentials[credentialId];

        if (!cred.exists) revert CredentialNotFound();
        if (cred.status != CredentialStatus.Suspended) revert InvalidStatus();

        // Only issuer can reactivate
        if (msg.sender != cred.issuer) revert Unauthorized();

        CredentialStatus oldStatus = cred.status;
        cred.status = CredentialStatus.Active;

        emit CredentialReactivated(credentialId, msg.sender, block.timestamp);
        emit CredentialStatusUpdated(credentialId, oldStatus, CredentialStatus.Active);
    }

    /**
     * @notice Check if a credential is active
     * @param credentialId ID of the credential
     * @return bool True if credential is active and not expired
     */
    function isActive(bytes32 credentialId) external view returns (bool) {
        Credential memory cred = credentials[credentialId];

        if (!cred.exists) return false;
        if (cred.status != CredentialStatus.Active) return false;
        if (cred.expiresAt > 0 && cred.expiresAt < block.timestamp) return false;

        // Also validate that issuer's accreditation is still valid
        return accreditationRegistry.validateTrustChain(cred.issuerAccreditationId);
    }

    /**
     * @notice Get credential status
     * @param credentialId ID of the credential
     * @return CredentialStatus Current status of the credential
     */
    function getCredentialStatus(bytes32 credentialId) external view returns (CredentialStatus) {
        Credential memory cred = credentials[credentialId];

        if (!cred.exists) revert CredentialNotFound();

        // Check expiration
        if (cred.expiresAt > 0 && cred.expiresAt < block.timestamp) {
            return CredentialStatus.Expired;
        }

        return cred.status;
    }

    /**
     * @notice Verify a credential's complete status
     * @param credentialId ID of the credential
     * @return isValid True if credential is valid
     * @return status Current status
     * @return trustChainValid True if issuer's trust chain is valid
     */
    function verifyCredential(bytes32 credentialId) external view returns (
        bool isValid,
        CredentialStatus status,
        bool trustChainValid
    ) {
        Credential memory cred = credentials[credentialId];

        if (!cred.exists) {
            return (false, CredentialStatus.Revoked, false);
        }

        // Check expiration
        if (cred.expiresAt > 0 && cred.expiresAt < block.timestamp) {
            return (false, CredentialStatus.Expired, false);
        }

        // Validate issuer's trust chain
        trustChainValid = accreditationRegistry.validateTrustChain(cred.issuerAccreditationId);

        // Credential is valid if active and trust chain is valid
        isValid = (cred.status == CredentialStatus.Active) && trustChainValid;

        return (isValid, cred.status, trustChainValid);
    }

    /**
     * @notice Get credential details
     * @param credentialId ID of the credential
     * @return Credential Struct containing all credential data
     */
    function getCredential(bytes32 credentialId) external view returns (Credential memory) {
        if (!credentials[credentialId].exists) revert CredentialNotFound();
        return credentials[credentialId];
    }

    /**
     * @notice Get all credentials for a holder
     * @param holder Address of the holder
     * @return bytes32[] Array of credential IDs
     */
    function getCredentialsByHolder(address holder) external view returns (bytes32[] memory) {
        return credentialsByHolder[holder];
    }

    /**
     * @notice Get all credentials issued by an address
     * @param issuer Address of the issuer
     * @return bytes32[] Array of credential IDs
     */
    function getCredentialsByIssuer(address issuer) external view returns (bytes32[] memory) {
        return credentialsByIssuer[issuer];
    }

    /**
     * @notice Batch verify multiple credentials
     * @param credentialIds Array of credential IDs to verify
     * @return results Array of verification results
     */
    function batchVerifyCredentials(bytes32[] memory credentialIds) external view returns (
        bool[] memory results
    ) {
        results = new bool[](credentialIds.length);

        for (uint256 i = 0; i < credentialIds.length; i++) {
            Credential memory cred = credentials[credentialIds[i]];

            if (!cred.exists) {
                results[i] = false;
                continue;
            }

            // Check status and expiration
            bool isValid = (cred.status == CredentialStatus.Active) &&
                          (cred.expiresAt == 0 || cred.expiresAt >= block.timestamp);

            // Validate issuer's trust chain
            bool trustChainValid = accreditationRegistry.validateTrustChain(cred.issuerAccreditationId);

            results[i] = isValid && trustChainValid;
        }

        return results;
    }

    // ============ Internal Functions ============

    /**
     * @notice Validate that the issuer is authorized to issue credentials
     * @param issuer Address of the issuer
     * @param issuerAccreditationId Accreditation ID to validate
     */
    function _validateIssuerAuthorization(
        address issuer,
        bytes32 issuerAccreditationId
    ) private view {
        // Get the accreditation
        AccreditationRegistry.Accreditation memory accred =
            accreditationRegistry.getAccreditation(issuerAccreditationId);

        // Validate accreditation belongs to issuer
        if (accred.subject != issuer) revert UnauthorizedIssuer();

        // Validate accreditation is institution-level
        if (accred.scope != REQUIRED_ISSUER_SCOPE) revert InvalidAccreditation();

        // Validate trust chain
        if (!accreditationRegistry.validateTrustChain(issuerAccreditationId)) {
            revert InvalidAccreditation();
        }

        // Check not revoked
        if (accred.revoked) revert InvalidAccreditation();

        // Check not expired
        if (accred.expiresAt > 0 && accred.expiresAt < block.timestamp) {
            revert InvalidAccreditation();
        }
    }
}
