export function getElementMarketId(chainId: number): string {
  return (chainId == 1 || chainId == 5) ? '2' : '0'
}
