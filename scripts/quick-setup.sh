#!/bin/bash

# install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash

export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s "${XDG_CONFIG_HOME}/nvm")"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" # This loads nvm

nvm install 18

# install yarn
npm install --global yarn

# install rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# install era-test-node
cargo install --git https://github.com/matter-labs/era-test-node.git --locked --branch ad-contract-impersonation

yarn
yarn build
era_test_node run > /dev/null 2>&1 & export TEST_NODE_PID=$!
yarn test
kill $TEST_NODE_PID
