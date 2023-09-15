use once_cell::sync::OnceCell;
use std::sync::Arc;

use colored::Colorize;
use hex;
use std::env;
use vm::constants::BOOTLOADER_HEAP_PAGE;
use vm::constants::VM_HOOK_PARAMS_COUNT;
use vm::constants::VM_HOOK_PARAMS_START_POSITION;
use vm::constants::VM_HOOK_POSITION;
use vm::old_vm::utils::dump_memory_page_using_primitive_value;
use vm::old_vm::utils::heap_page_from_base;
use vm::BootloaderState;
use vm::DynTracer;
use vm::ExecutionEndTracer;
use vm::ExecutionProcessing;
use vm::Halt;
use vm::HistoryDisabled;
use vm::HistoryMode;
use vm::L1BatchEnv;
use vm::L2BlockEnv;
use vm::SimpleMemory;
use vm::SystemEnv;
use vm::TxExecutionMode;
use vm::TxRevertReason;
use vm::Vm;
use vm::VmExecutionResultAndLogs;
use vm::VmExecutionStopReason;
use vm::VmTracer;
use vm::ZkSyncVmState;
use zksync_contracts::read_sys_contract_bytecode;
use zksync_contracts::read_zbin_bytecode;
use zksync_contracts::BaseSystemContracts;
use zksync_contracts::ContractLanguage;
use zksync_contracts::SystemContractCode;
use zksync_state::InMemoryStorage;
use zksync_state::StoragePtr;
use zksync_state::StorageView;
use zksync_state::WriteStorage;
use zksync_types::block::legacy_miniblock_hash;
use zksync_types::zkevm_test_harness::zk_evm::tracing::BeforeExecutionData;
use zksync_types::zkevm_test_harness::zk_evm::tracing::VmLocalStateData;
use zksync_types::zkevm_test_harness::zk_evm::zkevm_opcode_defs::decoding::AllowedPcOrImm;
use zksync_types::zkevm_test_harness::zk_evm::zkevm_opcode_defs::decoding::EncodingModeProduction;
use zksync_types::zkevm_test_harness::zk_evm::zkevm_opcode_defs::decoding::VmEncodingMode;
use zksync_types::zkevm_test_harness::zk_evm::zkevm_opcode_defs::system_params::BOOTLOADER_MAX_MEMORY;
use zksync_types::zkevm_test_harness::zk_evm::zkevm_opcode_defs::FatPointer;
use zksync_types::zkevm_test_harness::zk_evm::zkevm_opcode_defs::Opcode;
use zksync_types::zkevm_test_harness::zk_evm::zkevm_opcode_defs::UMAOpcode;
use zksync_types::zkevm_test_harness::zk_evm::zkevm_opcode_defs::RET_IMPLICIT_RETURNDATA_PARAMS_REGISTER;
use zksync_types::Address;
use zksync_types::L1BatchNumber;
use zksync_types::MiniblockNumber;
use zksync_types::H256;
use zksync_types::U256;
use zksync_utils::bytecode::hash_bytecode;
use zksync_utils::bytes_to_be_words;
use zksync_utils::u256_to_h256;

pub struct BootloaderTestTracer {
    test_failed: Option<String>,
    requested_assert: Option<String>,
    pub test_count: Arc<OnceCell<u32>>,
}

fn strip_trailing_zeros(input: &[u8]) -> &[u8] {
    // Find the position of the last non-zero byte.
    let end = input
        .iter()
        .rposition(|&byte| byte != 0)
        .map(|pos| pos + 1)
        .unwrap_or(0);

    // Return the byte slice up to the position found.
    &input[..end]
}

impl BootloaderTestTracer {
    pub fn new(test_count_result: Arc<OnceCell<u32>>) -> Self {
        BootloaderTestTracer {
            test_failed: None,
            requested_assert: None,
            test_count: test_count_result,
        }
    }

