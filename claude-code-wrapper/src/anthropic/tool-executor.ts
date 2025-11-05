/**
 * Real Tool Executor
 * Executes approved tools with real file system and command operations
 */

import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { glob } from 'glob';

const execAsync = promisify(exec);

export interface ToolExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  duration: number;
}

export class ToolExecutor {
  private workingDirectory: string;

  constructor(workingDirectory: string) {
    this.workingDirectory = workingDirectory;
  }

  /**
   * Execute a tool and return the result
   */
  async executeTool(toolName: string, input: Record<string, any>): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      let output: string;

      switch (toolName) {
        case 'Read':
          output = await this.executeRead(input.file_path);
          break;

        case 'Write':
          output = await this.executeWrite(input.file_path, input.content);
          break;

        case 'Edit':
          output = await this.executeEdit(input.file_path, input.old_string, input.new_string);
          break;

        case 'Bash':
          output = await this.executeBash(input.command);
          break;

        case 'Glob':
          output = await this.executeGlob(input.pattern, input.path);
          break;

        case 'Grep':
          output = await this.executeGrep(input.pattern, input.path);
          break;

        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }

      return {
        success: true,
        output,
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Read a file
   */
  private async executeRead(filePath: string): Promise<string> {
    const fullPath = this.resolvePath(filePath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${fullPath}`);
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');

    // Format with line numbers like cat -n
    const numbered = lines.map((line, index) => `${String(index + 1).padStart(6)}→${line}`).join('\n');

    return numbered;
  }

  /**
   * Write a file
   */
  private async executeWrite(filePath: string, content: string): Promise<string> {
    const fullPath = this.resolvePath(filePath);
    const dir = path.dirname(fullPath);

    // Create directory if it doesn't exist
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, content, 'utf-8');
    return `File written successfully: ${fullPath}`;
  }

  /**
   * Edit a file by replacing text
   */
  private async executeEdit(filePath: string, oldString: string, newString: string): Promise<string> {
    const fullPath = this.resolvePath(filePath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${fullPath}`);
    }

    const content = fs.readFileSync(fullPath, 'utf-8');

    // Check if old string exists
    if (!content.includes(oldString)) {
      throw new Error(`String not found in file: ${oldString.substring(0, 50)}...`);
    }

    // Replace first occurrence
    const newContent = content.replace(oldString, newString);
    fs.writeFileSync(fullPath, newContent, 'utf-8');

    return `File edited successfully: ${fullPath}`;
  }

  /**
   * Execute a bash command
   */
  private async executeBash(command: string): Promise<string> {
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: this.workingDirectory,
        maxBuffer: 10 * 1024 * 1024, // 10MB
        timeout: 120000, // 2 minutes
      });

      return stdout + (stderr ? `\n[stderr]: ${stderr}` : '');
    } catch (error: any) {
      throw new Error(`Command failed: ${error.message}\nstdout: ${error.stdout}\nstderr: ${error.stderr}`);
    }
  }

  /**
   * Execute glob pattern matching
   */
  private async executeGlob(pattern: string, searchPath?: string): Promise<string> {
    const basePath = searchPath ? this.resolvePath(searchPath) : this.workingDirectory;

    const files = await glob(pattern, {
      cwd: basePath,
      absolute: true,
      nodir: false,
    });

    if (files.length === 0) {
      return 'No files found';
    }

    return files.join('\n');
  }

  /**
   * Execute grep search
   */
  private async executeGrep(pattern: string, searchPath?: string): Promise<string> {
    const basePath = searchPath ? this.resolvePath(searchPath) : this.workingDirectory;

    try {
      const command = `grep -r -n "${pattern.replace(/"/g, '\\"')}" "${basePath}" 2>/dev/null || true`;
      const { stdout } = await execAsync(command, {
        cwd: this.workingDirectory,
        maxBuffer: 10 * 1024 * 1024,
      });

      if (!stdout.trim()) {
        return 'No matches found';
      }

      return stdout;
    } catch (error: any) {
      throw new Error(`Grep failed: ${error.message}`);
    }
  }

  /**
   * Resolve a path relative to working directory
   */
  private resolvePath(filePath: string): string {
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    return path.resolve(this.workingDirectory, filePath);
  }

  /**
   * Get working directory
   */
  getWorkingDirectory(): string {
    return this.workingDirectory;
  }

  /**
   * Set working directory
   */
  setWorkingDirectory(dir: string): void {
    this.workingDirectory = dir;
  }
}
