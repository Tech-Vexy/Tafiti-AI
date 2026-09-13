import logging

from fastapi import FastAPI

from app.core.config import settings

logger = logging.getLogger("tracing")

METRICS_PATH = "/metrics"


def init_tracing(app: FastAPI):
    """Initialize OpenTelemetry tracing when an OTLP endpoint is configured.

    Safe no-op when tracing is not configured or the optional packages are
    missing, so a minimal deployment never fails at startup over telemetry.
    """
    endpoint = settings.OTEL_EXPORTER_OTLP_ENDPOINT
    if not endpoint:
        return
    try:
        from opentelemetry import trace
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor

        resource = Resource.create({"service.name": settings.OTEL_SERVICE_NAME})
        provider = TracerProvider(resource=resource)
        provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=endpoint)))
        trace.set_tracer_provider(provider)
        FastAPIInstrumentor.instrument_app(app, tracer_provider=provider)
        logger.info("OpenTelemetry tracing enabled at %s", endpoint)
    except Exception as e:  # pragma: no cover - environment dependent
        logger.warning("OpenTelemetry init skipped: %s", e)


def mount_metrics(app: FastAPI):
    """Expose Prometheus /metrics when ENABLE_PROMETHEUS is set."""
    if not settings.ENABLE_PROMETHEUS:
        return
    try:
        from prometheus_fastapi_instrumentator import Instrumentator

        Instrumentator().instrument(app).expose(app, endpoint=METRICS_PATH, include_in_schema=False)
        logger.info("Prometheus metrics enabled at %s", METRICS_PATH)
    except Exception as e:  # pragma: no cover - environment dependent
        logger.warning("Prometheus metrics skipped: %s", e)