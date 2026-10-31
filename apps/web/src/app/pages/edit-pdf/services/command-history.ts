import { Injectable, signal, computed } from '@angular/core';

export interface Command {
  description: string;
  execute(): void;
  undo(): void;
}

@Injectable({
  providedIn: 'root'
})
export class CommandHistoryService {
  private readonly undoStack = signal<Command[]>([]);
  private readonly redoStack = signal<Command[]>([]);

  readonly canUndo = computed(() => this.undoStack().length > 0);
  readonly canRedo = computed(() => this.redoStack().length > 0);

  /**
   * Executes a command and pushes it to undo history, resetting redo history
   */
  execute(command: Command): void {
    command.execute();
    this.undoStack.update(stack => [...stack, command]);
    this.redoStack.set([]);
  }

  /**
   * Undoes the most recent command
   */
  undo(): void {
    const stack = this.undoStack();
    if (stack.length === 0) return;

    const command = stack[stack.length - 1];
    command.undo();

    this.undoStack.set(stack.slice(0, stack.length - 1));
    this.redoStack.update(r => [...r, command]);
  }

  /**
   * Redoes the most recently undone command
   */
  redo(): void {
    const stack = this.redoStack();
    if (stack.length === 0) return;

    const command = stack[stack.length - 1];
    command.execute();

    this.redoStack.set(stack.slice(0, stack.length - 1));
    this.undoStack.update(u => [...u, command]);
  }

  /**
   * Clears all history
   */
  clear(): void {
    this.undoStack.set([]);
    this.redoStack.set([]);
  }

  /**
   * Creates a batch macro command that groups multiple operations into a single undo/redo step
   */
  createBatchCommand(commands: Command[], description: string): Command {
    return {
      description,
      execute: () => {
        for (const cmd of commands) {
          cmd.execute();
        }
      },
      undo: () => {
        for (let i = commands.length - 1; i >= 0; i--) {
          commands[i].undo();
        }
      }
    };
  }
}
