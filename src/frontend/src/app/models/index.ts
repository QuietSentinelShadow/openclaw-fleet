export interface OpenClawInstance {
  id: string;
  name: string;
  description: string;
  agentRole: string;
  containerId?: string;
  containerName?: string;
  port: number;
  status: InstanceStatus;
  ollamaModel: string;
  workspacePath: string;
  customConfig?: string;
  soulContent?: string;
  agentsContent?: string;
  skillsPath?: string;
  createdAt: string;
  lastStartedAt?: string;
  lastStoppedAt?: string;
  lastHealthCheck?: string;
}

export type InstanceStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'error' | 'creating';

export interface AgentRole {
  id: string;
  key: string;
  name: string;
  description: string;
  defaultModel: string;
  defaultSoulContent: string;
  defaultAgentsContent: string;
  capabilities?: string;
  defaultSkills?: string;
  isSystem: boolean;
  isActive: boolean;
}

export interface AuditLog {
  id: string;
  instanceId: string;
  direction: CommunicationDirection;
  type: CommunicationType;
  content: string;
  response?: string;
  source?: string;
  destination?: string;
  userId?: string;
  sessionId?: string;
  model?: string;
  requestTokens?: number;
  responseTokens?: number;
  latencyMs?: number;
  isSuccess: boolean;
  errorMessage?: string;
  metadata?: string;
  timestamp: string;
}

export type CommunicationDirection = 'inbound' | 'outbound' | 'internal';
export type CommunicationType = 'chat' | 'task' | 'command' | 'system' | 'healthCheck' | 'error';

export interface FleetTask {
  id: string;
  instanceId?: string;
  title: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  priority: number;
  requiredCapabilities?: string;
  preferredModel?: string;
  submittedBy?: string;
  inputData?: string;
  result?: string;
  errorMessage?: string;
  parentTaskId?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  scheduledFor?: string;
  timeoutSeconds: number;
  retryCount: number;
  maxRetries: number;
}

export type TaskType = 'chat' | 'codeGeneration' | 'codeReview' | 'research' | 'analysis' | 'documentation' | 'testing' | 'deployment' | 'communication' | 'orchestration';
export type TaskStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout' | 'retrying';

export interface FleetStats {
  instances: {
    total: number;
    running: number;
    stopped: number;
    error: number;
  };
  tasks: {
    pending: number;
    running: number;
  };
}

export interface CreateInstanceRequest {
  name: string;
  description?: string;
  agentRoleId: string;
  ollamaModel?: string;
  soulContent?: string;
  agentsContent?: string;
}

export interface UpdateInstanceRequest {
  description?: string;
  ollamaModel?: string;
  soulContent?: string;
  agentsContent?: string;
  customConfig?: string;
}