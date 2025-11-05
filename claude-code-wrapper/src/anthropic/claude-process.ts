/**
 * Real Claude API Process Manager
 * Manages conversations with Claude using the Anthropic SDK
 */

import Anthropic from '@anthropic-ai/sdk';
import { EventEmitter } from 'events';

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string | Anthropic.MessageParam['content'];
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, any>;
}

export interface ClaudeResponse {
  text: string;
  thinking?: string;
  toolCalls: ToolCall[];
  stopReason: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface ClaudeProcessConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  workingDirectory: string;
}

/**
 * Manages a single Claude conversation using the Anthropic API
 */
export class ClaudeProcess extends EventEmitter {
  private client: Anthropic;
  private config: ClaudeProcessConfig;
  private conversationHistory: Anthropic.MessageParam[] = [];
  private systemPrompt: string;
  private totalInputTokens = 0;
  private totalOutputTokens = 0;

  constructor(config: ClaudeProcessConfig) {
    super();
    this.config = {
      model: 'claude-sonnet-4-20250514',
      maxTokens: 8192,
      temperature: 1.0,
      ...config,
    };
    this.client = new Anthropic({
      apiKey: this.config.apiKey,
    });
    this.systemPrompt = this.config.systemPrompt || '';
  }

  /**
   * Send a message to Claude and get a response
   */
  async sendMessage(
    userMessage: string,
    toolResults?: Array<{ toolUseId: string; content: string; isError?: boolean }>
  ): Promise<ClaudeResponse> {
    try {
      // Build message content
      const content: Anthropic.MessageParam['content'] = [];

      // Add tool results if provided
      if (toolResults && toolResults.length > 0) {
        for (const result of toolResults) {
          content.push({
            type: 'tool_result',
            tool_use_id: result.toolUseId,
            content: result.content,
            is_error: result.isError || false,
          });
        }
      }

      // Add user message
      if (userMessage) {
        content.push({
          type: 'text',
          text: userMessage,
        });
      }

      // Add to conversation history
      if (content.length > 0) {
        this.conversationHistory.push({
          role: 'user',
          content: content.length === 1 && typeof content[0] === 'object' && content[0].type === 'text'
            ? userMessage
            : content,
        });
      }

      // Make API call
      const response = await this.client.messages.create({
        model: this.config.model!,
        max_tokens: this.config.maxTokens!,
        temperature: this.config.temperature,
        system: this.systemPrompt,
        messages: this.conversationHistory,
        tools: this.getToolDefinitions(),
      });

      // Track token usage
      this.totalInputTokens += response.usage.input_tokens;
      this.totalOutputTokens += response.usage.output_tokens;

      // Parse response
      const parsed = this.parseResponse(response);

      // Add assistant response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: response.content,
      });

      this.emit('response', parsed);

      return parsed;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Parse Claude's response into structured format
   */
  private parseResponse(response: Anthropic.Message): ClaudeResponse {
    let text = '';
    let thinking = '';
    const toolCalls: ToolCall[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        text += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          input: block.input as Record<string, any>,
        });
      }
    }

    // Extract thinking if present (Claude sometimes puts it in text)
    const thinkingMatch = text.match(/<thinking>([\s\S]*?)<\/thinking>/);
    if (thinkingMatch) {
      thinking = thinkingMatch[1].trim();
      text = text.replace(/<thinking>[\s\S]*?<\/thinking>/, '').trim();
    }

    return {
      text,
      thinking,
      toolCalls,
      stopReason: response.stop_reason || 'unknown',
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }

  /**
   * Get tool definitions for Claude to use
   */
  private getToolDefinitions(): Anthropic.Tool[] {
    return [
      {
        name: 'Read',
        description: 'Read a file from the filesystem',
        input_schema: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'The absolute path to the file to read',
            },
          },
          required: ['file_path'],
        },
      },
      {
        name: 'Write',
        description: 'Write content to a file',
        input_schema: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'The absolute path to the file to write',
            },
            content: {
              type: 'string',
              description: 'The content to write to the file',
            },
          },
          required: ['file_path', 'content'],
        },
      },
      {
        name: 'Edit',
        description: 'Edit a file by replacing exact string matches',
        input_schema: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'The absolute path to the file to edit',
            },
            old_string: {
              type: 'string',
              description: 'The exact string to replace',
            },
            new_string: {
              type: 'string',
              description: 'The replacement string',
            },
          },
          required: ['file_path', 'old_string', 'new_string'],
        },
      },
      {
        name: 'Bash',
        description: 'Execute a bash command',
        input_schema: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'The bash command to execute',
            },
          },
          required: ['command'],
        },
      },
      {
        name: 'Glob',
        description: 'Find files matching a glob pattern',
        input_schema: {
          type: 'object',
          properties: {
            pattern: {
              type: 'string',
              description: 'The glob pattern to match',
            },
          },
          required: ['pattern'],
        },
      },
      {
        name: 'Grep',
        description: 'Search for patterns in files',
        input_schema: {
          type: 'object',
          properties: {
            pattern: {
              type: 'string',
              description: 'The pattern to search for',
            },
            path: {
              type: 'string',
              description: 'The path to search in',
            },
          },
          required: ['pattern'],
        },
      },
    ];
  }

  /**
   * Update the system prompt
   */
  updateSystemPrompt(newPrompt: string): void {
    this.systemPrompt = newPrompt;
  }

  /**
   * Get token usage statistics
   */
  getTokenUsage(): { input: number; output: number; total: number } {
    return {
      input: this.totalInputTokens,
      output: this.totalOutputTokens,
      total: this.totalInputTokens + this.totalOutputTokens,
    };
  }

  /**
   * Get conversation history
   */
  getConversationHistory(): Anthropic.MessageParam[] {
    return [...this.conversationHistory];
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
    this.totalInputTokens = 0;
    this.totalOutputTokens = 0;
  }

  /**
   * Get working directory
   */
  getWorkingDirectory(): string {
    return this.config.workingDirectory;
  }
}
