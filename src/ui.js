const chalk = require('chalk');
const ora = require('ora');

/**
 * UI utilities for aibox CLI
 * Provides consistent styling and visual feedback
 */

// Color helpers
const colors = {
  error: chalk.red,
  success: chalk.green,
  warning: chalk.yellow,
  info: chalk.blue,
  highlight: chalk.cyan,
  dim: chalk.dim,
};

// Icons with colors
const icons = {
  error: chalk.red('✗'),
  success: chalk.green('✓'),
  warning: chalk.yellow('⚠'),
  info: chalk.blue('ℹ'),
  robot: '🤖',
  gear: '⚙️',
  clean: '🧹',
  paperclip: '📎',
  package: '📦',
  pencil: '📝',
};

/**
 * Create a spinner for long-running operations
 * @param {string} text - Initial spinner text
 * @returns {ora.Ora} Spinner instance
 */
function spinner(text) {
  return ora({
    text,
    color: 'cyan',
  });
}

/**
 * Print an error message and exit
 * @param {string} message - Error message
 * @param {number} [code=1] - Exit code
 */
function error(message, code = 1) {
  console.error(`${icons.error} ${colors.error(message)}`);
  process.exit(code);
}

/**
 * Print a success message
 * @param {string} message - Success message
 */
function success(message) {
  console.log(`${icons.success} ${colors.success(message)}`);
}

/**
 * Print a warning message
 * @param {string} message - Warning message
 */
function warning(message) {
  console.log(`${icons.warning} ${colors.warning(message)}`);
}

/**
 * Print an info message
 * @param {string} message - Info message
 */
function info(message) {
  console.log(`${icons.info} ${colors.info(message)}`);
}

/**
 * Print account information
 * @param {string} account - Account name
 * @param {string} [cli] - CLI type (optional)
 */
function showAccountInfo(account, cli) {
  if (cli) {
    const cliName = cli.toUpperCase();
    console.log(`${icons.robot} Using ${cliName} CLI with account: ${colors.highlight(account)}`);
  } else {
    console.log(`${icons.robot} Account: ${colors.highlight(account)}`);
  }
}

/**
 * Print project directory info
 * @param {string} dir - Project directory path
 */
function showProjectDir(dir) {
  console.log(`${icons.gear}  Running in: ${colors.highlight(dir)}`);
  console.log('');
}

/**
 * Print environment file info
 * @param {string} filename - Environment file name
 */
function showEnvFile(filename) {
  console.log(`${icons.pencil} Using environment file: ${colors.success(filename)}`);
}

/**
 * List available SSH keys with formatting
 * @param {string[]} keys - Array of SSH key filenames
 */
function listSSHKeys(keys) {
  console.log(`${icons.info} ${colors.warning('Available SSH keys:')}`);
  if (keys.length === 0) {
    console.log('  None found');
  } else {
    keys.forEach(key => console.log(`  ${colors.dim(key)}`));
  }
  console.log('');
}

/**
 * List available environment files
 * @param {string[]} files - Array of env file paths
 */
function listEnvFiles(files) {
  console.log(`${icons.info} ${colors.warning('Available env files in project:')}`);
  if (files.length === 0) {
    console.log('  None found');
  } else {
    files.forEach(file => console.log(`  ${colors.dim(file)}`));
  }
}

module.exports = {
  colors,
  icons,
  spinner,
  error,
  success,
  warning,
  info,
  showAccountInfo,
  showProjectDir,
  showEnvFile,
  listSSHKeys,
  listEnvFiles,
};
