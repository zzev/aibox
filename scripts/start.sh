#!/bin/bash

# aibox - Docker Wrapper Script
# Safely run Claude Code, Codex, or Gemini CLI in an isolated Docker environment with multi-account support

set -e

# Detect if running from global npm installation
if [ -n "$AIBOX_INSTALL_DIR" ]; then
    # Running from global npm install - use AIBOX_INSTALL_DIR for resources
    INSTALL_DIR="$AIBOX_INSTALL_DIR"
    # Use AIBOX_PROJECT_DIR (passed by bin/aibox.js) or current directory
    PROJECT_ROOT="${AIBOX_PROJECT_DIR:-$(pwd)}"
else
    # Running from local clone - use script location
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    INSTALL_DIR="$(dirname "$SCRIPT_DIR")"
    PROJECT_ROOT="$INSTALL_DIR"
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
AI_ACCOUNT="${AI_ACCOUNT:-default}"
AI_CLI="${AI_CLI:-claude}"
CONTAINER_USER="${CONTAINER_USER:-ai}"
USER_UID=1001
USER_GID=1001

# Container management functions
container_exists() {
    local container_name="aibox-${AI_ACCOUNT}"
    docker ps -a --format '{{.Names}}' | grep -q "^${container_name}$"
}

container_running() {
    local container_name="aibox-${AI_ACCOUNT}"
    docker ps --format '{{.Names}}' | grep -q "^${container_name}$"
}

clean_orphans() {
    echo -e "${YELLOW}🧹 Cleaning orphan containers...${NC}"
    # Remove orphaned containers from docker-compose
    docker-compose -f "${INSTALL_DIR}/docker-compose.yml" down --remove-orphans 2>/dev/null || true

    # Remove any orphaned aibox run containers
    docker ps -a --filter "name=aibox-run" --format "{{.ID}}" | \
    while IFS= read -r container_id; do
        [ -n "$container_id" ] && docker rm -f "$container_id" 2>/dev/null || true
    done

    echo -e "${GREEN}✓ Orphan containers cleaned${NC}"
}

# Function to display help
show_help() {
    cat << EOF
aibox - Docker Wrapper for AI CLIs

Usage: aibox [OPTIONS] [CLI_ARGS]

OPTIONS:
    -t, --type TYPE        Choose CLI type: claude, codex, gemini (default: 'claude')
    -a, --account NAME     Use a specific account (default: 'default')
    -b, --build            Build/rebuild the Docker image
    -s, --shell            Start an interactive shell instead of CLI
    -c, --command CMD      Run a specific command in the container
    -r, --remove           Remove the container after exit
    --clean                Clean orphan containers before running
    --attach               Attach to existing container if running
    -h, --help             Show this help message

EXAMPLES:
    # Default: Open interactive bash shell (no CLI runs automatically)
    aibox

    # Inside the container, you can then run any CLI:
    # - claude --dangerously-skip-permissions
    # - codex
    # - gemini

    # Run Claude Code directly with arguments
    aibox --dangerously-skip-permissions

    # Run Codex CLI directly
    aibox -t codex [args]

    # Run Gemini CLI directly
    aibox -t gemini [args]

    # Build the image first
    aibox --build

    # Clean orphan containers before running
    aibox --clean

    # Attach to existing running container
    aibox --attach

    # Use a specific account
    aibox -a work

ACCOUNTS:
    Accounts allow you to maintain separate CLI configurations.
    Each account has its own volume for storing configuration and auth.

    To create a new account:
    1. Copy .aibox-env.example to .aibox-env.ACCOUNT_NAME
    2. Edit the file with your account-specific settings
    3. Run: aibox -a ACCOUNT_NAME

EOF
}

# Parse command line arguments
BUILD_IMAGE=false
INTERACTIVE_SHELL=false
REMOVE_AFTER=false
CLEAN_ORPHANS=false
ATTACH_MODE=false
CUSTOM_COMMAND=""
CLI_ARGS=()
CLI_TYPE_SPECIFIED=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--type)
            AI_CLI="$2"
            CLI_TYPE_SPECIFIED=true
            shift 2
            ;;
        -a|--account)
            AI_ACCOUNT="$2"
            shift 2
            ;;
        -b|--build)
            BUILD_IMAGE=true
            shift
            ;;
        -s|--shell)
            INTERACTIVE_SHELL=true
            shift
            ;;
        -c|--command)
            CUSTOM_COMMAND="$2"
            shift 2
            ;;
        -r|--remove)
            REMOVE_AFTER=true
            shift
            ;;
        --clean)
            CLEAN_ORPHANS=true
            shift
            ;;
        --attach)
            ATTACH_MODE=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            CLI_ARGS+=("$1")
            shift
            ;;
    esac
