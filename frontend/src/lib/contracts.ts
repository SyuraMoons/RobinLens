import { Contract, parseEther, formatEther, formatUnits, type JsonRpcSigner, type Provider } from 'ethers'

// Bonding curve contract ABI (reverse-engineered from on-chain)
const CURVE_ABI = [
  'function buy(uint256 minTokensOut, uint256 deadline) external payable',
  'function sell(uint256 tokensToSell, uint256 minEthOut, uint256 deadline) external',
  'function getCurrentPrice() external view returns (uint256)',
  'function getTokensForEth(uint256 ethAmount) external view returns (uint256)',
  'function trading() external view returns (bool)',
  'function FEE_PERCENT() external view returns (uint256)',
]

const ERC20_ABI = [
  'function balanceOf(address owner) external view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
]

const ROUTER_ABI = [
  'function buyToken(address curve, uint256 minTokensOut, uint256 deadline) external payable',
  'function sellToken(address curve, address token, uint256 tokenAmount, uint256 minEthOut, uint256 deadline) external',
  'function quoteBuy(address curve, uint256 ethAmount) external view returns (uint256 tokensOut)',
  'function getPrice(address curve) external view returns (uint256 price)',
  'function isTradingActive(address curve) external view returns (bool active)',
]

const ROUTER_ADDRESS: string | null = import.meta.env.VITE_ROUTER_ADDRESS || null

export function getCurveContract(curveAddress: string, signerOrProvider: JsonRpcSigner | Provider): Contract {
  return new Contract(curveAddress, CURVE_ABI, signerOrProvider)
}

export function getTokenContract(tokenAddress: string, signerOrProvider: JsonRpcSigner | Provider): Contract {
  return new Contract(tokenAddress, ERC20_ABI, signerOrProvider)
}

function getRouterContract(signerOrProvider: JsonRpcSigner | Provider): Contract | null {
  if (!ROUTER_ADDRESS) return null
  return new Contract(ROUTER_ADDRESS, ROUTER_ABI, signerOrProvider)
}

export async function isTradingActive(curveAddress: string, provider: Provider): Promise<boolean> {
  const router = getRouterContract(provider)
  if (router) {
    return router.isTradingActive(curveAddress)
  }
  const curve = getCurveContract(curveAddress, provider)
  return curve.trading()
}

export async function quoteBuy(
  curveAddress: string,
  ethAmount: string,
  provider: Provider,
): Promise<{ tokensOut: string; tokensOutRaw: bigint }> {
  const ethWei = parseEther(ethAmount)
  const router = getRouterContract(provider)
  if (router) {
    const tokensOutRaw: bigint = await router.quoteBuy(curveAddress, ethWei)
    return {
      tokensOut: formatUnits(tokensOutRaw, 18),
      tokensOutRaw,
    }
  }
  const curve = getCurveContract(curveAddress, provider)
  const tokensOutRaw: bigint = await curve.getTokensForEth(ethWei)
  return {
    tokensOut: formatUnits(tokensOutRaw, 18),
    tokensOutRaw,
  }
}

export async function getTokenBalance(
  tokenAddress: string,
  userAddress: string,
  provider: Provider,
): Promise<{ balance: string; balanceRaw: bigint }> {
  const token = getTokenContract(tokenAddress, provider)
  const balanceRaw: bigint = await token.balanceOf(userAddress)
  return {
    balance: formatUnits(balanceRaw, 18),
    balanceRaw,
  }
}

export interface TradeResult {
  txHash: string
}

export async function executeBuy(
  curveAddress: string,
  signer: JsonRpcSigner,
  ethAmount: string,
  slippageBps: number = 500,
): Promise<TradeResult> {
  const ethWei = parseEther(ethAmount)
  const deadline = Math.floor(Date.now() / 1000) + 300 // 5 minutes

  const router = getRouterContract(signer)
  if (router) {
    const tokensOut: bigint = await router.quoteBuy(curveAddress, ethWei)
    const minTokensOut = tokensOut * BigInt(10000 - slippageBps) / BigInt(10000)
    const tx = await router.buyToken(curveAddress, minTokensOut, deadline, { value: ethWei })
    await tx.wait()
    return { txHash: tx.hash }
  }

  const curve = getCurveContract(curveAddress, signer)
  const tokensOut: bigint = await curve.getTokensForEth(ethWei)
  const minTokensOut = tokensOut * BigInt(10000 - slippageBps) / BigInt(10000)
  const tx = await curve.buy(minTokensOut, deadline, { value: ethWei })
  await tx.wait()
  return { txHash: tx.hash }
}

export async function executeSell(
  curveAddress: string,
  tokenAddress: string,
  signer: JsonRpcSigner,
  tokenAmount: string,
  slippageBps: number = 500,
): Promise<TradeResult> {
  const token = getTokenContract(tokenAddress, signer)
  const address = await signer.getAddress()
  const tokenWei = parseEther(tokenAmount)
  const deadline = Math.floor(Date.now() / 1000) + 300

  const router = getRouterContract(signer)
  if (router) {
    // Approve router (not curve) to spend tokens
    const currentAllowance: bigint = await token.allowance(address, ROUTER_ADDRESS!)
    if (currentAllowance < tokenWei) {
      const approveTx = await token.approve(ROUTER_ADDRESS!, tokenWei)
      await approveTx.wait()
    }

    const currentPrice: bigint = await router.getPrice(curveAddress)
    const estimatedEthOut = tokenWei * currentPrice / BigInt(10 ** 18)
    const minEthOut = estimatedEthOut * BigInt(10000 - slippageBps) / BigInt(10000)

    const tx = await router.sellToken(curveAddress, tokenAddress, tokenWei, minEthOut, deadline)
    await tx.wait()
    return { txHash: tx.hash }
  }

  // Direct curve call (no router)
  const curve = getCurveContract(curveAddress, signer)
  const currentAllowance: bigint = await token.allowance(address, curveAddress)
  if (currentAllowance < tokenWei) {
    const approveTx = await token.approve(curveAddress, tokenWei)
    await approveTx.wait()
  }

  const currentPrice: bigint = await curve.getCurrentPrice()
  const estimatedEthOut = tokenWei * currentPrice / BigInt(10 ** 18)
  const minEthOut = estimatedEthOut * BigInt(10000 - slippageBps) / BigInt(10000)

  const tx = await curve.sell(tokenWei, minEthOut, deadline)
  await tx.wait()
  return { txHash: tx.hash }
}

export { formatEther, parseEther }
