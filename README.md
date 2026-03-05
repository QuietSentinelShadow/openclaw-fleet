# OpenClaw Fleet Manager

A comprehensive management system for deploying and orchestrating multiple OpenClaw agent instances using Docker and Ollama.

## Overview

OpenClaw Fleet Manager allows you to:
- **Deploy Multiple OpenClaw Instances**: Create and manage multiple agent instances with different roles and capabilities
- **Configure Agent Personas**: Customize SOUL.md and AGENTS.md for each instance
- **Integrate with Ollama**: Use local Ollama models for LLM inference
- **Orchestrate Tasks**: Route tasks to appropriate agents based on capabilities
- **Audit Communications**: Complete logging of all inbound/outbound communications

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Angular Frontend (Port 4200)                 │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                    .NET API Gateway (Port 5000)                  │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │ Fleet API   │  │ SignalR Hub  │  │ Audit Logging          │  │
│  └─────────────┘  └──────────────┘  └────────────────────────┘  │
└─────────────────────────────┬───────────────────────────────────┘
                              │
    ┌─────────────────────────┼─────────────────────────┐
    │                         │                         │
┌───▼───┐               ┌─────▼─────┐             ┌─────▼─────┐
│Docker │               │  Ollama   │             │ Keycloak  │
│Engine │               │  :11434   │             │  :8080    │
└───┬───┘               └───────────┘             └───────────┘
    │
    │  ┌──────────────────────────────────────────┐
    ├──▶  OpenClaw Instance 1 (Port 8081)         │
    │    - Role: Code Helper                      │
    │    - Model: llama3.2                        │
    ├─────────────────────────────────────────────┤
    ├──▶  OpenClaw Instance 2 (Port 8082)         │
    │    - Role: Research Assistant               │
    │    - Model: mistral                         │
    ├─────────────────────────────────────────────┤
    └──▶  OpenClaw Instance N (Port 80XX)         │
         - Role: Custom                           │
         - Model: your-model                      │
    └──────────────────────────────────────────────┘
```

## Prerequisites

- Docker Desktop (latest version)
- .NET 10 SDK
- Node.js 20+ and npm
- Ollama (running locally with models pulled)
- Git

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/QuietSentinelShadow/openclaw-fleet.git
cd openclaw-fleet
```

### 2. Start Infrastructure Services

```bash
cd docker
docker-compose up -d postgres keycloak
```

Wait for services to be healthy (about 30 seconds).

### 3. Configure Keycloak

1. Access Keycloak at http://localhost:8080
2. Login with admin/admin123
3. Import the realm from `docker/keycloak/realm-import.json`
4. Or use the pre-configured realm

### 4. Start the Backend API

```bash
cd src/backend/OpenClawFleet.Api
dotnet restore
dotnet ef database update
dotnet run
```

The API will be available at http://localhost:5000.

### 5. Start the Frontend

```bash
cd src/frontend
npm install
npm start
```

The UI will be available at http://localhost:4200.

### 6. Ensure Ollama is Running

```bash
# Start Ollama (if not already running)
ollama serve

# Pull required models
ollama pull llama3.2
ollama pull mistral
ollama pull codellama
```

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

## API Endpoints

### Fleet Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/fleet/instances` | GET | List all instances |
| `/api/fleet/instances` | POST | Create new instance |
| `/api/fleet/instances/{id}` | GET | Get instance details |
| `/api/fleet/instances/{id}` | PUT | Update instance |
| `/api/fleet/instances/{id}` | DELETE | Delete instance |
| `/api/fleet/instances/{id}/start` | POST | Start instance |
| `/api/fleet/instances/{id}/stop` | POST | Stop instance |
| `/api/fleet/instances/{id}/logs` | GET | Get container logs |
| `/api/fleet/roles` | GET | List agent roles |
| `/api/fleet/stats` | GET | Get fleet statistics |

### SignalR Hub

Connect to `/hubs/fleet` for real-time updates:

```typescript
const connection = new signalR.HubConnectionBuilder()
  .withUrl('http://localhost:5000/hubs/fleet')
  .build();

connection.on('InstanceStatusChanged', (data) => {
  console.log('Instance status:', data);
});

connection.start();
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