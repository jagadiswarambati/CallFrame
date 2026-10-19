export interface CallSession {
  id: string;
  callerName?: string;
  callerPhone?: string;
  callerEmail?: string;
  company?: string;
  currentStage: number; // 1 to 8
  timerSeconds: number;
  stageData: Record<number, Record<string, any>>;
  notes: string;
  outcome?: string;
  followUpDate?: string;
  status: 'active' | 'completed' | 'abandoned';
  createdAt: string;
  updatedAt: string;
}

const ACTIVE_CALL_KEY = 'callframe_active_call_id';
const CALL_DRAFT_PREFIX = 'callframe_draft_';

/**
 * Gets the current active call ID stored in local cache.
 */
export function getActiveCallId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACTIVE_CALL_KEY);
}

/**
 * Sets the current active call ID in local cache.
 */
export function setActiveCallId(id: string | null): void {
  if (typeof window === 'undefined') return;
  if (id) {
    localStorage.setItem(ACTIVE_CALL_KEY, id);
  } else {
    localStorage.removeItem(ACTIVE_CALL_KEY);
  }
}

/**
 * Saves local draft state for a call ID.
 */
export function saveCallDraft(id: string, data: Partial<CallSession>): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`${CALL_DRAFT_PREFIX}${id}`, JSON.stringify(data));
}

/**
 * Retrieves local draft state for a call ID.
 */
export function getCallDraft(id: string): Partial<CallSession> | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(`${CALL_DRAFT_PREFIX}${id}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Purges draft state for a specific call ID.
 */
export function clearCallDraft(id: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(`${CALL_DRAFT_PREFIX}${id}`);
}

/**
 * 1. Start a New Call Session
 */
export async function startNewCall(callerDetails?: {
  name?: string;
  phone?: string;
  email?: string;
  company?: string;
}): Promise<CallSession> {
  // Purge any existing active call reference first
  setActiveCallId(null);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch('/api/calls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callerName: callerDetails?.name || '',
        callerPhone: callerDetails?.phone || '',
        callerEmail: callerDetails?.email || '',
        company: callerDetails?.company || '',
        currentStage: 1,
        status: 'active',
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Server returned ${res.status}: Failed to initialize new call`);
    }

    const newCall: CallSession = await res.json();
    setActiveCallId(newCall.id);
    clearCallDraft(newCall.id);
    return newCall;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * 2. Fetch Call Details by ID
 */
export async function fetchCallById(id: string): Promise<CallSession> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`/api/calls/${id}`, {
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Failed to load call ${id}`);
    }

    const call: CallSession = await res.json();
    return call;
  } catch (error) {
    clearTimeout(timeoutId);
    // Fallback to local draft if offline or API delay occurs
    const draft = getCallDraft(id);
    if (draft && draft.id) {
      return draft as CallSession;
    }
    throw error;
  }
}

/**
 * 3. Save / Update Stage Progress
 */
export async function saveStageProgress(
  id: string,
  payload: {
    stage: number;
    stageData: Record<string, any>;
    notes?: string;
    timerSeconds?: number;
  }
): Promise<CallSession> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`/api/calls/${id}/stage`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error('Failed to save stage data on server.');
    }

    const updated: CallSession = await res.json();
    saveCallDraft(id, updated);
    return updated;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * 4. End Call and Submit Final Outcome
 */
export async function endCallSession(
  id: string,
  finalPayload: {
    outcome: string;
    followUpDate?: string;
    notes?: string;
    timerSeconds?: number;
    stageData?: Record<number, Record<string, any>>;
  }
): Promise<CallSession> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(`/api/calls/${id}/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...finalPayload,
        status: 'completed',
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error('Server rejected call completion request.');
    }

    const completedCall: CallSession = await res.json();

    // Remove active call references ONLY after confirmed backend completion
    setActiveCallId(null);
    clearCallDraft(id);

    return completedCall;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * 5. Fetch Call History List
 */
export async function fetchCallHistory(): Promise<CallSession[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch('/api/calls', {
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error('Failed to fetch call history from database');
    }

    const history: CallSession[] = await res.json();
    return history;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}