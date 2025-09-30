# AI CLI Docker Environment

A secure, isolated Docker environment for running multiple AI command-line tools (Claude Code, Codex, and Gemini) with multi-account support and comprehensive security features.

## 🚀 Features

- **Multi-CLI Support**: Run Claude Code, Codex, or Gemini CLI from a single unified container
- **Security First**: Non-root user execution, capability dropping, and filesystem isolation
- **Multi-Account**: Manage separate configurations for work, personal, or client projects
- **Persistent Configs**: Direct host mapping of `~/.claude`, `~/.codex`, and `~/.gemini`
- **Interactive by Default**: Opens bash shell by default - run any CLI manually or pass args to execute directly
- **Git Integration**: Seamless git operations with SSH key mounting and macOS compatibility
- **Resource Limited**: CPU and memory constraints to prevent system exhaustion
- **Simple Management**: Single service architecture with docker-compose

## 📋 Prerequisites

- [Docker](https://docs.docker.com/get-docker/) installed and running
- [Docker Compose](https://docs.docker.com/compose/install/) installed

## 🏁 Quick Start

### 1. Clone and Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd ai-cli

# Copy environment files
cp .env.local.example .env.local
cp .ai-cli-env.example .ai-cli-env.default

# Edit configuration files as needed
nano .ai-cli-env.default
nano .env.local
```

### 2. Build the Image

```bash
./scripts/start.sh --build
```

### 3. Run

```bash
# Default: Interactive bash shell
./scripts/start.sh

# Inside the container, run any CLI:
claude --dangerously-skip-permissions
codex
gemini

# Or run directly with arguments:
./scripts/start.sh --dangerously-skip-permissions  # Claude Code
./scripts/start.sh -t codex                        # Codex
./scripts/start.sh -t gemini                       # Gemini
```

## 🎯 Usage

### Basic Commands

```bash
# Interactive shell (default)
./scripts/start.sh

# Run specific CLI directly
./scripts/start.sh --dangerously-skip-permissions  # Claude Code
./scripts/start.sh -t codex                        # Codex (executes directly)
./scripts/start.sh -t gemini                       # Gemini (executes directly)

# With additional arguments
./scripts/start.sh -t codex help
./scripts/start.sh -t gemini chat "Hello"

# Build/rebuild image
./scripts/start.sh --build

# Clean orphan containers
./scripts/start.sh --clean

# Attach to running container
./scripts/start.sh --attach

# Use specific account
./scripts/start.sh -a work

# Remove container after exit
./scripts/start.sh -r
```

### Multi-Account Setup

```bash
# Create account-specific configurations
cp .ai-cli-env.example .ai-cli-env.work
cp .ai-cli-env.example .ai-cli-env.personal

# Edit with account-specific settings
nano .ai-cli-env.work
nano .ai-cli-env.personal

# Use different accounts
./scripts/start.sh -a work -t codex
./scripts/start.sh -a personal -t claude --dangerously-skip-permissions
```

## 📁 Project Structure

```
.
├── README.md                      # This file
├── DOCKER.md                     # Detailed documentation
├── Dockerfile.ai-cli             # Docker image definition
├── docker-compose.ai-cli.yml     # Docker Compose configuration
├── scripts/
│   ├── start.sh                  # Main wrapper script
│   └── docker-entrypoint.sh      # Container entrypoint
├── .ai-cli-env.example           # AI CLI config template
├── .env.local.example            # Project env template
└── .gitignore                    # Git ignore rules
```

## ⚙️ Configuration

### AI CLI Configuration (`.ai-cli-env.*`)

Controls the container and AI CLI behavior:

```bash
AI_ACCOUNT=default           # Account identifier
AI_CLI=claude               # Default CLI (claude/codex/gemini)
CONTAINER_USER=ai           # Container username
GIT_AUTHOR_NAME="Your Name"
GIT_AUTHOR_EMAIL="you@example.com"
SSH_KEY_FILE=id_rsa         # Specific SSH key (optional)
```

### Project Environment (`.env.local`)

Project-specific variables loaded into the container:

```bash
NODE_ENV=development
# Add your API keys, database URLs, etc.
```

## 🔒 Security Features

- **Non-root execution**: Runs as `ai` user (UID 1001)
- **Capability dropping**: Minimal Linux capabilities
- **No privilege escalation**: `no-new-privileges` security option
- **Read-only mounts**: SSH keys and configs mounted read-only
- **Network isolation**: Dedicated `ai-network`
- **Resource limits**: 2 CPU cores, 4GB RAM max
- **SSH config filtering**: Automatic macOS → Linux compatibility

## 🗂️ Volume Mappings

All configurations are mapped from your host for instant persistence:

| Host Path | Container Path | Purpose |
|-----------|---------------|---------|
| `~/.claude` | `/home/ai/.claude` | Claude Code config |
| `~/.codex` | `/home/ai/.codex` | Codex config |
| `~/.gemini` | `/home/ai/.gemini` | Gemini config |
| `~/.ssh` | `/home/ai/.ssh` | SSH keys (read-only) |
| `~/.gitignore_global` | `/home/ai/.gitignore_global` | Global gitignore |
| `~/.config/ccstatusline` | `/home/ai/.config/ccstatusline` | ccstatusline config |
| `./` | `/home/ai/code` | Project directory |

## 🐳 Container Naming

Containers are named: `ai-cli-{AI_ACCOUNT}`

Examples:
- `ai-cli-default`
- `ai-cli-work`
- `ai-cli-personal`

The same container is reused for all CLI types (Claude, Codex, Gemini), making it more efficient.

## 📖 Documentation

For comprehensive documentation, see [DOCKER.md](./DOCKER.md) which includes:

- Detailed usage examples
- Troubleshooting guide
- Advanced configuration
- SSH key setup
- Git integration
- Best practices

## 🛠️ Common Operations

### Rebuilding the Image

```bash
# Standard rebuild
./scripts/start.sh --build

# Force clean rebuild
docker build --no-cache -f Dockerfile.ai-cli -t ai-cli-env:latest .
```

### Managing Containers

```bash
# List all AI CLI containers
docker ps -a --filter "name=ai-cli"

# Stop specific container
docker stop ai-cli-default

# Remove specific container
docker rm ai-cli-default

# Clean all stopped containers
./scripts/start.sh --clean
```

### Viewing Logs

```bash
# View container logs
docker logs ai-cli-default
docker logs ai-cli-work

# Follow logs
docker logs -f ai-cli-personal
```

## 🔧 Troubleshooting

### Container won't start

```bash
# Rebuild from scratch
docker-compose -f docker-compose.ai-cli.yml down
./scripts/start.sh --build
```

### SSH/Git issues

```bash
# Verify SSH keys exist
ls -la ~/.ssh

# Enter container and test
./scripts/start.sh
ssh -T git@github.com
```

### Permission errors

```bash
# Container runs as ai:ai (1001:1001)
# Ensure host directories are accessible
ls -la ~/.claude ~/.codex ~/.gemini
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## 📄 License

This project is provided as-is for use with AI CLIs. Ensure compliance with the respective terms of service:
- [Anthropic Terms of Service](https://www.anthropic.com/legal/consumer-terms) (Claude Code)
- [OpenAI Terms of Use](https://openai.com/policies/terms-of-use) (Codex)
- [Google Terms of Service](https://policies.google.com/terms) (Gemini)

## ⚠️ Disclaimer

This Docker environment is designed for development and testing purposes. The `--dangerously-skip-permissions` flag for Claude Code should only be used in isolated environments like this Docker container.

## 🙏 Acknowledgments

- Built for secure execution of AI command-line tools
- Inspired by best practices in Docker security and isolation
- Designed for developers who work with multiple AI CLIs

---

**Need help?** Check out the [detailed documentation](./DOCKER.md) or open an issue.
