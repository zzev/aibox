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

# Fix macOS-specific SSH config options that don't work on Linux
# Create a clean SSH config without macOS-specific options
if [ -f "/home/${CONTAINER_USER}/.ssh/config" ]; then
    # Create a cleaned config file in /tmp
    grep -v -i "UseKeychain" "/home/${CONTAINER_USER}/.ssh/config" | \
    grep -v "IgnoreUnknown UseKeychain" > /tmp/ssh_config_clean || true

    # Create wrapper script that uses the clean config
    SSH_WRAPPER="/tmp/ssh-wrapper"
    cat > "$SSH_WRAPPER" << EOF
#!/bin/sh
# Use cleaned SSH config without macOS options
exec /usr/bin/ssh -F /tmp/ssh_config_clean "\$@"
EOF
    chmod +x "$SSH_WRAPPER"

    # Configure git to use our wrapper
    export GIT_SSH="$SSH_WRAPPER"

    # Also export for child processes
    echo "export GIT_SSH=$SSH_WRAPPER" >> /home/${CONTAINER_USER}/.bashrc
    echo "SSH config cleaned: Removed macOS-specific options"
fi

# Configure SSH if specific key is requested
if [ -n "${SSH_KEY_FILE}" ]; then
    # Note: SSH directory is mounted read-only, we cannot create symlinks there
    # Instead we can use SSH_AUTH_SOCK or configure git to use the specific key
    echo "SSH key specified: ${SSH_KEY_FILE}"
    # Set GIT_SSH_COMMAND to use the specific key
    export GIT_SSH_COMMAND="ssh -i /home/${CONTAINER_USER}/.ssh/${SSH_KEY_FILE} -o IdentitiesOnly=yes"
fi

# Execute the main command
exec "$@"