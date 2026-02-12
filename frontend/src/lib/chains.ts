export const BASE_MAINNET = {
  chainId: 8453,
  chainIdHex: '0x2105',
  name: 'Base',
  rpc: 'https://mainnet.base.org',
  explorer: 'https://basescan.org',
  currency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
} as const

export const BASE_SEPOLIA = {
  chainId: 84532,
  chainIdHex: '0x14a34',
  name: 'Base Sepolia',
  rpc: 'https://sepolia.base.org',
  explorer: 'https://sepolia.basescan.org',
  currency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
} as const

const CHAIN_ENV = import.meta.env.VITE_CHAIN as string | undefined

export const ACTIVE_CHAIN = CHAIN_ENV === 'sepolia' ? BASE_SEPOLIA : BASE_MAINNET

export function basescanTxUrl(txHash: string): string {
  return `${ACTIVE_CHAIN.explorer}/tx/${txHash}`
}

export function basescanAddressUrl(address: string): string {
  return `${ACTIVE_CHAIN.explorer}/address/${address}`
}
