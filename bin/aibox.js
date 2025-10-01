#!/usr/bin/env node

/**
 * aibox - Secure, isolated Docker environment for AI CLIs
 *
 * This is the main entry point when aibox is installed globally via npm.
 * It delegates to the start.sh script with proper path resolution.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Get the installation directory (where this script is located)
const INSTALL_DIR = path.resolve(__dirname, '..');
const START_SCRIPT = path.join(INSTALL_DIR, 'scripts', 'start.sh');

// Verify the start script exists
if (!fs.existsSync(START_SCRIPT)) {
  console.error('Error: start.sh script not found at:', START_SCRIPT);
  console.error('aibox may not be installed correctly.');
  process.exit(1);
}

// Get current working directory (where user is running aibox from)
const CWD = process.cwd();

// Pass all command line arguments to start.sh
const args = process.argv.slice(2);

// Set environment variables to help start.sh locate its resources
const env = {
  ...process.env,
  AIBOX_INSTALL_DIR: INSTALL_DIR,
  AIBOX_PROJECT_DIR: CWD
};

// Spawn the bash script
const child = spawn('bash', [START_SCRIPT, ...args], {
  stdio: 'inherit',
  cwd: CWD,
  env: env
});

// Handle exit
child.on('exit', (code) => {
  process.exit(code || 0);
});

// Handle errors
child.on('error', (err) => {
  console.error('Error running aibox:', err.message);
  process.exit(1);
});
