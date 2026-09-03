export type ApiSuccessEnvelope<T> = {
  ok: true;
  data: T;
};

export type ApiErrorEnvelope = {
  ok: false;
  error: string;
  details?: unknown;
};

export type ApiEnvelope<T> = ApiSuccessEnvelope<T> | ApiErrorEnvelope;
