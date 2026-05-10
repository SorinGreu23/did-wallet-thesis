// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ZkpVerifierRegistry
 * @notice On-chain registry for ZKP circuit verification key hashes.
 * @dev Stores the canonical verification-key hash for each supported circuit.
 *      Mobile wallets can compare bundled verification keys against this
 *      registry before verifying proofs locally.
 */
contract ZkpVerifierRegistry {
    // ============ State Variables ============

    address public immutable owner;

    mapping(string => CircuitRecord) private circuits;

    struct CircuitRecord {
        bytes32 vKeyHash;
        uint16 version;
        uint64 registeredAt;
        bool active;
    }

    // ============ Events ============

    event CircuitRegistered(
        string indexed name,
        bytes32 indexed vKeyHash,
        uint16 version
    );

    event CircuitDeactivated(string indexed name);

    // ============ Errors ============

    error Unauthorized();
    error InvalidCircuitName();
    error InvalidVKeyHash();
    error InvalidVersion();
    error CircuitNotFound();
    error CircuitAlreadyInactive();

    // ============ Modifiers ============

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    // ============ Constructor ============

    constructor() {
        owner = msg.sender;
    }

    // ============ External Functions ============

    /**
     * @notice Register or update a circuit verification-key hash.
     * @param name Circuit name, e.g. "ageVerification"
     * @param vKeyHash keccak256 hash of canonical verification_key.json
     * @param version Circuit version, must be greater than zero
     */
    function register(
        string calldata name,
        bytes32 vKeyHash,
        uint16 version
    ) external onlyOwner {
        if (bytes(name).length == 0) revert InvalidCircuitName();
        if (vKeyHash == bytes32(0)) revert InvalidVKeyHash();
        if (version == 0) revert InvalidVersion();

        circuits[name] = CircuitRecord({
            vKeyHash: vKeyHash,
            version: version,
            registeredAt: uint64(block.timestamp),
            active: true
        });

        emit CircuitRegistered(name, vKeyHash, version);
    }

    /**
     * @notice Deactivate a circuit.
     * @param name Circuit name
     */
    function deactivate(string calldata name) external onlyOwner {
        CircuitRecord storage record = circuits[name];

        if (record.registeredAt == 0) revert CircuitNotFound();
        if (!record.active) revert CircuitAlreadyInactive();

        record.active = false;

        emit CircuitDeactivated(name);
    }

    /**
     * @notice Get circuit record by name.
     * @param name Circuit name
     * @return CircuitRecord Stored circuit metadata
     */
    function get(string calldata name) external view returns (CircuitRecord memory) {
        CircuitRecord memory record = circuits[name];

        if (record.registeredAt == 0) revert CircuitNotFound();

        return record;
    }

    /**
     * @notice Check whether a circuit is active.
     * @param name Circuit name
     * @return bool True when circuit exists and is active
     */
    function isActive(string calldata name) external view returns (bool) {
        return circuits[name].active;
    }

    /**
     * @notice Check whether a circuit exists.
     * @param name Circuit name
     * @return bool True when circuit has been registered at least once
     */
    function exists(string calldata name) external view returns (bool) {
        return circuits[name].registeredAt != 0;
    }
}
