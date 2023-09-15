use std::sync::Arc;

use once_cell::sync::OnceCell;
use vm::{
    tracers::utils::get_vm_hook_params, DynTracer, ExecutionEndTracer, ExecutionProcessing,
    HistoryMode, SimpleMemory, VmExecutionResultAndLogs, VmTracer,
};
use zksync_state::{StoragePtr, WriteStorage};
use zksync_types::{
    zkevm_test_harness::zk_evm::tracing::{BeforeExecutionData, VmLocalStateData},
    U256,
};
use zksync_utils::u256_to_h256;

use crate::tracer::TestVmHook;

/// Tracer that returns number of tests in the bootloader test file.
pub struct TestCountTracer {
    /// Returns number of tests in the yul file.
    pub test_count: Arc<OnceCell<u32>>,
}

impl TestCountTracer {
    /// Creates the tracer that should also report the amount of tests in a file.
    pub fn new(test_count_result: Arc<OnceCell<u32>>) -> Self {
        TestCountTracer {
            test_count: test_count_result,
        }
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

impl<S, H: HistoryMode> DynTracer<S, H> for TestCountTracer {
    fn before_execution(
        &mut self,
        state: VmLocalStateData<'_>,
        data: BeforeExecutionData,
        memory: &SimpleMemory<H>,
        _storage: StoragePtr<S>,
    ) {
        let hook = TestVmHook::from_opcode_memory(&state, &data);

        if let TestVmHook::TestCount = hook {
            self.parse_test_count(memory);
        }
    }
}

impl<H: HistoryMode> ExecutionEndTracer<H> for TestCountTracer {}

impl<S: WriteStorage, H: HistoryMode> ExecutionProcessing<S, H> for TestCountTracer {}

impl<S: WriteStorage, H: HistoryMode> VmTracer<S, H> for TestCountTracer {
    fn save_results(&mut self, _result: &mut VmExecutionResultAndLogs) {}
}
