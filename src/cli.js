const { Command } = require('commander');
const path = require('path');
const ui = require('./ui');
const docker = require('./docker');
const config = require('./config');
const prompts = require('./prompts');

/**
 * Main CLI logic for aibox
 */

const VALID_CLI_TYPES = ['claude', 'codex', 'gemini'];

/**
 * Create and configure the CLI program
 * @param {string} installDir - Installation directory
 * @returns {Command} Configured commander program
 */
function createProgram(installDir) {
  const program = new Command();

  program
    .name('aibox')
    .description('Docker Wrapper for AI CLIs - Run Claude Code, Codex, or Gemini in isolated containers')
    .version(require('../package.json').version)
    .option('-t, --type <type>', 'Choose CLI type: claude, codex, gemini', 'claude')
    .option('-a, --account <name>', 'Use a specific account', 'default')
    .option('-p, --setup <name>', 'Configure or reconfigure a profile')
    .option('-s, --shell', 'Start an interactive shell instead of CLI')
    .option('-c, --command <cmd>', 'Run a specific command in the container')
    .option('-r, --remove', 'Remove the container after exit')
    .option('--yolo', 'Run CLI in YOLO mode (skip all permissions)')
    .option('--clean', 'Clean orphan containers before running')
    .option('--attach', 'Attach to existing container if running')
    .option('--update', 'Check for Docker image updates')
    .allowUnknownOption()
    .addHelpText('after', `

EXAMPLES:
  # Default: Open interactive bash shell
  $ aibox

  # Inside the container, run any CLI:
  $ claude --dangerously-skip-permissions
  $ codex
  $ gemini

  # Run Claude Code directly with arguments
  $ aibox --dangerously-skip-permissions

  # Run Codex CLI directly
  $ aibox -t codex [args]

  # Run Gemini CLI directly
  $ aibox -t gemini [args]

  # YOLO mode (skip permissions for any CLI)
  $ aibox --yolo                          # Claude with --dangerously-skip-permissions
  $ aibox -t codex --yolo                 # Codex with --sandbox danger-full-access
  $ aibox -t gemini --yolo                # Gemini with --yolo

  # Clean orphan containers
  $ aibox --clean

  # Use a specific account
  $ aibox -a work

  # Configure or reconfigure a profile
  $ aibox -p default
  $ aibox --setup work

  # Check for Docker image updates
  $ aibox --update
  $ aibox -a work --update

ACCOUNTS:
  Accounts allow you to maintain separate CLI configurations.
  Each account has its own volume for storing configuration and auth.

  Profiles are stored in: ~/.aibox/profiles/

  To create or reconfigure a profile:
  $ aibox -p ACCOUNT_NAME
  $ aibox --setup ACCOUNT_NAME
`);

  return program;
}

/**
 * Get YOLO flags for specific CLI type
 * @param {string} cliType - CLI type (claude, codex, gemini)
 * @returns {string} YOLO flags for the CLI
 */
function getYoloFlags(cliType) {
  switch (cliType) {
    case 'claude':
      return '--dangerously-skip-permissions';
    case 'codex':
      return '--sandbox danger-full-access --ask-for-approval never';
    case 'gemini':
      return '--yolo';
    default:
      return '';
  }
}

/**
 * Main CLI execution
 * @param {string} installDir - Installation directory
 * @param {string[]} argv - Command line arguments
 */
