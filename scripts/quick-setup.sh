#!/bin/bash

# install rust
if ! command -v rustc &> /dev/null
then
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  source "$HOME/.cargo/env"
fi

rustup toolchain install nightly

# install era-test-node
cargo +nightly install --git https://github.com/matter-labs/era-test-node.git --locked --branch boojum-integration-merge-main

yarn
era_test_node run > /dev/null 2>&1 & export TEST_NODE_PID=$!
yarn test test/AccountCodeStorage.spec.ts
kill $TEST_NODE_PID
