# OpenClaw Fleet Manager

A comprehensive management system for deploying and orchestrating multiple OpenClaw agent instances using Docker and Ollama.

## Overview

OpenClaw Fleet Manager allows you to:
- **Deploy Multiple OpenClaw Instances**: Create and manage multiple agent instances with different roles and capabilities
- **Real Docker Integration**: Instances run in actual Docker containers with exposed ports for communication
- **Ollama Integration**: Use local Ollama models for LLM inference with automatic model pulling
- **Configure Agent Personas**: Customize SOUL.md and AGENTS.md for each instance
- **Orchestrate Tasks**: Route tasks to appropriate agents and broadcast messages to multiple instances
- **Audit Communications**: Complete logging of all inbound/outbound communications

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Angular Frontend (Port 4200)                 │
│              Dashboard | Instances | Tasks | Audit               │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                    Node.js API (Port 5001)                       │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │ Fleet API   │  │ Docker Mgmt  │  │ Audit Logging          │  │
│  │ Ollama API  │  │ Real-time    │  │ SQLite Storage         │  │
│  └─────────────┘  └──────────────┘  └────────────────────────┘  │
└─────────────────────────────┬───────────────────────────────────┘
                              │
    ┌─────────────────────────┼─────────────────────────┐
    │                         │                         │
┌───▼───────────┐       ┌─────▼─────┐                  │
│ Docker Engine │       │  Ollama   │                  │
│ (Real Docker) │       │  :11434   │                  │
└───┬───────────┘       └───────────┘                  │
    │                                                  │
    │  ┌───────────────────────────────────────────┐  │
    ├──▶ OpenClaw Container 1 (Port 8081)          │  │
    │    - Role: Code Helper                       │  │
    │    - Model: llama3.2                         │  │
    │    - Connected to host Ollama                │  │
    ├──────────────────────────────────────────────┤  │
    ├──▶ OpenClaw Container 2 (Port 8082)          │  │
    │    - Role: Research Assistant                │  │
    │    - Model: mistral                          │  │
    ├──────────────────────────────────────────────┤  │
    └──▶ OpenClaw Container N (Port 80XX)          │  │
         - Role: Custom                            │  │
         - Model: your-model                       │  │
         - Direct Ollama fallback                  │  │
    └───────────────────────────────────────────────┘  │
                                                       │
┌──────────────────────────────────────────────────────┘
│
│  Alternative: .NET Backend (Port 5000)
│  - Entity Framework + PostgreSQL
│  - SignalR for real-time updates
│  - Keycloak authentication
│  - Docker.DotNet integration
└──────────────────────────────────────────────────────
```

## Prerequisites

- **Docker Desktop** (latest version) - Must be running
- **Node.js 20+** and npm
- **Ollama** (running locally with models)
- Git

## Quick Start (Node.js Backend - Recommended)

### 1. Clone the Repository

```bash
git clone https://github.com/QuietSentinelShadow/openclaw-fleet.git
cd openclaw-fleet
```

### 2. Start Ollama and Pull Models

```bash
# Start Ollama (if not already running)
ollama serve

# Pull required models
ollama pull llama3.2
ollama pull mistral
# Optional: ollama pull codellama
```

### 3. Start the Backend API

```bash
cd src/backend-node
npm install
npm start
```

The API will be available at http://localhost:5001.
The backend will automatically check Docker and Ollama availability on startup.

### 4. Start the Frontend

```bash
cd src/frontend
npm install
npm start
```

The UI will be available at http://localhost:4200.

### 5. Verify System Status

Open the dashboard at http://localhost:4200 and verify:
- ✅ Docker: Connected
- ✅ Ollama: Connected
- Models are listed

## Quick Start (.NET Backend - Alternative)

See the full .NET setup with Keycloak authentication below.

## Agent Roles

The system includes pre-configured agent roles:

| Role | Description | Default Model |
|------|-------------|---------------|
| **Code Helper** | General coding assistance and debugging | llama3.2 |
| **Code Reviewer** | Code review and quality analysis | codellama |
| **Research Assistant** | Research and information gathering | mistral |
| **Task Orchestrator** | Multi-agent task coordination | llama3.2 |
| **Documentation Writer** | Technical documentation generation | mistral |
| **Test Engineer** | Test case generation and QA | codellama |
| **DevOps Assistant** | CI/CD and infrastructure automation | llama3.2 |

## API Endpoints (Node.js Backend - Port 5001)

### System Status

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/fleet/status` | GET | Get Docker and Ollama availability status |
| `/api/fleet/stats` | GET | Get fleet statistics |
| `/api/fleet/models` | GET | List available Ollama models |
| `/api/fleet/models/{name}/pull` | POST | Pull/download an Ollama model |