done

# Validate AI_CLI
if [[ ! "$AI_CLI" =~ ^(claude|codex|gemini)$ ]]; then
    echo -e "${RED}Error: Invalid CLI type '${AI_CLI}'${NC}"
    echo -e "${YELLOW}Valid types are: claude, codex, gemini${NC}"
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    echo "Please install Docker first: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo -e "${RED}Error: Docker is not running${NC}"
    echo "Please start Docker and try again"
    exit 1
fi

# Export environment variables for docker-compose
export AI_ACCOUNT
export AI_CLI
export CONTAINER_USER
export USER_UID
export USER_GID

# Set SSH configuration
# You can specify a specific SSH key file with SSH_KEY_FILE environment variable
# Example: SSH_KEY_FILE=id_rsa_work aibox

# SSH configuration
if [ -n "$SSH_KEY_FILE" ]; then
    # Specific SSH key file requested
    if [ -f "$HOME/.ssh/$SSH_KEY_FILE" ]; then
        export SSH_KEY_PATH="$HOME/.ssh"
        export SSH_KEY_FILE
    else
        echo -e "⚠️ ${YELLOW}Warning: SSH key file ~/.ssh/${SSH_KEY_FILE} not found${NC}"
        echo -e "💡 ${YELLOW}Available SSH keys:${NC}"
        ls -la "$HOME/.ssh/id_*" 2>/dev/null | awk '{print "  " $9}' | sed "s|$HOME/.ssh/||" || echo "  None found"
        echo ""
    fi
elif [ -d "$HOME/.ssh" ]; then
    # Default: mount entire .ssh directory
    export SSH_KEY_PATH="$HOME/.ssh"
fi

# Check for project environment file (optional)
if [ -z "$ENV_FILE" ]; then
    # ENV_FILE not specified, try to find one (in order of priority)
    if [ -f "${PROJECT_ROOT}/.env.local" ]; then
        export ENV_FILE=".env.local"
        echo -e "📝 ${GREEN}Using environment file: .env.local${NC}"
    elif [ -f "${PROJECT_ROOT}/.env" ]; then
        export ENV_FILE=".env"
        echo -e "📝 ${GREEN}Using environment file: .env${NC}"
    else
        # No env file found, use /dev/null (docker-compose will ignore it)
        export ENV_FILE="/dev/null"
    fi
else
    # ENV_FILE explicitly specified, check if it exists
    SPECIFIED_ENV_FILE="${PROJECT_ROOT}/${ENV_FILE}"
    if [ ! -f "$SPECIFIED_ENV_FILE" ]; then
        echo -e "❌ ${RED}Error: Specified env file not found: ${SPECIFIED_ENV_FILE}${NC}"
        echo ""
        echo -e "💡 ${YELLOW}Available env files in project:${NC}"
        ls -la "${PROJECT_ROOT}"/.env* 2>/dev/null | grep -v ".env.example\|.claude-env" | awk '{print "  " $9}' || echo "  None found"
        exit 1
    fi
    export ENV_FILE
    echo -e "📝 ${GREEN}Using environment file: ${ENV_FILE}${NC}"
fi

# Check for account-specific profile (stored globally in ~/.aibox/profiles/)
AIBOX_CONFIG_DIR="$HOME/.aibox"
AIBOX_PROFILES_DIR="$AIBOX_CONFIG_DIR/profiles"
AI_ENV_FILE="${AIBOX_PROFILES_DIR}/${AI_ACCOUNT}.env"

# Create profiles directory if it doesn't exist
mkdir -p "$AIBOX_PROFILES_DIR" 2>/dev/null

# Check if profile exists, create from template if not
if [ ! -f "$AI_ENV_FILE" ]; then
    # Try to create from example template
    if [ -f "${INSTALL_DIR}/.aibox-env.example" ]; then
        cp "${INSTALL_DIR}/.aibox-env.example" "${AI_ENV_FILE}"
        # Update the account name in the created file
        sed -i.bak "s/AI_ACCOUNT=default/AI_ACCOUNT=${AI_ACCOUNT}/" "${AI_ENV_FILE}" && rm "${AI_ENV_FILE}.bak" 2>/dev/null || true
    else
        # Create minimal profile
        cat > "${AI_ENV_FILE}" <<EOF
# aibox Profile: ${AI_ACCOUNT}
AI_ACCOUNT=${AI_ACCOUNT}
AI_CLI=claude
CONTAINER_USER=ai

