import type { CorrectionMode, CorrectionResponse, FieldType } from '@ewa/shared';

export type CorrectMessage = {
  type: 'CORRECT';
  requestId: string;
  text: string;
  fieldType?: FieldType;
  previousText?: string;
};

export type CorrectResultMessage = {
  type: 'CORRECT_RESULT';
  requestId: string;
  ok: boolean;
  data?: CorrectionResponse;
  error?: string;
  aborted?: boolean;
  timing?: { backendMs?: number; model?: string };
};

export type CancelMessage = {
  type: 'CANCEL_CORRECT';
  requestId: string;
};

export type GetSettingsMessage = { type: 'GET_SETTINGS' };
export type SetSettingsMessage = {
  type: 'SET_SETTINGS';
  patch: {
    enabled?: boolean;
    highlights?: boolean;
    correctionMode?: CorrectionMode;
    backendUrl?: string;
    consentAccepted?: boolean;
    groqApiKey?: string;
  };
};
export type GetHistoryMessage = { type: 'GET_HISTORY' };
export type ClearHistoryMessage = { type: 'CLEAR_HISTORY' };
export type AddHistoryMessage = {
  type: 'ADD_HISTORY';
  original: string;
  corrected: string;
};

export type ExtensionMessage =
  | CorrectMessage
  | CancelMessage
  | GetSettingsMessage
  | SetSettingsMessage
  | GetHistoryMessage
  | ClearHistoryMessage
  | AddHistoryMessage;

export type SettingsPayload = {
  enabled: boolean;
  highlights: boolean;
  correctionMode: CorrectionMode;
  backendUrl: string;
  consentAccepted: boolean;
  groqApiKey: string;
};
