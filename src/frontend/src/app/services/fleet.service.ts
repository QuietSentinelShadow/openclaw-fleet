import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { 
  OpenClawInstance, 
  AgentRole, 
  FleetStats, 
  CreateInstanceRequest, 
  UpdateInstanceRequest,
  AuditLog,
  FleetTask,
  SystemStatus,
  OllamaModel,
  ChatResponse,
  BroadcastResponse
} from '../models';

@Injectable({
  providedIn: 'root'
})
export class FleetService {
  private apiUrl = 'http://localhost:5001/api/fleet';

  constructor(private http: HttpClient) {}

  // System Status
  getSystemStatus(): Observable<SystemStatus> {
    return this.http.get<SystemStatus>(`${this.apiUrl}/status`);
  }

  // Instances
  getInstances(): Observable<OpenClawInstance[]> {
    return this.http.get<OpenClawInstance[]>(`${this.apiUrl}/instances`);
  }

  getInstance(id: string): Observable<OpenClawInstance> {
    return this.http.get<OpenClawInstance>(`${this.apiUrl}/instances/${id}`);
  }

  createInstance(request: CreateInstanceRequest): Observable<OpenClawInstance> {
    return this.http.post<OpenClawInstance>(`${this.apiUrl}/instances`, request);
  }

  updateInstance(id: string, request: UpdateInstanceRequest): Observable<OpenClawInstance> {
    return this.http.put<OpenClawInstance>(`${this.apiUrl}/instances/${id}`, request);
  }

  deleteInstance(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/instances/${id}`);
  }

  startInstance(id: string): Observable<{ message: string; instance: OpenClawInstance; containerId: string; port: number }> {
    return this.http.post<{ message: string; instance: OpenClawInstance; containerId: string; port: number }>(`${this.apiUrl}/instances/${id}/start`, {});
  }

  stopInstance(id: string): Observable<{ message: string; instance: OpenClawInstance }> {
    return this.http.post<{ message: string; instance: OpenClawInstance }>(`${this.apiUrl}/instances/${id}/stop`, {});
  }

  getInstanceStatus(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/instances/${id}/status`);
  }

  getInstanceLogs(id: string, tail: number = 100): Observable<{ logs: string }> {
    return this.http.get<{ logs: string }>(`${this.apiUrl}/instances/${id}/logs?tail=${tail}`);
  }

  // Chat with instance
  chatWithInstance(id: string, message: string, useDirectOllama: boolean = false): Observable<ChatResponse> {
    return this.http.post<ChatResponse>(`${this.apiUrl}/instances/${id}/chat`, { message, useDirectOllama });
  }

  // Orchestration - Broadcast to multiple instances
  broadcastMessage(message: string, instanceIds: string[], parallel: boolean = true): Observable<BroadcastResponse> {
    return this.http.post<BroadcastResponse>(`${this.apiUrl}/broadcast`, { message, instanceIds, parallel });
  }

  // Roles
  getAgentRoles(): Observable<AgentRole[]> {
    return this.http.get<AgentRole[]>(`${this.apiUrl}/roles`);
  }

  // Stats
  getStats(): Observable<FleetStats> {
    return this.http.get<FleetStats>(`${this.apiUrl}/stats`);
  }

  // Audit Logs
  getAuditLogs(instanceId?: string, limit: number = 100, offset: number = 0): Observable<AuditLog[]> {
    const params: any = { limit, offset };
    if (instanceId) params.instanceId = instanceId;
    return this.http.get<AuditLog[]>(`${this.apiUrl}/audit`, { params });
  }

  // Ollama Models
  getOllamaModels(): Observable<OllamaModel[]> {
    return this.http.get<OllamaModel[]>(`${this.apiUrl}/models`);
  }

  pullOllamaModel(name: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.apiUrl}/models/${name}/pull`, {});
  }

  // Tasks
  getTasks(): Observable<FleetTask[]> {
    return this.http.get<FleetTask[]>(`${this.apiUrl}/tasks`);
  }

  createTask(task: Partial<FleetTask>): Observable<FleetTask> {
    return this.http.post<FleetTask>(`${this.apiUrl}/tasks`, task);
  }
}
