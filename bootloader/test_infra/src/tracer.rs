use colored::Colorize;
use hex;

use vm::{
    constants::{
        BOOTLOADER_HEAP_PAGE, VM_HOOK_PARAMS_COUNT, VM_HOOK_PARAMS_START_POSITION, VM_HOOK_POSITION,
    },
    old_vm::utils::{dump_memory_page_using_primitive_value, heap_page_from_base},
    BootloaderState, DynTracer, ExecutionEndTracer, ExecutionProcessing, Halt, HistoryMode,
    SimpleMemory, TxRevertReason, VmExecutionResultAndLogs, VmExecutionStopReason, VmTracer,
    ZkSyncVmState,
};
use zksync_state::{StoragePtr, WriteStorage};
use zksync_types::{
    zkevm_test_harness::zk_evm::{
        tracing::{BeforeExecutionData, VmLocalStateData},
        zkevm_opcode_defs::{
            decoding::{AllowedPcOrImm, EncodingModeProduction, VmEncodingMode},
            FatPointer, Opcode, UMAOpcode, RET_IMPLICIT_RETURNDATA_PARAMS_REGISTER,
        },
    },
    U256,
};
use zksync_utils::u256_to_h256;

/// Bootloader test tracer that is executing while the bootloader tests are running.
/// It can check the assers, return information about the running tests (and amount of tests) etc.

pub struct BootloaderTestTracer {
    /// Set if the currently running test has failed.
    test_failed: Option<String>,
    /// Set, if the currently running test should fail with a given assert.
    requested_assert: Option<String>,
}

impl BootloaderTestTracer {
    pub fn new() -> Self {
        BootloaderTestTracer {
            test_failed: None,
            requested_assert: None,
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
