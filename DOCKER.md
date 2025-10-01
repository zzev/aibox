# aibox

A secure Docker environment for running multiple AI CLIs (Claude Code, Codex, and Gemini) with isolation from the host system and support for multiple accounts.

> **Important**: Make sure Docker and Docker Compose are installed and running before using this setup.

## Features

- **Multi-CLI Support**: Run Claude Code, Codex, or Gemini CLI from a single container
- **Security**: Runs as a non-root user (`ai`) without sudo privileges for maximum isolation
- **Customizable**: Configurable username and working directory via environment variables
- **Isolation**: Complete filesystem isolation from host machine
- **Multi-Account Support**: Manage multiple AI CLI accounts/configurations
- **Persistent Storage**: Configurations persist across container restarts (mapped from host)
- **Resource Limits**: CPU and memory limits to prevent resource exhaustion
- **Git Integration**: Seamless git operations with SSH key mounting
- **Container Reuse**: Automatically reuses existing containers with docker-compose up -d
- **Simplified Management**: Single service architecture using docker-compose

## Quick Start

### 1. Initial Setup

```bash
# Build the Docker image (required on first use)
aibox --build

# The script will automatically create .aibox-env.default from .aibox-env.example if needed
# Edit your environment file if needed
nano .aibox-env.default
```

**Note**: The build process will automatically create the necessary directories and set up permissions.

### 2. Run AI CLI

```bash
# Default: Opens interactive bash shell
aibox

# Run Claude Code directly
aibox --dangerously-skip-permissions

# Run Codex directly (executes codex CLI)
aibox -t codex

# Run Gemini directly (executes gemini CLI)
aibox -t gemini

# Run specific CLI with arguments
aibox -t codex help
aibox -t gemini chat "Hello"

# Clean orphan containers before running
aibox --clean

# Attach to existing running container
aibox --attach
```

### 3. Interactive Shell

```bash
# By default, the script opens an interactive shell
aibox

# Inside the container, you can run any CLI
claude --dangerously-skip-permissions
codex
gemini
```

## Multi-CLI Usage

The container includes all three AI CLIs. Choose which one to run:

```bash
# Claude Code with arguments
aibox --dangerously-skip-permissions
aibox chat "Help me understand this codebase"

# Codex CLI - executes codex directly
aibox -t codex
aibox -t codex help

# Gemini CLI - executes gemini directly
aibox -t gemini
aibox -t gemini chat "Hello"

# Or use environment variable
AI_CLI=codex aibox
AI_CLI=gemini aibox
```

Each CLI uses its own configuration directory:
- Claude: `~/.claude`
- Codex: `~/.codex`
- Gemini: `~/.gemini`

All three are mapped from your host machine for persistence.

## Multi-Account Management

Create and use different accounts for different projects:

```bash
# Create a work account
cp .aibox-env.example .aibox-env.work
# Edit .aibox-env.work with work-specific settings

# Create a personal account
cp .aibox-env.example .aibox-env.personal
# Edit .aibox-env.personal with personal settings

# Use specific accounts
aibox -a work -t codex
aibox -a personal --dangerously-skip-permissions
```

Each account maintains its own:
- AI CLI configurations (all three CLIs)
- Authentication state
- Git configuration

## Command Options

```bash
aibox [OPTIONS] [CLI_ARGS]

OPTIONS:
  -t, --type TYPE        Choose CLI type: claude, codex, gemini (default: claude)
  -a, --account NAME     Use a specific account (default: 'default')
  -b, --build            Build/rebuild the Docker image
  -s, --shell            Start an interactive shell
  -c, --command CMD      Run a specific command
  -r, --remove           Remove container after exit
  --clean                Clean orphan containers before running
  --attach               Attach to existing container if running
  -h, --help             Show help message
```

## File Structure

```
.
├── Dockerfile                  # Docker image definition
├── docker-compose.yml          # Docker Compose configuration (single service)
├── scripts/
│   ├── start.sh                # Wrapper script
│   └── docker-entrypoint.sh    # Container entrypoint with git config and SSH fix
├── .aibox-env.example          # Environment template
├── .aibox-env.default          # Default account settings (auto-created from example)
├── .aibox-env.work             # Work account settings (optional)
└── .aibox-env.personal         # Personal account settings (optional)
```

## Environment Variables

Key environment variables in `.aibox-env.*` files:

