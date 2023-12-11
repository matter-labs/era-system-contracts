use std::sync::Arc;

use colored::Colorize;
use once_cell::sync::OnceCell;

use multivm::interface::{
    dyn_tracers::vm_1_4_0::DynTracer,
    tracer::{TracerExecutionStatus, TracerExecutionStopReason, VmExecutionStopReason},
};
use multivm::vm_latest::{BootloaderState, HistoryMode, SimpleMemory, VmTracer, ZkSyncVmState};
use multivm::zk_evm_1_4_0::tracing::{BeforeExecutionData, VmLocalStateData};

use zksync_state::{StoragePtr, WriteStorage};

use crate::hook::TestVmHook;

#[derive(Debug)]
pub struct TestResult {
    pub test_name: String,
    pub result: Result<(), String>,
}

/// Bootloader test tracer that is executing while the bootloader tests are running.
/// It can check the assers, return information about the running tests (and amount of tests) etc.
pub struct BootloaderTestTracer {
    /// Set if the currently running test has failed.
    test_result: Arc<OnceCell<TestResult>>,
    /// Set, if the currently running test should fail with a given assert.
    requested_assert: Option<String>,

    test_name: Option<String>,
}

impl BootloaderTestTracer {
    pub fn new(test_result: Arc<OnceCell<TestResult>>) -> Self {
        BootloaderTestTracer {
            test_result,
            requested_assert: None,
            test_name: None,
        }
    }
}

impl<S, H: HistoryMode> DynTracer<S, SimpleMemory<H>> for BootloaderTestTracer {
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

            self.test_result
                .set(TestResult {
                    test_name: self.test_name.clone().unwrap_or("".to_owned()),
                    result: Err(result.clone()),
                })
                .unwrap();
        }
        if let TestVmHook::RequestedAssert(requested_assert) = &hook {
            self.requested_assert = Some(requested_assert.clone())
        }

        if let TestVmHook::TestStart(test_name) = &hook {
            self.test_name = Some(test_name.clone());
        }
    }
}

impl<S: WriteStorage, H: HistoryMode> VmTracer<S, H> for BootloaderTestTracer {
    fn finish_cycle(
        &mut self,
        _state: &mut ZkSyncVmState<S, H>,
        _bootloader_state: &mut BootloaderState,
    ) -> TracerExecutionStatus {
        if let Some(TestResult {
            test_name: _,
            result: Err(_),
        }) = self.test_result.get()
        {
            TracerExecutionStatus::Stop(TracerExecutionStopReason::Finish)
        } else {
            TracerExecutionStatus::Continue
        }
    }

    fn after_vm_execution(
        &mut self,
        _state: &mut ZkSyncVmState<S, H>,
        _bootloader_state: &BootloaderState,
        _stop_reason: VmExecutionStopReason,
    ) {
        // let r = if let Some(requested_assert) = &self.requested_assert {
        //     match &result.result {
        //         ExecutionResult::Success { .. } => Err(format!(
        //             "Should have failed with {}, but run succesfully.",
        //             requested_assert
        //         )),
        //         ExecutionResult::Revert { output } => Err(format!(
        //             "Should have failed with {}, but run reverted with {}.",
        //             requested_assert,
        //             output.to_user_friendly_string()
        //         )),
        //         ExecutionResult::Halt { reason } => {
        //             if let Halt::UnexpectedVMBehavior(reason) = reason {
        //                 let reason = reason.strip_prefix("Assertion error: ").unwrap();
        //                 if reason == requested_assert {
        //                     Ok(())
        //                 } else {
        //                     Err(format!(
        //                         "Should have failed with `{}`, but failed with different assert `{}`",
        //                         requested_assert, reason
        //                     ))
        //                 }
        //             } else {
        //                 Err(format!(
        //                     "Should have failed with `{}`, but halted with`{}`",
        //                     requested_assert, reason
        //                 ))
        //             }
        //         }
        //     }
        // } else {
        //     match &result.result {
        //         ExecutionResult::Success { .. } => Ok(()),
        //         ExecutionResult::Revert { output } => Err(output.to_user_friendly_string()),
        //         ExecutionResult::Halt { reason } => Err(reason.to_string()),
        //     }
        // };
        // if self.test_result.get().is_none() {
        //     self.test_result
        //         .set(TestResult {
        //             test_name: self.test_name.clone().unwrap_or("".to_owned()),
        //             result: r,
        //         })
        //         .unwrap();
        // }
    }
}
