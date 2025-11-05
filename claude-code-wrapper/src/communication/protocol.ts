/**
 * Communication protocol for Manager-Worker interaction
 */

import { Message, MessageType } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class Protocol {
  /**
   * Create a message with proper structure
   */
  static createMessage(
    type: MessageType,
    sender: 'manager' | 'worker',
    payload: any,
    replyTo?: string
  ): Message {
    return {
      id: uuidv4(),
      type,
      timestamp: Date.now(),
      sender,
      payload,
      replyTo,
    };
  }

  /**
   * Validate message structure
   */
  static validateMessage(message: any): message is Message {
    return (
      message &&
      typeof message.id === 'string' &&
      typeof message.type === 'string' &&
      typeof message.timestamp === 'number' &&
      (message.sender === 'manager' || message.sender === 'worker') &&
      message.payload !== undefined
    );
  }

  /**
   * Serialize message for transmission
   */
  static serialize(message: Message): string {
    return JSON.stringify(message);
  }

  /**
   * Deserialize message from transmission
   */
  static deserialize(data: string): Message {
    const message = JSON.parse(data);
    if (!this.validateMessage(message)) {
      throw new Error('Invalid message format');
    }
    return message;
  }

  /**
   * Create task assignment message
   */
  static taskAssignment(task: any): Message {
    return this.createMessage(MessageType.TASK_ASSIGNED, 'manager', { task });
  }

  /**
   * Create tool use request message
   */
  static toolUseRequest(request: any): Message {
    return this.createMessage(MessageType.TOOL_USE_REQUEST, 'worker', { request });
  }

  /**
   * Create tool use approval message
   */
  static toolUseApproval(requestId: string, approved: boolean, reason?: string): Message {
    return this.createMessage(
      approved ? MessageType.TOOL_USE_APPROVED : MessageType.TOOL_USE_BLOCKED,
      'manager',
      { requestId, approved, reason },
      requestId
    );
  }

  /**
   * Create implementation submission message
   */
  static implementationSubmission(implementation: any): Message {
    return this.createMessage(MessageType.IMPLEMENTATION_SUBMITTED, 'worker', { implementation });
  }

  /**
   * Create review feedback message
   */
  static reviewFeedback(review: any): Message {
    return this.createMessage(MessageType.REVIEW_FEEDBACK, 'manager', { review });
  }

  /**
   * Create implementation approval/rejection message
   */
  static implementationResult(approved: boolean, implementationId: string, feedback?: any): Message {
    return this.createMessage(
      approved ? MessageType.IMPLEMENTATION_APPROVED : MessageType.IMPLEMENTATION_REJECTED,
      'manager',
      { implementationId, approved, feedback }
    );
  }

  /**
   * Create status update message
   */
  static statusUpdate(status: any): Message {
    return this.createMessage(MessageType.STATUS_UPDATE, 'worker', { status });
  }

  /**
   * Create error report message
   */
  static errorReport(error: any): Message {
    return this.createMessage(MessageType.ERROR_REPORT, 'worker', { error });
  }

  /**
   * Create heartbeat message
   */
  static heartbeat(sender: 'manager' | 'worker'): Message {
    return this.createMessage(MessageType.HEARTBEAT, sender, { timestamp: Date.now() });
  }

  /**
   * Create acknowledgment message
   */
  static ack(originalMessageId: string, sender: 'manager' | 'worker'): Message {
    return this.createMessage(MessageType.ACK, sender, { originalMessageId }, originalMessageId);
  }
}
