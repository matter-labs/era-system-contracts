import { expect } from 'chai';
import { BootloaderUtilities } from '../typechain';
import { Wallet } from 'zksync-web3';
import { getWallets, deployContract } from './shared/utils';
import { ethers } from 'hardhat';
import * as zksync from 'zksync-web3';
import { hashBytecode, serialize } from 'zksync-web3/build/src/utils';
import { BigNumberish, BytesLike, Transaction } from 'ethers';

describe('BootloaderUtilities tests', function () {
    let wallet: Wallet;
    let bootloaderUtilities: BootloaderUtilities;

    before(async () => {
        wallet = getWallets()[0];
        bootloaderUtilities = (await deployContract('BootloaderUtilities')) as BootloaderUtilities;
    });

    describe('EIP-712 transaction', function () {
        it('check hashes', async () => {
            const eip712Tx = await wallet.populateTransaction({
                type: 113,
                to: wallet.address,
                from: wallet.address,
                data: '0x',
                value: 0,
                maxFeePerGas: 12000,
                maxPriorityFeePerGas: 100,
                customData: {
                    gasPerPubdata: zksync.utils.DEFAULT_GAS_PER_PUBDATA_LIMIT
                }
            });
            const signedEip712Tx = await wallet.signTransaction(eip712Tx);
            const parsedEIP712tx = zksync.utils.parseTransaction(signedEip712Tx);

            const eip712TxData = signedTxToTransactionData(parsedEIP712tx)!;
            const expectedEIP712TxHash = parsedEIP712tx.hash;
            const expectedEIP712SignedHash = zksync.EIP712Signer.getSignedDigest(eip712Tx);

            const proposedEIP712Hashes = await bootloaderUtilities.getTransactionHashes(eip712TxData);

            expect(proposedEIP712Hashes.txHash).to.be.eq(expectedEIP712TxHash);
            expect(proposedEIP712Hashes.signedTxHash).to.be.eq(expectedEIP712SignedHash);
        });
    });

    describe('legacy transaction', function () {
        it('check hashes', async () => {
            const legacyTx = await wallet.populateTransaction({
                type: 0,
                to: wallet.address,
                from: wallet.address,
                data: '0x',
                value: 0,
                gasLimit: 50000
            });
            const txBytes = await wallet.signTransaction(legacyTx);
            const parsedTx = zksync.utils.parseTransaction(txBytes);
            const txData = signedTxToTransactionData(parsedTx)!;

            const expectedTxHash = parsedTx.hash;
            delete legacyTx.from;
            const expectedSignedHash = ethers.utils.keccak256(serialize(legacyTx));

            const proposedHashes = await bootloaderUtilities.getTransactionHashes(txData);
            expect(proposedHashes.txHash).to.be.eq(expectedTxHash);
            expect(proposedHashes.signedTxHash).to.be.eq(expectedSignedHash);
        });

        it('invalid v signature value', async () => {
            const legacyTx = await wallet.populateTransaction({
                type: 0,
                to: wallet.address,
                from: wallet.address,
                data: '0x',
                value: 0,
                gasLimit: 50000
            });
            const txBytes = await wallet.signTransaction(legacyTx);
            const parsedTx = zksync.utils.parseTransaction(txBytes);
            const txData = signedTxToTransactionData(parsedTx)!;

            let signature = ethers.utils.arrayify(txData.signature);
            signature[64] = 29;
            txData.signature = signature;

            await expect(bootloaderUtilities.getTransactionHashes(txData)).to.be.revertedWith('Invalid v value');
        });
    });

    describe('EIP-1559 transaction', function () {
        it('check hashes', async () => {
            const eip1559Tx = await wallet.populateTransaction({
                type: 2,
                to: wallet.address,
                from: wallet.address,
                data: '0x',
                value: 0,
                maxFeePerGas: 12000,
                maxPriorityFeePerGas: 100
            });
            const signedEip1559Tx = await wallet.signTransaction(eip1559Tx);
            const parsedEIP1559tx = zksync.utils.parseTransaction(signedEip1559Tx);

            const EIP1559TxData = signedTxToTransactionData(parsedEIP1559tx)!;
            delete eip1559Tx.from;
            const expectedEIP1559TxHash = parsedEIP1559tx.hash;
            const expectedEIP1559SignedHash = ethers.utils.keccak256(serialize(eip1559Tx));

            const proposedEIP1559Hashes = await bootloaderUtilities.getTransactionHashes(EIP1559TxData);
            expect(proposedEIP1559Hashes.txHash).to.be.eq(expectedEIP1559TxHash);
            expect(proposedEIP1559Hashes.signedTxHash).to.be.eq(expectedEIP1559SignedHash);
        });

        it('invalid v signature value', async () => {
            const eip1559Tx = await wallet.populateTransaction({
                type: 2,
                to: wallet.address,
                from: wallet.address,
                data: '0x',
                value: 0,
                maxFeePerGas: 12000,
                maxPriorityFeePerGas: 100
            });
            const signedEip1559Tx = await wallet.signTransaction(eip1559Tx);
            const parsedEIP1559tx = zksync.utils.parseTransaction(signedEip1559Tx);

            const EIP1559TxData = signedTxToTransactionData(parsedEIP1559tx)!;
            let signature = ethers.utils.arrayify(EIP1559TxData.signature);
            signature[64] = 0;
            EIP1559TxData.signature = signature;

            await expect(bootloaderUtilities.getTransactionHashes(EIP1559TxData)).to.be.revertedWith('Invalid v value');
        });
    });

    describe('EIP-1559 transaction', function () {
        it('check hashes', async () => {
            const eip2930Tx = await wallet.populateTransaction({
                type: 1,
                to: wallet.address,
                from: wallet.address,
                data: '0x',
                value: 0,
                gasLimit: 50000,
                gasPrice: 55000
            });
            const signedEip2930Tx = await wallet.signTransaction(eip2930Tx);
            const parsedEIP2930tx = zksync.utils.parseTransaction(signedEip2930Tx);

            const EIP2930TxData = signedTxToTransactionData(parsedEIP2930tx)!;
            delete eip2930Tx.from;
            const expectedEIP2930TxHash = parsedEIP2930tx.hash;
            const expectedEIP2930SignedHash = ethers.utils.keccak256(serialize(eip2930Tx));

            const proposedEIP2930Hashes = await bootloaderUtilities.getTransactionHashes(EIP2930TxData);
            expect(proposedEIP2930Hashes.txHash).to.be.eq(expectedEIP2930TxHash);
            expect(proposedEIP2930Hashes.signedTxHash).to.be.eq(expectedEIP2930SignedHash);
        });

        it('invalid v signature value', async () => {
            const eip2930Tx = await wallet.populateTransaction({
                type: 1,
                to: wallet.address,
                from: wallet.address,
                data: '0x',
                value: 0,
                gasLimit: 50000,
                gasPrice: 55000
            });
            const signedEip2930Tx = await wallet.signTransaction(eip2930Tx);
            const parsedEIP2930tx = zksync.utils.parseTransaction(signedEip2930Tx);

            const EIP2930TxData = signedTxToTransactionData(parsedEIP2930tx)!;
            let signature = ethers.utils.arrayify(EIP2930TxData.signature);
            signature[64] = 100;
            EIP2930TxData.signature = signature;

            await expect(bootloaderUtilities.getTransactionHashes(EIP2930TxData)).to.be.revertedWith('Invalid v value');
        });
    });
});

