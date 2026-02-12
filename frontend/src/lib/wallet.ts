import { BrowserProvider, formatEther, type JsonRpcSigner } from 'ethers'
import { ACTIVE_CHAIN } from './chains'

const STORAGE_KEY = 'robinlens:wallet-connected'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Eth = any

function getEthereum(): Eth | undefined {
  if (typeof window === 'undefined') return undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eth = (window as any).ethereum
  if (!eth) return undefined
  // When multiple extensions inject providers, pick MetaMask
  if (eth.providers?.length) {
    const mm = eth.providers.find(
      (p: Eth) => p.isMetaMask && !p.isCoinbaseWallet && !p.isPhantom,
    )
    return mm ?? eth.providers.find((p: Eth) => p.isMetaMask) ?? eth.providers[0]
  }
  return eth
}

export async function connectWallet(): Promise<{ address: string; signer: JsonRpcSigner; chainId: number }> {
  const ethereum = getEthereum()
  if (!ethereum) {
    throw new Error('No wallet detected. Install MetaMask to continue.')
  }

  // Single approach: BrowserProvider handles the connection popup internally
  const provider = new BrowserProvider(ethereum)
  const signer = await provider.getSigner()
  const address = signer.address
  const network = await provider.getNetwork()
  const chainId = Number(network.chainId)

  if (chainId !== ACTIVE_CHAIN.chainId) {
    await switchToBase()
    const newProvider = new BrowserProvider(ethereum)
    const newSigner = await newProvider.getSigner()
    localStorage.setItem(STORAGE_KEY, '1')
    return { address: newSigner.address, signer: newSigner, chainId: ACTIVE_CHAIN.chainId }
  }

  localStorage.setItem(STORAGE_KEY, '1')
  return { address, signer, chainId }
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
