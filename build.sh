#!/bin/bash

# Get nvm
source $HOME/.nvm/nvm.sh
nvm install

# Build the site
(cd site && npm ci && npx nuxt generate --fail-on-error)

# Copy the site into the server
rm -rf server/site
mkdir server/site
cp -r site/dist/* server/site/

# Install server dependencies
(cd server && npm ci --only-prod && npx tsc)
