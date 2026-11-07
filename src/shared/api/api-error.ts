export class ApiError extends Error {
  readonly status: number;
  readonly data?: unknown;
  readonly requestId?: string;
  readonly serverBuild?: string;
  readonly serverSchema?: string;

  constructor(status: number, message: string, data?: unknown, context: { requestId?: string; serverBuild?: string; serverSchema?: string } = {}) {
    super(message);

    this.name = "ApiError";

    this.status = status;
    this.data = data;
    this.requestId = context.requestId;
    this.serverBuild = context.serverBuild;
    this.serverSchema = context.serverSchema;
  }
}
