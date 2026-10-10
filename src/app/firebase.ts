import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { environment } from '../environments/environment';

const config = environment.firebase;
const configured = Object.values(config).every((value) => Boolean(value));
const app = configured ? initializeApp(config) : null;

export const firebaseAuth = app ? getAuth(app) : null;
export const firebaseDb = app ? getFirestore(app) : null;
