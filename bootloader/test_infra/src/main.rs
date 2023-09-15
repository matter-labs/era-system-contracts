use once_cell::sync::OnceCell;
use std::{env, sync::Arc};
use vm::{HistoryDisabled, L1BatchEnv, L2BlockEnv, SystemEnv, TxExecutionMode, Vm, VmTracer};
use zksync_contracts::{
    read_sys_contract_bytecode, read_zbin_bytecode, BaseSystemContracts, ContractLanguage,
    SystemContractCode,
};
use zksync_state::{InMemoryStorage, StoragePtr, StorageView};

use zksync_types::{block::legacy_miniblock_hash, Address, L1BatchNumber, MiniblockNumber, U256};

use zksync_utils::bytecode::hash_bytecode;
use zksync_utils::{bytes_to_be_words, u256_to_h256};

use crate::{test_count_tracer::TestCountTracer, tracer::BootloaderTestTracer};

mod test_count_tracer;
mod tracer;

/// Executes the "internal transfer test" of the bootloader -- the test that
/// returns the amount of gas needed to perform and internal transfer, assuming no gas price
/// per pubdata, i.e. under assumption that the refund will not touch any new slots.
fn execute_internal_bootloader_test() {
    let test_location = env::current_dir()
        .unwrap()
        .join("../build/artifacts/bootloader_test.yul/bootloader_test.yul.zbin");
    println!("Current dir is {:?}", test_location);
    let bytecode = read_zbin_bytecode(test_location.as_path());
    let hash = hash_bytecode(&bytecode);
    let bootloader = SystemContractCode {
        code: bytes_to_be_words(bytecode),
        hash,
    };

    let bytecode = read_sys_contract_bytecode("", "DefaultAccount", ContractLanguage::Sol);
    let hash = hash_bytecode(&bytecode);
    let default_aa = SystemContractCode {
        code: bytes_to_be_words(bytecode),
        hash,
    };

    let base_system_contract = BaseSystemContracts {
        bootloader,
        default_aa,
    };

    let system_env = SystemEnv {
        zk_porter_available: false,
        version: zksync_types::ProtocolVersionId::Version14,
        base_system_smart_contracts: base_system_contract,
        gas_limit: 80_000_000,
        execution_mode: TxExecutionMode::VerifyExecute,
        default_validation_computational_gas_limit: 80_000_000,
        chain_id: zksync_types::L2ChainId(299),
    };

    let mut l1_batch_env = L1BatchEnv {
        previous_batch_hash: None,
        number: L1BatchNumber::from(13),
        timestamp: 14,
        l1_gas_price: 250_000_000,
        fair_l2_gas_price: 250_000_000,
        fee_account: Address::default(),

        enforced_base_fee: None,
        first_l2_block: L2BlockEnv {
            number: 1,
            timestamp: 15,
            prev_block_hash: legacy_miniblock_hash(MiniblockNumber(0)),
            max_virtual_blocks_to_create: 0,
        },
    };

    // First - get the number of tests.
    let test_count = {
        let storage: StoragePtr<StorageView<InMemoryStorage>> =
            StorageView::new(InMemoryStorage::with_system_contracts(hash_bytecode)).to_rc_ptr();

        let mut vm = Vm::new(
            l1_batch_env.clone(),
            system_env.clone(),
            storage.clone(),
            HistoryDisabled,
        );

        let test_count = Arc::new(OnceCell::default());
        let custom_tracers = vec![Box::new(TestCountTracer::new(test_count.clone()))
            as Box<dyn VmTracer<StorageView<InMemoryStorage>, HistoryDisabled>>];

        // We're using a TestCountTracer (and passing 0 as fee account) - this should cause the bootloader
        // test framework to report number of tests via VM hook.
        vm.inspect_the_rest_of_the_batch(custom_tracers);

        test_count.get().unwrap().clone()
    };
    println!(" ==== Running {} tests ====", test_count);

    // Now we iterate over the tests.
    for test_id in 1..=test_count {
        println!("\n === Running test {}", test_id);

        let storage: StoragePtr<StorageView<InMemoryStorage>> =
            StorageView::new(InMemoryStorage::with_system_contracts(hash_bytecode)).to_rc_ptr();

        // We are passing id of the test in location (0) where we normally put the operator.
        // This is then picked up by the testing framework.
        l1_batch_env.fee_account = zksync_types::H160::from(u256_to_h256(U256::from(test_id)));
        let mut vm = Vm::new(
            l1_batch_env.clone(),
            system_env.clone(),
            storage.clone(),
            HistoryDisabled,
        );
        let custom_tracers = vec![Box::new(BootloaderTestTracer::new())
            as Box<dyn VmTracer<StorageView<InMemoryStorage>, HistoryDisabled>>];

        let result = vm.inspect_the_rest_of_the_batch(custom_tracers);

        println!("Result: {:?}", result);
    }
}

fn main() {
    execute_internal_bootloader_test();
}
