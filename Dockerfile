# AI CLI Docker Environment
# Provides a secure, isolated environment for running Claude Code, Codex, and Gemini CLI

FROM node:20-alpine

# Define the container username as a build argument
ARG USER=ai
ARG USER_UID=1001
ARG USER_GID=1001

# Install dependencies
RUN apk add --no-cache \
    bash \
    git \
    openssh-client \
    keychain \
    ca-certificates \
    gnupg \
    python3 \
    py3-pip \
    postgresql-client \
    netcat-openbsd \
    iputils \
    curl \
    vim \
    github-cli

# Install Claude Code CLI, Codex CLI, Gemini CLI, and ccstatusline globally
RUN npm install -g @anthropic-ai/claude-code @openai/codex @google/gemini-cli ccstatusline

# Create non-root user
RUN addgroup -g ${USER_GID} ${USER} && \
    adduser -D -u ${USER_UID} -G ${USER} -s /bin/bash ${USER} && \
    mkdir -p /home/${USER}/.config && \
    mkdir -p /home/${USER}/.config/ccstatusline && \
    mkdir -p /home/${USER}/.claude && \
    mkdir -p /home/${USER}/.codex && \
    mkdir -p /home/${USER}/.gemini && \
    mkdir -p /home/${USER}/.ssh && \
    mkdir -p /home/${USER}/.npm && \
    mkdir -p /home/${USER}/.npm-global && \
    mkdir -p /home/${USER}/code

# Set up working directory in user's home
WORKDIR /home/${USER}/code

# Create directories for multiple account configurations
RUN mkdir -p /ai-configs && \
    chmod 755 /ai-configs

# Set ownership and permissions for user directories
RUN chown -R ${USER}:${USER} /home/${USER} && \
    chmod -R 755 /home/${USER} && \
    chown -R ${USER}:${USER} /ai-configs && \
    chmod 755 /ai-configs

# Pre-create the config directories with correct permissions
RUN mkdir -p /home/${USER}/.claude /home/${USER}/.codex /home/${USER}/.gemini && \
    chown -R ${USER}:${USER} /home/${USER}/.claude /home/${USER}/.codex /home/${USER}/.gemini && \
    chmod 755 /home/${USER}/.claude /home/${USER}/.codex /home/${USER}/.gemini

# Copy the entrypoint and git setup scripts
COPY scripts/docker-entrypoint.sh /entrypoint.sh
COPY scripts/git-setup.sh /usr/local/bin/git-setup.sh
RUN chmod +x /entrypoint.sh && chmod +x /usr/local/bin/git-setup.sh


# Switch to non-root user
USER ${USER}

# Set environment variables
ENV PATH="/home/${USER}/.npm-global/bin:${PATH}"
ENV USER=${USER}
ENV GIT_SSH=/tmp/ssh-wrapper

# Set entrypoint
ENTRYPOINT ["/entrypoint.sh"]

# Default command
CMD ["/bin/bash"]