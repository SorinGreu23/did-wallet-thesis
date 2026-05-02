// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console2.sol";

import "../contracts/EURootAuthority.sol";
import "../contracts/AccreditationRegistry.sol";
import "../contracts/CredentialRegistry.sol";

contract Deploy is Script {
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

        vm.stopBroadcast();

        console2.log("EURootAuthority:", address(rootAuthority));
        console2.log("AccreditationRegistry:", address(accreditationRegistry));
        console2.log("CredentialRegistry:", address(credentialRegistry));
    }
}