// Interface encoding the transaction struct used for AA protocol
interface TransactionData {
    txType: BigNumberish;
    from: BigNumberish;
    to: BigNumberish;
    gasLimit: BigNumberish;
    gasPerPubdataByteLimit: BigNumberish;
    maxFeePerGas: BigNumberish;
    maxPriorityFeePerGas: BigNumberish;
    paymaster: BigNumberish;
    nonce: BigNumberish;
    value: BigNumberish;
    // In the future, we might want to add some
    // new fields to the struct. The `txData` struct
    // is to be passed to account and any changes to its structure
    // would mean a breaking change to these accounts. In order to prevent this,
    // we should keep some fields as "reserved".
    // It is also recommneded that their length is fixed, since
    // it would allow easier proof integration (in case we will need
    // some special circuit for preprocessing transactions).
    reserved: [BigNumberish, BigNumberish, BigNumberish, BigNumberish];
    data: BytesLike;
    signature: BytesLike;
    factoryDeps: BytesLike[];
    paymasterInput: BytesLike;
    // Reserved dynamic type for the future use-case. Using it should be avoided,
    // But it is still here, just in case we want to enable some additional functionality.
    reservedDynamic: BytesLike;
}

function signedTxToTransactionData(tx: Transaction) {
    // Transform legacy transaction's `v` part of the signature
    // to a single byte used in the packed eth signature
    function unpackV(v: number) {
        if (v >= 35) {
            const chainId = Math.floor((v - 35) / 2);
            return v - chainId * 2 - 8;
        } else if (v <= 1) {
            return 27 + v;
        }

        throw new Error('Invalid `v`');
    }

    function legacyTxToTransactionData(tx: any): TransactionData {
        return {
            txType: 0,
            from: tx.from!,
            to: tx.to!,
            gasLimit: tx.gasLimit!,
            gasPerPubdataByteLimit: zksync.utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
            maxFeePerGas: tx.gasPrice!,
            maxPriorityFeePerGas: tx.gasPrice!,
            paymaster: 0,
            nonce: tx.nonce,
            value: tx.value || 0,
            reserved: [tx.chainId || 0, 0, 0, 0],
            data: tx.data!,
            signature: ethers.utils.hexConcat([tx.r, tx.s, new Uint8Array([unpackV(tx.v)])]),
            factoryDeps: [],
            paymasterInput: '0x',
            reservedDynamic: '0x'
        };
    }

    function eip2930TxToTransactionData(tx: any): TransactionData {
        return {
            txType: 1,
            from: tx.from!,
            to: tx.to!,
            gasLimit: tx.gasLimit!,
            gasPerPubdataByteLimit: zksync.utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
            maxFeePerGas: tx.gasPrice!,
            maxPriorityFeePerGas: tx.gasPrice!,
            paymaster: 0,
            nonce: tx.nonce,
            value: tx.value || 0,
            reserved: [0, 0, 0, 0],
            data: tx.data!,
            signature: ethers.utils.hexConcat([tx.r, tx.s, unpackV(tx.v)]),
            factoryDeps: [],
            paymasterInput: '0x',
            reservedDynamic: '0x'
        };
    }

    function eip1559TxToTransactionData(tx: any): TransactionData {
        return {
            txType: 2,
            from: tx.from!,
            to: tx.to!,
            gasLimit: tx.gasLimit!,
            gasPerPubdataByteLimit: zksync.utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
            maxFeePerGas: tx.maxFeePerGas,
            maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
            paymaster: 0,
            nonce: tx.nonce,
            value: tx.value || 0,
            reserved: [0, 0, 0, 0],
            data: tx.data!,
            signature: ethers.utils.hexConcat([tx.r, tx.s, unpackV(tx.v)]),
            factoryDeps: [],
            paymasterInput: '0x',
            reservedDynamic: '0x'
        };
    }

    function eip712TxToTransactionData(tx: any): TransactionData {
        return {
            txType: 113,
            from: tx.from!,
            to: tx.to!,
            gasLimit: tx.gasLimit!,
            gasPerPubdataByteLimit: tx.customData.gasPerPubdata || zksync.utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
            maxFeePerGas: tx.maxFeePerGas,
            maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
            paymaster: tx.customData.paymasterParams?.paymaster || 0,
            nonce: tx.nonce,
            value: tx.value || 0,
            reserved: [0, 0, 0, 0],
            data: tx.data!,
            signature: tx.customData.customSignature,
            factoryDeps: tx.customData.factoryDeps.map(hashBytecode),
            paymasterInput: tx.customData.paymasterParams?.paymasterInput || '0x',
            reservedDynamic: '0x'
        };
    }

    const txType = tx.type ?? 0;

    switch (txType) {
        case 0:
            return legacyTxToTransactionData(tx);
        case 1:
            return eip2930TxToTransactionData(tx);
        case 2:
            return eip1559TxToTransactionData(tx);
        case 113:
            return eip712TxToTransactionData(tx);
        default:
            throw new Error('Unsupported tx type');
    }
}
