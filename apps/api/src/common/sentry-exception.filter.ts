import { ArgumentsHost, Catch, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import * as Sentry from "@sentry/node";
import { sentryEnabled } from "../instrument";

/**
 * Global filter that forwards genuine server faults (5xx / non-HTTP throws) to
 * Sentry with request context, then defers to Nest's default handling so the
 * client still gets the correct response. Expected 4xx exceptions (validation,
 * auth, not-found) are NOT reported — they're normal, not incidents.
 */
@Catch()
export class SentryExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger("Exception");

  override catch(exception: unknown, host: ArgumentsHost) {
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (status >= 500) {
      const req = host.switchToHttp().getRequest<{ method?: string; url?: string; id?: string }>();
      this.logger.error(
        `${req?.method ?? ""} ${req?.url ?? ""} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception)
      );
      if (sentryEnabled) {
        Sentry.withScope((scope) => {
          if (req?.id) scope.setTag("request_id", String(req.id));
          if (req?.url) scope.setContext("request", { method: req.method, url: req.url });
          Sentry.captureException(exception);
        });
      }
    }

    super.catch(exception, host);
  }
}
