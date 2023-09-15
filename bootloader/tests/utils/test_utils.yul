function testLog(msg, data) {
    storeVmHookParam(0, nonOptimized(msg))
    storeVmHookParam(1, nonOptimized(data))
    setHook(nonOptimized(100))
}

function testing_assertEq(a, b, message) {
    if iszero(eq(a, b)) {
        storeVmHookParam(0, nonOptimized(a))
        storeVmHookParam(1, nonOptimized(b))
        // Hack...
        storeVmHookParam(3, nonOptimized(message))
        setHook(nonOptimized(101))
    }
}
function testing_testWillFailWith(message) {
    storeVmHookParam(0, unoptimized(message))
    setHook(nonOptimized(102))
}
function testing_totalTests(tests) {
    storeVmHookParam(0, unoptimized(tests))
    setHook(nonOptimized(103))
}
