const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

/**
 * Configuration management for aibox
 * Handles profiles, environment variables, and paths
 */

const HOME = os.homedir();
const AIBOX_CONFIG_DIR = path.join(HOME, '.aibox');
const AIBOX_PROFILES_DIR = path.join(AIBOX_CONFIG_DIR, 'profiles');

// Default values
const DEFAULTS = {
  AI_ACCOUNT: 'default',
  AI_CLI: 'claude',
  CONTAINER_USER: 'ai',
  USER_UID: '1001',
  USER_GID: '1001',
  IMAGE_NAME: 'ghcr.io/zzev/aibox:latest',
};

/**
 * Ensure aibox config directories exist
 */
function ensureConfigDirs() {
  if (!fs.existsSync(AIBOX_CONFIG_DIR)) {
    fs.mkdirSync(AIBOX_CONFIG_DIR, { recursive: true });
  }
  if (!fs.existsSync(AIBOX_PROFILES_DIR)) {
    fs.mkdirSync(AIBOX_PROFILES_DIR, { recursive: true });
  }
}

/**
 * Get profile file path
 * @param {string} account - Account name
 * @returns {string} Profile file path
 */
function getProfilePath(account) {
  return path.join(AIBOX_PROFILES_DIR, `${account}.env`);
}

/**
 * Check if profile exists
 * @param {string} account - Account name
 * @returns {boolean} True if profile exists
 */
function profileExists(account) {
  return fs.existsSync(getProfilePath(account));
}

/**
 * Parse environment file into object
 * @param {string} filePath - Path to env file
 * @returns {Object} Parsed environment variables
 */
function parseEnvFile(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) {
    return env;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      env[key] = value;
    }
  }

  return env;
}

/**
 * Load profile environment
 * @param {string} account - Account name
 * @returns {Object} Profile environment variables
 */
function loadProfile(account) {
  const profilePath = getProfilePath(account);
  if (!fs.existsSync(profilePath)) {
    return {};
  }
  return parseEnvFile(profilePath);
}

/**
 * Get Git config from host system
 * @returns {Object} Git configuration {name, email}
 */
function getHostGitConfig() {
  try {
    const name = execSync('git config --global user.name', { encoding: 'utf-8' }).trim();
    const email = execSync('git config --global user.email', { encoding: 'utf-8' }).trim();
    return { name, email };
  } catch (error) {
    return { name: '', email: '' };
  }
}

/**
 * Get CLI-specific config directories based on account
 * @param {string} account - Account name
 * @returns {Object} Config directory paths
 */
function getCliConfigDirs(account) {
  if (account === 'default') {
    return {
      CLAUDE_CONFIG_DIR: path.join(HOME, '.claude'),
      CODEX_HOME: path.join(HOME, '.codex'),
    };
  } else {
    return {
      CLAUDE_CONFIG_DIR: path.join(HOME, `.claude-${account}`),
      CODEX_HOME: path.join(HOME, `.codex-${account}`),
    };
  }
}

/**
 * Ensure CLI config directories exist
 * @param {string} account - Account name
 */
function ensureCliConfigDirs(account) {
  const dirs = getCliConfigDirs(account);
  const geminiDir = path.join(HOME, '.gemini');

  for (const dir of Object.values(dirs)) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // Gemini dir (shared across all accounts)
  if (!fs.existsSync(geminiDir)) {
    fs.mkdirSync(geminiDir, { recursive: true });
  }
}

/**
 * Find project environment file
 * @param {string} projectRoot - Project root directory
 * @param {string} [envFile] - Explicit env file name
 * @returns {string|null} Path to env file or null
 */
