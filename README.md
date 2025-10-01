# aibox

A secure, isolated Docker environment for running multiple AI command-line tools (Claude Code, Codex, and Gemini) with multi-account support and comprehensive security features.

**Optimized for Node.js/JavaScript projects** - Built on Node.js 20 Alpine, includes npm, and common development tools for modern JavaScript/TypeScript development.

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
- [Node.js](https://nodejs.org/) (for npm installation method)

## 🏁 Quick Start

### Installation

**Option 1: Install via npm (Recommended)**

```bash
# Install globally
npm install -g aibox

# Or use with npx (no installation needed)
npx aibox
```

**Option 2: Install from GitHub**

```bash
npm install -g https://github.com/your-username/aibox.git
```

**Option 3: Clone and link locally**

```bash
# Clone the repository
git clone <your-repo-url>
cd aibox

# Link globally
npm link
```

### Setup

```bash
# Navigate to your project directory
cd /path/to/your/project

# Copy environment files
cp .env.local.example .env.local
cp .aibox-env.example .aibox-env.default

# Edit configuration files as needed
nano .aibox-env.default
nano .env.local

# Build the Docker image (first time only)
aibox --build
```

### Run

```bash
# Default: Interactive bash shell
aibox

# Inside the container, run any CLI:
claude --dangerously-skip-permissions
codex
gemini

# Or run directly with arguments:
aibox --dangerously-skip-permissions  # Claude Code
aibox -t codex                        # Codex
aibox -t gemini                       # Gemini
```

## 🎯 Usage

### Basic Commands

```bash
# Interactive shell (default)
aibox

# Run specific CLI directly
aibox --dangerously-skip-permissions  # Claude Code
aibox -t codex                        # Codex (executes directly)
aibox -t gemini                       # Gemini (executes directly)

# With additional arguments
aibox -t codex help
aibox -t gemini chat "Hello"

# Build/rebuild image
aibox --build

# Clean orphan containers
aibox --clean

# Attach to running container
aibox --attach

# Use specific account
aibox -a work

# Remove container after exit
aibox -r
```

### Multi-Account Setup

```bash
# Create account-specific configurations
cp .aibox-env.example .aibox-env.work
cp .aibox-env.example .aibox-env.personal

# Edit with account-specific settings
nano .aibox-env.work
nano .aibox-env.personal

# Use different accounts
aibox -a work -t codex
aibox -a personal -t claude --dangerously-skip-permissions
```

## 📁 Project Structure

```
.
├── README.md                      # This file
├── DOCKER.md                     # Detailed documentation
├── package.json                  # npm package configuration
├── bin/
│   └── aibox.js                  # npm executable entry point
├── Dockerfile                    # Docker image definition
├── docker-compose.yml            # Docker Compose configuration
├── scripts/
│   ├── start.sh                  # Main wrapper script
│   └── docker-entrypoint.sh      # Container entrypoint
├── .aibox-env.example            # aibox config template
├── .env.local.example            # Project env template
├── .npmignore                    # npm publish ignore rules
└── .gitignore                    # Git ignore rules
```

## ⚙️ Configuration

### aibox Configuration (`.aibox-env.*`)

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

Containers are named: `aibox-{AI_ACCOUNT}`

Examples:
- `aibox-default`
- `aibox-work`
- `aibox-personal`

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
aibox --build

# Force clean rebuild (from aibox installation directory)
docker build --no-cache -t aibox:latest -f "$(npm root -g)/aibox/Dockerfile" "$(npm root -g)/aibox"
```

### Managing Containers

```bash
# List all aibox containers
docker ps -a --filter "name=aibox"

# Stop specific container
docker stop aibox-default

# Remove specific container
docker rm aibox-default

# Clean all stopped containers
aibox --clean
```

### Viewing Logs

```bash
# View container logs
docker logs aibox-default
docker logs aibox-work

# Follow logs
docker logs -f aibox-personal
```

## 🔧 Troubleshooting

### Container won't start

```bash
# Rebuild from scratch
aibox --clean
aibox --build
```

### SSH/Git issues

```bash
# Verify SSH keys exist
ls -la ~/.ssh

# Enter container and test
aibox
ssh -T git@github.com
```

### Permission errors

```bash
# Container runs as ai:ai (1001:1001)
# Ensure host directories are accessible
ls -la ~/.claude ~/.codex ~/.gemini
```

## 🆚 aibox vs devcontainers

While both use Docker for isolated development, they serve different purposes:

| Feature | aibox | devcontainers |
|---------|-------|---------------|
| **Purpose** | Run AI CLIs securely with multi-account support | Full development environment in container |
| **Setup** | Single global installation via npm | Per-project `.devcontainer` configuration |
| **Usage** | CLI-first: `aibox` command from any project | IDE-integrated: requires VS Code/supported editor |
| **Configuration** | Reusable across all projects | Project-specific configuration |
| **AI Account Management** | Native multi-account support | Manual configuration per project |
| **Config Persistence** | Direct host mapping (`~/.claude`, etc.) | Volumes or per-project setup |
| **Complexity** | Minimal: one command to start | Higher: JSON config, IDE integration |
| **Best for** | Quick AI CLI access, multiple AI accounts, JS projects | Full-stack development, polyglot projects, team standardization |

**Use aibox when**: You want instant AI CLI access across projects without per-project configuration.

**Use devcontainers when**: You need a fully customized development environment with IDE integration.

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
