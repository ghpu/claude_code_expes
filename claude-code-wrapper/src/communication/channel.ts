/**
 * Communication channel implementation
 */

import { EventEmitter } from 'events';
import { Message, MessageType } from '../types';
import { Protocol } from './protocol';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ChannelConfig {
  type: 'ipc' | 'socket' | 'file';
  queueSize: number;
  timeout: number;
  heartbeatInterval: number;
  channelPath?: string;
}

/**
 * File-based communication channel
 * Uses JSON files in a directory for message passing
 */
export class FileChannel extends EventEmitter {
  private channelPath: string;
  private inboxPath: string;
  private outboxPath: string;
  private role: 'manager' | 'worker';
  private pollInterval: NodeJS.Timeout | null = null;
  private lastMessageId: string = '';
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private config: ChannelConfig;

  constructor(channelPath: string, role: 'manager' | 'worker', config: ChannelConfig) {
    super();
    this.channelPath = channelPath;
    this.role = role;
    this.config = config;

    // Manager writes to worker's inbox, reads from worker's outbox
    // Worker writes to manager's inbox, reads from manager's outbox
    if (role === 'manager') {
      this.outboxPath = path.join(channelPath, 'worker-inbox');
      this.inboxPath = path.join(channelPath, 'manager-inbox');
    } else {
      this.outboxPath = path.join(channelPath, 'manager-inbox');
      this.inboxPath = path.join(channelPath, 'worker-inbox');
    }
  }

  async initialize(): Promise<void> {
    // Create channel directories
    await fs.mkdir(this.channelPath, { recursive: true });
    await fs.mkdir(this.inboxPath, { recursive: true });
    await fs.mkdir(this.outboxPath, { recursive: true });

    // Start polling for messages
    this.startPolling();

    // Start heartbeat
    this.startHeartbeat();
  }

  private startPolling(): void {
    this.pollInterval = setInterval(async () => {
      await this.pollMessages();
    }, 100); // Poll every 100ms
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.send(Protocol.heartbeat(this.role));
    }, this.config.heartbeatInterval);
  }

  private async pollMessages(): Promise<void> {
    try {
      const files = await fs.readdir(this.inboxPath);

      // Sort by timestamp to process in order
      const messageFiles = files
        .filter(f => f.endsWith('.json'))
        .sort();

      for (const file of messageFiles) {
        const filePath = path.join(this.inboxPath, file);
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const message = Protocol.deserialize(content);

          // Avoid processing same message twice
          if (message.id !== this.lastMessageId) {
            this.lastMessageId = message.id;
            this.emit('message', message);
          }

          // Delete processed message
          await fs.unlink(filePath);
        } catch (error) {
          console.error(`Error processing message file ${file}:`, error);
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('Error polling messages:', error);
      }
    }
  }

  async send(message: Message): Promise<void> {
    const filename = `${message.timestamp}-${message.id}.json`;
    const filePath = path.join(this.outboxPath, filename);
    await fs.writeFile(filePath, Protocol.serialize(message), 'utf-8');
  }

  async sendAndWaitForReply(message: Message, timeout: number = 30000): Promise<Message> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.removeListener('message', messageHandler);
        reject(new Error('Timeout waiting for reply'));
      }, timeout);

      const messageHandler = (reply: Message) => {
        if (reply.replyTo === message.id) {
          clearTimeout(timer);
          this.removeListener('message', messageHandler);
          resolve(reply);
        }
      };

      this.on('message', messageHandler);
      this.send(message);
    });
  }

  async close(): Promise<void> {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    this.removeAllListeners();
  }
}

/**
 * Message queue for managing pending messages
 */
export class MessageQueue {
  private queue: Message[] = [];
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  enqueue(message: Message): void {
    if (this.queue.length >= this.maxSize) {
      // Remove oldest message if queue is full
      this.queue.shift();
    }
    this.queue.push(message);
  }

  dequeue(): Message | undefined {
    return this.queue.shift();
  }

  peek(): Message | undefined {
    return this.queue[0];
  }

  findById(id: string): Message | undefined {
    return this.queue.find(m => m.id === id);
  }

  findByType(type: MessageType): Message[] {
    return this.queue.filter(m => m.type === type);
  }

  remove(id: string): boolean {
    const index = this.queue.findIndex(m => m.id === id);
    if (index !== -1) {
      this.queue.splice(index, 1);
      return true;
    }
    return false;
  }

  clear(): void {
    this.queue = [];
  }

  get length(): number {
    return this.queue.length;
  }

  get isEmpty(): boolean {
    return this.queue.length === 0;
  }
}
