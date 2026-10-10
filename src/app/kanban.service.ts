import { Injectable, NgZone } from '@angular/core';
import { Auth, User, createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { Firestore, addDoc, collection, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { Observable } from 'rxjs';
import { firebaseAuth, firebaseDb } from './firebase';

export type TaskStatus = 'todo' | 'doing' | 'done';
export type BoardPermission = 'owner' | 'editor' | 'viewer';

export interface KanbanTask {
  id: string;
  text: string;
  status: TaskStatus;
}

export interface KanbanBoard {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  ownerEmail: string;
  memberIds: string[];
  permission: BoardPermission;
  tasks: KanbanTask[];
  updatedAt: number;
}

@Injectable({ providedIn: 'root' })
export class KanbanService {
  readonly configured = Boolean(firebaseAuth && firebaseDb);
  private readonly auth = firebaseAuth as Auth | null;
  private readonly db = firebaseDb as Firestore | null;

  constructor(private readonly ngZone: NgZone) {}

  authChanges(): Observable<User | null> {
    return new Observable((subscriber) => {
      if (!this.auth) {
        subscriber.next(null);
        subscriber.complete();
        return;
      }
      return onAuthStateChanged(
        this.auth,
        (user) => this.ngZone.run(() => subscriber.next(user)),
        (error) => this.ngZone.run(() => subscriber.error(error))
      );
    });
  }

  async signIn(email: string, password: string): Promise<void> {
    this.requireFirebase();
    await signInWithEmailAndPassword(this.auth!, email, password);
  }

  async register(email: string, password: string): Promise<void> {
    this.requireFirebase();
    await createUserWithEmailAndPassword(this.auth!, email, password);
  }

  async signOut(): Promise<void> {
    if (this.auth) await signOut(this.auth);
  }

  watchBoards(user: User, next: (boards: KanbanBoard[]) => void, error: (error: Error) => void): () => void {
    this.requireFirebase();
    const boardsQuery = query(collection(this.db!, 'boards'), where('memberIds', 'array-contains', user.uid));
    return onSnapshot(
      boardsQuery,
      (snapshot) => {
        const boards = snapshot.docs
          .map((item) => {
            const data = item.data();
            const isOwner = data['ownerId'] === user.uid;
            const permission = isOwner ? 'owner' : data['members']?.[user.uid];
            return {
              id: item.id,
              name: String(data['name'] ?? ''),
              description: String(data['description'] ?? ''),
              ownerId: String(data['ownerId'] ?? ''),
              ownerEmail: String(data['ownerEmail'] ?? ''),
              memberIds: Object.keys(data['members'] ?? {}),
              permission: permission as BoardPermission,
              tasks: Array.isArray(data['tasks']) ? (data['tasks'] as KanbanTask[]) : [],
              updatedAt: Number(data['updatedAt'] ?? 0),
            };
          })
          .filter((board) => board.permission);

        this.ngZone.run(() => {
          next(boards.sort((first, second) => second.updatedAt - first.updatedAt));
        });
      },
      (err) => {
        this.ngZone.run(() => error(err));
      }
    );
  }

  async createBoard(user: User, name: string, description: string, permission: BoardPermission): Promise<void> {
    this.requireFirebase();
    await addDoc(collection(this.db!, 'boards'), {
      name,
      description,
      ownerId: user.uid,
      ownerEmail: user.email ?? '',
      members: { [user.uid]: permission },
      memberIds: [user.uid],
      tasks: [],
      updatedAt: Date.now(),
    });
  }

  async saveTasks(board: KanbanBoard, tasks: KanbanTask[]): Promise<void> {
    this.requireFirebase();
    await updateDoc(doc(this.db!, 'boards', board.id), { tasks, updatedAt: Date.now() });
  }

  private requireFirebase(): void {
    if (!this.configured) throw new Error('Configure as credenciais do Firebase nos arquivos src/environments/environment*.ts.');
  }
}
