export function getElementMarketId(chainId: number): string {
  return (chainId == 1 || chainId == 5) ? '2' : '0'
}

export function getSeaportMarketId(): string {
  return '1'
}

export function getLooksRareMarketId(): string {
  return '3'
}
