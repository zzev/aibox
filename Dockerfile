# AI CLI Docker Environment
# Provides a secure, isolated environment for running Claude Code, Codex, and Gemini CLI

FROM node:20-alpine

# Define the container username as a build argument
ARG USER=ai
ARG USER_UID=1001
ARG USER_GID=1001

# Install dependencies and npm packages in a single layer
# Note: python3, make, g++ are needed for node-gyp to build native modules (tree-sitter for gemini-cli)
RUN apk add --no-cache \
    bash \
    git \
    openssh-client \
    keychain \
    ca-certificates \
    gnupg \
    netcat-openbsd \
    iputils \
    curl \
    vim \
    github-cli \
    python3 \
    make \
    g++ && \
    npm install -g @anthropic-ai/claude-code @openai/codex @google/gemini-cli ccstatusline && \
    npm cache clean --force && \
    apk del python3 make g++

# Create non-root user and all necessary directories in a single layer
RUN addgroup -g ${USER_GID} ${USER} && \
    adduser -D -u ${USER_UID} -G ${USER} -s /bin/bash ${USER} && \
    mkdir -p /ai-configs \
             /home/${USER}/.config/ccstatusline \
             /home/${USER}/.claude \
             /home/${USER}/.codex \
             /home/${USER}/.gemini \
             /home/${USER}/.ssh \
             /home/${USER}/.npm \
             /home/${USER}/.npm-global \
             /home/${USER}/code && \
    chown -R ${USER}:${USER} /home/${USER} /ai-configs && \
    chmod -R 755 /home/${USER} && \
    chmod 755 /ai-configs

# Set up working directory in user's home
WORKDIR /home/${USER}/code

# Copy the entrypoint and git setup scripts
COPY scripts/docker-entrypoint.sh /entrypoint.sh
COPY scripts/git-setup.sh /usr/local/bin/git-setup.sh
RUN chmod +x /entrypoint.sh && chmod +x /usr/local/bin/git-setup.sh


# Switch to non-root user
USER ${USER}

# Set environment variables
ENV PATH="/home/${USER}/.npm-global/bin:${PATH}"
ENV USER=${USER}

# Set entrypoint
ENTRYPOINT ["/entrypoint.sh"]

# Default command
CMD ["/bin/bash"]