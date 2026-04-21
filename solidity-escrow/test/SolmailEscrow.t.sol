// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SolmailEscrow} from "../src/SolmailEscrow.sol";

contract SolmailEscrowTest is Test {
    SolmailEscrow internal escrow;

    address internal sender = makeAddr("sender");
    address internal receiver = makeAddr("receiver");
    address internal stranger = makeAddr("stranger");

    bytes32 internal constant THREAD_ID = bytes32(uint256(0xdead));
    uint256 internal constant AMOUNT = 1 ether;

    function setUp() public {
        escrow = new SolmailEscrow();
        vm.deal(sender, 10 ether);
        vm.deal(stranger, 10 ether);
    }

    // ─── initializeEscrow ────────────────────────────────────────────

    function test_initialize_happyPath() public {
        vm.prank(sender);
        escrow.initializeEscrow{value: AMOUNT}(THREAD_ID, AMOUNT);

        SolmailEscrow.Escrow memory e = escrow.getEscrow(sender, THREAD_ID);
        assertEq(e.sender, sender);
        assertEq(e.amount, AMOUNT);
        assertEq(e.threadId, THREAD_ID);
        assertEq(uint8(e.status), uint8(SolmailEscrow.Status.Pending));
        assertEq(e.expiresAt, e.createdAt + escrow.FIFTEEN_DAYS());
        assertEq(address(escrow).balance, AMOUNT);
    }

    function test_initialize_revertsIfAmountMismatch() public {
        vm.prank(sender);
        vm.expectRevert(SolmailEscrow.AmountMismatch.selector);
        escrow.initializeEscrow{value: 0.5 ether}(THREAD_ID, AMOUNT);
    }

    function test_initialize_revertsIfAlreadyExists() public {
        vm.startPrank(sender);
        escrow.initializeEscrow{value: AMOUNT}(THREAD_ID, AMOUNT);
        vm.expectRevert(SolmailEscrow.EscrowAlreadyExists.selector);
        escrow.initializeEscrow{value: AMOUNT}(THREAD_ID, AMOUNT);
        vm.stopPrank();
    }

    // ─── registerAndClaim ────────────────────────────────────────────

    function test_claim_happyPath() public {
        vm.prank(sender);
        escrow.initializeEscrow{value: AMOUNT}(THREAD_ID, AMOUNT);

        uint256 before = receiver.balance;
        vm.prank(receiver);
        escrow.registerAndClaim(sender, THREAD_ID);

        assertEq(receiver.balance - before, AMOUNT);
        // entry deleted
        SolmailEscrow.Escrow memory e = escrow.getEscrow(sender, THREAD_ID);
        assertEq(uint8(e.status), uint8(SolmailEscrow.Status.None));
        assertEq(address(escrow).balance, 0);
    }

    function test_claim_revertsIfWrongSender() public {
        vm.prank(sender);
        escrow.initializeEscrow{value: AMOUNT}(THREAD_ID, AMOUNT);

        // Claim for a sender that never funded → entry is None → InvalidStatus.
        vm.prank(receiver);
        vm.expectRevert(SolmailEscrow.InvalidStatus.selector);
        escrow.registerAndClaim(stranger, THREAD_ID);
    }

    function test_claim_revertsIfWrongThreadId() public {
        vm.prank(sender);
        escrow.initializeEscrow{value: AMOUNT}(THREAD_ID, AMOUNT);

        bytes32 otherThread = bytes32(uint256(0xbeef));
        vm.prank(receiver);
        vm.expectRevert(SolmailEscrow.InvalidStatus.selector);
        escrow.registerAndClaim(sender, otherThread);
    }

    function test_claim_revertsIfAlreadyClaimed() public {
        vm.prank(sender);
        escrow.initializeEscrow{value: AMOUNT}(THREAD_ID, AMOUNT);

        vm.prank(receiver);
        escrow.registerAndClaim(sender, THREAD_ID);

        vm.prank(receiver);
        vm.expectRevert(SolmailEscrow.InvalidStatus.selector);
        escrow.registerAndClaim(sender, THREAD_ID);
    }

    // ─── refundEscrow ────────────────────────────────────────────────

    function test_refund_revertsBeforeExpiry() public {
        vm.prank(sender);
        escrow.initializeEscrow{value: AMOUNT}(THREAD_ID, AMOUNT);

        vm.prank(sender);
        vm.expectRevert(SolmailEscrow.NotExpired.selector);
        escrow.refundEscrow(THREAD_ID);
    }

    function test_refund_happyPathAfterExpiry() public {
        vm.prank(sender);
        escrow.initializeEscrow{value: AMOUNT}(THREAD_ID, AMOUNT);

        vm.warp(block.timestamp + escrow.FIFTEEN_DAYS());

        uint256 before = sender.balance;
        vm.prank(sender);
        escrow.refundEscrow(THREAD_ID);

        assertEq(sender.balance - before, AMOUNT);
        SolmailEscrow.Escrow memory e = escrow.getEscrow(sender, THREAD_ID);
        assertEq(uint8(e.status), uint8(SolmailEscrow.Status.None));
        assertEq(address(escrow).balance, 0);
    }

    function test_refund_revertsIfNotSender() public {
        vm.prank(sender);
        escrow.initializeEscrow{value: AMOUNT}(THREAD_ID, AMOUNT);

        vm.warp(block.timestamp + escrow.FIFTEEN_DAYS());

        // A stranger calls refund; their mapping entry is None → InvalidStatus.
        vm.prank(stranger);
        vm.expectRevert(SolmailEscrow.InvalidStatus.selector);
        escrow.refundEscrow(THREAD_ID);
    }

    function test_refund_revertsIfAlreadyClaimed() public {
        vm.prank(sender);
        escrow.initializeEscrow{value: AMOUNT}(THREAD_ID, AMOUNT);

        vm.prank(receiver);
        escrow.registerAndClaim(sender, THREAD_ID);

        vm.warp(block.timestamp + escrow.FIFTEEN_DAYS());
        vm.prank(sender);
        vm.expectRevert(SolmailEscrow.InvalidStatus.selector);
        escrow.refundEscrow(THREAD_ID);
    }

    // ─── relifecycle ────────────────────────────────────────────────

    function test_canReinitializeSameThreadAfterRefund() public {
        vm.prank(sender);
        escrow.initializeEscrow{value: AMOUNT}(THREAD_ID, AMOUNT);
        vm.warp(block.timestamp + escrow.FIFTEEN_DAYS());
        vm.prank(sender);
        escrow.refundEscrow(THREAD_ID);

        // Same (sender, threadId) becomes usable again, matching Solana PDA
        // semantics where the account is closed on refund.
        vm.prank(sender);
        escrow.initializeEscrow{value: AMOUNT}(THREAD_ID, AMOUNT);
        SolmailEscrow.Escrow memory e = escrow.getEscrow(sender, THREAD_ID);
        assertEq(uint8(e.status), uint8(SolmailEscrow.Status.Pending));
    }
}
