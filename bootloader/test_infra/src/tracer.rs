use colored::Colorize;

use vm::{
    old_vm::utils::dump_memory_page_using_primitive_value, BootloaderState, DynTracer,
    ExecutionEndTracer, ExecutionProcessing, Halt, HistoryMode, SimpleMemory, TxRevertReason,
    VmExecutionResultAndLogs, VmExecutionStopReason, VmTracer, ZkSyncVmState,
};
use zksync_state::{StoragePtr, WriteStorage};
use zksync_types::zkevm_test_harness::zk_evm::{
    tracing::{BeforeExecutionData, VmLocalStateData},
    zkevm_opcode_defs::{
        decoding::{AllowedPcOrImm, EncodingModeProduction, VmEncodingMode},
        RET_IMPLICIT_RETURNDATA_PARAMS_REGISTER,
    },
};

use crate::hook::TestVmHook;

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
}

impl<S, H: HistoryMode> DynTracer<S, H> for BootloaderTestTracer {
    fn before_execution(
        &mut self,
        state: VmLocalStateData<'_>,
        data: BeforeExecutionData,
        memory: &SimpleMemory<H>,
        _storage: StoragePtr<S>,
    ) {
        let hook = TestVmHook::from_opcode_memory(&state, &data, memory);

        if let TestVmHook::TestLog(msg, data_str) = &hook {
            println!("{} {} {}", "Test log".bold(), msg, data_str);
        }
        if let TestVmHook::AssertEqFailed(a, b, msg) = &hook {
            let result = format!("Assert failed: {} is not equal to {}: {}", a, b, msg);
            self.test_failed = Some(result.clone());
            println!("{} {}", "TEST FAILED:".red(), result)
        }
        if let TestVmHook::RequestedAssert(requested_assert) = &hook {
            self.requested_assert = Some(requested_assert.clone())
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
