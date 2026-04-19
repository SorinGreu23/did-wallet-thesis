// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title EURootAuthority
 * @notice Root of trust for the EU DID system with three-layer trust anchor
 */
contract EURootAuthority {
    // ============ Immutable Trust Anchors ============

    /// @notice Genesis block hash for cryptographic anchoring
    bytes32 public immutable GENESIS_BLOCK_HASH;

    /// @notice Block number when contract was deployed
    uint256 public immutable DEPLOYMENT_BLOCK;

    /// @notice Official EU DID document identifier (did:web:europa.eu)
    string public OFFICIAL_DID_DOCUMENT;

    // ============ Ownership ============

    /// @notice Contract owner (EU Root deployer)
    address public immutable owner;

    // ============ Member State Management ============

    /// @notice EU member state addresses
    mapping(address => bool) public memberStates;

    /// @notice Member state metadata
    mapping(address => MemberStateInfo) public memberStateInfo;

    /// @notice Array of all member state addresses
    address[] public memberStateList;

    struct MemberStateInfo {
        string countryCode;  // ISO 3166-1 alpha-2 (e.g., "RO", "DE")
        string didDocument;  // DID for the member state
        uint256 addedAt;
        bool active;
    }

    // ============ Events ============

    event MemberStateAdded(address indexed stateAddress, string countryCode, string didDocument);
    event MemberStateRemoved(address indexed stateAddress, string countryCode);
    event MemberStateUpdated(address indexed stateAddress, string didDocument);

    // ============ Errors ============

    error NotOwner();
    error NotMemberState();
    error AlreadyMemberState();
    error MemberStateNotFound();

    // ============ Constructor ============

    constructor(
        bytes32 _genesisBlockHash,
        string memory _officialDID
    ) {
        GENESIS_BLOCK_HASH = _genesisBlockHash;
        DEPLOYMENT_BLOCK = block.number;
        OFFICIAL_DID_DOCUMENT = _officialDID;
        owner = msg.sender;
    }

    // ============ Member State Management ============

    /**
     * @notice Add a member state (owner only)
     * @param stateAddress Address of the member state
     * @param countryCode ISO 3166-1 alpha-2 country code
     * @param didDocument DID document for the member state
     */
    function addMemberState(
        address stateAddress,
        string memory countryCode,
        string memory didDocument
    ) external {
        if (msg.sender != owner) revert NotOwner();
        if (memberStates[stateAddress]) revert AlreadyMemberState();

        memberStates[stateAddress] = true;
        memberStateInfo[stateAddress] = MemberStateInfo({
            countryCode: countryCode,
            didDocument: didDocument,
            addedAt: block.timestamp,
            active: true
        });
        memberStateList.push(stateAddress);

        emit MemberStateAdded(stateAddress, countryCode, didDocument);
    }

    /**
     * @notice Remove a member state (owner only)
     * @param stateAddress Address of the member state to remove
     */
    function removeMemberState(address stateAddress) external {
        if (msg.sender != owner) revert NotOwner();
        if (!memberStates[stateAddress]) revert MemberStateNotFound();

        memberStateInfo[stateAddress].active = false;

        emit MemberStateRemoved(stateAddress, memberStateInfo[stateAddress].countryCode);
    }

    /**
     * @notice Update a member state's DID document (owner only)
     * @param stateAddress Address of the member state
     * @param didDocument New DID document
     */
    function updateMemberState(address stateAddress, string memory didDocument) external {
        if (msg.sender != owner) revert NotOwner();
        if (!memberStates[stateAddress]) revert MemberStateNotFound();

        memberStateInfo[stateAddress].didDocument = didDocument;

        emit MemberStateUpdated(stateAddress, didDocument);
    }

    /**
     * @notice Check if an address is a member state
     * @param state Address to check
     * @return bool True if address is an active member state
     */
    function isMemberState(address state) external view returns (bool) {
        return memberStates[state] && memberStateInfo[state].active;
    }

    /**
     * @notice Get member state information
     * @param state Address of member state
     * @return MemberStateInfo Struct containing member state details
     */
    function getMemberStateInfo(address state) external view returns (MemberStateInfo memory) {
        return memberStateInfo[state];
    }

    /**
     * @notice Get all member states
     * @return address[] Array of member state addresses
     */
    function getAllMemberStates() external view returns (address[] memory) {
        return memberStateList;
    }

    /**
     * @notice Get active member state count
     * @return uint256 Number of active member states
     */
    function getActiveMemberStateCount() external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < memberStateList.length; i++) {
            if (memberStateInfo[memberStateList[i]].active) {
                count++;
            }
        }
        return count;
    }
}
