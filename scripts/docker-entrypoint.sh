#!/bin/bash
set -e

# Use CONTAINER_USER to avoid conflict with system USER
CONTAINER_USER=${CONTAINER_USER:-claude}

# Configure git with environment variables if provided
if [ -n "${GIT_AUTHOR_NAME}" ]; then
    git config --global user.name "${GIT_AUTHOR_NAME}"
    echo "Git configured: user.name = ${GIT_AUTHOR_NAME}"
fi

if [ -n "${GIT_AUTHOR_EMAIL}" ]; then
    git config --global user.email "${GIT_AUTHOR_EMAIL}"
    echo "Git configured: user.email = ${GIT_AUTHOR_EMAIL}"
fi

# Mark the working directory as safe for git operations
git config --global --add safe.directory /home/${CONTAINER_USER}/code
echo "Git configured: safe.directory = /home/${CONTAINER_USER}/code"

# Configure global gitignore if available
if [ -f "/home/${CONTAINER_USER}/.gitignore_global" ] && [ -s "/home/${CONTAINER_USER}/.gitignore_global" ]; then
    git config --global core.excludesfile /home/${CONTAINER_USER}/.gitignore_global
    echo "Git configured: core.excludesfile = /home/${CONTAINER_USER}/.gitignore_global"
fi

# Export GIT_COMMITTER variables to ensure they are used
export GIT_COMMITTER_NAME="${GIT_COMMITTER_NAME:-${GIT_AUTHOR_NAME}}"
export GIT_COMMITTER_EMAIL="${GIT_COMMITTER_EMAIL:-${GIT_AUTHOR_EMAIL}}"

# Ensure git configuration is persisted for Claude Code
if [ -n "${GIT_AUTHOR_NAME}" ] || [ -n "${GIT_AUTHOR_EMAIL}" ]; then
    # Create gitconfig if it doesn't exist
    if [ -n "${CONTAINER_USER}" ] && [ -d "/home/${CONTAINER_USER}" ]; then
        touch /home/${CONTAINER_USER}/.gitconfig 2>/dev/null || true
        chmod 644 /home/${CONTAINER_USER}/.gitconfig 2>/dev/null || true
    fi
fi

# Configure SSH Agent for authenticated git operations
# Check for Docker Desktop for Mac special SSH socket (version 4.26+)
if [ -S "/run/host-services/ssh-auth.sock" ]; then
    export SSH_AUTH_SOCK="/run/host-services/ssh-auth.sock"
    echo "SSH agent detected: Docker Desktop for Mac (automatic)"
    echo "export SSH_AUTH_SOCK='/run/host-services/ssh-auth.sock'" >> /home/${CONTAINER_USER}/.bashrc

    # Test if SSH agent has keys loaded
    if ssh-add -l >/dev/null 2>&1; then
        echo "SSH agent is ready with keys loaded"
    else
        echo "Warning: SSH agent socket exists but no keys are loaded"
    fi
else
    # No SSH agent available - this is expected on macOS with Docker Desktop <4.26
    echo "Note: SSH agent not available in this Docker environment."
    echo "SSH keys without passphrases will work normally."
    echo ""
    echo "For password-protected SSH keys:"
    echo "  • macOS: Upgrade Docker Desktop to 4.26+ for automatic SSH agent support"
    echo "  • Linux/WSL2: SSH agent forwarding can be configured via docker run options"
fi

# Fix macOS-specific SSH config options that don't work on Linux
# Create a clean SSH config without macOS-specific options
if [ -f "/home/${CONTAINER_USER}/.ssh/config" ]; then
    # Create a cleaned config file in /tmp, removing all macOS-specific options
    grep -v -i "UseKeychain" "/home/${CONTAINER_USER}/.ssh/config" | \
    grep -v -i "AddKeysToAgent" | \
    grep -v "IgnoreUnknown UseKeychain" > /tmp/ssh_config_clean || true

    # Only proceed if we have a valid cleaned config
    if [ -s /tmp/ssh_config_clean ]; then
        # Use GIT_SSH_COMMAND for better compatibility with StrictHostKeyChecking disabled
        # to avoid known_hosts issues (read-only mount)
        export GIT_SSH_COMMAND="ssh -F /tmp/ssh_config_clean -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=/dev/null"

        # Also export for child processes
        echo "export GIT_SSH_COMMAND='ssh -F /tmp/ssh_config_clean -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=/dev/null'" >> /home/${CONTAINER_USER}/.bashrc
        echo "SSH config cleaned: Removed macOS-specific options (UseKeychain, AddKeysToAgent)"
    else
        echo "Warning: Could not create cleaned SSH config"
        # Fallback: use no config file to avoid errors
        export GIT_SSH_COMMAND="ssh -F /dev/null -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=/dev/null"
        echo "export GIT_SSH_COMMAND='ssh -F /dev/null -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=/dev/null'" >> /home/${CONTAINER_USER}/.bashrc
    fi
else
    # No SSH config file, use defaults with known_hosts workaround
    export GIT_SSH_COMMAND="ssh -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=/dev/null"
    echo "export GIT_SSH_COMMAND='ssh -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=/dev/null'" >> /home/${CONTAINER_USER}/.bashrc
fi

# Configure SSH if specific key is requested
if [ -n "${SSH_KEY_FILE}" ]; then
    # Note: SSH directory is mounted read-only, we cannot create symlinks there
    # Instead we can use SSH_AUTH_SOCK or configure git to use the specific key
    echo "SSH key specified: ${SSH_KEY_FILE}"
    # Set GIT_SSH_COMMAND to use the specific key
    # Override the cleaned config to use the specific key with no config file
    export GIT_SSH_COMMAND="ssh -F /dev/null -i /home/${CONTAINER_USER}/.ssh/${SSH_KEY_FILE} -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=/dev/null"
    echo "export GIT_SSH_COMMAND='ssh -F /dev/null -i /home/${CONTAINER_USER}/.ssh/${SSH_KEY_FILE} -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=/dev/null'" >> /home/${CONTAINER_USER}/.bashrc
fi

# Execute the main command
exec "$@"