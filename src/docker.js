const { spawn, execSync } = require('child_process');
const path = require('path');
const ui = require('./ui');

/**
 * Docker operations for aibox
 */

/**
 * Check if Docker is installed
 * @returns {boolean} True if Docker is installed
 */
function isDockerInstalled() {
  try {
    execSync('docker --version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Check if Docker is running
 * @returns {boolean} True if Docker daemon is running
 */
function isDockerRunning() {
  try {
    execSync('docker info', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Check if a container exists
 * @param {string} containerName - Container name
 * @returns {boolean} True if container exists
 */
function containerExists(containerName) {
  try {
    const result = execSync(`docker ps -a --format '{{.Names}}'`, { encoding: 'utf-8' });
    return result.split('\n').some(name => name === containerName);
  } catch (error) {
    return false;
  }
}

/**
 * Check if a container is running
 * @param {string} containerName - Container name
 * @returns {boolean} True if container is running
 */
function containerRunning(containerName) {
  try {
    const result = execSync(`docker ps --format '{{.Names}}'`, { encoding: 'utf-8' });
    return result.split('\n').some(name => name === containerName);
  } catch (error) {
    return false;
  }
}

/**
 * Check if Docker image exists locally
 * @param {string} imageName - Docker image name
 * @returns {boolean} True if image exists
 */
function imageExists(imageName) {
  try {
    execSync(`docker image inspect ${imageName}`, { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Pull Docker image with progress feedback
 * @param {string} imageName - Docker image name
 * @returns {Promise<void>}
 */
function pullImage(imageName) {
  return new Promise((resolve, reject) => {
    console.log(`${ui.icons.package} ${ui.colors.info('Pulling aibox Docker image from registry...')}`);
    console.log('');

    const child = spawn('docker', ['pull', imageName], {
      stdio: 'inherit'
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log('');
        ui.success('Image pulled successfully');
        resolve();
      } else {
        console.log('');
        ui.error('Failed to pull Docker image', code);
        reject(new Error(`Docker pull failed with code ${code}`));
      }
    });

    child.on('error', (err) => {
      console.log('');
      ui.error('Failed to pull Docker image');
      reject(err);
    });
  });
}

/**
 * Clean orphan containers
 * @param {string} composeFile - Path to docker-compose.yml
 * @returns {Promise<void>}
 */
async function cleanOrphans(composeFile) {
  const spin = ui.spinner(`${ui.icons.clean} Cleaning orphan containers...`).start();

  try {
    // Remove orphaned containers from docker-compose
    execSync(`docker-compose -f "${composeFile}" down --remove-orphans`, {
      stdio: 'ignore'
    });

    // Remove any orphaned aibox run containers
    const containers = execSync('docker ps -a --filter "name=aibox-run" --format "{{.ID}}"', {
      encoding: 'utf-8'
    }).trim();

    if (containers) {
      const containerIds = containers.split('\n').filter(id => id);
      for (const id of containerIds) {
        execSync(`docker rm -f ${id}`, { stdio: 'ignore' });
      }
    }

    spin.succeed('Orphan containers cleaned');
  } catch (error) {
    spin.fail('Failed to clean orphan containers');
    throw error;
  }
}

/**
 * Start container using docker-compose
 * @param {string} composeFile - Path to docker-compose.yml
 * @param {Object} env - Environment variables
 * @returns {Promise<void>}
 */
function startContainer(composeFile, env) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker-compose', ['-f', composeFile, 'up', '-d', 'aibox'], {
      stdio: 'inherit',
      env: { ...process.env, ...env },
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`docker-compose up failed with code ${code}`));
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Execute command in container
 * @param {string} containerName - Container name
 * @param {string} command - Command to execute
 * @param {boolean} interactive - Whether to run interactively
 * @returns {Promise<number>} Exit code
 */
function execInContainer(containerName, command, interactive = true) {
  return new Promise((resolve, reject) => {
    // Wrap command with git setup script
    const wrappedCommand = `source /usr/local/bin/git-setup.sh 2>/dev/null || true; ${command}`;

    const args = ['exec'];
    if (interactive) args.push('-it');
    args.push(containerName, 'bash', '-c', wrappedCommand);

    const child = spawn('docker', args, {
      stdio: 'inherit',
    });

    child.on('close', (code) => {
      resolve(code || 0);
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Run temporary container using docker-compose
 * @param {string} composeFile - Path to docker-compose.yml
 * @param {string} command - Command to execute
 * @param {Object} env - Environment variables
 * @returns {Promise<number>} Exit code
 */
function runTemporaryContainer(composeFile, command, env) {
  return new Promise((resolve, reject) => {
    // Wrap command with git setup script
    const wrappedCommand = `source /usr/local/bin/git-setup.sh 2>/dev/null || true; ${command}`;

    const child = spawn('docker-compose', [
      '-f', composeFile,
      'run',
      '--rm',
      '--remove-orphans',
      'aibox',
      'bash',
      '-c',
      wrappedCommand
    ], {
      stdio: 'inherit',
      env: { ...process.env, ...env },
    });

    child.on('close', (code) => {
      resolve(code || 0);
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Attach to running container
 * @param {string} containerName - Container name
 * @returns {Promise<number>} Exit code
 */
function attachToContainer(containerName) {
  return new Promise((resolve, reject) => {
    ui.info(`${ui.icons.paperclip} Attaching to container: ${containerName}`);

    const child = spawn('docker', ['exec', '-it', containerName, '/bin/bash'], {
      stdio: 'inherit',
    });

    child.on('close', (code) => {
      resolve(code || 0);
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Get local image digest
 * @param {string} imageName - Docker image name
 * @returns {string|null} Image digest or null if not found
 */
function getLocalImageDigest(imageName) {
  try {
    const result = execSync(`docker image inspect ${imageName} --format '{{index .RepoDigests 0}}'`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim();

    if (!result || result === '<no value>') {
      return null;
    }

    // Extract digest from format: repository@sha256:...
    const match = result.match(/@(sha256:[a-f0-9]+)/);
    return match ? match[1] : null;
  } catch (error) {
    return null;
  }
}

/**
 * Get remote image digest
 * @param {string} imageName - Docker image name
 * @returns {string|null} Image digest or null if not found
 */
function getRemoteImageDigest(imageName) {
  try {
    // Use buildx imagetools which works better with registries
    const result = execSync(`docker buildx imagetools inspect ${imageName} --format '{{json .}}'`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore']
    });

    const manifest = JSON.parse(result);

    // Check for manifest digest
    if (manifest.manifest && manifest.manifest.digest) {
      return manifest.manifest.digest;
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Check if image update is available
 * @param {string} imageName - Docker image name
 * @returns {Object} Update info {available: boolean, localDigest: string, remoteDigest: string}
 */
function checkImageUpdate(imageName) {
  const localDigest = getLocalImageDigest(imageName);
  const remoteDigest = getRemoteImageDigest(imageName);

  return {
    available: localDigest && remoteDigest && localDigest !== remoteDigest,
    localDigest,
    remoteDigest,
    hasLocal: !!localDigest,
    hasRemote: !!remoteDigest,
  };
}

/**
 * Validate Docker environment
 * Checks if Docker is installed and running
 */
function validateDocker() {
  if (!isDockerInstalled()) {
    ui.error('Docker is not installed\nPlease install Docker first: https://docs.docker.com/get-docker/');
  }

  if (!isDockerRunning()) {
    ui.error('Docker is not running\nPlease start Docker and try again');
  }
}

module.exports = {
  isDockerInstalled,
  isDockerRunning,
  containerExists,
  containerRunning,
  imageExists,
  pullImage,
  cleanOrphans,
  startContainer,
  execInContainer,
  runTemporaryContainer,
  attachToContainer,
  validateDocker,
  getLocalImageDigest,
  getRemoteImageDigest,
  checkImageUpdate,
};