### Instance Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/fleet/instances` | GET | List all instances |
| `/api/fleet/instances` | POST | Create new instance |
| `/api/fleet/instances/{id}` | GET | Get instance details |
| `/api/fleet/instances/{id}` | PUT | Update instance configuration |
| `/api/fleet/instances/{id}` | DELETE | Delete instance (stops container first) |
| `/api/fleet/instances/{id}/start` | POST | Start Docker container for instance |
| `/api/fleet/instances/{id}/stop` | POST | Stop Docker container |
| `/api/fleet/instances/{id}/logs` | GET | Get container logs |
| `/api/fleet/instances/{id}/chat` | POST | Send message to instance (uses Ollama) |

### Orchestration

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/fleet/broadcast` | POST | Broadcast message to multiple instances |

### Roles & Audit

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/fleet/roles` | GET | List agent roles |
| `/api/fleet/audit` | GET | Get audit logs (optional `instanceId` query param) |

### Example: Create and Start an Instance

```bash
# Create instance
curl -X POST http://localhost:5001/api/fleet/instances \
  -H "Content-Type: application/json" \
  -d '{"name": "Code Bot", "agentRoleId": "role-uuid-here", "ollamaModel": "llama3.2"}'

# Start the instance (creates and starts Docker container)
curl -X POST http://localhost:5001/api/fleet/instances/{id}/start

# Chat with the instance
curl -X POST http://localhost:5001/api/fleet/instances/{id}/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, can you help me with Python?"}'

# Broadcast to multiple instances
curl -X POST http://localhost:5001/api/fleet/broadcast \
  -H "Content-Type: application/json" \
  -d '{"message": "Status check", "instanceIds": ["id1", "id2"], "parallel": true}'
```

## Configuration

### Environment Variables

Create a `.env` file in the backend project:

```env
# Database
ConnectionStrings__DefaultConnection=Host=localhost;Port=5432;Database=openclaw_fleet;Username=postgres;Password=postgres

# Keycloak
Keycloak__Authority=http://localhost:8080/realms/openclaw-fleet
Keycloak__Audience=openclaw-fleet-api
Keycloak__ClientId=openclaw-fleet-api
Keycloak__ClientSecret=your-client-secret

# Ollama
Ollama__BaseUrl=http://localhost:11434

# Docker
Docker__OpenClawImage=openclaw/openclaw:latest
Docker__NetworkName=openclaw-fleet
Docker__BaseWorkspacePath=/var/lib/openclaw-fleet/workspaces
```

### OpenClaw Configuration

Each instance is configured with:
- **SOUL.md**: Agent persona and behavior
- **AGENTS.md**: Agent instructions and capabilities
- **Skills**: Optional skill modules
- **Custom Config**: JSON configuration overrides

## Development

### Build Backend

```bash
cd src/backend
dotnet build
dotnet test
```

### Build Frontend

```bash
cd src/frontend
npm run build
```

### Run with Docker Compose (Full Stack)

```bash
cd docker
docker-compose up -d
```

## Audit Logging

All communications are logged for compliance:
- **Inbound**: Messages received by agents
- **Outbound**: Responses from agents
- **Internal**: Inter-agent communications
- **System**: Health checks and status updates

Logs include:
- Timestamp
- Direction and type
- Content and response
- Token counts
- Latency metrics
- User/session tracking

## Security

- **Authentication**: OAuth2/OIDC via Keycloak
- **Authorization**: Role-based access control
- **API Security**: JWT token validation
- **CORS**: Configured for frontend origin

## Troubleshooting

### Common Issues

1. **Docker containers not starting**
   ```bash
   docker-compose logs openclaw-instance-name
   ```

2. **Ollama connection failures**
   - Ensure Ollama is running: `ollama serve`
   - Check model availability: `ollama list`

3. **Keycloak authentication errors**
   - Verify realm import
   - Check client configuration

4. **Port conflicts**
   - Modify ports in docker-compose.yml
   - Update appsettings.json accordingly

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

MIT License - See LICENSE file for details.

## Support

For issues and feature requests, please use the GitHub Issues page.