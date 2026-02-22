// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title EURootAuthority
 * @notice Root of trust for the EU DID system with three-layer trust anchor
 * @dev Implements multi-sig governance and deployment ceremony validation
 */
contract EURootAuthority {
    // ============ Immutable Trust Anchors ============

    /// @notice Genesis block hash for cryptographic anchoring
    bytes32 public immutable GENESIS_BLOCK_HASH;

    /// @notice Block number when contract was deployed
    uint256 public immutable DEPLOYMENT_BLOCK;

    /// @notice Official EU DID document identifier (did:web:europa.eu)
    string public OFFICIAL_DID_DOCUMENT;

    // ============ Deployment Ceremony ============

    /// @notice Minimum required witness signatures (18 out of 27 EU member states)
    uint256 public constant MIN_WITNESS_SIGNATURES = 18;

    /// @notice Total EU member states
    uint256 public constant TOTAL_MEMBER_STATES = 27;

    /// @notice Deployment ceremony witness signatures
    mapping(address => bool) public deploymentWitnesses;

    /// @notice Count of valid witness signatures
    uint256 public witnessCount;

    /// @notice Deployment ceremony completed flag
    bool public deploymentCeremonyCompleted;

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

    // ============ Multi-Sig Governance ============

    /// @notice Governance proposals
    mapping(bytes32 => Proposal) public proposals;

    /// @notice Proposal votes
    mapping(bytes32 => mapping(address => bool)) public proposalVotes;

    /// @notice Required approval percentage (66% = 2/3 majority)
    uint256 public constant APPROVAL_THRESHOLD = 66;

    struct Proposal {
        ProposalType proposalType;
        address target;
        string data;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 createdAt;
        uint256 executedAt;
        bool executed;
    }

    enum ProposalType {
        AddMemberState,
        RemoveMemberState,
        UpdateMemberState
    }

    // ============ Events ============

    event DeploymentWitnessAdded(address indexed witness, uint256 totalWitnesses);
    event DeploymentCeremonyCompleted(uint256 blockNumber, uint256 witnessCount);
    event MemberStateAdded(address indexed stateAddress, string countryCode, string didDocument);
    event MemberStateRemoved(address indexed stateAddress, string countryCode);
    event MemberStateUpdated(address indexed stateAddress, string didDocument);
    event ProposalCreated(bytes32 indexed proposalId, ProposalType proposalType, address indexed target);
    event ProposalVoted(bytes32 indexed proposalId, address indexed voter, bool support);
    event ProposalExecuted(bytes32 indexed proposalId, uint256 executedAt);

    // ============ Errors ============

    error DeploymentCeremonyNotCompleted();
    error DeploymentCeremonyAlreadyCompleted();
    error InsufficientWitnesses();
    error AlreadyWitness();
    error NotMemberState();
    error AlreadyMemberState();
    error ProposalAlreadyExecuted();
    error ProposalNotApproved();
    error AlreadyVoted();
    error InvalidProposal();

    // ============ Constructor ============

    constructor(
        bytes32 _genesisBlockHash,
        string memory _officialDID
    ) {
        GENESIS_BLOCK_HASH = _genesisBlockHash;
        DEPLOYMENT_BLOCK = block.number;
        OFFICIAL_DID_DOCUMENT = _officialDID;

        deploymentCeremonyCompleted = false;
        witnessCount = 0;
    }

    // ============ Deployment Ceremony Functions ============

    /**
     * @notice Add a witness signature to the deployment ceremony
     * @param witness Address of the witnessing member state
     */
    function addDeploymentWitness(address witness) external {
        if (deploymentCeremonyCompleted) revert DeploymentCeremonyAlreadyCompleted();
        if (deploymentWitnesses[witness]) revert AlreadyWitness();

        deploymentWitnesses[witness] = true;
        witnessCount++;

        emit DeploymentWitnessAdded(witness, witnessCount);

        // Auto-complete ceremony if threshold reached
        if (witnessCount >= MIN_WITNESS_SIGNATURES) {
            _completeDeploymentCeremony();
        }
    }

    /**
     * @notice Complete the deployment ceremony
     */
    function _completeDeploymentCeremony() private {
        if (witnessCount < MIN_WITNESS_SIGNATURES) revert InsufficientWitnesses();

        deploymentCeremonyCompleted = true;

        emit DeploymentCeremonyCompleted(block.number, witnessCount);
    }

    /**
     * @notice Verify deployment ceremony integrity
     * @return bool True if ceremony is valid
     */
    function verifyDeploymentCeremony() external view returns (bool) {
        if (!deploymentCeremonyCompleted) return false;
        if (witnessCount < MIN_WITNESS_SIGNATURES) return false;

        return true;
    }

    // ============ Member State Management ============

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

    // ============ Governance Functions ============

    /**
     * @notice Create a proposal to add a member state
     * @param stateAddress Address of new member state
     * @param countryCode ISO 3166-1 alpha-2 country code
     * @param didDocument DID document for the member state
     * @return bytes32 Proposal ID
     */
    function proposeAddMemberState(
        address stateAddress,
        string memory countryCode,
        string memory didDocument
    ) external returns (bytes32) {
        if (!deploymentCeremonyCompleted) revert DeploymentCeremonyNotCompleted();
        if (!memberStates[msg.sender]) revert NotMemberState();
        if (memberStates[stateAddress]) revert AlreadyMemberState();

        bytes32 proposalId = keccak256(abi.encodePacked(
            ProposalType.AddMemberState,
            stateAddress,
            countryCode,
            didDocument,
            block.timestamp
        ));

        proposals[proposalId] = Proposal({
            proposalType: ProposalType.AddMemberState,
            target: stateAddress,
            data: string(abi.encodePacked(countryCode, "|", didDocument)),
            votesFor: 0,
            votesAgainst: 0,
            createdAt: block.timestamp,
            executedAt: 0,
            executed: false
        });

        emit ProposalCreated(proposalId, ProposalType.AddMemberState, stateAddress);

        return proposalId;
    }

    /**
     * @notice Vote on a proposal
     * @param proposalId ID of the proposal
     * @param support True to vote for, false to vote against
     */
    function voteOnProposal(bytes32 proposalId, bool support) external {
        if (!memberStates[msg.sender]) revert NotMemberState();

        Proposal storage proposal = proposals[proposalId];
        if (proposal.createdAt == 0) revert InvalidProposal();
        if (proposal.executed) revert ProposalAlreadyExecuted();
        if (proposalVotes[proposalId][msg.sender]) revert AlreadyVoted();

        proposalVotes[proposalId][msg.sender] = true;

        if (support) {
            proposal.votesFor++;
        } else {
            proposal.votesAgainst++;
        }

        emit ProposalVoted(proposalId, msg.sender, support);
    }

    /**
     * @notice Execute an approved proposal
     * @param proposalId ID of the proposal
     */
    function executeProposal(bytes32 proposalId) external {
        Proposal storage proposal = proposals[proposalId];

        if (proposal.executed) revert ProposalAlreadyExecuted();

        uint256 approvalPercentage = (proposal.votesFor * 100) / memberStateList.length;

        if (approvalPercentage < APPROVAL_THRESHOLD) revert ProposalNotApproved();

        proposal.executed = true;
        proposal.executedAt = block.timestamp;

        // Execute based on proposal type
        if (proposal.proposalType == ProposalType.AddMemberState) {
            _addMemberState(proposal);
        } else if (proposal.proposalType == ProposalType.RemoveMemberState) {
            _removeMemberState(proposal);
        } else if (proposal.proposalType == ProposalType.UpdateMemberState) {
            _updateMemberState(proposal);
        }

        emit ProposalExecuted(proposalId, block.timestamp);
    }

    /**
     * @notice Internal function to add a member state
     * @param proposal The approved proposal
     */
    function _addMemberState(Proposal storage proposal) private {
        address stateAddress = proposal.target;

        // Parse data (format: "countryCode|didDocument")
        string[] memory parts = _splitString(proposal.data, "|");

        memberStates[stateAddress] = true;
        memberStateInfo[stateAddress] = MemberStateInfo({
            countryCode: parts[0],
            didDocument: parts[1],
            addedAt: block.timestamp,
            active: true
        });
        memberStateList.push(stateAddress);

        emit MemberStateAdded(stateAddress, parts[0], parts[1]);
    }

    /**
     * @notice Internal function to remove a member state
     * @param proposal The approved proposal
     */
    function _removeMemberState(Proposal storage proposal) private {
        address stateAddress = proposal.target;

        memberStateInfo[stateAddress].active = false;

        emit MemberStateRemoved(stateAddress, memberStateInfo[stateAddress].countryCode);
    }

    /**
     * @notice Internal function to update a member state
     * @param proposal The approved proposal
     */
    function _updateMemberState(Proposal storage proposal) private {
        address stateAddress = proposal.target;

        memberStateInfo[stateAddress].didDocument = proposal.data;

        emit MemberStateUpdated(stateAddress, proposal.data);
    }

    /**
     * @notice Helper function to split string by delimiter
     * @param str String to split
     * @param delimiter Delimiter character
     * @return string[] Array of split strings
     */
    function _splitString(string memory str, string memory delimiter) private pure returns (string[] memory) {
        // Simplified implementation - in production use a library
        string[] memory parts = new string[](2);
        bytes memory strBytes = bytes(str);
        bytes memory delimBytes = bytes(delimiter);

        uint256 delimIndex = 0;
        for (uint256 i = 0; i < strBytes.length; i++) {
            if (strBytes[i] == delimBytes[0]) {
                delimIndex = i;
                break;
            }
        }

        bytes memory part1 = new bytes(delimIndex);
        bytes memory part2 = new bytes(strBytes.length - delimIndex - 1);

        for (uint256 i = 0; i < delimIndex; i++) {
            part1[i] = strBytes[i];
        }

        for (uint256 i = delimIndex + 1; i < strBytes.length; i++) {
            part2[i - delimIndex - 1] = strBytes[i];
        }

        parts[0] = string(part1);
        parts[1] = string(part2);

        return parts;
    }

    /**
     * @notice Bootstrap initial member states (only callable once during deployment ceremony)
     * @param initialStates Array of initial member state addresses
     * @param countryCodes Array of country codes
     * @param didDocuments Array of DID documents
     */
    function bootstrapMemberStates(
        address[] memory initialStates,
        string[] memory countryCodes,
        string[] memory didDocuments
    ) external {
        if (deploymentCeremonyCompleted) revert DeploymentCeremonyAlreadyCompleted();
        if (memberStateList.length > 0) revert DeploymentCeremonyAlreadyCompleted();

        require(
            initialStates.length == countryCodes.length &&
            initialStates.length == didDocuments.length,
            "Array length mismatch"
        );

        for (uint256 i = 0; i < initialStates.length; i++) {
            address stateAddress = initialStates[i];

            memberStates[stateAddress] = true;
            memberStateInfo[stateAddress] = MemberStateInfo({
                countryCode: countryCodes[i],
                didDocument: didDocuments[i],
                addedAt: block.timestamp,
                active: true
            });
            memberStateList.push(stateAddress);

            emit MemberStateAdded(stateAddress, countryCodes[i], didDocuments[i]);
        }

        deploymentCeremonyCompleted = true;
    }
}
