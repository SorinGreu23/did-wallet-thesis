// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../contracts/ZkpVerifierRegistry.sol";

contract ZkpVerifierRegistryTest is Test {
    ZkpVerifierRegistry private registry;

    address private owner = address(this);
    address private randomUser = address(0x9999);

    bytes32 private constant AGE_VKEY_HASH =
        keccak256("ageVerification-vkey");
    bytes32 private constant GRADUATION_VKEY_HASH =
        keccak256("graduationYearRange-vkey");
    bytes32 private constant COUNTRY_VKEY_HASH =
        keccak256("countryMembership-vkey");

    function setUp() public {
        registry = new ZkpVerifierRegistry();
    }

    function testConstructorStoresOwner() public view {
        assertEq(registry.owner(), owner);
    }

    function testOwnerCanRegisterCircuit() public {
        registry.register("ageVerification", AGE_VKEY_HASH, 1);

        ZkpVerifierRegistry.CircuitRecord memory record =
            registry.get("ageVerification");

        assertEq(record.vKeyHash, AGE_VKEY_HASH);
        assertEq(record.version, 1);
        assertEq(record.registeredAt, uint64(block.timestamp));
        assertTrue(record.active);
        assertTrue(registry.exists("ageVerification"));
        assertTrue(registry.isActive("ageVerification"));
    }

    function testRegisterEmitsEvent() public {
        vm.expectEmit(true, true, false, true);

        emit ZkpVerifierRegistry.CircuitRegistered(
            "ageVerification",
            AGE_VKEY_HASH,
            1
        );

        registry.register("ageVerification", AGE_VKEY_HASH, 1);
    }

    function testOwnerCanRegisterMultipleCircuits() public {
        registry.register("ageVerification", AGE_VKEY_HASH, 1);
        registry.register("graduationYearRange", GRADUATION_VKEY_HASH, 1);
        registry.register("countryMembership", COUNTRY_VKEY_HASH, 1);

        ZkpVerifierRegistry.CircuitRecord memory age =
            registry.get("ageVerification");

        ZkpVerifierRegistry.CircuitRecord memory graduation =
            registry.get("graduationYearRange");

        ZkpVerifierRegistry.CircuitRecord memory country =
            registry.get("countryMembership");

        assertEq(age.vKeyHash, AGE_VKEY_HASH);
        assertEq(graduation.vKeyHash, GRADUATION_VKEY_HASH);
        assertEq(country.vKeyHash, COUNTRY_VKEY_HASH);

        assertTrue(age.active);
        assertTrue(graduation.active);
        assertTrue(country.active);
    }

    function testOwnerCanUpdateExistingCircuit() public {
        registry.register("ageVerification", AGE_VKEY_HASH, 1);

        bytes32 newHash = keccak256("ageVerification-vkey-v2");

        vm.warp(block.timestamp + 1 days);

        registry.register("ageVerification", newHash, 2);

        ZkpVerifierRegistry.CircuitRecord memory record =
            registry.get("ageVerification");

        assertEq(record.vKeyHash, newHash);
        assertEq(record.version, 2);
        assertEq(record.registeredAt, uint64(block.timestamp));
        assertTrue(record.active);
    }

    function testNonOwnerCannotRegisterCircuit() public {
        vm.prank(randomUser);

        vm.expectRevert(ZkpVerifierRegistry.Unauthorized.selector);

        registry.register("ageVerification", AGE_VKEY_HASH, 1);
    }

    function testCannotRegisterEmptyName() public {
        vm.expectRevert(ZkpVerifierRegistry.InvalidCircuitName.selector);

        registry.register("", AGE_VKEY_HASH, 1);
    }

    function testCannotRegisterZeroHash() public {
        vm.expectRevert(ZkpVerifierRegistry.InvalidVKeyHash.selector);

        registry.register("ageVerification", bytes32(0), 1);
    }

    function testCannotRegisterZeroVersion() public {
        vm.expectRevert(ZkpVerifierRegistry.InvalidVersion.selector);

        registry.register("ageVerification", AGE_VKEY_HASH, 0);
    }

    function testOwnerCanDeactivateCircuit() public {
        registry.register("ageVerification", AGE_VKEY_HASH, 1);

        registry.deactivate("ageVerification");

        ZkpVerifierRegistry.CircuitRecord memory record =
            registry.get("ageVerification");

        assertFalse(record.active);
        assertFalse(registry.isActive("ageVerification"));
        assertTrue(registry.exists("ageVerification"));
    }

    function testDeactivateEmitsEvent() public {
        registry.register("ageVerification", AGE_VKEY_HASH, 1);

        vm.expectEmit(true, false, false, true);

        emit ZkpVerifierRegistry.CircuitDeactivated("ageVerification");

        registry.deactivate("ageVerification");
    }

    function testNonOwnerCannotDeactivateCircuit() public {
        registry.register("ageVerification", AGE_VKEY_HASH, 1);

        vm.prank(randomUser);

        vm.expectRevert(ZkpVerifierRegistry.Unauthorized.selector);

        registry.deactivate("ageVerification");
    }

    function testCannotDeactivateMissingCircuit() public {
        vm.expectRevert(ZkpVerifierRegistry.CircuitNotFound.selector);

        registry.deactivate("missingCircuit");
    }

    function testCannotDeactivateAlreadyInactiveCircuit() public {
        registry.register("ageVerification", AGE_VKEY_HASH, 1);
        registry.deactivate("ageVerification");

        vm.expectRevert(ZkpVerifierRegistry.CircuitAlreadyInactive.selector);

        registry.deactivate("ageVerification");
    }

    function testGetMissingCircuitReverts() public {
        vm.expectRevert(ZkpVerifierRegistry.CircuitNotFound.selector);

        registry.get("missingCircuit");
    }

    function testExistsReturnsFalseForMissingCircuit() public view {
        assertFalse(registry.exists("missingCircuit"));
    }

    function testIsActiveReturnsFalseForMissingCircuit() public view {
        assertFalse(registry.isActive("missingCircuit"));
    }
}
