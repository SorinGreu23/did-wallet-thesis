// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../contracts/EURootAuthority.sol";

contract EURootAuthorityTest is Test {
    EURootAuthority private rootAuthority;

    bytes32 private constant GENESIS_BLOCK_HASH =
        keccak256("EU_DID_WALLET_GENESIS");
    string private constant OFFICIAL_DID = "did:web:europa.eu";

    address private owner = address(this);
    address private memberState = address(0xBEEF);
    address private anotherMemberState = address(0xCAFE);
    address private nonOwner = address(0xBAD);

    event MemberStateAdded(
        address indexed stateAddress,
        string countryCode,
        string didDocument
    );

    event MemberStateRemoved(
        address indexed stateAddress,
        string countryCode
    );

    event MemberStateUpdated(
        address indexed stateAddress,
        string didDocument
    );

    function setUp() public {
        rootAuthority = new EURootAuthority(
            GENESIS_BLOCK_HASH,
            OFFICIAL_DID
        );
    }

    function testConstructorStoresTrustAnchorsAndOwner() public view {
        assertEq(rootAuthority.GENESIS_BLOCK_HASH(), GENESIS_BLOCK_HASH);
        assertEq(rootAuthority.OFFICIAL_DID_DOCUMENT(), OFFICIAL_DID);
        assertEq(rootAuthority.owner(), owner);
        assertEq(rootAuthority.DEPLOYMENT_BLOCK(), block.number);
    }

    function testOwnerCanAddMemberState() public {
        vm.expectEmit(true, false, false, true);
        emit MemberStateAdded(memberState, "RO", "did:web:gov.ro");

        rootAuthority.addMemberState(
            memberState,
            "RO",
            "did:web:gov.ro"
        );

        assertTrue(rootAuthority.isMemberState(memberState));
        assertEq(rootAuthority.getActiveMemberStateCount(), 1);

        EURootAuthority.MemberStateInfo memory info =
            rootAuthority.getMemberStateInfo(memberState);

        assertEq(info.countryCode, "RO");
        assertEq(info.didDocument, "did:web:gov.ro");
        assertEq(info.addedAt, block.timestamp);
        assertTrue(info.active);
    }

    function testNonOwnerCannotAddMemberState() public {
        vm.prank(nonOwner);

        vm.expectRevert(EURootAuthority.NotOwner.selector);

        rootAuthority.addMemberState(
            memberState,
            "RO",
            "did:web:gov.ro"
        );
    }

    function testCannotAddSameMemberStateTwice() public {
        rootAuthority.addMemberState(
            memberState,
            "RO",
            "did:web:gov.ro"
        );

        vm.expectRevert(EURootAuthority.AlreadyMemberState.selector);

        rootAuthority.addMemberState(
            memberState,
            "RO",
            "did:web:gov.ro"
        );
    }

    function testOwnerCanUpdateMemberStateDidDocument() public {
        rootAuthority.addMemberState(
            memberState,
            "RO",
            "did:web:gov.ro"
        );

        vm.expectEmit(true, false, false, true);
        emit MemberStateUpdated(memberState, "did:web:romania.eu");

        rootAuthority.updateMemberState(
            memberState,
            "did:web:romania.eu"
        );

        EURootAuthority.MemberStateInfo memory info =
            rootAuthority.getMemberStateInfo(memberState);

        assertEq(info.countryCode, "RO");
        assertEq(info.didDocument, "did:web:romania.eu");
        assertTrue(info.active);
    }

    function testNonOwnerCannotUpdateMemberState() public {
        rootAuthority.addMemberState(
            memberState,
            "RO",
            "did:web:gov.ro"
        );

        vm.prank(nonOwner);

        vm.expectRevert(EURootAuthority.NotOwner.selector);

        rootAuthority.updateMemberState(
            memberState,
            "did:web:romania.eu"
        );
    }

    function testCannotUpdateUnknownMemberState() public {
        vm.expectRevert(EURootAuthority.MemberStateNotFound.selector);

        rootAuthority.updateMemberState(
            memberState,
            "did:web:romania.eu"
        );
    }

    function testOwnerCanRemoveMemberState() public {
        rootAuthority.addMemberState(
            memberState,
            "RO",
            "did:web:gov.ro"
        );

        vm.expectEmit(true, false, false, true);
        emit MemberStateRemoved(memberState, "RO");

        rootAuthority.removeMemberState(memberState);

        assertFalse(rootAuthority.isMemberState(memberState));
        assertEq(rootAuthority.getActiveMemberStateCount(), 0);

        EURootAuthority.MemberStateInfo memory info =
            rootAuthority.getMemberStateInfo(memberState);

        assertEq(info.countryCode, "RO");
        assertEq(info.didDocument, "did:web:gov.ro");
        assertFalse(info.active);
    }

    function testNonOwnerCannotRemoveMemberState() public {
        rootAuthority.addMemberState(
            memberState,
            "RO",
            "did:web:gov.ro"
        );

        vm.prank(nonOwner);

        vm.expectRevert(EURootAuthority.NotOwner.selector);

        rootAuthority.removeMemberState(memberState);
    }

    function testCannotRemoveUnknownMemberState() public {
        vm.expectRevert(EURootAuthority.MemberStateNotFound.selector);

        rootAuthority.removeMemberState(memberState);
    }

    function testGetAllMemberStatesReturnsAddedAddresses() public {
        rootAuthority.addMemberState(
            memberState,
            "RO",
            "did:web:gov.ro"
        );

        rootAuthority.addMemberState(
            anotherMemberState,
            "DE",
            "did:web:bund.de"
        );

        address[] memory states = rootAuthority.getAllMemberStates();

        assertEq(states.length, 2);
        assertEq(states[0], memberState);
        assertEq(states[1], anotherMemberState);
    }

    function testActiveMemberStateCountIgnoresRemovedStates() public {
        rootAuthority.addMemberState(
            memberState,
            "RO",
            "did:web:gov.ro"
        );

        rootAuthority.addMemberState(
            anotherMemberState,
            "DE",
            "did:web:bund.de"
        );

        assertEq(rootAuthority.getActiveMemberStateCount(), 2);

        rootAuthority.removeMemberState(memberState);

        assertEq(rootAuthority.getActiveMemberStateCount(), 1);
        assertFalse(rootAuthority.isMemberState(memberState));
        assertTrue(rootAuthority.isMemberState(anotherMemberState));
    }
}