# Git Configuration (for commits made by AI tools)
GIT_AUTHOR_NAME=Your Name
GIT_AUTHOR_EMAIL=your.email@example.com
GIT_COMMITTER_NAME=Your Name
GIT_COMMITTER_EMAIL=your.email@example.com
EOF
    fi
fi

export AI_ENV_FILE

# Build image if requested or if it doesn't exist
if [ "$BUILD_IMAGE" = true ] || ! docker image inspect aibox:latest &> /dev/null; then
    echo -e "${GREEN}Building aibox Docker image...${NC}"
    echo -e "${YELLOW}This may take a few minutes. Showing build logs:${NC}"
    echo ""
    cd "$INSTALL_DIR"

    # Build directly with docker build for better log visibility
    docker build \
        --progress=auto \
        --build-arg USER=${CONTAINER_USER} \
        --build-arg USER_UID=${USER_UID} \
        --build-arg USER_GID=${USER_GID} \
        -t aibox:latest \
        -f Dockerfile \
        .

    echo ""
    echo -e "${GREEN}✓ Build completed successfully${NC}"
fi

# Prepare the command to run
if [ -n "$CUSTOM_COMMAND" ]; then
    DOCKER_COMMAND="$CUSTOM_COMMAND"
    INTERACTIVE_SHELL=false
elif [ ${#CLI_ARGS[@]} -gt 0 ]; then
    DOCKER_COMMAND="${AI_CLI} ${CLI_ARGS[*]}"
    INTERACTIVE_SHELL=false
elif [ "$CLI_TYPE_SPECIFIED" = true ]; then
    # -t was specified without additional args, run that CLI directly
    DOCKER_COMMAND="${AI_CLI}"
    INTERACTIVE_SHELL=false
else
    # Default: interactive shell
    DOCKER_COMMAND="/bin/bash"
    INTERACTIVE_SHELL=true
fi


# Run options
RUN_OPTIONS=""
if [ "$REMOVE_AFTER" = true ]; then
    RUN_OPTIONS="--rm"
fi

# Clean orphans if requested
if [ "$CLEAN_ORPHANS" = true ]; then
    clean_orphans
fi

# Check for attach mode
if [ "$ATTACH_MODE" = true ]; then
    CONTAINER_NAME="aibox-${AI_ACCOUNT}"
    echo -e "${GREEN}📎 Attaching to container: ${CONTAINER_NAME}${NC}"
    cd "$PROJECT_ROOT"
    docker-compose -f "${INSTALL_DIR}/docker-compose.yml" up -d aibox
    docker exec -it "${CONTAINER_NAME}" /bin/bash
    exit 0
fi

# Display account info
AI_CLI_UPPER=$(echo "$AI_CLI" | tr '[:lower:]' '[:upper:]')
echo -e "🤖 Using ${AI_CLI_UPPER} CLI with account: ${GREEN}${AI_ACCOUNT}${NC}"
echo -e "⚙️  Running in: ${GREEN}${PROJECT_ROOT}${NC}"
echo ""

# Run the container from project root
cd "$PROJECT_ROOT"

CONTAINER_NAME="aibox-${AI_ACCOUNT}"

# Simplified container execution
if [ "$REMOVE_AFTER" = true ]; then
    # Force new container with --rm flag
    if [ "$INTERACTIVE_SHELL" = true ]; then
        echo -e "${GREEN}Starting interactive shell (temporary container)...${NC}"
        docker-compose -f "${INSTALL_DIR}/docker-compose.yml" run --rm --remove-orphans aibox /bin/bash
    else
        echo -e "${GREEN}Running: $DOCKER_COMMAND${NC}"
        docker-compose -f "${INSTALL_DIR}/docker-compose.yml" run --rm --remove-orphans aibox bash -c "$DOCKER_COMMAND"
    fi
else
    # Reuse existing container
    docker-compose -f "${INSTALL_DIR}/docker-compose.yml" up -d aibox

    if [ "$INTERACTIVE_SHELL" = true ]; then
        echo -e "${GREEN}Starting interactive shell...${NC}"
        docker exec -it "${CONTAINER_NAME}" /bin/bash
    else
        echo -e "${GREEN}Executing: $DOCKER_COMMAND${NC}"
        docker exec -it "${CONTAINER_NAME}" bash -c "$DOCKER_COMMAND"
    fi
fi

# Cleanup
if [ "$REMOVE_AFTER" = true ]; then
    echo -e "${GREEN}Container removed${NC}"
fi