- `AI_ACCOUNT`: Account identifier (default: default)
- `AI_CLI`: CLI type to use (claude, codex, or gemini)
- `CONTAINER_USER`: Container username (default: ai)
- `USER_UID`: User ID for the container user (default: 1001)
- `USER_GID`: Group ID for the container user (default: 1001)
- `ENV_FILE`: Specify which .env file to use (default: .env.local)
- `GIT_AUTHOR_NAME`: Git commit author name (automatically configured on container start)
- `GIT_AUTHOR_EMAIL`: Git commit author email (automatically configured on container start)
- `GIT_COMMITTER_NAME`: Git committer name (defaults to GIT_AUTHOR_NAME if not set)
- `GIT_COMMITTER_EMAIL`: Git committer email (defaults to GIT_AUTHOR_EMAIL if not set)
- `SSH_KEY_PATH`: Path to SSH keys directory (default: ~/.ssh)
- `SSH_KEY_FILE`: Specific SSH key file to use (e.g., `id_rsa_personal`, `id_rsa_work`)

### Using Different Environment Files

You can specify which `.env` file to load for your project:

```bash
# Use default .env.local file
aibox

# Use .env file
ENV_FILE=.env aibox

# Use .env.production
ENV_FILE=.env.production aibox -t codex

# Use .env.staging
ENV_FILE=.env.staging aibox -t gemini

# Use .env.test
ENV_FILE=.env.test aibox
```

**Note:** By default, the script looks for `.env.local`. If it doesn't exist, you'll see an error message with instructions on how to specify a different env file.

### SSH Key Configuration

SSH keys are automatically mounted from your host system:

```bash
# Use default SSH keys (mounts ~/.ssh directory)
aibox

# Use specific SSH key for work account
SSH_KEY_FILE=id_rsa_work aibox -a work -t codex

# Combine with environment file specification
SSH_KEY_FILE=id_rsa_work ENV_FILE=.env.production aibox
```

**How it works:**
- Your `~/.ssh` directory is mounted read-only in the container
- macOS-specific SSH config options (UseKeychain) are automatically filtered out
- A cleaned SSH config is created in `/tmp/ssh_config_clean` without macOS options
- Git uses a custom SSH wrapper (`/tmp/ssh-wrapper`) that uses the cleaned config
- When `SSH_KEY_FILE` is specified, Git is configured to use that specific key
- The script warns if the specified key file doesn't exist

## Security Features

1. **Non-root User**: All CLIs run as configurable user (default: `ai`, UID 1001) without any sudo privileges
2. **Capability Dropping**: Container drops all Linux capabilities except essential ones
3. **No New Privileges**: Prevents privilege escalation
4. **Read-only Mounts**: SSH keys mounted as read-only (config is filtered, not modified)
5. **Network Isolation**: Runs in isolated Docker network (`ai-network`) with host access via `host.docker.internal`
6. **Resource Limits**: CPU (2 cores max) and memory (4GB max) limits
7. **SSH Config Filtering**: Automatically removes incompatible macOS options for Linux compatibility

## Volume Persistence

The following data persists across container restarts (mapped from host):

- **Claude Config**: `~/.claude` (mapped from host `~/.claude`)
- **Codex Config**: `~/.codex` (mapped from host `~/.codex`)
- **Gemini Config**: `~/.gemini` (mapped from host `~/.gemini`)
- **Project Files**: Current directory mounted at `/home/ai/code`
- **Git Global Ignore**: `~/.gitignore_global` (mounted read-only from host)
- **SSH Keys**: `~/.ssh` (mounted read-only from host)
- **ccstatusline Config**: `~/.config/ccstatusline` (mounted read-only from host)

**Note**: All AI CLI configurations are directly mapped from your host machine, so changes persist automatically and are immediately available to the host system.

## Container Naming

Containers are named based on the account only (not CLI type):
- Format: `aibox-{AI_ACCOUNT}`
- Examples: `aibox-default`, `aibox-work`, `aibox-personal`

This means the same container is reused regardless of which CLI you run. You can switch between Claude, Codex, and Gemini using the same container, which is more efficient and avoids container proliferation.

## Troubleshooting

### Container Management

```bash
# Clean orphan containers before running
aibox --clean

# List all aibox containers
docker ps -a --filter "name=aibox"

# Attach to existing container
aibox --attach

# Force temporary container (auto-removed on exit)
aibox -r
```

