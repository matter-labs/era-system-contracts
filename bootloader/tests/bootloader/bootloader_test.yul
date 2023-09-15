function TEST_safeSub() {
    testing_assertEq(safeSub(10, 7, "err"), 3, "Failed to subtract 7")
    testing_assertEq(safeSub(10, 8, "err"), 2, "Failed to subtract 8")
}

function TEST_asserts() {
    testing_testWillFailWith("willFail")
    safeSub(10, 12, "willFail")
}
// function TEST_should ignore

function TEST_strLen() {
    testing_assertEq(getStrLen("abcd"), 4, "short string")
    testing_assertEq(getStrLen(""), 0, "empty string")
    testing_assertEq(getStrLen("12345678901234567890123456789012"), 32, "max length")
    testing_assertEq(getStrLen("1234567890123456789012345678901234"), 0, "over max length")


}

