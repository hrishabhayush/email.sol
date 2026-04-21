// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title  SolMail Escrow (EVM)
/// @notice Incentivized email-reply escrow. Ported from the Solana program at
///         ../escrow/programs/solmail_escrow/src/lib.rs.
///
///         A sender locks ETH (or native token) against a given email
///         `threadId`. The receiver can claim the funds by calling
///         `registerAndClaim` within 15 days; otherwise the sender can call
///         `refundEscrow` to reclaim them after expiry.
///
///         The Solana program uses a PDA seeded by ["escrow", sender,
///         threadId]. The EVM equivalent is the `(sender, threadId)` key of
///         the `escrows` mapping. On completion or refund the entry is
///         deleted, mirroring the `close` behavior of the Anchor program.
contract SolmailEscrow {
    /// 15 days in seconds (matches `FIFTEEN_DAYS` in lib.rs).
    uint256 public constant FIFTEEN_DAYS = 15 days;

    /// Status of an escrow. `None` is the default zero value for an
    /// uninitialized / deleted entry.
    enum Status {
        None,
        Pending,
        Completed,
        Refunded
    }

    struct Escrow {
        address sender;
        address receiver;
        bytes32 threadId;
        uint256 amount;
        uint64 createdAt;
        uint64 expiresAt;
        Status status;
    }

    /// Escrow state keyed by (sender, threadId). Mirrors the PDA seeds
    /// ["escrow", sender, threadId] in the Solana program.
    mapping(address => mapping(bytes32 => Escrow)) public escrows;

    event EscrowInitialized(
        address indexed sender,
        bytes32 indexed threadId,
        uint256 amount,
        uint64 createdAt,
        uint64 expiresAt
    );
    event EscrowClaimed(
        address indexed sender,
        address indexed receiver,
        bytes32 indexed threadId,
        uint256 amount
    );
    event EscrowRefunded(
        address indexed sender,
        bytes32 indexed threadId,
        uint256 amount
    );

    error EscrowAlreadyExists();
    error AmountMismatch();
    error InvalidStatus();
    error ThreadIdMismatch();
    error SenderMismatch();
    error NotExpired();
    error TransferFailed();

    /// @notice Initialize an escrow for `threadId` funded by `msg.sender`.
    /// @dev    Each (sender, threadId) can only be initialized while no
    ///         prior entry is live. After Completed/Refunded the entry is
    ///         deleted, so a fresh escrow with the same threadId becomes
    ///         possible — matching the Solana PDA lifecycle.
    /// @param  threadId Deterministic 32-byte id for the email thread.
    /// @param  amount   Amount to escrow. Must equal `msg.value`; kept as
    ///                  an explicit parameter to mirror the Rust signature.
    function initializeEscrow(bytes32 threadId, uint256 amount) external payable {
        if (msg.value != amount) revert AmountMismatch();

        Escrow storage e = escrows[msg.sender][threadId];
        if (e.status != Status.None) revert EscrowAlreadyExists();

        uint64 nowTs = uint64(block.timestamp);
        uint64 expiresAt = nowTs + uint64(FIFTEEN_DAYS);

        e.sender = msg.sender;
        e.threadId = threadId;
        e.amount = amount;
        e.createdAt = nowTs;
        e.expiresAt = expiresAt;
        e.status = Status.Pending;

        emit EscrowInitialized(msg.sender, threadId, amount, nowTs, expiresAt);
    }

    /// @notice Claim the escrowed funds as the receiver of `threadId`.
    /// @dev    Mirrors `register_and_claim` in lib.rs. Caller becomes the
    ///         receiver. Follows checks-effects-interactions and deletes the
    ///         entry before transferring, so reentrancy is a no-op.
    /// @param  sender   Original funder — needed to locate the entry.
    /// @param  threadId Email thread id originally escrowed.
    function registerAndClaim(address sender, bytes32 threadId) external {
        Escrow storage e = escrows[sender][threadId];

        if (e.status != Status.Pending) revert InvalidStatus();
        if (e.threadId != threadId) revert ThreadIdMismatch();
        if (e.sender != sender) revert SenderMismatch();

        uint256 amount = e.amount;
        address receiver = msg.sender;

        delete escrows[sender][threadId];

        (bool ok, ) = receiver.call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit EscrowClaimed(sender, receiver, threadId, amount);
    }

    /// @notice Refund an unclaimed escrow back to the original sender after
    ///         the 15-day expiry. Mirrors `refund_escrow` in lib.rs.
    function refundEscrow(bytes32 threadId) external {
        Escrow storage e = escrows[msg.sender][threadId];

        if (e.status != Status.Pending) revert InvalidStatus();
        if (e.threadId != threadId) revert ThreadIdMismatch();
        if (e.sender != msg.sender) revert SenderMismatch();
        if (block.timestamp < e.expiresAt) revert NotExpired();

        uint256 amount = e.amount;

        delete escrows[msg.sender][threadId];

        (bool ok, ) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit EscrowRefunded(msg.sender, threadId, amount);
    }

    /// @notice Convenience view returning the full Escrow struct for a
    ///         (sender, threadId) pair.
    function getEscrow(address sender, bytes32 threadId)
        external
        view
        returns (Escrow memory)
    {
        return escrows[sender][threadId];
    }
}
