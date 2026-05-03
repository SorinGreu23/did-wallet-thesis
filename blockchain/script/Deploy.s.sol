// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console2.sol";

import "../contracts/EURootAuthority.sol";
import "../contracts/AccreditationRegistry.sol";
import "../contracts/CredentialRegistry.sol";
import "../contracts/ZkpVerifierRegistry.sol";

contract Deploy is Script {

    bytes32 private constant AGE_VERIFICATION_VKEY_HASH =
    keccak256(bytes("ageVerification-vkey-placeholder"));

    bytes32 private constant GRADUATION_YEAR_RANGE_VKEY_HASH =
        keccak256(bytes("graduationYearRange-vkey-placeholder"));

    bytes32 private constant COUNTRY_MEMBERSHIP_VKEY_HASH =
        keccak256(bytes("countryMembership-vkey-placeholder"));

    function run() external {
        vm.startBroadcast();

        bytes32 genesisBlockHash = keccak256(bytes("EU_DID_WALLET_GENESIS"));
        string memory officialDID = "did:web:europa.eu";

        EURootAuthority rootAuthority = new EURootAuthority(
            genesisBlockHash,
            officialDID
        );

        rootAuthority.addMemberState(
            msg.sender,
            "RO",
            "did:web:gov.ro"
        );

        AccreditationRegistry accreditationRegistry =
            new AccreditationRegistry(address(rootAuthority));

        CredentialRegistry credentialRegistry =
            new CredentialRegistry(address(accreditationRegistry));

        ZkpVerifierRegistry zkpVerifierRegistry =
            new ZkpVerifierRegistry();

        zkpVerifierRegistry.register(
            "ageVerification",
            AGE_VERIFICATION_VKEY_HASH,
            1
        );

        zkpVerifierRegistry.register(
            "graduationYearRange",
            GRADUATION_YEAR_RANGE_VKEY_HASH,
            1
        );

        zkpVerifierRegistry.register(
            "countryMembership",
            COUNTRY_MEMBERSHIP_VKEY_HASH,
            1
        );

        vm.stopBroadcast();

        console2.log("EURootAuthority:", address(rootAuthority));
        console2.log("AccreditationRegistry:", address(accreditationRegistry));
        console2.log("CredentialRegistry:", address(credentialRegistry));
        console2.log("ZkpVerifierRegistry:", address(zkpVerifierRegistry));
    }
}