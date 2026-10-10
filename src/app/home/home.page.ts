import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonContent } from '@ionic/angular';
import { User } from 'firebase/auth';
import { KanbanBoard, KanbanService, KanbanTask, TaskStatus, BoardPermission } from '../kanban.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [CommonModule, FormsModule, IonContent],
})
export class HomePage implements OnInit, OnDestroy {
  user: User | null = null;
  boards: KanbanBoard[] = [];
  selectedBoardId = '';
  email = '';
  password = '';
  taskText = '';
  boardName = '';
  boardDescription = '';
  boardPermission: BoardPermission = 'owner';
  newTaskStatus: TaskStatus = 'todo';
  isRegistering = false;
  showBoardForm = false;
  busy = false;
  errorMessage = '';
  readonly statuses: { id: TaskStatus; label: string }[] = [
    { id: 'todo', label: 'A fazer' },
    { id: 'doing', label: 'Em andamento' },
    { id: 'done', label: 'Concluído' }
  ];
  private stopAuth?: () => void;
  private stopBoards?: () => void;

  constructor(
    private readonly kanban: KanbanService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  get configured(): boolean { return this.kanban.configured; }
  get selectedBoard(): KanbanBoard | undefined { return this.boards.find((board) => board.id === this.selectedBoardId); }
  get canEdit(): boolean { return ['owner', 'editor'].includes(this.selectedBoard?.permission ?? ''); }

  ngOnInit(): void {
    const subscription = this.kanban.authChanges().subscribe({
      next: (user) => {
        this.user = user;
        this.boards = [];
        this.stopBoards?.();
        if (user && this.configured) {
          this.stopBoards = this.kanban.watchBoards(user, (boards) => {
            this.boards = boards;
            if (!boards.some((board) => board.id === this.selectedBoardId)) this.selectedBoardId = boards[0]?.id ?? '';
            this.cdr.markForCheck();
          }, (error) => {
            this.showError(error);
            this.cdr.markForCheck();
          });
        }
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.showError(error);
        this.cdr.markForCheck();
      }
    });
    this.stopAuth = () => subscription.unsubscribe();
  }

  ngOnDestroy(): void { this.stopAuth?.(); this.stopBoards?.(); }

  async authenticate(): Promise<void> {
    await this.perform(async () => {
      if (this.isRegistering) await this.kanban.register(this.email.trim(), this.password);
      else await this.kanban.signIn(this.email.trim(), this.password);
      this.password = '';
    });
  }

  async logout(): Promise<void> { await this.perform(() => this.kanban.signOut()); }

  async createBoard(): Promise<void> {
    if (!this.user || !this.boardName.trim()) return;
    await this.perform(async () => {
      await this.kanban.createBoard(this.user!, this.boardName.trim(), this.boardDescription.trim(), this.boardPermission);
      this.boardName = '';
      this.boardDescription = '';
      this.boardPermission = 'owner';
      this.showBoardForm = false;
    });
  }

  async addTask(): Promise<void> {
    const board = this.selectedBoard;
    if (!board || !this.canEdit || !this.taskText.trim()) return;
    const previousTasks = [...board.tasks];
    const text = this.taskText.trim();
    const newTask: KanbanTask = { id: crypto.randomUUID(), text, status: this.newTaskStatus };
    const updatedTasks = [...board.tasks, newTask];

    board.tasks = updatedTasks;
    this.taskText = '';
    this.cdr.markForCheck();

    try {
      await this.kanban.saveTasks(board, updatedTasks);
    } catch (error) {
      board.tasks = previousTasks;
      this.taskText = text;
      this.showError(error);
      this.cdr.markForCheck();
    }
  }

  async moveTask(task: KanbanTask, status: TaskStatus): Promise<void> {
    const board = this.selectedBoard;
    if (!board || !this.canEdit || task.status === status) return;
    const previousTasks = [...board.tasks];
    const updatedTasks = board.tasks.map((item) => (item.id === task.id ? { ...item, status } : item));

    board.tasks = updatedTasks;
    this.cdr.markForCheck();

    try {
      await this.kanban.saveTasks(board, updatedTasks);
    } catch (error) {
      board.tasks = previousTasks;
      this.showError(error);
      this.cdr.markForCheck();
    }
  }

  async deleteTask(task: KanbanTask): Promise<void> {
    const board = this.selectedBoard;
    if (!board || !this.canEdit) return;
    const previousTasks = [...board.tasks];
    const updatedTasks = board.tasks.filter((item) => item.id !== task.id);

    board.tasks = updatedTasks;
    this.cdr.markForCheck();

    try {
      await this.kanban.saveTasks(board, updatedTasks);
    } catch (error) {
      board.tasks = previousTasks;
      this.showError(error);
      this.cdr.markForCheck();
    }
  }

  trackById(_index: number, item: { id: string }): string {
    return item.id;
  }

  trackByStatus(_index: number, item: { id: TaskStatus }): string {
    return item.id;
  }

  tasksFor(status: TaskStatus): KanbanTask[] { return this.selectedBoard?.tasks.filter((task) => task.status === status) ?? []; }

  permissionLabel(permission: BoardPermission): string {
    return ({ owner: 'Proprietário', editor: 'Editor', viewer: 'Visualizador' })[permission];
  }

  private async perform(action: () => Promise<void>): Promise<void> {
    this.busy = true;
    this.errorMessage = '';
    try {
      await action();
    } catch (error) {
      this.showError(error);
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }

  private showError(error: unknown): void {
    const code = (error as { code?: string })?.code;
    const messages: Record<string, string> = {
      'auth/invalid-credential': 'E-mail ou senha inválidos.',
      'auth/email-already-in-use': 'Este e-mail já possui uma conta.',
      'auth/weak-password': 'A senha deve conter pelo menos 6 caracteres.',
      'auth/invalid-email': 'Informe um e-mail válido.',
      'permission-denied': 'Sem permissão para acessar estes dados.'
    };
    this.errorMessage = messages[code ?? ''] ?? (error instanceof Error ? error.message : 'Não foi possível concluir a operação.');
  }
}
