export class ApplicationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
    public readonly headers?: HeadersInit,
  ) {
    super(message);
    this.name = "ApplicationError";
  }
}
