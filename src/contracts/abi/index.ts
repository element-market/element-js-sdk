import ERC20Abi from './common/ERC20.json'
import ERC721Abi from './common/ERC721.json'
import ERC1155Abi from './common/ERC1155.json'
import WETHAbi from './common/WETH.json'
import IElementExAbi from './elementEx/IElementEx.json'
import IElementExSwapAbi from './elementEx/IElementExSwapV2.json'
import HelperAbi from './elementEx/IAggTraderHelper.json'
import SeaportAbi from './others/Seaport.json'
import LooksRareAbi from './others/LooksRare.json'

export interface AbiInfo {
    contractName: string;
    sourceName?: string;
    abi: any;
}

export const ContractABI = {
    weth: WETHAbi as AbiInfo,
    erc20: ERC20Abi as AbiInfo,
    erc721: ERC721Abi as AbiInfo,
    erc1155: ERC1155Abi as AbiInfo,
    elementEx: IElementExAbi as AbiInfo,
    elementExSwap: IElementExSwapAbi as AbiInfo,
    helper: HelperAbi as AbiInfo,
    seaport: SeaportAbi as AbiInfo,
    looksRare: LooksRareAbi as AbiInfo
}