function findProjectEnvFile(projectRoot, envFile) {
  if (envFile) {
    const specifiedPath = path.join(projectRoot, envFile);
    if (!fs.existsSync(specifiedPath)) {
      return null; // Will trigger error in caller
    }
    return specifiedPath;
  }

  // Try in priority order
  const candidates = ['.env.local', '.env'];
  for (const candidate of candidates) {
    const candidatePath = path.join(projectRoot, candidate);
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  return null; // No env file found (this is OK)
}

/**
 * List available SSH keys
 * @returns {string[]} Array of SSH key filenames
 */
function listSSHKeys() {
  const sshDir = path.join(HOME, '.ssh');
  if (!fs.existsSync(sshDir)) {
    return [];
  }

  try {
    const files = fs.readdirSync(sshDir);
    return files
      .filter(f => f.startsWith('id_') && !f.endsWith('.pub'))
      .sort();
  } catch (error) {
    return [];
  }
}

/**
 * List available env files in project
 * @param {string} projectRoot - Project root directory
 * @returns {string[]} Array of env file paths
 */
function listEnvFiles(projectRoot) {
  try {
    const files = fs.readdirSync(projectRoot);
    return files
      .filter(f => f.startsWith('.env') && !f.includes('.example'))
      .sort();
  } catch (error) {
    return [];
  }
}

/**
 * Get SSH configuration
 * @param {string} [sshKeyFile] - Specific SSH key file name
 * @returns {Object} SSH configuration {SSH_KEY_PATH, SSH_KEY_FILE}
 */
function getSSHConfig(sshKeyFile) {
  const sshDir = path.join(HOME, '.ssh');

  if (!fs.existsSync(sshDir)) {
    return {};
  }

  if (sshKeyFile) {
    const keyPath = path.join(sshDir, sshKeyFile);
    if (!fs.existsSync(keyPath)) {
      return { notFound: true, sshKeyFile };
    }
    return {
      SSH_KEY_PATH: sshDir,
      SSH_KEY_FILE: sshKeyFile,
    };
  }

  // Default: mount entire .ssh directory
  return {
    SSH_KEY_PATH: sshDir,
  };
}

/**
 * Get global gitignore path if it exists
 * @returns {string|null} Path to global gitignore or null
 */
function getGlobalGitignore() {
  const gitignorePath = path.join(HOME, '.gitignore_global');
  return fs.existsSync(gitignorePath) ? gitignorePath : null;
}

/**
 * Build complete environment for docker-compose
 * @param {Object} options - Configuration options
 * @returns {Object} Complete environment object
 */
function buildEnvironment(options) {
  const {
    account = DEFAULTS.AI_ACCOUNT,
    cli = DEFAULTS.AI_CLI,
    projectRoot = process.cwd(),
    envFile = null,
  } = options;

  const env = {
    // Core settings
    AI_ACCOUNT: account,
    AI_CLI: cli,
    CONTAINER_USER: DEFAULTS.CONTAINER_USER,
    USER_UID: DEFAULTS.USER_UID,
    USER_GID: DEFAULTS.USER_GID,
    AIBOX_PROJECT_DIR: projectRoot,
  };

  // Load profile settings
  const profile = loadProfile(account);
  Object.assign(env, profile);

  // CLI config directories
  const cliDirs = getCliConfigDirs(account);
  Object.assign(env, cliDirs);

  // SSH config
  const sshConfig = getSSHConfig(profile.SSH_KEY_FILE);
  if (!sshConfig.notFound) {
    Object.assign(env, sshConfig);
  }

  // Global gitignore
  const gitignorePath = getGlobalGitignore();
  if (gitignorePath) {
    env.GITIGNORE_GLOBAL_PATH = gitignorePath;
  }

  // Project env file
  const projectEnvPath = findProjectEnvFile(projectRoot, envFile);
  if (projectEnvPath) {
    env.ENV_FILE = projectEnvPath;
  } else {
    env.ENV_FILE = '/dev/null';
  }

  // Profile path
  env.AI_ENV_FILE = getProfilePath(account);

  return env;
}

module.exports = {
  DEFAULTS,
  HOME,
  AIBOX_CONFIG_DIR,
  AIBOX_PROFILES_DIR,
  ensureConfigDirs,
  getProfilePath,
  profileExists,
  parseEnvFile,
  loadProfile,
  getHostGitConfig,
  getCliConfigDirs,
  ensureCliConfigDirs,
  findProjectEnvFile,
  listSSHKeys,
  listEnvFiles,
  getSSHConfig,
  getGlobalGitignore,
  buildEnvironment,
};
