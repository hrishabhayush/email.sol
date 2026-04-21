// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {SolmailEscrow} from "../src/SolmailEscrow.sol";

/// @notice Deploy `SolmailEscrow` to Base (or any EVM chain).
///
/// Usage:
///   forge script script/Deploy.s.sol:Deploy \
///     --rpc-url $BASE_RPC_URL \
///     --private-key $DEPLOYER_KEY \
///     --broadcast --verify
contract Deploy is Script {
    function run() external returns (SolmailEscrow deployed) {
        vm.startBroadcast();
        deployed = new SolmailEscrow();
        vm.stopBroadcast();
        console2.log("SolmailEscrow deployed at", address(deployed));
    }
}
