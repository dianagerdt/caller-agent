export type QuestId = 'it-archetype' | 'debugging-confession' | 'prod-down-rpg' | 'custom';

export type CallStatus =
  | 'idle'
  | 'connecting'
  | 'published'
  | 'ringing'
  | 'answered'
  | 'completed'
  | 'noAnswer'
  | 'failed'
  | 'closed'
  | 'interrupted';

export type TranscriptSource = 'user' | 'model' | 'unknown';

export interface TranscriptItem {
  id: string;
  source: TranscriptSource;
  text: string;
  timestamp: number;
  seqNum?: number;
}

export interface TechnicalEvent {
  id: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  timestamp: number;
  details?: unknown;
}

export interface QuestDefinition {
  id: QuestId;
  title: string;
  description: string;
  accentColor: string;
}

export interface ResultCard {
  questId: QuestId;
  source: 'gigachat' | 'fallback';
  title: string;
  fields: Record<string, string | string[] | number>;
}

export interface CallSessionSnapshot {
  sessionId: string;
  requestId?: string;
  callId?: string;
  questId: QuestId;
  voice: string;
  status: CallStatus;
  transcript: TranscriptItem[];
  technicalEvents: TechnicalEvent[];
  resultCard?: ResultCard;
  createdAt: number;
  updatedAt: number;
}

export type ServerEvent =
  | { type: 'status'; session: CallSessionSnapshot }
  | { type: 'transcription'; item: TranscriptItem }
  | { type: 'technicalEvent'; event: TechnicalEvent }
  | { type: 'functionCall'; data: unknown }
  | { type: 'resultCard'; card: ResultCard }
  | { type: 'error'; message: string; details?: unknown };
