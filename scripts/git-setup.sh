#!/bin/bash
# Git configuration setup script
# This script is sourced before each command execution to ensure git is properly configured

CONTAINER_USER=${CONTAINER_USER:-ai}

# Configure git with environment variables if provided
if [ -n "${GIT_AUTHOR_NAME}" ]; then
    git config --global user.name "${GIT_AUTHOR_NAME}" 2>/dev/null
fi

if [ -n "${GIT_AUTHOR_EMAIL}" ]; then
    git config --global user.email "${GIT_AUTHOR_EMAIL}" 2>/dev/null
fi

# Mark the working directory as safe for git operations
git config --global --add safe.directory /home/${CONTAINER_USER}/code 2>/dev/null

# Configure global gitignore if available
if [ -f "/home/${CONTAINER_USER}/.gitignore_global" ] && [ -s "/home/${CONTAINER_USER}/.gitignore_global" ]; then
    git config --global core.excludesfile /home/${CONTAINER_USER}/.gitignore_global 2>/dev/null
fi

# Export GIT_COMMITTER variables to ensure they are used
export GIT_COMMITTER_NAME="${GIT_COMMITTER_NAME:-${GIT_AUTHOR_NAME}}"
export GIT_COMMITTER_EMAIL="${GIT_COMMITTER_EMAIL:-${GIT_AUTHOR_EMAIL}}"

# Configure SSH if specific key is requested
if [ -n "${SSH_KEY_FILE}" ]; then
    export GIT_SSH_COMMAND="ssh -i /home/${CONTAINER_USER}/.ssh/${SSH_KEY_FILE} -o IdentitiesOnly=yes"
fi

# Fix macOS-specific SSH config options if SSH wrapper exists
if [ -f "/tmp/ssh-wrapper" ]; then
    export GIT_SSH="/tmp/ssh-wrapper"
fi