### Docker not installed

```bash
# Install Docker from https://docs.docker.com/get-docker/
```

### Permission denied errors

```bash
# The container runs as ai user (UID 1001)
# If you still have issues, rebuild the image:
aibox --build

# Then run normally:
aibox
```

### Container won't start

```bash
# Force rebuild the image (clean build)
docker-compose build --no-cache

# Or use the script:
aibox --build

# Check Docker logs
docker logs aibox-default
docker logs aibox-work
docker logs aibox-personal

# Remove and rebuild if needed
docker-compose down
aibox --build
```

### Git operations failing

```bash
# Ensure SSH keys are mounted correctly
ls -la ~/.ssh  # Check host keys exist

# In container, verify keys are accessible
aibox
ls -la /home/ai/.ssh

# The container automatically handles macOS SSH config issues
# Git will use the cleaned config via the SSH wrapper
git pull  # Should work without UseKeychain errors
```

### SSH "UseKeychain" errors (Automatically Fixed)

If you're on macOS, your SSH config likely contains `UseKeychain` options that aren't compatible with Linux. **This is automatically handled** by the container:

- The entrypoint creates a cleaned SSH config without macOS-specific options
- Git operations use a custom SSH wrapper that bypasses these issues
- You don't need to modify your host SSH config

### Git commits showing wrong author

The container automatically configures git with your environment variables on startup. If commits still show the wrong author:

```bash
# Check your .aibox-env.* file has the correct values
cat .aibox-env.default | grep GIT_

# Inside the container, verify git configuration
aibox
git config --global user.name
git config --global user.email

# Manually reconfigure if needed
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# Git is automatically configured on container startup via the entrypoint script
```

**Note**: The entrypoint script automatically sets git configuration from environment variables when the container starts.

## Advanced Usage

### Customizing Container User and Working Directory

You can customize the container username and working directory by setting environment variables:

```bash
# Using custom username
export CONTAINER_USER=myuser
export USER_UID=1001
export USER_GID=1001

# Build with custom settings
aibox --build

# Run with custom settings
aibox
```

Or add them to your `.aibox-env.*` file:

```bash
# .aibox-env.custom
AI_ACCOUNT=custom
AI_CLI=claude
CONTAINER_USER=developer
USER_UID=1001
USER_GID=1001
```

### Custom Docker Socket (Docker-in-Docker)

If AI CLIs need to interact with Docker:

1. Uncomment in `docker-compose.yml`:

```yaml
- /var/run/docker.sock:/var/run/docker.sock:ro
```

2. The container user would need to be added to the docker group at build time (not recommended for security)

### Custom Resource Limits

Edit `docker-compose.yml`:

```yaml
deploy:
  resources:
    limits:
      cpus: "4" # Increase CPU limit
      memory: 8G # Increase memory limit
```

### Using with CI/CD

```bash
# Non-interactive mode with auto-remove
aibox -r -a ci -t claude analyze src/
aibox -r -a ci -t codex
```

## Best Practices

1. **Use accounts**: Separate work/personal/client projects
2. **Choose the right CLI**: Use `-t` flag or `AI_CLI` environment variable
3. **Environment consistency**: Keep `.aibox-env.*` files in `.gitignore`
4. **Regular updates**: Rebuild image periodically for updates
5. **Monitor resources**: Check Docker stats for resource usage
6. **Container management**: Uses docker-compose for simplified container lifecycle
7. **SSH compatibility**: macOS SSH configs are automatically cleaned for Linux compatibility
8. **Configuration persistence**: All CLI configs are mapped from host, changes persist automatically

```bash
# Check container status
docker ps -a --filter "name=aibox"

# Monitor resource usage
docker stats aibox-default
docker stats aibox-work
docker stats aibox-personal

# Clean orphans before running
aibox --clean
```

## Limitations

- No GUI applications support
- Limited to mounted directories (can't access entire host filesystem)
- Some system-level operations may not work
- Docker-in-Docker requires additional configuration

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Review Docker logs: `docker logs <container-name>`
3. Ensure all files are properly configured
4. Verify Docker and Docker Compose are up to date

## License

This Docker setup is provided as-is for use with AI CLIs. Ensure you comply with the respective terms of service when using Claude Code, Codex, or Gemini CLI.
