#!/usr/bin/env node

/**
 * aibox - Secure, isolated Docker environment for AI CLIs
 *
 * This is the main entry point when aibox is installed globally via npm.
 */

const path = require('path');
const { main } = require('../src/cli');

// Get the installation directory (where this script is located)
const INSTALL_DIR = path.resolve(__dirname, '..');

// Run the CLI
main(INSTALL_DIR, process.argv).catch((error) => {
  console.error('Error running aibox:', error.message);
  process.exit(1);
});
