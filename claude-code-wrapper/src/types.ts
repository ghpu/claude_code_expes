/**
 * Shared types for Claude Code Wrapper
 */

export enum MessageType {
  // Manager -> Worker
  TASK_ASSIGNED = 'TASK_ASSIGNED',
  TOOL_USE_APPROVED = 'TOOL_USE_APPROVED',
  TOOL_USE_BLOCKED = 'TOOL_USE_BLOCKED',
  IMPLEMENTATION_APPROVED = 'IMPLEMENTATION_APPROVED',
  IMPLEMENTATION_REJECTED = 'IMPLEMENTATION_REJECTED',
  REVIEW_FEEDBACK = 'REVIEW_FEEDBACK',
  REQUEST_STATUS = 'REQUEST_STATUS',
  TERMINATE = 'TERMINATE',

  // Worker -> Manager
  TOOL_USE_REQUEST = 'TOOL_USE_REQUEST',
  TOOL_USE_COMPLETED = 'TOOL_USE_COMPLETED',
  IMPLEMENTATION_SUBMITTED = 'IMPLEMENTATION_SUBMITTED',
  STATUS_UPDATE = 'STATUS_UPDATE',
  ERROR_REPORT = 'ERROR_REPORT',
  QUESTION = 'QUESTION',

  // Bidirectional
  HEARTBEAT = 'HEARTBEAT',
  ACK = 'ACK',
}

export interface Message {
  id: string;
  type: MessageType;
  timestamp: number;
  sender: 'manager' | 'worker';
  payload: any;
  replyTo?: string;
}

export interface Task {
  id: string;
  description: string;
  requirements: string[];
  constraints: string[];
  deliverables: string[];
  parentTaskId?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in_progress' | 'blocked' | 'review' | 'completed' | 'rejected';
  assignedTo?: 'manager' | 'worker';
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, any>;
}

export interface ToolUseRequest {
  toolName: string;
  parameters: Record<string, any>;
  reason: string;
  taskId: string;
  impact: 'low' | 'medium' | 'high';
}

export interface ToolUseResult {
  toolName: string;
  success: boolean;
  output?: any;
  error?: string;
  duration: number;
}

export interface Implementation {
  taskId: string;
  files: {
    path: string;
    action: 'created' | 'modified' | 'deleted';
    content?: string;
    diff?: string;
  }[];
  tests: {
    path: string;
    passed: boolean;
    results?: string;
  }[];
  documentation: string;
  completionNotes: string;
}

export interface Review {
  implementationId: string;
  approved: boolean;
  score: number; // 0-100
  feedback: {
    category: 'quality' | 'completeness' | 'testing' | 'documentation' | 'performance' | 'security';
    severity: 'info' | 'warning' | 'error' | 'critical';
    message: string;
    file?: string;
    line?: number;
  }[];
  requiredChanges: string[];
  suggestions: string[];
  reviewedAt: number;
}

export interface QualityGate {
  name: string;
  description: string;
  check: (implementation: Implementation) => Promise<QualityCheckResult>;
}

export interface QualityCheckResult {
  passed: boolean;
  gate: string;
  issues: {
    severity: 'info' | 'warning' | 'error' | 'critical';
    message: string;
    location?: string;
  }[];
}

export interface ManagerConfig {
  strictness: 'low' | 'medium' | 'high' | 'extreme';
  allowMocks: boolean;
  requireTests: boolean;
  requireDocumentation: boolean;
  maxIterations: number;
  qualityGates: string[];
  reviewTimeout: number; // milliseconds
  autoApproveSimpleChanges: boolean;
  minTestCoverage?: number;
}

export interface WorkerConfig {
  enableHooks: boolean;
  hookTimeout: number; // milliseconds
  maxRetries: number;
  requestApprovalFor: string[]; // tool names
  autoSubmitAfterTools: string[]; // tool names that trigger auto-submit
  workingDirectory: string;
}

export interface WrapperConfig {
  manager: ManagerConfig;
  worker: WorkerConfig;
  communication: {
    channelType: 'ipc' | 'socket' | 'file';
    messageQueueSize: number;
    heartbeatInterval: number;
    timeout: number;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    outputPath?: string;
  };
}

export interface WorkflowState {
  taskId: string;
  currentPhase: 'planning' | 'implementation' | 'review' | 'revision' | 'completed' | 'failed';
  tasks: Task[];
  currentTaskId?: string;
  iterations: number;
  startTime: number;
  endTime?: number;
  metadata: Record<string, any>;
}

export interface HookContext {
  hookName: string;
  toolName?: string;
  parameters?: Record<string, any>;
  result?: any;
  taskId?: string;
  workingDirectory: string;
  environment: Record<string, string>;
}

export interface CritiqueResult {
  score: number;
  hasShortcuts: boolean;
  hasMocks: boolean;
  hasTodos: boolean;
  hasIncompleteCode: boolean;
  testsPassed: boolean;
  isDocumented: boolean;
  issues: Array<{
    type: 'mock' | 'todo' | 'incomplete' | 'test_failure' | 'missing_docs' | 'poor_quality';
    severity: 'low' | 'medium' | 'high';
    message: string;
    location?: string;
  }>;
  recommendations: string[];
}

export interface PlanningResult {
  mainTask: Task;
  subtasks: Task[];
  dependencies: Array<{
    taskId: string;
    dependsOn: string[];
  }>;
  estimatedDuration: number;
  risks: string[];
}
