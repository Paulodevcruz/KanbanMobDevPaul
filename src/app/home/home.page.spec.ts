import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { HomePage } from './home.page';
import { KanbanService, KanbanBoard } from '../kanban.service';

describe('HomePage', () => {
  let component: HomePage;
  let fixture: ComponentFixture<HomePage>;
  let kanbanService: KanbanService;

  beforeEach(async () => {
    fixture = TestBed.createComponent(HomePage);
    component = fixture.componentInstance;
    kanbanService = TestBed.inject(KanbanService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should optimistically add a task to the selected board', async () => {
    const mockBoard: KanbanBoard = {
      id: 'board-1',
      name: 'Board Test',
      description: '',
      ownerId: 'user-1',
      ownerEmail: 'test@example.com',
      memberIds: ['user-1'],
      permission: 'owner',
      tasks: [],
      updatedAt: Date.now()
    };

    component.boards = [mockBoard];
    component.selectedBoardId = 'board-1';
    component.taskText = 'Nova tarefa';
    component.newTaskStatus = 'todo';

    const saveSpy = vi.spyOn(kanbanService, 'saveTasks').mockResolvedValue();

    await component.addTask();

    expect(component.selectedBoard?.tasks.length).toBe(1);
    expect(component.selectedBoard?.tasks[0].text).toBe('Nova tarefa');
    expect(component.selectedBoard?.tasks[0].status).toBe('todo');
    expect(component.taskText).toBe('');
    expect(saveSpy).toHaveBeenCalled();
  });

  it('should optimistically move a task to a different status', async () => {
    const mockBoard: KanbanBoard = {
      id: 'board-1',
      name: 'Board Test',
      description: '',
      ownerId: 'user-1',
      ownerEmail: 'test@example.com',
      memberIds: ['user-1'],
      permission: 'owner',
      tasks: [{ id: 'task-1', text: 'Tarefa 1', status: 'todo' }],
      updatedAt: Date.now()
    };

    component.boards = [mockBoard];
    component.selectedBoardId = 'board-1';

    const saveSpy = vi.spyOn(kanbanService, 'saveTasks').mockResolvedValue();

    await component.moveTask(mockBoard.tasks[0], 'doing');

    expect(component.selectedBoard?.tasks[0].status).toBe('doing');
    expect(saveSpy).toHaveBeenCalled();
  });

  it('should optimistically delete a task from the selected board', async () => {
    const mockBoard: KanbanBoard = {
      id: 'board-1',
      name: 'Board Test',
      description: '',
      ownerId: 'user-1',
      ownerEmail: 'test@example.com',
      memberIds: ['user-1'],
      permission: 'owner',
      tasks: [{ id: 'task-1', text: 'Tarefa 1', status: 'todo' }],
      updatedAt: Date.now()
    };

    component.boards = [mockBoard];
    component.selectedBoardId = 'board-1';

    const saveSpy = vi.spyOn(kanbanService, 'saveTasks').mockResolvedValue();

    await component.deleteTask(mockBoard.tasks[0]);

    expect(component.selectedBoard?.tasks.length).toBe(0);
    expect(saveSpy).toHaveBeenCalled();
  });
});
