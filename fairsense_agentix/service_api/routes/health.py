"""Health and lifecycle routes."""

from __future__ import annotations

import logging
import os
import secrets
import time

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Request

from fairsense_agentix import __version__
from fairsense_agentix.configs import settings
from fairsense_agentix.data.risk_corpus import (
    MIT_AI_RISK_REPOSITORY_VERSION,
    MIT_AI_RISK_SNAPSHOT_DATE,
    MIT_INDEXED_RISK_COUNT,
)


logger = logging.getLogger(__name__)
router = APIRouter()

_LOOPBACK_HOSTS = frozenset({"127.0.0.1", "::1", "localhost", "testclient"})


@router.get("/v1/health")
async def health() -> dict[str, str | bool | int]:
    """Return readiness probe details.

    ``mock_mode`` is ``True`` when the LLM provider is ``fake``: results are
    synthetic placeholders and must not be interpreted as real analysis.

    Risk index fields describe the MIT corpus bundled in this release (see
    ``fairsense_agentix.data.risk_corpus``); they may differ from the frozen
    JOSS paper snapshot.
    """
    return {
        "status": "ok",
        "software_version": __version__,
        "llm_provider": settings.llm_provider,
        "mock_mode": settings.llm_provider == "fake",
        "mit_risk_repository_version": MIT_AI_RISK_REPOSITORY_VERSION,
        "mit_risk_snapshot_date": MIT_AI_RISK_SNAPSHOT_DATE,
        "indexed_risk_count": MIT_INDEXED_RISK_COUNT,
    }


def _authorize_shutdown(request: Request, token: str | None) -> None:
    """Reject shutdown requests that are disabled, unauthenticated, or remote.

    The endpoint is hidden (404) unless ``api_enable_shutdown_endpoint`` is set.
    When a shutdown token is configured it must be supplied; otherwise only
    loopback clients may stop the server.
    """
    if not settings.api_enable_shutdown_endpoint:
        raise HTTPException(status_code=404, detail="Not Found")

    if settings.api_shutdown_token:
        if not token or not secrets.compare_digest(
            token,
            settings.api_shutdown_token,
        ):
            raise HTTPException(status_code=403, detail="Invalid shutdown token")
        return

    client_host = request.client.host if request.client else None
    if client_host not in _LOOPBACK_HOSTS:
        raise HTTPException(
            status_code=403,
            detail=(
                "Shutdown is only accepted from loopback clients. Configure "
                "FAIRSENSE_API_SHUTDOWN_TOKEN to allow remote shutdown."
            ),
        )


@router.post("/v1/shutdown")
async def shutdown(
    request: Request,
    background_tasks: BackgroundTasks,
    x_shutdown_token: str | None = Header(default=None),
) -> dict[str, str]:
    """Gracefully shutdown the server.

    Disabled unless ``FAIRSENSE_API_ENABLE_SHUTDOWN_ENDPOINT=true``. Requires the
    ``X-Shutdown-Token`` header when ``FAIRSENSE_API_SHUTDOWN_TOKEN`` is set, and
    is otherwise restricted to loopback clients.

    Returns immediately with a success message, then shuts down after 1 second.
    """
    _authorize_shutdown(request, x_shutdown_token)

    def _shutdown() -> None:
        """Background task to exit cleanly after response is sent."""
        time.sleep(1)  # Give time for response to be sent
        logger.info("🛑 Shutdown requested via API - exiting gracefully...")
        os._exit(0)  # Clean exit - launcher will detect and cleanup ports

    background_tasks.add_task(_shutdown)
    return {"status": "shutting_down", "message": "Server will shutdown in 1 second"}
