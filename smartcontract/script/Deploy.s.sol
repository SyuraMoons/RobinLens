// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {RobinLensRouter} from "../src/RobinLensRouter.sol";
import {StartupToken} from "../src/StartupToken.sol";
import {MockBondingCurve} from "../src/MockBondingCurve.sol";

contract DeployRobinLens is Script {
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        // ─── Token 1: EasyHack (EHACK) ──────────────────────────────────
        StartupToken ehack = new StartupToken("EasyHack", "EHACK");
        MockBondingCurve ehackCurve = new MockBondingCurve(address(ehack));
        ehack.setCurve(address(ehackCurve));

        // ─── Token 2: Robinpump (ROBIN) ─────────────────────────────────
        StartupToken robin = new StartupToken("Robinpump", "ROBIN");
        MockBondingCurve robinCurve = new MockBondingCurve(address(robin));
        robin.setCurve(address(robinCurve));

        // ─── Router ─────────────────────────────────────────────────────
        RobinLensRouter router = new RobinLensRouter();

        vm.stopBroadcast();

        // Summary
        console.log("");
        console.log("=== Deployment Summary ===");
        console.log("");
        console.log("-- EasyHack (EHACK) --");
        console.log("  Token:  ", address(ehack));
        console.log("  Curve:  ", address(ehackCurve));
        console.log("");
        console.log("-- Robinpump (ROBIN) --");
        console.log("  Token:  ", address(robin));
        console.log("  Curve:  ", address(robinCurve));
        console.log("");
        console.log("-- Router --");
        console.log("  Router: ", address(router));
        console.log("");
        console.log(
            "Buy EHACK: router.buyToken(ehackCurveAddr, 0, deadline) with ETH"
        );
        console.log(
            "Buy ROBIN: router.buyToken(robinCurveAddr, 0, deadline) with ETH"
        );
    }
}
