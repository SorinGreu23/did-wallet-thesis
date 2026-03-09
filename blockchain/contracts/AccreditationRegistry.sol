// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./EURootAuthority.sol";

/**
 * @title AccreditationRegistry
 * @notice Hierarchical accreditation registry with on-chain trust chain validation
 * @dev Enforces hierarchy: EU Root → Member State → Ministry → Institution
 */
contract AccreditationRegistry {
    // ============ State Variables ============

    /// @notice Reference to the EU Root Authority contract
    EURootAuthority public immutable rootAuthority;

    /// @notice Address that deployed this contract (EU Root backend signer)
    address public immutable owner;

    /// @notice Accreditation records
    mapping(bytes32 => Accreditation) public accreditations;

    /// @notice Accreditations by subject (for lookup)
    mapping(address => bytes32[]) public accreditationsBySubject;

    /// @notice Accreditations by issuer (for lookup)
    mapping(address => bytes32[]) public accreditationsByIssuer;

    /// @notice Valid accreditation scopes
    mapping(bytes32 => mapping(address => bool)) public validAccreditations;

    struct Accreditation {
        bytes32 id;
        address issuer;
        address subject;
        bytes32 parentAccreditationId;
        AccreditationScope scope;
        bytes32 permissionsHash;
        uint256 issuedAt;
        uint256 expiresAt;
        bool revoked;
        bool exists;
    }

    enum AccreditationScope {
        None,
        MemberState,      // Issued by EU Root to member states
        Ministry,         // Issued by member states to ministries
        Institution,      // Issued by ministries to institutions
        Department        // Issued by institutions to departments (optional)
    }

    // ============ Events ============

    event AccreditationIssued(
        bytes32 indexed id,
        address indexed issuer,
        address indexed subject,
        AccreditationScope scope,
        bytes32 parentAccreditationId
    );

    event AccreditationRevoked(
        bytes32 indexed id,
        address indexed revokedBy,
        uint256 revokedAt
    );

    event AccreditationUpdated(
        bytes32 indexed id,
        bytes32 newPermissionsHash
    );

    // ============ Errors ============

    error UnauthorizedIssuer();
    error InvalidParentAccreditation();
    error InvalidScope();
    error AccreditationNotFound();
    error AccreditationExpired();
    error AccreditationAlreadyRevoked();
    error AccreditationAlreadyExists();
    error InvalidTrustChain();
    error NotMemberState();

    // ============ Constructor ============

    constructor(address _rootAuthority) {
        rootAuthority = EURootAuthority(_rootAuthority);
        owner = msg.sender;
    }

    // ============ Core Functions ============

    /**
     * @notice Issue a new accreditation
     * @param subject Address receiving the accreditation
     * @param scope Scope of the accreditation
     * @param parentAccreditationId Parent accreditation in the chain
     * @param permissionsHash Hash of the permissions granted
     * @param expiresAt Expiration timestamp (0 for no expiration)
     * @return bytes32 ID of the new accreditation
     */
    function issueAccreditation(
        address subject,
        AccreditationScope scope,
        bytes32 parentAccreditationId,
        bytes32 permissionsHash,
        uint256 expiresAt
    ) external returns (bytes32) {
        // Validate issuer authorization
        _validateIssuerAuthorization(msg.sender, scope, parentAccreditationId);

        // Generate accreditation ID
        bytes32 accreditationId = keccak256(abi.encodePacked(
            msg.sender,
            subject,
            scope,
            permissionsHash,
            block.timestamp
        ));

        // Check if accreditation already exists
        if (accreditations[accreditationId].exists) {
            revert AccreditationAlreadyExists();
        }

        // Create accreditation
        accreditations[accreditationId] = Accreditation({
            id: accreditationId,
            issuer: msg.sender,
            subject: subject,
            parentAccreditationId: parentAccreditationId,
            scope: scope,
            permissionsHash: permissionsHash,
            issuedAt: block.timestamp,
            expiresAt: expiresAt,
            revoked: false,
            exists: true
        });

        // Update lookups
        accreditationsBySubject[subject].push(accreditationId);
        accreditationsByIssuer[msg.sender].push(accreditationId);
        validAccreditations[accreditationId][subject] = true;

        emit AccreditationIssued(
            accreditationId,
            msg.sender,
            subject,
            scope,
            parentAccreditationId
        );

        return accreditationId;
    }

    /**
     * @notice Revoke an accreditation
     * @param accreditationId ID of the accreditation to revoke
     */
    function revokeAccreditation(bytes32 accreditationId) external {
        Accreditation storage accred = accreditations[accreditationId];

        if (!accred.exists) revert AccreditationNotFound();
        if (accred.revoked) revert AccreditationAlreadyRevoked();

        // Only issuer or root authority can revoke
        require(
            msg.sender == accred.issuer || rootAuthority.isMemberState(msg.sender),
            "Unauthorized to revoke"
        );

        accred.revoked = true;
        validAccreditations[accreditationId][accred.subject] = false;

        emit AccreditationRevoked(accreditationId, msg.sender, block.number);
    }

    /**
     * @notice Validate the complete trust chain for an accreditation
     * @param accreditationId ID of the accreditation
     * @return bool True if the trust chain is valid
     */
    function validateTrustChain(bytes32 accreditationId) public view returns (bool) {
        Accreditation memory accred = accreditations[accreditationId];

        if (!accred.exists) return false;
        if (accred.revoked) return false;
        if (accred.expiresAt > 0 && accred.expiresAt < block.timestamp) return false;

        // Walk up the chain
        if (accred.scope == AccreditationScope.MemberState) {
            // Member state must be validated by root authority
            return rootAuthority.isMemberState(accred.subject);
        } else if (accred.scope == AccreditationScope.Ministry) {
            // Ministry's trust chain is valid if its issuer is a member state
            return rootAuthority.isMemberState(accred.issuer);
        } else if (accred.scope == AccreditationScope.Institution) {
            // Institution must have valid parent (ministry)
            if (accred.parentAccreditationId == bytes32(0)) return false;
            Accreditation memory parent = accreditations[accred.parentAccreditationId];
            if (parent.scope != AccreditationScope.Ministry) return false;
            return validateTrustChain(accred.parentAccreditationId);
        } else if (accred.scope == AccreditationScope.Department) {
            // Department must have valid parent (institution)
            if (accred.parentAccreditationId == bytes32(0)) return false;
            Accreditation memory parent = accreditations[accred.parentAccreditationId];
            if (parent.scope != AccreditationScope.Institution) return false;
            return validateTrustChain(accred.parentAccreditationId);
        }

        return false;
    }

    /**
     * @notice Check if an address has a valid accreditation for a specific scope
     * @param subject Address to check
     * @param scope Required scope
     * @return bool True if the address has a valid accreditation
     */
    function hasValidAccreditation(address subject, AccreditationScope scope) external view returns (bool) {
        bytes32[] memory accreds = accreditationsBySubject[subject];

        for (uint256 i = 0; i < accreds.length; i++) {
            Accreditation memory accred = accreditations[accreds[i]];

            if (accred.scope == scope &&
                !accred.revoked &&
                (accred.expiresAt == 0 || accred.expiresAt > block.timestamp) &&
                validateTrustChain(accreds[i])) {
                return true;
            }
        }

        return false;
    }

    /**
     * @notice Get the complete trust chain for an accreditation
     * @param accreditationId ID of the accreditation
     * @return bytes32[] Array of accreditation IDs from root to target
     */
    function getTrustChain(bytes32 accreditationId) external view returns (bytes32[] memory) {
        uint256 chainLength = _getChainLength(accreditationId);
        bytes32[] memory chain = new bytes32[](chainLength);

        bytes32 currentId = accreditationId;
        for (uint256 i = chainLength; i > 0; i--) {
            chain[i - 1] = currentId;
            Accreditation memory accred = accreditations[currentId];
            currentId = accred.parentAccreditationId;
            if (currentId == bytes32(0)) break;
        }

        return chain;
    }

    /**
     * @notice Get all accreditations for a subject
     * @param subject Address to query
     * @return bytes32[] Array of accreditation IDs
     */
    function getAccreditationsBySubject(address subject) external view returns (bytes32[] memory) {
        return accreditationsBySubject[subject];
    }

    /**
     * @notice Get all accreditations issued by an address
     * @param issuer Address to query
     * @return bytes32[] Array of accreditation IDs
     */
    function getAccreditationsByIssuer(address issuer) external view returns (bytes32[] memory) {
        return accreditationsByIssuer[issuer];
    }

    /**
     * @notice Get accreditation details
     * @param accreditationId ID of the accreditation
     * @return Accreditation Struct containing all accreditation data
     */
    function getAccreditation(bytes32 accreditationId) external view returns (Accreditation memory) {
        if (!accreditations[accreditationId].exists) revert AccreditationNotFound();
        return accreditations[accreditationId];
    }

    // ============ Internal Functions ============

    /**
     * @notice Validate that the issuer is authorized to issue an accreditation
     * @param issuer Address of the issuer
     * @param scope Scope being issued
     * @param parentAccreditationId Parent accreditation
     */
    function _validateIssuerAuthorization(
        address issuer,
        AccreditationScope scope,
        bytes32 parentAccreditationId
    ) private view {
        // The contract owner (EU Root backend signer) can issue at any scope
        bool isRootDeployer = (issuer == owner);

        if (scope == AccreditationScope.MemberState) {
            if (!isRootDeployer) revert NotMemberState();
        } else if (scope == AccreditationScope.Ministry) {
            if (!isRootDeployer) revert UnauthorizedIssuer();
        } else if (scope == AccreditationScope.Institution) {
            if (parentAccreditationId == bytes32(0)) revert InvalidParentAccreditation();
            Accreditation memory parent = accreditations[parentAccreditationId];
            if (!parent.exists) revert InvalidParentAccreditation();
            if (parent.scope != AccreditationScope.Ministry) revert InvalidScope();
            if (parent.subject != issuer && !isRootDeployer) revert UnauthorizedIssuer();
            if (!validateTrustChain(parentAccreditationId)) revert InvalidTrustChain();
        } else if (scope == AccreditationScope.Department) {
            if (parentAccreditationId == bytes32(0)) revert InvalidParentAccreditation();
            Accreditation memory parent = accreditations[parentAccreditationId];
            if (!parent.exists) revert InvalidParentAccreditation();
            if (parent.scope != AccreditationScope.Institution) revert InvalidScope();
            if (parent.subject != issuer && !isRootDeployer) revert UnauthorizedIssuer();
            if (!validateTrustChain(parentAccreditationId)) revert InvalidTrustChain();
        } else {
            revert InvalidScope();
        }
    }

    /**
     * @notice Get the length of the trust chain
     * @param accreditationId ID of the accreditation
     * @return uint256 Length of the chain
     */
    function _getChainLength(bytes32 accreditationId) private view returns (uint256) {
        uint256 length = 0;
        bytes32 currentId = accreditationId;

        while (currentId != bytes32(0)) {
            length++;
            Accreditation memory accred = accreditations[currentId];
            currentId = accred.parentAccreditationId;

            // Prevent infinite loops
            if (length > 10) break;
        }

        return length;
    }
}