async function main(installDir, argv) {
  const program = createProgram(installDir);
  program.parse(argv);

  const options = program.opts();
  const cliArgs = program.args;

  // Handle profile setup mode
  if (options.setup) {
    config.ensureConfigDirs();
    config.ensureCliConfigDirs(options.setup);
    await prompts.createProfile(options.setup);
    process.exit(0);
  }

  // Validate Docker
  docker.validateDocker();

  // Handle update mode
  if (options.update) {
    config.ensureConfigDirs();

    // Load profile to get configured image
    const profile = config.loadProfile(options.account);
    const imageName = profile.DOCKER_IMAGE || config.DEFAULTS.IMAGE_NAME;

    ui.info(`${ui.icons.package} Checking for updates: ${imageName}`);

    const spin = ui.spinner('Checking remote registry...').start();
    const updateInfo = docker.checkImageUpdate(imageName);
    spin.stop();

    if (!updateInfo.hasRemote) {
      ui.error('Failed to check remote image.\nPlease verify your internet connection and Docker is running.');
    }

    if (!updateInfo.hasLocal) {
      ui.warning('Image not found locally. Use aibox without --update to pull it.');
      process.exit(0);
    }

    if (updateInfo.available) {
      const shouldUpdate = await prompts.confirmUpdate(imageName);

      if (shouldUpdate) {
        await docker.pullImage(imageName);
        ui.success('Image updated successfully!');
      } else {
        ui.info('Update cancelled.');
      }
    } else {
      ui.success('You already have the latest version!');
    }

    process.exit(0);
  }

  // Validate CLI type
  if (!VALID_CLI_TYPES.includes(options.type)) {
    ui.error(`Invalid CLI type '${options.type}'\nValid types are: ${VALID_CLI_TYPES.join(', ')}`);
  }

  // Paths
  const projectRoot = process.cwd();
  const composeFile = path.join(installDir, 'docker-compose.yml');
  const projectHash = config.getProjectHash(projectRoot);
  const containerName = `aibox-${options.account}-${projectHash}`;

  // Ensure config directories
  config.ensureConfigDirs();
  config.ensureCliConfigDirs(options.account);

  // Ensure profile exists (interactive setup if not)
  await prompts.ensureProfile(options.account);

  // Build environment
  const env = config.buildEnvironment({
    account: options.account,
    cli: options.type,
    projectRoot,
  });

  const imageName = env.DOCKER_IMAGE;

  // Check SSH configuration
  const sshConfig = config.getSSHConfig(env.SSH_KEY_FILE);
  if (sshConfig.notFound) {
    ui.warning(`SSH key file ~/.ssh/${sshConfig.sshKeyFile} not found`);
    const availableKeys = config.listSSHKeys();
    ui.listSSHKeys(availableKeys);
  }

  // Pull image if needed
  if (!docker.imageExists(imageName)) {
    await docker.pullImage(imageName);
  }

  // Clean orphans if requested
  if (options.clean) {
    await docker.cleanOrphans(composeFile);
  }

  // Attach mode
  if (options.attach) {
    ui.info(`${ui.icons.paperclip} Attaching to container: ${containerName}`);
    await docker.startContainer(composeFile, env);
    const exitCode = await docker.attachToContainer(containerName);
    process.exit(exitCode);
  }

  // Determine what command to run
  let command;
  let isInteractive = false;

  if (options.command) {
    // Custom command
    command = options.command;
  } else if (options.yolo) {
    // YOLO mode
    const yoloFlags = getYoloFlags(options.type);
    command = `${options.type} ${yoloFlags} ${cliArgs.join(' ')}`.trim();
  } else if (cliArgs.length > 0) {
    // CLI with arguments
    command = `${options.type} ${cliArgs.join(' ')}`;
  } else if (options.shell) {
    // Explicit shell request
    command = '/bin/bash';
    isInteractive = true;
  } else if (program.rawArgs.some(arg => arg === '-t' || arg === '--type')) {
    // -t was specified without additional args, run that CLI directly
    command = options.type;
  } else {
    // Default: interactive shell
    command = '/bin/bash';
    isInteractive = true;
  }

  // Display account info
  if (isInteractive) {
    ui.showAccountInfo(options.account);
  } else {
    ui.showAccountInfo(options.account, options.type);
  }
  ui.showProjectDir(projectRoot);

  // Show env file if found
  if (env.ENV_FILE && env.ENV_FILE !== '/dev/null') {
    ui.showEnvFile(path.basename(env.ENV_FILE));
  }

  // Execute container
  let exitCode;

  if (options.remove) {
    // Temporary container with --rm
    if (isInteractive) {
      console.log(ui.colors.info('Starting interactive shell (temporary container)...'));
    } else {
      console.log(ui.colors.info(`Running: ${command}`));
    }
    exitCode = await docker.runTemporaryContainer(composeFile, command, env);
    ui.success('Container removed');
  } else {
    // Persistent container
    await docker.startContainer(composeFile, env);

    if (isInteractive) {
      console.log(ui.colors.info('Starting interactive shell...'));
    } else {
      console.log(ui.colors.info(`Executing: ${command}`));
    }

    exitCode = await docker.execInContainer(containerName, command, true);
  }

  process.exit(exitCode);
}

module.exports = {
  createProgram,
  main,
};
