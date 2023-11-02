import '@matterlabs/hardhat-zksync-chai-matchers';
import '@matterlabs/hardhat-zksync-solc';
import '@nomiclabs/hardhat-ethers';
import '@typechain/hardhat';

export default {
    zksolc: {
        version: '1.3.14',
        compilerSource: 'binary',
        settings: {
            isSystem: true
        }
    },
    zkSyncDeploy: {
        zkSyncNetwork: 'http://localhost:3050',
        ethNetwork: 'http://localhost:8545'
    },
    solidity: {
        version: '0.8.17',
        settings: {
            optimizer: {
                enabled: true,
                runs: 200
            },
            viaIR: true
        }
    },
    networks: {
        hardhat: {
            zksync: true
        },
        zkSyncTestNode: {
            url: 'http://127.0.0.1:8011',
            ethNetwork: '',
            zksync: true
        }
    },
    paths: {
        sources: "./contracts-preprocessed"
    },
};
