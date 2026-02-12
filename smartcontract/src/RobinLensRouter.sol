// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IRobinPumpCurve} from "./interfaces/IRobinPumpCurve.sol";

/// @title RobinLensRouter
/// @notice Trade router for buying/selling tokens on RobinPump bonding curves via RobinLens AI recommendations
/// @dev Users sign all transactions themselves. This contract routes trades with slippage protection and event tracking.
contract RobinLensRouter {
    // ─── Events ──────────────────────────────────────────────────────────────────

    event TokenBought(
        address indexed user,
        address indexed curve,
        uint256 ethSpent,
        uint256 tokensReceived,
        uint256 timestamp
    );

    event TokenSold(
        address indexed user,
        address indexed curve,
        uint256 tokensSold,
        uint256 ethReceived,
        uint256 timestamp
    );

    event MultiBuyExecuted(
        address indexed user,
        uint256 totalEthSpent,
        uint256 curveCount,
        uint256 timestamp
    );

    // ─── Errors ──────────────────────────────────────────────────────────────────

    error DeadlineExpired();
    error TradingNotActive();
    error InsufficientEthSent();
    error ArrayLengthMismatch();
    error ZeroAmount();
    error TransferFailed();

    // ─── Modifiers ───────────────────────────────────────────────────────────────

    modifier beforeDeadline(uint256 deadline) {
        if (block.timestamp > deadline) revert DeadlineExpired();
        _;
    }

    // ─── External Functions ──────────────────────────────────────────────────────

    /// @notice Buy tokens on a RobinPump bonding curve
    /// @param curve Address of the bonding curve contract
    /// @param minTokensOut Minimum tokens to receive (slippage protection)
    /// @param deadline Unix timestamp after which the transaction reverts
    function buyToken(
        address curve,
        uint256 minTokensOut,
        uint256 deadline
    ) external payable beforeDeadline(deadline) {
        if (msg.value == 0) revert ZeroAmount();

        IRobinPumpCurve pumpCurve = IRobinPumpCurve(curve);
        if (!pumpCurve.trading()) revert TradingNotActive();

        // Get token address from the curve to check balance before/after
        // Execute buy — sends ETH to the curve, tokens go to this contract
        pumpCurve.buy{value: msg.value}(minTokensOut, deadline);

        // Forward received tokens to the user
        // RobinPump curves send tokens to msg.sender (this contract),
        // so we need to forward them to the actual user
        _forwardTokens(curve, msg.sender);

        emit TokenBought(
            msg.sender,
            curve,
            msg.value,
            minTokensOut,
            block.timestamp
        );
    }

    /// @notice Sell tokens back to a RobinPump bonding curve
    /// @dev User must approve this contract to spend their tokens first
    /// @param curve Address of the bonding curve contract
    /// @param token Address of the ERC20 token to sell
    /// @param tokenAmount Amount of tokens to sell
    /// @param minEthOut Minimum ETH to receive (slippage protection)
    /// @param deadline Unix timestamp after which the transaction reverts
    function sellToken(
        address curve,
        address token,
        uint256 tokenAmount,
        uint256 minEthOut,
        uint256 deadline
    ) external beforeDeadline(deadline) {
        if (tokenAmount == 0) revert ZeroAmount();

        IRobinPumpCurve pumpCurve = IRobinPumpCurve(curve);
        if (!pumpCurve.trading()) revert TradingNotActive();

        // Transfer tokens from user to this contract
        _safeTransferFrom(token, msg.sender, address(this), tokenAmount);

        // Approve the curve to spend tokens
        _safeApprove(token, curve, tokenAmount);

        // Record ETH balance before sell
        uint256 ethBefore = address(this).balance;

        // Execute sell — curve takes tokens, sends ETH to this contract
        pumpCurve.sell(tokenAmount, minEthOut, deadline);

        // Calculate ETH received and forward to user
        uint256 ethReceived = address(this).balance - ethBefore;
        _safeTransferETH(msg.sender, ethReceived);

        emit TokenSold(
            msg.sender,
            curve,
            tokenAmount,
            ethReceived,
            block.timestamp
        );
    }

    /// @notice Buy multiple tokens in one transaction (batch buy from AI recommendations)
    /// @param curves Array of bonding curve addresses
    /// @param ethAmounts Array of ETH amounts to spend on each curve
    /// @param minTokensOutArr Array of minimum tokens to receive for each buy
    /// @param deadline Unix timestamp after which the transaction reverts
    function multiBuy(
        address[] calldata curves,
        uint256[] calldata ethAmounts,
        uint256[] calldata minTokensOutArr,
        uint256 deadline
    ) external payable beforeDeadline(deadline) {
        uint256 len = curves.length;
        if (len != ethAmounts.length || len != minTokensOutArr.length)
            revert ArrayLengthMismatch();

        uint256 totalEthNeeded;
        for (uint256 i; i < len; ) {
            totalEthNeeded += ethAmounts[i];
            unchecked {
                ++i;
            }
        }
        if (msg.value < totalEthNeeded) revert InsufficientEthSent();

        for (uint256 i; i < len; ) {
            if (ethAmounts[i] > 0) {
                IRobinPumpCurve pumpCurve = IRobinPumpCurve(curves[i]);

                // Skip if trading not active (don't revert entire batch)
                if (pumpCurve.trading()) {
                    pumpCurve.buy{value: ethAmounts[i]}(
                        minTokensOutArr[i],
                        deadline
                    );
                    _forwardTokens(curves[i], msg.sender);

                    emit TokenBought(
                        msg.sender,
                        curves[i],
                        ethAmounts[i],
                        minTokensOutArr[i],
                        block.timestamp
                    );
                }
            }
            unchecked {
                ++i;
            }
        }

        // Refund any excess ETH
        uint256 remaining = address(this).balance;
        if (remaining > 0) {
            _safeTransferETH(msg.sender, remaining);
        }

        emit MultiBuyExecuted(msg.sender, totalEthNeeded, len, block.timestamp);
    }

    // ─── View Functions ──────────────────────────────────────────────────────────

    /// @notice Get a quote for buying tokens on a curve
    /// @param curve Address of the bonding curve
    /// @param ethAmount Amount of ETH to spend
    /// @return tokensOut Estimated tokens you would receive
    function quoteBuy(
        address curve,
        uint256 ethAmount
    ) external view returns (uint256 tokensOut) {
        return IRobinPumpCurve(curve).getTokensForEth(ethAmount);
    }

    /// @notice Get the current token price on a curve
    /// @param curve Address of the bonding curve
    /// @return price Current price in wei per token
    function getPrice(address curve) external view returns (uint256 price) {
        return IRobinPumpCurve(curve).getCurrentPrice();
    }

    /// @notice Check if trading is active on a curve
    /// @param curve Address of the bonding curve
    /// @return active True if trading is enabled
    function isTradingActive(
        address curve
    ) external view returns (bool active) {
        return IRobinPumpCurve(curve).trading();
    }

    // ─── Internal Helpers ────────────────────────────────────────────────────────

    /// @dev Forward all tokens of a curve's token to the recipient
    function _forwardTokens(address curve, address recipient) internal {
        // Get the token address — we use a low-level call since RobinPump curves
        // may have different ways to expose the token address
        (bool success, bytes memory data) = curve.staticcall(
            abi.encodeWithSignature("token()")
        );
        if (!success || data.length < 32) return;

        address token = abi.decode(data, (address));
        uint256 balance = _balanceOf(token, address(this));
        if (balance > 0) {
            _safeTransfer(token, recipient, balance);
        }
    }

    function _balanceOf(
        address token,
        address account
    ) internal view returns (uint256) {
        (bool success, bytes memory data) = token.staticcall(
            abi.encodeWithSelector(0x70a08231, account) // balanceOf(address)
        );
        if (!success || data.length < 32) return 0;
        return abi.decode(data, (uint256));
    }

    function _safeTransfer(address token, address to, uint256 amount) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(0xa9059cbb, to, amount) // transfer(address,uint256)
        );
        if (!success || (data.length > 0 && !abi.decode(data, (bool))))
            revert TransferFailed();
    }

    function _safeTransferFrom(
        address token,
        address from,
        address to,
        uint256 amount
    ) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(0x23b872dd, from, to, amount) // transferFrom(address,address,uint256)
        );
        if (!success || (data.length > 0 && !abi.decode(data, (bool))))
            revert TransferFailed();
    }

    function _safeApprove(
        address token,
        address spender,
        uint256 amount
    ) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(0x095ea7b3, spender, amount) // approve(address,uint256)
        );
        if (!success || (data.length > 0 && !abi.decode(data, (bool))))
            revert TransferFailed();
    }

    function _safeTransferETH(address to, uint256 amount) internal {
        (bool success, ) = to.call{value: amount}("");
        if (!success) revert TransferFailed();
    }

    /// @dev Allow contract to receive ETH (from curve sell proceeds)
    receive() external payable {}
}
