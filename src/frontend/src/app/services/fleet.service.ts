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
  FleetTask
} from '../models';

@Injectable({
  providedIn: 'root'
})
export class FleetService {
  private apiUrl = 'http://localhost:5001/api/fleet';

  constructor(private http: HttpClient) {}

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

  startInstance(id: string): Observable<{ message: string; instance: OpenClawInstance }> {
    return this.http.post<{ message: string; instance: OpenClawInstance }>(`${this.apiUrl}/instances/${id}/start`, {});
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

  // Roles
  getAgentRoles(): Observable<AgentRole[]> {
    return this.http.get<AgentRole[]>(`${this.apiUrl}/roles`);
  }

  // Stats
  getStats(): Observable<FleetStats> {
    return this.http.get<FleetStats>(`${this.apiUrl}/stats`);
  }
}