    pub fn handle_assert<H: HistoryMode>(&mut self, memory: &SimpleMemory<H>) -> String {
        let vm_hook_params: Vec<_> = get_vm_hook_params(memory)
            .into_iter()
            .map(u256_to_h256)
            .collect();
        let val0 = vm_hook_params[0].as_bytes().to_vec();
        let val1 = vm_hook_params[1].as_bytes().to_vec();
        let msg = vm_hook_params[3].as_bytes().to_vec();

        let msg = String::from_utf8(msg).expect("Invalid debug message");
        let val0 = U256::from_big_endian(&val0);
        let val1 = U256::from_big_endian(&val1);

        let result = format!("Assert failed: {} is not equal to {}: {}", val0, val1, msg);
        self.test_failed = Some(result.clone());
        result
    }

    pub fn set_requested_assert<H: HistoryMode>(&mut self, memory: &SimpleMemory<H>) {
        let vm_hook_params: Vec<_> = get_vm_hook_params(memory)
            .into_iter()
            .map(u256_to_h256)
            .collect();
        let msg = vm_hook_params[0].as_bytes().to_vec();

        let msg =
            String::from_utf8(strip_trailing_zeros(&msg).to_vec()).expect("Invalid debug message");

        self.requested_assert = Some(msg);
    }
    pub fn parse_test_count<H: HistoryMode>(&mut self, memory: &SimpleMemory<H>) {
        let vm_hook_params: Vec<_> = get_vm_hook_params(memory)
            .into_iter()
            .map(u256_to_h256)
            .collect();
        let val0 = vm_hook_params[0].as_bytes().to_vec();
        let val0 = U256::from_big_endian(&val0);

        self.test_count.set(val0.as_u32()).unwrap();
    }
}

#[derive(Clone, Debug, Copy)]
pub(crate) enum TestVmHook {
    NoHook,
    TestLog,
    AssertEqFailed,
    RequestedAssert,
    TestCount,
}

fn get_vm_hook_params<H: HistoryMode>(memory: &SimpleMemory<H>) -> Vec<U256> {
    memory.dump_page_content_as_u256_words(
        BOOTLOADER_HEAP_PAGE,
        // +2 is a huge hack here.
        VM_HOOK_PARAMS_START_POSITION..VM_HOOK_PARAMS_START_POSITION + VM_HOOK_PARAMS_COUNT + 2,
    )
}

pub fn get_test_log<H: HistoryMode>(memory: &SimpleMemory<H>) -> String {
    let vm_hook_params: Vec<_> = get_vm_hook_params(memory)
        .into_iter()
        .map(u256_to_h256)
        .collect();
    let msg = vm_hook_params[0].as_bytes().to_vec();
    let data = vm_hook_params[1].as_bytes().to_vec();

    let msg = String::from_utf8(msg).expect("Invalid debug message");
    let data = U256::from_big_endian(&data);

    // For long data, it is better to use hex-encoding for greater readibility
    let data_str = if data > U256::from(u64::max_value()) {
        let mut bytes = [0u8; 32];
        data.to_big_endian(&mut bytes);
        format!("0x{}", hex::encode(bytes))
    } else {
        data.to_string()
    };

    format!("{} {}", msg, data_str)
}

impl TestVmHook {
    pub(crate) fn from_opcode_memory(
        state: &VmLocalStateData<'_>,
        data: &BeforeExecutionData,
    ) -> Self {
        let opcode_variant = data.opcode.variant;
        let heap_page =
            heap_page_from_base(state.vm_local_state.callstack.current.base_memory_page).0;

        let src0_value = data.src0_value.value;

        let fat_ptr = FatPointer::from_u256(src0_value);

        let value = data.src1_value.value;

        // Only UMA opcodes in the bootloader serve for vm hooks
        if !matches!(opcode_variant.opcode, Opcode::UMA(UMAOpcode::HeapWrite))
            || heap_page != BOOTLOADER_HEAP_PAGE
            || fat_ptr.offset != VM_HOOK_POSITION * 32
        {
            return Self::NoHook;
        }

        match value.as_u32() {
            100 => Self::TestLog,
            101 => Self::AssertEqFailed,
            102 => Self::RequestedAssert,
            103 => Self::TestCount,

            _ => Self::NoHook,
        }
    }
}

