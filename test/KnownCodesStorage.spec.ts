import { expect } from 'chai';
import { ethers, network } from 'hardhat';
import { Wallet } from 'zksync-web3';
import {
    ContractDeployer__factory,
    KnownCodesStorage, KnownCodesStorage__factory,
    MockContract, MockContract__factory,
    MockL1Messenger,
    MockL1Messenger__factory
} from '../typechain-types';
import {
    ACCOUNT_CODE_STORAGE_SYSTEM_CONTRACT_ADDRESS,
    BOOTLOADER_FORMAL_ADDRESS,
    COMPRESSOR_CONTRACT_ADDRESS, DEPLOYER_SYSTEM_CONTRACT_ADDRESS, KNOWN_CODE_STORAGE_CONTRACT_ADDRESS,
    L1_MESSENGER_SYSTEM_CONTRACT_ADDRESS
} from './shared/constants';
import {deployContract, deployContractOnAddress, getCode, getWallets, loadArtifact, setCode} from './shared/utils';

describe('KnownCodesStorage tests', function () {
    let wallet: Wallet;
    let bootloaderAccount: ethers.Signer;
    let compressorAccount: ethers.Signer;

    let knownCodesStorage: KnownCodesStorage;
    let mockL1Messenger: MockContract;

    let l1MessengerIface: ethers.utils.Interface

    const BYTECODE_HASH_1 = '0x0100FFFFDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEF';
    const BYTECODE_HASH_2 = '0x0100FFFFDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEE1';
    const BYTECODE_HASH_3 = '0x0100FFFFDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEE2';
    const BYTECODE_HASH_4 = '0x0100FFFFDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEE3';
    const INCORRECTLY_FORMATTED_HASH = '0x0120FFFFDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEF';
    const INVALID_LENGTH_HASH = '0x0100FFFEDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEF';

    // TODO: currently test depends on the previous state and can not be run twice, think about fixing it. Relevant for other tests as well.
    before(async () => {
        wallet = (await getWallets())[0];

        await deployContractOnAddress(KNOWN_CODE_STORAGE_CONTRACT_ADDRESS, 'KnownCodesStorage')
        knownCodesStorage = KnownCodesStorage__factory.connect(KNOWN_CODE_STORAGE_CONTRACT_ADDRESS, wallet);

        await deployContractOnAddress(L1_MESSENGER_SYSTEM_CONTRACT_ADDRESS, 'MockContract')
        mockL1Messenger = MockContract__factory.connect(L1_MESSENGER_SYSTEM_CONTRACT_ADDRESS, wallet);

        l1MessengerIface = new ethers.utils.Interface((await loadArtifact('L1Messenger')).abi)

        await network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [BOOTLOADER_FORMAL_ADDRESS]
        });
        await network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [COMPRESSOR_CONTRACT_ADDRESS]
        });
        bootloaderAccount = await ethers.getSigner(BOOTLOADER_FORMAL_ADDRESS);
        compressorAccount = await ethers.getSigner(COMPRESSOR_CONTRACT_ADDRESS);
    });

    after(async () => {
        await network.provider.request({
            method: 'hardhat_stopImpersonatingAccount',
            params: [BOOTLOADER_FORMAL_ADDRESS]
        });
        await network.provider.request({
            method: 'hardhat_stopImpersonatingAccount',
            params: [COMPRESSOR_CONTRACT_ADDRESS]
        });
    });

    describe('markBytecodeAsPublished', function () {
        it('non-compressor failed to call', async () => {
            await expect(knownCodesStorage.markBytecodeAsPublished(BYTECODE_HASH_1)).to.be.revertedWith(
                'Callable only by the compressor'
            );
        });

        it('incorrectly fomatted bytecode hash failed to call', async () => {
            await expect(
                knownCodesStorage.connect(compressorAccount).markBytecodeAsPublished(INCORRECTLY_FORMATTED_HASH)
            ).to.be.revertedWith('Incorrectly formatted bytecodeHash');
        });

        it('invalid length bytecode hash failed to call', async () => {
            await expect(
                knownCodesStorage.connect(compressorAccount).markBytecodeAsPublished(INVALID_LENGTH_HASH)
            ).to.be.revertedWith('Code length in words must be odd');
        });

        it('successfuly marked', async () => {
            await expect(knownCodesStorage.connect(compressorAccount).markBytecodeAsPublished(BYTECODE_HASH_1))
                .to.emit(knownCodesStorage, 'MarkedAsKnown')
                .withArgs(BYTECODE_HASH_1.toLowerCase(), false)
                .not.emit(mockL1Messenger, 'Called');
            expect(await knownCodesStorage.getMarker(BYTECODE_HASH_1)).to.be.eq(1);
        });

        it('not marked second time', async () => {
            await expect(
                knownCodesStorage.connect(compressorAccount).markBytecodeAsPublished(BYTECODE_HASH_1)
            ).to.not.emit(knownCodesStorage, 'MarkedAsKnown');
        });
    });

    describe('markFactoryDeps', function () {
        it('non-bootloader failed to call', async () => {
            await expect(
                knownCodesStorage.markFactoryDeps(false, [BYTECODE_HASH_2, BYTECODE_HASH_3])
            ).to.be.revertedWith('Callable only by the bootloader');
        });

        it('incorrectly fomatted bytecode hash failed to call', async () => {
            await expect(
                knownCodesStorage
                    .connect(bootloaderAccount)
                    .markFactoryDeps(true, [BYTECODE_HASH_2, INCORRECTLY_FORMATTED_HASH])
            ).to.be.revertedWith('Incorrectly formatted bytecodeHash');
        });

        it('invalid length bytecode hash failed to call', async () => {
            await expect(
                knownCodesStorage
                    .connect(bootloaderAccount)
                    .markFactoryDeps(false, [INVALID_LENGTH_HASH, BYTECODE_HASH_3])
            ).to.be.revertedWith('Code length in words must be odd');
        });

        it('successfuly marked', async () => {
            await expect(
                knownCodesStorage.connect(bootloaderAccount).markFactoryDeps(false, [BYTECODE_HASH_2, BYTECODE_HASH_3])
            )
                .to.emit(knownCodesStorage, 'MarkedAsKnown')
                .withArgs(BYTECODE_HASH_2.toLowerCase(), false)
                .emit(knownCodesStorage, 'MarkedAsKnown')
                .withArgs(BYTECODE_HASH_3.toLowerCase(), false)
                .not.emit(mockL1Messenger, 'Called')
            expect(await knownCodesStorage.getMarker(BYTECODE_HASH_2)).to.be.eq(1);
            expect(await knownCodesStorage.getMarker(BYTECODE_HASH_3)).to.be.eq(1);
        });

        it('not marked second time', async () => {
            await expect(
                knownCodesStorage.connect(bootloaderAccount).markFactoryDeps(false, [BYTECODE_HASH_2, BYTECODE_HASH_3])
            ).to.not.emit(knownCodesStorage, 'MarkedAsKnown');
        });

        it('sent to l1', async () => {
            await expect(knownCodesStorage.connect(bootloaderAccount).markFactoryDeps(true, [BYTECODE_HASH_4]))
                .to.emit(knownCodesStorage, 'MarkedAsKnown')
                .withArgs(BYTECODE_HASH_4.toLowerCase(), true)
                .emit(mockL1Messenger, 'Called')
                .withArgs(0, l1MessengerIface.encodeFunctionData('requestBytecodeL1Publication', [BYTECODE_HASH_4]));
            expect(await knownCodesStorage.getMarker(BYTECODE_HASH_4)).to.be.eq(1);
        });
    });

    describe('getMarker', function () {
        it('not known', async () => {
            expect(await knownCodesStorage.getMarker(INCORRECTLY_FORMATTED_HASH)).to.be.eq(0);
        });

        it('known', async () => {
            expect(await knownCodesStorage.getMarker(BYTECODE_HASH_1)).to.be.eq(1);
        });
    });
});
