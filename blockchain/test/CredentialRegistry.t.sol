// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";

import "../contracts/EURootAuthority.sol";
import "../contracts/AccreditationRegistry.sol";
import "../contracts/CredentialRegistry.sol";

contract CredentialRegistryTest is Test {
    EURootAuthority private rootAuthority;
    AccreditationRegistry private accreditationRegistry;
    CredentialRegistry private credentialRegistry;

    bytes32 private constant GENESIS_BLOCK_HASH =
        keccak256("EU_DID_WALLET_GENESIS");

    address private root = address(this);
    address private memberState = address(0x1001);
    address private ministry = address(0x1002);
    address private institution = address(0x1003);
    address private holder = address(0x2001);
    address private randomUser = address(0x9999);

    bytes32 private constant CREDENTIAL_HASH =
        keccak256("credential-json-payload");

    string private constant CREDENTIAL_TYPE = "UniversityDegree";

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
        CredentialRegistry.CredentialStatus oldStatus,
        CredentialRegistry.CredentialStatus newStatus
    );

    function setUp() public {
        rootAuthority = new EURootAuthority(
            GENESIS_BLOCK_HASH,
            "did:web:europa.eu"
        );

        accreditationRegistry = new AccreditationRegistry(
            address(rootAuthority)
        );

        credentialRegistry = new CredentialRegistry(
            address(accreditationRegistry)
        );
    }

    function testConstructorStoresAccreditationRegistry() public view {
        assertEq(
            address(credentialRegistry.accreditationRegistry()),
            address(accreditationRegistry)
        );
    }

    function testRequiredIssuerScopeIsInstitution() public view {
        assertEq(
            uint256(credentialRegistry.REQUIRED_ISSUER_SCOPE()),
            uint256(AccreditationRegistry.AccreditationScope.Institution)
        );
    }

    function testInstitutionCanRecordCredential() public {
        bytes32 institutionAccreditationId =
            _issueValidInstitutionAccreditation();

        vm.prank(institution);

        bytes32 credentialId = credentialRegistry.recordCredential(
            holder,
            CREDENTIAL_HASH,
            CREDENTIAL_TYPE,
            institutionAccreditationId,
            0
        );

        CredentialRegistry.Credential memory credential =
            credentialRegistry.getCredential(credentialId);

        assertEq(credential.id, credentialId);
        assertEq(credential.issuer, institution);
        assertEq(credential.holder, holder);
        assertEq(credential.credentialHash, CREDENTIAL_HASH);
        assertEq(credential.credentialType, CREDENTIAL_TYPE);
        assertEq(
            uint256(credential.status),
            uint256(CredentialRegistry.CredentialStatus.Active)
        );
        assertEq(credential.issuedAt, block.timestamp);
        assertEq(credential.expiresAt, 0);
        assertEq(credential.issuerAccreditationId, institutionAccreditationId);
        assertTrue(credential.exists);

        assertTrue(credentialRegistry.isActive(credentialId));
    }

    function testRecordCredentialEmitsCredentialIssued() public {
        bytes32 institutionAccreditationId =
            _issueValidInstitutionAccreditation();

        vm.prank(institution);

        bytes32 expectedCredentialId = keccak256(
            abi.encodePacked(
                institution,
                holder,
                CREDENTIAL_HASH,
                CREDENTIAL_TYPE,
                block.timestamp
            )
        );

        vm.expectEmit(true, true, true, true);
        emit CredentialIssued(
            expectedCredentialId,
            institution,
            holder,
            CREDENTIAL_TYPE,
            institutionAccreditationId
        );

        credentialRegistry.recordCredential(
            holder,
            CREDENTIAL_HASH,
            CREDENTIAL_TYPE,
            institutionAccreditationId,
            0
        );
    }

    function testCannotRecordCredentialWithoutAccreditation() public {
        vm.prank(institution);

        vm.expectRevert();

        credentialRegistry.recordCredential(
            holder,
            CREDENTIAL_HASH,
            CREDENTIAL_TYPE,
            bytes32("missing-accreditation"),
            0
        );
    }

    function testCannotRecordCredentialWithWrongIssuer() public {
        bytes32 institutionAccreditationId =
            _issueValidInstitutionAccreditation();

        vm.prank(randomUser);

        vm.expectRevert(CredentialRegistry.UnauthorizedIssuer.selector);

        credentialRegistry.recordCredential(
            holder,
            CREDENTIAL_HASH,
            CREDENTIAL_TYPE,
            institutionAccreditationId,
            0
        );
    }

    function testCannotRecordCredentialWithNonInstitutionAccreditation() public {
        bytes32 memberStateAccreditationId =
            accreditationRegistry.issueAccreditation(
                memberState,
                AccreditationRegistry.AccreditationScope.MemberState,
                bytes32(0),
                bytes32(0),
                0
            );

        vm.prank(memberState);

        vm.expectRevert(CredentialRegistry.InvalidAccreditation.selector);

        credentialRegistry.recordCredential(
            holder,
            CREDENTIAL_HASH,
            CREDENTIAL_TYPE,
            memberStateAccreditationId,
            0
        );
    }

    function testCannotRecordCredentialWithRevokedIssuerAccreditation() public {
        bytes32 institutionAccreditationId =
            _issueValidInstitutionAccreditation();

        vm.prank(ministry);
        accreditationRegistry.revokeAccreditation(institutionAccreditationId);

        vm.prank(institution);

        vm.expectRevert(CredentialRegistry.InvalidAccreditation.selector);

        credentialRegistry.recordCredential(
            holder,
            CREDENTIAL_HASH,
            CREDENTIAL_TYPE,
            institutionAccreditationId,
            0
        );
    }

    function testCannotRecordCredentialWithExpiredIssuerAccreditation() public {
        uint256 expiresAt = block.timestamp + 1 days;

        bytes32 institutionAccreditationId =
            _issueValidInstitutionAccreditationWithExpiry(expiresAt);

        vm.warp(expiresAt + 1);

        vm.prank(institution);

        vm.expectRevert(CredentialRegistry.InvalidAccreditation.selector);

        credentialRegistry.recordCredential(
            holder,
            CREDENTIAL_HASH,
            CREDENTIAL_TYPE,
            institutionAccreditationId,
            0
        );
    }

    function testIssuerCanRevokeCredential() public {
        bytes32 credentialId = _recordValidCredential();

        vm.prank(institution);

        vm.expectEmit(true, true, false, true);
        emit CredentialRevoked(
            credentialId,
            institution,
            block.number,
            "mistake"
        );

        vm.expectEmit(true, false, false, true);
        emit CredentialStatusUpdated(
            credentialId,
            CredentialRegistry.CredentialStatus.Active,
            CredentialRegistry.CredentialStatus.Revoked
        );

        credentialRegistry.revokeCredential(credentialId, "mistake");

        assertFalse(credentialRegistry.isActive(credentialId));

        CredentialRegistry.CredentialStatus status =
            credentialRegistry.getCredentialStatus(credentialId);

        assertEq(
            uint256(status),
            uint256(CredentialRegistry.CredentialStatus.Revoked)
        );
    }

    function testRandomUserCannotRevokeCredential() public {
        bytes32 credentialId = _recordValidCredential();

        vm.prank(randomUser);

        vm.expectRevert(CredentialRegistry.Unauthorized.selector);

        credentialRegistry.revokeCredential(credentialId, "not allowed");
    }

    function testCannotRevokeMissingCredential() public {
        vm.expectRevert(CredentialRegistry.CredentialNotFound.selector);

        credentialRegistry.revokeCredential(bytes32("missing"), "missing");
    }

    function testCannotRevokeAlreadyRevokedCredential() public {
        bytes32 credentialId = _recordValidCredential();

        vm.startPrank(institution);

        credentialRegistry.revokeCredential(credentialId, "first");

        vm.expectRevert(CredentialRegistry.CredentialAlreadyRevoked.selector);

        credentialRegistry.revokeCredential(credentialId, "second");

        vm.stopPrank();
    }

    function testIssuerCanSuspendCredential() public {
        bytes32 credentialId = _recordValidCredential();

        vm.prank(institution);

        vm.expectEmit(true, true, false, true);
        emit CredentialSuspended(
            credentialId,
            institution,
            block.timestamp,
            "review"
        );

        vm.expectEmit(true, false, false, true);
        emit CredentialStatusUpdated(
            credentialId,
            CredentialRegistry.CredentialStatus.Active,
            CredentialRegistry.CredentialStatus.Suspended
        );

        credentialRegistry.suspendCredential(credentialId, "review");

        assertFalse(credentialRegistry.isActive(credentialId));

        CredentialRegistry.CredentialStatus status =
            credentialRegistry.getCredentialStatus(credentialId);

        assertEq(
            uint256(status),
            uint256(CredentialRegistry.CredentialStatus.Suspended)
        );
    }

    function testRandomUserCannotSuspendCredential() public {
        bytes32 credentialId = _recordValidCredential();

        vm.prank(randomUser);

        vm.expectRevert(CredentialRegistry.Unauthorized.selector);

        credentialRegistry.suspendCredential(credentialId, "not allowed");
    }

    function testIssuerCanReactivateSuspendedCredential() public {
        bytes32 credentialId = _recordValidCredential();

        vm.startPrank(institution);

        credentialRegistry.suspendCredential(credentialId, "review");

        vm.expectEmit(true, true, false, true);
        emit CredentialReactivated(
            credentialId,
            institution,
            block.timestamp
        );

        vm.expectEmit(true, false, false, true);
        emit CredentialStatusUpdated(
            credentialId,
            CredentialRegistry.CredentialStatus.Suspended,
            CredentialRegistry.CredentialStatus.Active
        );

        credentialRegistry.reactivateCredential(credentialId);

        vm.stopPrank();

        assertTrue(credentialRegistry.isActive(credentialId));

        CredentialRegistry.CredentialStatus status =
            credentialRegistry.getCredentialStatus(credentialId);

        assertEq(
            uint256(status),
            uint256(CredentialRegistry.CredentialStatus.Active)
        );
    }

    function testCannotReactivateNonSuspendedCredential() public {
        bytes32 credentialId = _recordValidCredential();

        vm.prank(institution);

        vm.expectRevert(CredentialRegistry.InvalidStatus.selector);

        credentialRegistry.reactivateCredential(credentialId);
    }

    function testRandomUserCannotReactivateCredential() public {
        bytes32 credentialId = _recordValidCredential();

        vm.prank(institution);
        credentialRegistry.suspendCredential(credentialId, "review");

        vm.prank(randomUser);

        vm.expectRevert(CredentialRegistry.Unauthorized.selector);

        credentialRegistry.reactivateCredential(credentialId);
    }

    function testGetCredentialStatusReturnsExpiredForExpiredCredential() public {
        uint256 expiresAt = block.timestamp + 1 days;

        bytes32 credentialId = _recordValidCredentialWithExpiry(expiresAt);

        vm.warp(expiresAt + 1);

        CredentialRegistry.CredentialStatus status =
            credentialRegistry.getCredentialStatus(credentialId);

        assertEq(
            uint256(status),
            uint256(CredentialRegistry.CredentialStatus.Expired)
        );

        assertFalse(credentialRegistry.isActive(credentialId));
    }

    function testVerifyCredentialReturnsValidForActiveCredential() public {
        bytes32 credentialId = _recordValidCredential();

        (
            bool isValid,
            CredentialRegistry.CredentialStatus status,
            bool trustChainValid
        ) = credentialRegistry.verifyCredential(credentialId);

        assertTrue(isValid);
        assertTrue(trustChainValid);
        assertEq(
            uint256(status),
            uint256(CredentialRegistry.CredentialStatus.Active)
        );
    }

    function testVerifyCredentialReturnsInvalidForRevokedCredential() public {
        bytes32 credentialId = _recordValidCredential();

        vm.prank(institution);
        credentialRegistry.revokeCredential(credentialId, "revoked");

        (
            bool isValid,
            CredentialRegistry.CredentialStatus status,
            bool trustChainValid
        ) = credentialRegistry.verifyCredential(credentialId);

        assertFalse(isValid);
        assertTrue(trustChainValid);
        assertEq(
            uint256(status),
            uint256(CredentialRegistry.CredentialStatus.Revoked)
        );
    }

    function testVerifyCredentialReturnsInvalidForMissingCredential() public view {
        (
            bool isValid,
            CredentialRegistry.CredentialStatus status,
            bool trustChainValid
        ) = credentialRegistry.verifyCredential(bytes32("missing"));

        assertFalse(isValid);
        assertFalse(trustChainValid);
        assertEq(
            uint256(status),
            uint256(CredentialRegistry.CredentialStatus.Revoked)
        );
    }

    function testGetCredentialsByHolder() public {
        bytes32 credentialId = _recordValidCredential();

        bytes32[] memory ids =
            credentialRegistry.getCredentialsByHolder(holder);

        assertEq(ids.length, 1);
        assertEq(ids[0], credentialId);
    }

    function testGetCredentialsByIssuer() public {
        bytes32 credentialId = _recordValidCredential();

        bytes32[] memory ids =
            credentialRegistry.getCredentialsByIssuer(institution);

        assertEq(ids.length, 1);
        assertEq(ids[0], credentialId);
    }

    function testBatchVerifyCredentials() public {
    bytes32 institutionAccreditationId =
        _issueValidInstitutionAccreditation();

    vm.prank(institution);

    bytes32 validCredentialId = credentialRegistry.recordCredential(
        holder,
        CREDENTIAL_HASH,
        CREDENTIAL_TYPE,
        institutionAccreditationId,
        0
    );

    vm.prank(institution);

    bytes32 revokedCredentialId = credentialRegistry.recordCredential(
        holder,
        keccak256("second-credential"),
        "Transcript",
        institutionAccreditationId,
        0
    );

    vm.prank(institution);

    credentialRegistry.revokeCredential(revokedCredentialId, "revoked");

    bytes32[] memory ids = new bytes32[](3);
    ids[0] = validCredentialId;
    ids[1] = revokedCredentialId;
    ids[2] = bytes32("missing");

    bool[] memory results = credentialRegistry.batchVerifyCredentials(ids);

    assertEq(results.length, 3);
    assertTrue(results[0]);
    assertFalse(results[1]);
    assertFalse(results[2]);
}

    function _recordValidCredential() private returns (bytes32) {
        return _recordValidCredentialWithExpiry(0);
    }

    function _recordValidCredentialWithExpiry(
        uint256 expiresAt
    ) private returns (bytes32) {
        bytes32 institutionAccreditationId =
            _issueValidInstitutionAccreditation();

        vm.prank(institution);

        return credentialRegistry.recordCredential(
            holder,
            CREDENTIAL_HASH,
            CREDENTIAL_TYPE,
            institutionAccreditationId,
            expiresAt
        );
    }

    function _issueValidInstitutionAccreditation()
        private
        returns (bytes32 institutionId)
    {
        return _issueValidInstitutionAccreditationWithExpiry(0);
    }

    function _issueValidInstitutionAccreditationWithExpiry(
        uint256 expiresAt
    ) private returns (bytes32 institutionId) {
        bytes32 memberStateId = accreditationRegistry.issueAccreditation(
            memberState,
            AccreditationRegistry.AccreditationScope.MemberState,
            bytes32(0),
            bytes32(0),
            0
        );

        vm.prank(memberState);

        bytes32 ministryId = accreditationRegistry.issueAccreditation(
            ministry,
            AccreditationRegistry.AccreditationScope.Ministry,
            memberStateId,
            bytes32(0),
            0
        );

        vm.prank(ministry);

        institutionId = accreditationRegistry.issueAccreditation(
            institution,
            AccreditationRegistry.AccreditationScope.Institution,
            ministryId,
            bytes32(0),
            expiresAt
        );
    }
}