impl<S, H: HistoryMode> DynTracer<S, H> for BootloaderTestTracer {
    fn before_execution(
        &mut self,
        state: VmLocalStateData<'_>,
        data: BeforeExecutionData,
        memory: &SimpleMemory<H>,
        _storage: StoragePtr<S>,
    ) {
        let hook = TestVmHook::from_opcode_memory(&state, &data);

        if let TestVmHook::TestLog = hook {
            let log = get_test_log(memory);
            println!("{} {}", "Test log".bold(), log);
        }
        if let TestVmHook::AssertEqFailed = hook {
            let result = self.handle_assert(memory);
            println!("{} {}", "TEST FAILED:".red(), result)
        }
        if let TestVmHook::RequestedAssert = hook {
            self.set_requested_assert(memory);
        }
        if let TestVmHook::TestCount = hook {
            self.parse_test_count(memory);
        }
    }
}

impl<H: HistoryMode> ExecutionEndTracer<H> for BootloaderTestTracer {
    fn should_stop_execution(&self) -> bool {
        self.test_failed.is_some()
    }
}

impl<S: WriteStorage, H: HistoryMode> ExecutionProcessing<S, H> for BootloaderTestTracer {
    fn after_vm_execution(
        &mut self,
        state: &mut ZkSyncVmState<S, H>,
        _bootloader_state: &BootloaderState,
        _stop_reason: VmExecutionStopReason,
    ) {
        if let Some(requested_assert) = &self.requested_assert {
            let r1 = state.local_state.registers[RET_IMPLICIT_RETURNDATA_PARAMS_REGISTER as usize];

            let outer_eh_location =
                <EncodingModeProduction as VmEncodingMode<8>>::PcOrImm::MAX.as_u64();

            if let VmExecutionStopReason::VmFinished = _stop_reason {
                if state.execution_has_ended()
                    && state.local_state.callstack.get_current_stack().pc.as_u64()
                        == outer_eh_location
                {
                    if !state.local_state.flags.overflow_or_less_than_flag {
                        let returndata = dump_memory_page_using_primitive_value(&state.memory, r1);
                        let revert_reason = TxRevertReason::parse_error(&returndata);
                        if let TxRevertReason::Halt(Halt::UnexpectedVMBehavior(reason)) =
                            revert_reason
                        {
                            let reason = reason.strip_prefix("Assertion error: ").unwrap();
                            if reason != requested_assert {
                                println!(
                                    "{} Should have failed with `{}`, but failed with `{}`",
                                    "Test failed.".red(),
                                    requested_assert,
                                    reason,
                                );
                                return;
                            } else {
                                println!("{}", "[PASS]".bold().green());
                                return;
                            }
                        }
                    }
                }
            }
            println!(
                "{} Should have failed with {}, but run succefully.",
                "Test failed.".red(),
                requested_assert,
            );
            return;
        }

        println!("{}", "[PASS]".bold().green());
    }
}

impl<S: WriteStorage, H: HistoryMode> VmTracer<S, H> for BootloaderTestTracer {
    fn save_results(&mut self, _result: &mut VmExecutionResultAndLogs) {}
}

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

        let custom_tracers = vec![Box::new(BootloaderTestTracer::new(test_count.clone()))
            as Box<dyn VmTracer<StorageView<InMemoryStorage>, HistoryDisabled>>];

        vm.inspect_the_rest_of_the_batch(custom_tracers);

        test_count.get().unwrap().clone()
    };
    println!(" ==== Running {} tests ====", test_count);

    for test_id in 1..=test_count {
        println!("\n === Running test {}", test_id);

        let storage: StoragePtr<StorageView<InMemoryStorage>> =
            StorageView::new(InMemoryStorage::with_system_contracts(hash_bytecode)).to_rc_ptr();

        // Crazy hack - passing id of the test in location (0) where we normally put the operator.
        l1_batch_env.fee_account = zksync_types::H160::from(u256_to_h256(U256::from(test_id)));
        let mut vm = Vm::new(
            l1_batch_env.clone(),
            system_env.clone(),
            storage.clone(),
            HistoryDisabled,
        );
        let test_count = Arc::new(OnceCell::default());

        let custom_tracers = vec![Box::new(BootloaderTestTracer::new(test_count.clone()))
            as Box<dyn VmTracer<StorageView<InMemoryStorage>, HistoryDisabled>>];

        let result = vm.inspect_the_rest_of_the_batch(custom_tracers);

        println!("Result: {:?}", result);
    }
}

fn main() {
    execute_internal_bootloader_test();
}
