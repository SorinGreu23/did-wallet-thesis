// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../contracts/EURootAuthority.sol";
import "../contracts/AccreditationRegistry.sol";

contract AccreditationRegistryTest is Test {
    EURootAuthority private rootAuthority;
    AccreditationRegistry private registry;

    bytes32 private constant GENESIS_BLOCK_HASH =
    keccak256("EU_DID_WALLET_GENESIS");

    address private root = address(this);
    address private memberState = address(0x1001);
    address private ministry = address(0x1002);
    address private institution = address(0x1003);
    address private department = address(0x1004);
    address private businessRegistry = address(0x1005);
    address private enterprise = address(0x1006);
    address private randomUser = address(0x9999);

    function setUp() public {
        rootAuthority = new EURootAuthority(
            GENESIS_BLOCK_HASH,
            "did:web:europa.eu"
        );

        registry = new AccreditationRegistry(address(rootAuthority));
    }

    function testConstructorStoresRootAuthorityAndOwner() public view {
        assertEq(address(registry.rootAuthority()), address(rootAuthority));
        assertEq(registry.owner(), root);
    }

    function testOwnerCanIssueMemberStateAccreditation() public {
        bytes32 id = registry.issueAccreditation(
            memberState,
            AccreditationRegistry.AccreditationScope.MemberState,
            bytes32(0),
            bytes32(0),
            0
        );

        AccreditationRegistry.Accreditation memory accred =
                            registry.getAccreditation(id);

        assertEq(accred.id, id);
        assertEq(accred.issuer, root);
        assertEq(accred.subject, memberState);
        assertEq(
            uint256(accred.scope),
            uint256(AccreditationRegistry.AccreditationScope.MemberState)
        );
        assertEq(accred.parentAccreditationId, bytes32(0));
        assertFalse(accred.revoked);
        assertTrue(accred.exists);

        assertTrue(registry.validateTrustChain(id));
    }

    function testNonOwnerCannotIssueMemberStateAccreditation() public {
        vm.prank(randomUser);

        vm.expectRevert(AccreditationRegistry.NotMemberState.selector);

        registry.issueAccreditation(
            memberState,
            AccreditationRegistry.AccreditationScope.MemberState,
            bytes32(0),
            bytes32(0),
            0
        );
    }

    function testOwnerCanIssueMinistryWithoutParent() public {
        bytes32 ministryId = registry.issueAccreditation(
            ministry,
            AccreditationRegistry.AccreditationScope.Ministry,
            bytes32(0),
            bytes32(0),
            0
        );

        assertTrue(registry.validateTrustChain(ministryId));

        AccreditationRegistry.Accreditation memory accred =
                            registry.getAccreditation(ministryId);

        assertEq(accred.subject, ministry);
        assertEq(
            uint256(accred.scope),
            uint256(AccreditationRegistry.AccreditationScope.Ministry)
        );
    }

    function testMemberStateCanIssueMinistryWithValidParent() public {
        bytes32 memberStateId = registry.issueAccreditation(
            memberState,
            AccreditationRegistry.AccreditationScope.MemberState,
            bytes32(0),
            bytes32(0),
            0
        );

        vm.prank(memberState);

        bytes32 ministryId = registry.issueAccreditation(
            ministry,
            AccreditationRegistry.AccreditationScope.Ministry,
            memberStateId,
            bytes32(0),
            0
        );

        assertTrue(registry.validateTrustChain(ministryId));

        AccreditationRegistry.Accreditation memory accred =
                            registry.getAccreditation(ministryId);

        assertEq(accred.issuer, memberState);
        assertEq(accred.subject, ministry);
        assertEq(accred.parentAccreditationId, memberStateId);
    }

    function testCannotIssueMinistryWithInvalidParent() public {
        vm.prank(memberState);

        vm.expectRevert(AccreditationRegistry.InvalidParentAccreditation.selector);

        registry.issueAccreditation(
            ministry,
            AccreditationRegistry.AccreditationScope.Ministry,
            bytes32("missing-parent"),
            bytes32(0),
            0
        );
    }

    function testMinistryCanIssueInstitutionWithValidParent() public {
        bytes32 memberStateId = registry.issueAccreditation(
            memberState,
            AccreditationRegistry.AccreditationScope.MemberState,
            bytes32(0),
            bytes32(0),
            0
        );

        vm.prank(memberState);

        bytes32 ministryId = registry.issueAccreditation(
            ministry,
            AccreditationRegistry.AccreditationScope.Ministry,
            memberStateId,
            bytes32(0),
            0
        );

        vm.prank(ministry);

        bytes32 institutionId = registry.issueAccreditation(
            institution,
            AccreditationRegistry.AccreditationScope.Institution,
            ministryId,
            bytes32(0),
            0
        );

        assertTrue(registry.validateTrustChain(institutionId));

        AccreditationRegistry.Accreditation memory accred =
                            registry.getAccreditation(institutionId);

        assertEq(accred.issuer, ministry);
        assertEq(accred.subject, institution);
        assertEq(accred.parentAccreditationId, ministryId);
    }

    function testCannotIssueInstitutionWithoutParent() public {
        vm.expectRevert(AccreditationRegistry.InvalidParentAccreditation.selector);

        registry.issueAccreditation(
            institution,
            AccreditationRegistry.AccreditationScope.Institution,
            bytes32(0),
            bytes32(0),
            0
        );
    }

    function testInstitutionCanIssueDepartmentWithValidParent() public {
        bytes32 institutionId = _issueValidInstitutionAccreditation();

        vm.prank(institution);

        bytes32 departmentId = registry.issueAccreditation(
            department,
            AccreditationRegistry.AccreditationScope.Department,
            institutionId,
            bytes32(0),
            0
        );

        assertTrue(registry.validateTrustChain(departmentId));

        AccreditationRegistry.Accreditation memory accred =
                            registry.getAccreditation(departmentId);

        assertEq(accred.issuer, institution);
        assertEq(accred.subject, department);
        assertEq(accred.parentAccreditationId, institutionId);
    }

    function testMemberStateCanIssueBusinessRegistryWithValidParent() public {
        bytes32 businessRegistryId = _issueValidBusinessRegistryAccreditation();

        assertTrue(registry.validateTrustChain(businessRegistryId));

        AccreditationRegistry.Accreditation memory accred =
                            registry.getAccreditation(businessRegistryId);

        assertEq(accred.issuer, memberState);
        assertEq(accred.subject, businessRegistry);
        assertEq(
            uint256(accred.scope),
            uint256(AccreditationRegistry.AccreditationScope.BusinessRegistry)
        );
    }

    function testCannotIssueBusinessRegistryFromMinistry() public {
        bytes32 memberStateId = registry.issueAccreditation(
            memberState,
            AccreditationRegistry.AccreditationScope.MemberState,
            bytes32(0),
            bytes32(0),
            0
        );

        vm.prank(memberState);

        bytes32 ministryId = registry.issueAccreditation(
            ministry,
            AccreditationRegistry.AccreditationScope.Ministry,
            memberStateId,
            bytes32(0),
            0
        );

        vm.prank(ministry);

        vm.expectRevert(AccreditationRegistry.InvalidScope.selector);

        registry.issueAccreditation(
            businessRegistry,
            AccreditationRegistry.AccreditationScope.BusinessRegistry,
            ministryId,
            bytes32(0),
            0
        );
    }

    function testBusinessRegistryCanIssueEnterpriseWithValidParent() public {
        bytes32 businessRegistryId = _issueValidBusinessRegistryAccreditation();

        vm.prank(businessRegistry);

        bytes32 enterpriseId = registry.issueAccreditation(
            enterprise,
            AccreditationRegistry.AccreditationScope.Enterprise,
            businessRegistryId,
            bytes32(0),
            0
        );

        assertTrue(registry.validateTrustChain(enterpriseId));

        AccreditationRegistry.Accreditation memory accred =
                            registry.getAccreditation(enterpriseId);

        assertEq(accred.issuer, businessRegistry);
        assertEq(accred.subject, enterprise);
        assertEq(accred.parentAccreditationId, businessRegistryId);
        assertEq(
            uint256(accred.scope),
            uint256(AccreditationRegistry.AccreditationScope.Enterprise)
        );
    }

    function testCannotIssueEnterpriseFromMinistry() public {
        bytes32 memberStateId = registry.issueAccreditation(
            memberState,
            AccreditationRegistry.AccreditationScope.MemberState,
            bytes32(0),
            bytes32(0),
            0
        );

        vm.prank(memberState);

        bytes32 ministryId = registry.issueAccreditation(
            ministry,
            AccreditationRegistry.AccreditationScope.Ministry,
            memberStateId,
            bytes32(0),
            0
        );

        vm.prank(ministry);

        vm.expectRevert(AccreditationRegistry.InvalidScope.selector);

        registry.issueAccreditation(
            enterprise,
            AccreditationRegistry.AccreditationScope.Enterprise,
            ministryId,
            bytes32(0),
            0
        );
    }

    function testEnterpriseTrustChainReturnsRootToTargetOrder() public {
        bytes32 businessRegistryId = _issueValidBusinessRegistryAccreditation();

        vm.prank(businessRegistry);

        bytes32 enterpriseId = registry.issueAccreditation(
            enterprise,
            AccreditationRegistry.AccreditationScope.Enterprise,
            businessRegistryId,
            bytes32(0),
            0
        );

        bytes32[] memory chain = registry.getTrustChain(enterpriseId);

        assertEq(chain.length, 3);

        AccreditationRegistry.Accreditation memory memberStateAccred =
                            registry.getAccreditation(chain[0]);

        AccreditationRegistry.Accreditation memory businessRegistryAccred =
                            registry.getAccreditation(chain[1]);

        AccreditationRegistry.Accreditation memory enterpriseAccred =
                            registry.getAccreditation(chain[2]);

        assertEq(
            uint256(memberStateAccred.scope),
            uint256(AccreditationRegistry.AccreditationScope.MemberState)
        );
        assertEq(
            uint256(businessRegistryAccred.scope),
            uint256(AccreditationRegistry.AccreditationScope.BusinessRegistry)
        );
        assertEq(
            uint256(enterpriseAccred.scope),
            uint256(AccreditationRegistry.AccreditationScope.Enterprise)
        );

        assertEq(chain[2], enterpriseId);
    }

    function testHasValidAccreditationReturnsTrueForValidScope() public {
        bytes32 institutionId = _issueValidInstitutionAccreditation();

        assertTrue(registry.validateTrustChain(institutionId));

        bool hasInstitutionScope = registry.hasValidAccreditation(
            institution,
            AccreditationRegistry.AccreditationScope.Institution
        );

        assertTrue(hasInstitutionScope);
    }

    function testHasValidAccreditationReturnsTrueForEnterpriseScope() public {
        bytes32 businessRegistryId = _issueValidBusinessRegistryAccreditation();

        vm.prank(businessRegistry);

        registry.issueAccreditation(
            enterprise,
            AccreditationRegistry.AccreditationScope.Enterprise,
            businessRegistryId,
            bytes32(0),
            0
        );

        bool hasEnterpriseScope = registry.hasValidAccreditation(
            enterprise,
            AccreditationRegistry.AccreditationScope.Enterprise
        );

        assertTrue(hasEnterpriseScope);
    }

    function testHasValidAccreditationReturnsFalseForWrongScope() public {
        _issueValidInstitutionAccreditation();

        bool hasMinistryScope = registry.hasValidAccreditation(
            institution,
            AccreditationRegistry.AccreditationScope.Ministry
        );

        assertFalse(hasMinistryScope);
    }

    function testIssuerCanRevokeAccreditation() public {
        bytes32 institutionId = _issueValidInstitutionAccreditation();

        vm.prank(ministry);

        registry.revokeAccreditation(institutionId);

        AccreditationRegistry.Accreditation memory accred =
                            registry.getAccreditation(institutionId);

        assertTrue(accred.revoked);
        assertFalse(registry.validateTrustChain(institutionId));
    }

    function testOwnerCanRevokeAnyAccreditation() public {
        bytes32 institutionId = _issueValidInstitutionAccreditation();

        registry.revokeAccreditation(institutionId);

        AccreditationRegistry.Accreditation memory accred =
                            registry.getAccreditation(institutionId);

        assertTrue(accred.revoked);
        assertFalse(registry.validateTrustChain(institutionId));
    }

    function testRandomUserCannotRevokeAccreditation() public {
        bytes32 institutionId = _issueValidInstitutionAccreditation();

        vm.prank(randomUser);

        vm.expectRevert("Unauthorized to revoke");

        registry.revokeAccreditation(institutionId);
    }

    function testCannotRevokeMissingAccreditation() public {
        vm.expectRevert(AccreditationRegistry.AccreditationNotFound.selector);

        registry.revokeAccreditation(bytes32("missing"));
    }

    function testExpiredAccreditationFailsTrustChain() public {
        uint256 expiresAt = block.timestamp + 1 days;

        bytes32 memberStateId = registry.issueAccreditation(
            memberState,
            AccreditationRegistry.AccreditationScope.MemberState,
            bytes32(0),
            bytes32(0),
            expiresAt
        );

        assertTrue(registry.validateTrustChain(memberStateId));

        vm.warp(expiresAt + 1);

        assertFalse(registry.validateTrustChain(memberStateId));
    }

    function testGetAccreditationsBySubject() public {
        bytes32 institutionId = _issueValidInstitutionAccreditation();

        bytes32[] memory ids = registry.getAccreditationsBySubject(institution);

        assertEq(ids.length, 1);
        assertEq(ids[0], institutionId);
    }

    function testGetAccreditationsByIssuer() public {
        bytes32 institutionId = _issueValidInstitutionAccreditation();

        bytes32[] memory ids = registry.getAccreditationsByIssuer(ministry);

        assertEq(ids.length, 1);
        assertEq(ids[0], institutionId);
    }

    function testGetTrustChainReturnsRootToTargetOrder() public {
        bytes32 institutionId = _issueValidInstitutionAccreditation();

        bytes32[] memory chain = registry.getTrustChain(institutionId);

        assertEq(chain.length, 3);

        AccreditationRegistry.Accreditation memory memberStateAccred =
                            registry.getAccreditation(chain[0]);

        AccreditationRegistry.Accreditation memory ministryAccred =
                            registry.getAccreditation(chain[1]);

        AccreditationRegistry.Accreditation memory institutionAccred =
                            registry.getAccreditation(chain[2]);

        assertEq(
            uint256(memberStateAccred.scope),
            uint256(AccreditationRegistry.AccreditationScope.MemberState)
        );
        assertEq(
            uint256(ministryAccred.scope),
            uint256(AccreditationRegistry.AccreditationScope.Ministry)
        );
        assertEq(
            uint256(institutionAccred.scope),
            uint256(AccreditationRegistry.AccreditationScope.Institution)
        );

        assertEq(chain[2], institutionId);
    }

    function _issueValidInstitutionAccreditation()
    private
    returns (bytes32 institutionId)
    {
        bytes32 memberStateId = registry.issueAccreditation(
            memberState,
            AccreditationRegistry.AccreditationScope.MemberState,
            bytes32(0),
            bytes32(0),
            0
        );

        vm.prank(memberState);

        bytes32 ministryId = registry.issueAccreditation(
            ministry,
            AccreditationRegistry.AccreditationScope.Ministry,
            memberStateId,
            bytes32(0),
            0
        );

        vm.prank(ministry);

        institutionId = registry.issueAccreditation(
            institution,
            AccreditationRegistry.AccreditationScope.Institution,
            ministryId,
            bytes32(0),
            0
        );
    }

    function _issueValidBusinessRegistryAccreditation()
    private
    returns (bytes32 businessRegistryId)
    {
        bytes32 memberStateId = registry.issueAccreditation(
            memberState,
            AccreditationRegistry.AccreditationScope.MemberState,
            bytes32(0),
            bytes32(0),
            0
        );

        vm.prank(memberState);

        businessRegistryId = registry.issueAccreditation(
            businessRegistry,
            AccreditationRegistry.AccreditationScope.BusinessRegistry,
            memberStateId,
            bytes32(0),
            0
        );
    }
}
