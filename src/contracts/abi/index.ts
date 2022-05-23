import ERC20Abi from './common/ERC20.json';
import ERC721Abi from './common/ERC721.json';
import ERC1155Abi from './common/ERC1155.json';
import WETHAbi from './common/WETH.json';
import IElementEx from './elementEx/IElementEx.json';
import ElementExHelper from './elementEx/ElementExHelper.json';

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
    elementExV3: IElementEx as AbiInfo,
    elementExV3Helper: ElementExHelper as AbiInfo
}
