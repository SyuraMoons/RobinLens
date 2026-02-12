import { BrowserProvider, formatEther, type JsonRpcSigner } from 'ethers'
import { ACTIVE_CHAIN } from './chains'

const STORAGE_KEY = 'robinlens:wallet-connected'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EthereumProvider = any

/**
 * Find the best available wallet provider.
 *
 * When multiple wallet extensions are installed (MetaMask, Coinbase Wallet,
 * Phantom, etc.) they either share `window.ethereum` via the `providers`
 * array or fight over it. We explicitly prefer MetaMask (real MetaMask, not
 * Coinbase Wallet which also sets `isMetaMask`).
 */
function getEthereum(): EthereumProvider | undefined {
  if (typeof window === 'undefined') return undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eth = (window as any).ethereum
  if (!eth) return undefined

  // Multiple providers injected (EIP-5749 / EIP-6963)
  if (eth.providers?.length) {
    // Real MetaMask: isMetaMask=true AND NOT isCoinbaseWallet/isPhantom
    const mm = eth.providers.find(
      (p: EthereumProvider) => p.isMetaMask && !p.isCoinbaseWallet && !p.isPhantom,
    )
    if (mm) return mm
    // Any MetaMask-like provider
    const anyMM = eth.providers.find((p: EthereumProvider) => p.isMetaMask)
    if (anyMM) return anyMM
    return eth.providers[0]
  }

  return eth
}

export async function connectWallet(): Promise<{ address: string; signer: JsonRpcSigner; chainId: number }> {
  const ethereum = getEthereum()
  if (!ethereum) {
    throw new Error('No wallet detected. Install MetaMask to continue.')
  }

  // Request accounts via EIP-1193
  const accounts = (await ethereum.request({ method: 'eth_requestAccounts' })) as string[]
  if (!accounts?.length) {
    throw new Error('No accounts returned. Unlock your wallet and try again.')
  }

  const provider = new BrowserProvider(ethereum)
  const network = await provider.getNetwork()
  const chainId = Number(network.chainId)

  if (chainId !== ACTIVE_CHAIN.chainId) {
    await switchToBase()
    // Re-create provider after chain switch
    const newProvider = new BrowserProvider(ethereum)
    const signer = await newProvider.getSigner()
    localStorage.setItem(STORAGE_KEY, '1')
    return { address: signer.address, signer, chainId: ACTIVE_CHAIN.chainId }
  }

  const signer = await provider.getSigner()
  localStorage.setItem(STORAGE_KEY, '1')
  return { address: signer.address, signer, chainId }
}

export async function reconnectWallet(): Promise<{ address: string; signer: JsonRpcSigner; chainId: number } | null> {
  if (!localStorage.getItem(STORAGE_KEY)) return null

  const ethereum = getEthereum()
  if (!ethereum) return null

  try {
    const accounts = (await ethereum.request({ method: 'eth_accounts' })) as string[]
    if (!accounts?.length) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }

    const provider = new BrowserProvider(ethereum)
    const network = await provider.getNetwork()
    const chainId = Number(network.chainId)
    const signer = await provider.getSigner()

    return { address: signer.address, signer, chainId }
  } catch {
    localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

export function disconnectWallet(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export async function switchToBase(): Promise<void> {
  const ethereum = getEthereum()
  if (!ethereum) throw new Error('No wallet detected')

  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: ACTIVE_CHAIN.chainIdHex }],
    })
  } catch (err: unknown) {
    const switchError = err as { code?: number }
    // Chain not added yet (4902) -- add it
    if (switchError.code === 4902) {
      await ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: ACTIVE_CHAIN.chainIdHex,
          chainName: ACTIVE_CHAIN.name,
          rpcUrls: [ACTIVE_CHAIN.rpc],
          blockExplorerUrls: [ACTIVE_CHAIN.explorer],
          nativeCurrency: ACTIVE_CHAIN.currency,
        }],
      })
    } else {
      throw err
    }
  }
}

export async function getEthBalance(address: string): Promise<string> {
  const ethereum = getEthereum()
  if (!ethereum) return '0'

  const provider = new BrowserProvider(ethereum)
  const balance = await provider.getBalance(address)
  return formatEther(balance)
}

export function onAccountsChanged(callback: (accounts: string[]) => void): () => void {
  const ethereum = getEthereum()
  if (!ethereum) return () => {}

  const handler = (...args: unknown[]) => callback(args[0] as string[])
  ethereum.on('accountsChanged', handler)
  return () => ethereum.removeListener('accountsChanged', handler)
}

export function onChainChanged(callback: (chainId: string) => void): () => void {
  const ethereum = getEthereum()
  if (!ethereum) return () => {}

  const handler = (...args: unknown[]) => callback(args[0] as string)
  ethereum.on('chainChanged', handler)
  return () => ethereum.removeListener('chainChanged', handler)
}
