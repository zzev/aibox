const { input, select, confirm } = require('@inquirer/prompts');
const fs = require('fs');
const config = require('./config');
const ui = require('./ui');

/**
 * Interactive prompts for aibox profile setup
 */

/**
 * Create a new profile interactively
 * @param {string} account - Account name
 * @returns {Promise<Object>} Profile configuration
 */
async function createProfile(account) {
  const profileExists = config.profileExists(account);
  const existingProfile = profileExists ? config.loadProfile(account) : {};

  if (profileExists) {
    console.log(ui.colors.info(`Reconfiguring profile '${account}'\n`));
  } else {
    console.log(ui.colors.warning(`Profile '${account}' not found. Let's set it up!\n`));
  }

  // Get Git config from host first
  const hostGit = config.getHostGitConfig();

  // Git author name
  const gitName = await input({
    message: 'Git author name (for commits):',
    default: existingProfile.GIT_AUTHOR_NAME || hostGit.name || 'Your Name',
  });

  // Git author email
  const gitEmail = await input({
    message: 'Git author email:',
    default: existingProfile.GIT_AUTHOR_EMAIL || hostGit.email || 'your.email@example.com',
  });

  // Preferred AI CLI
  const aiCli = await select({
    message: 'Choose your preferred AI CLI:',
    choices: [
      { name: 'claude', value: 'claude' },
      { name: 'codex', value: 'codex' },
      { name: 'gemini', value: 'gemini' },
    ],
    default: existingProfile.AI_CLI || 'claude',
  });

  // CLI Configuration directories
  const defaultClaudeDir = account === 'default' ? '~/.claude' : `~/.claude-${account}`;
  const defaultCodexDir = account === 'default' ? '~/.codex' : `~/.codex-${account}`;

  const claudeConfigDir = await input({
    message: 'Claude Code config directory:',
    default: existingProfile.CLAUDE_CONFIG_DIR || defaultClaudeDir,
  });

  const codexHome = await input({
    message: 'Codex config directory:',
    default: existingProfile.CODEX_HOME || defaultCodexDir,
  });

  // SSH Key configuration
  const sshPath = await input({
    message: 'SSH key directory:',
    default: existingProfile.SSH_KEY_PATH || '~/.ssh',
  });

  const sshFile = await input({
    message: 'SSH key file:',
    default: existingProfile.SSH_KEY_FILE || 'id_rsa',
  });

  // GitHub token (optional)
  const hasExistingToken = existingProfile.GH_TOKEN && existingProfile.GH_TOKEN.length > 0;
  const wantsGhToken = await confirm({
    message: 'Do you want to add a GitHub CLI token?',
    default: hasExistingToken,
  });

  let ghToken = '';
  if (wantsGhToken) {
    ghToken = await input({
      message: 'GitHub CLI token:',
      default: existingProfile.GH_TOKEN || '',
    });
  }

  // Build profile content
  const profileContent = buildProfileContent({
    account,
    gitName,
    gitEmail,
    aiCli,
    claudeConfigDir,
    codexHome,
    sshPath,
    sshFile,
    ghToken,
  });

  // Save profile
  const profilePath = config.getProfilePath(account);
  fs.writeFileSync(profilePath, profileContent, 'utf-8');

  console.log('');
  if (profileExists) {
    ui.success(`Profile '${account}' updated successfully!`);
  } else {
    ui.success(`Profile '${account}' created successfully!`);
  }
  console.log(ui.colors.dim(`   Location: ${profilePath}`));
  console.log('');

  return config.parseEnvFile(profilePath);
}

/**
 * Build profile file content
 * @param {Object} options - Profile options
 * @returns {string} Profile file content
 */
function buildProfileContent(options) {
  const { account, gitName, gitEmail, aiCli, claudeConfigDir, codexHome, sshPath, sshFile, ghToken } = options;

  let content = `# aibox Profile: ${account}
AI_ACCOUNT=${account}
AI_CLI=${aiCli}
CONTAINER_USER=ai

# CLI Configuration Directories
CLAUDE_CONFIG_DIR=${claudeConfigDir}
CODEX_HOME=${codexHome}

# Git Configuration
GIT_AUTHOR_NAME=${gitName}
GIT_AUTHOR_EMAIL=${gitEmail}
GIT_COMMITTER_NAME=${gitName}
GIT_COMMITTER_EMAIL=${gitEmail}

# SSH Configuration
SSH_KEY_PATH=${sshPath}
SSH_KEY_FILE=${sshFile}
`;

  // Add GitHub token if provided
  if (ghToken) {
    content += `
# GitHub CLI
GH_TOKEN=${ghToken}
`;
  }

  return content;
}

/**
 * Confirm profile creation if it doesn't exist
 * @param {string} account - Account name
 * @returns {Promise<Object>} Profile configuration
 */
async function ensureProfile(account) {
  if (!config.profileExists(account)) {
    return await createProfile(account);
  }
  return config.loadProfile(account);
}

module.exports = {
  createProfile,
  ensureProfile,
  buildProfileContent,
};
