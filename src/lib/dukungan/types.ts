export const ORG_SHORT = "PUK K-SPSI 1973";
export const COMPANY = "PT. Indomarco Prismatama";
export const APP_TITLE = "Pernyataan Dukungan PKB";

export type Progress = {
  submitted: number;
  verified: number;
  totalEmployees: number | null;
  targetPercent: number;
  targetCount: number | null;
};

export type Challenge = {
  a: number;
  b: number;
  token: string;
};

export type PublicCatalog = {
  statementText: string;
  consentText: string;
  contactName: string;
  contactDetail: string;
  retentionNote: string;
  stores: string[];
  positions: string[];
  progress: Progress;
  challenge: Challenge;
};

export type SubmitInput = {
  fullName: string;
  nik: string;
  storeName: string;
  storeCode: string;
  positionName: string;
  signaturePng: string;
  consentRepresent: boolean;
  consentMember: boolean;
  challengeToken: string;
  challengeAnswer: string;
  hpField: string;
};

export type SubmitOk = {
  ok: true;
  receipt: string;
  fullName: string;
  storeName: string;
  storeCode: string;
  positionName: string;
  nikMask: string;
  at: string;
  consentMember: boolean;
};

export type Fail = { ok: false; message: string; code?: string };

export type SubmissionStatus = "pending" | "verified";

export type SubmissionRow = {
  id: string;
  receipt: string;
  fullName: string;
  nikMask: string;
  storeName: string;
  storeCode: string;
  positionName: string;
  consentMember: boolean;
  status: SubmissionStatus;
  at: string;
};

export type OfficialRow = SubmissionRow & {
  nik: string;
  signaturePng: string;
};

export type StoreStat = {
  storeName: string;
  total: number;
  verified: number;
};

export type KeyMode = "explicit" | "host" | "preview";

export type SettingsInput = {
  totalEmployees: number | null;
  targetPercent: number;
  statementText: string;
  consentText: string;
  contactName: string;
  contactDetail: string;
  retentionNote: string;
};
