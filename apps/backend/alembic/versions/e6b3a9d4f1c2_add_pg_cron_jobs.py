"""Move expiry/timeout/recovery jobs into Supabase pg_cron

Revision ID: e6b3a9d4f1c2
Revises: d5e9b321a78f
Create Date: 2026-09-07

Replaces the in-process FastAPI background loops with pg_cron jobs:
  - public.mark_expired_subscriptions()  — hourly          (users expiry)
  - public.enforce_task_timeouts()       — every minute    (task_execution_logs)
  - public.recover_orphaned_sessions()   — every 2 minutes (stale session state)

Also adds the affected tables to the supabase_realtime publication so
clients receive row changes over Supabase Realtime. users is added with a
column list so sensitive fields (password hashes etc.) are not broadcast.
"""

from alembic import op

revision = "e6b3a9d4f1c2"
down_revision = "d5e9b321a78f"
branch_labels = None
depends_on = None


_CRON_JOBS = {
    "tafiti_subscription_expiry": ("0 * * * *", "SELECT public.mark_expired_subscriptions()"),
    "tafiti_task_timeouts": ("* * * * *", "SELECT public.enforce_task_timeouts()"),
    "tafiti_crash_recovery": ("*/2 * * * *", "SELECT public.recover_orphaned_sessions()"),
}


def _create_cron_jobs() -> None:
    for name, (schedule, command) in _CRON_JOBS.items():
        op.execute(
            f"SELECT cron.unschedule('{name}') WHERE EXISTS "
            f"(SELECT 1 FROM cron.job WHERE jobname = '{name}')"
        )
        op.execute(f"SELECT cron.schedule('{name}', '{schedule}', $cron${command}$cron$)")


def _drop_cron_jobs() -> None:
    for name in _CRON_JOBS:
        op.execute(
            f"SELECT cron.unschedule('{name}') WHERE EXISTS "
            f"(SELECT 1 FROM cron.job WHERE jobname = '{name}')"
        )


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_cron;")

    # ── SQL functions (replace the Python background-job logic) ───────────────
    op.execute(
        """
        CREATE OR REPLACE FUNCTION public.mark_expired_subscriptions()
        RETURNS void
        LANGUAGE plpgsql
        AS $$
        BEGIN
            UPDATE public.users
               SET subscription_status = 'expired',
                   updated_at = (now() AT TIME ZONE 'UTC')
             WHERE subscription_status = 'active'
               AND subscription_ends_at IS NOT NULL
               AND subscription_ends_at < (now() AT TIME ZONE 'UTC');

            UPDATE public.users
               SET subscription_status = 'expired',
                   updated_at = (now() AT TIME ZONE 'UTC')
             WHERE subscription_status = 'trialing'
               AND trial_ends_at IS NOT NULL
               AND trial_ends_at < (now() AT TIME ZONE 'UTC');
        END;
        $$
        """
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION public.enforce_task_timeouts()
        RETURNS integer
        LANGUAGE plpgsql
        AS $$
        DECLARE
            v_affected integer;
        BEGIN
            UPDATE public.task_execution_logs
               SET status = 'failed',
                   error = 'Execution timed out after ' || timeout_seconds::text || 's',
                   completed_at = (now() AT TIME ZONE 'UTC')
             WHERE status = 'executing'
               AND timeout_at IS NOT NULL
               AND timeout_at < (now() AT TIME ZONE 'UTC');

            GET DIAGNOSTICS v_affected = ROW_COUNT;
            RETURN v_affected;
        END;
        $$
        """
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION public.recover_orphaned_sessions()
        RETURNS integer
        LANGUAGE plpgsql
        AS $$
        DECLARE
            v_session_ids text[];
            v_affected integer;
        BEGIN
            SELECT array_agg(id::text)
              INTO v_session_ids
              FROM public.research_session_states
             WHERE status = 'running'
               AND (heartbeat_at IS NULL
                 OR heartbeat_at < ((now() AT TIME ZONE 'UTC') - interval '120 seconds'));

            IF v_session_ids IS NULL THEN
                RETURN 0;
            END IF;

            UPDATE public.task_execution_logs
               SET status = 'orphaned',
                   error = 'Session abandoned or crashed',
                   completed_at = (now() AT TIME ZONE 'UTC')
             WHERE status IN ('planned', 'executing')
               AND session_id = ANY(v_session_ids);

            UPDATE public.research_session_states
               SET status = 'failed',
                   last_error = 'Recovered after crash/disconnect (heartbeat timed out)',
                   completed_at = (now() AT TIME ZONE 'UTC')
             WHERE id = ANY(v_session_ids);

            GET DIAGNOSTICS v_affected = ROW_COUNT;
            RETURN v_affected;
        END;
        $$
        """
    )

    # ── pg_cron schedules ─────────────────────────────────────────────────────
    _create_cron_jobs()

    # ── Supabase Realtime publication ─────────────────────────────────────────
    op.execute(
        """
        DO $$
        DECLARE
            v_pub boolean;
        BEGIN
            SELECT EXISTS (
                SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
            ) INTO v_pub;

            IF NOT v_pub THEN
                RAISE NOTICE 'supabase_realtime publication not found; skipping.';
                RETURN;
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM pg_publication_tables
                 WHERE pubname = 'supabase_realtime'
                   AND schemaname = 'public'
                   AND tablename = 'users'
            ) THEN
                ALTER PUBLICATION supabase_realtime
                  ADD TABLE public.users
                    (id, email, username, subscription_status,
                     subscription_ends_at, trial_ends_at);
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM pg_publication_tables
                 WHERE pubname = 'supabase_realtime'
                   AND schemaname = 'public'
                   AND tablename = 'research_session_states'
            ) THEN
                ALTER PUBLICATION supabase_realtime
                  ADD TABLE public.research_session_states;
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM pg_publication_tables
                 WHERE pubname = 'supabase_realtime'
                   AND schemaname = 'public'
                   AND tablename = 'task_execution_logs'
            ) THEN
                ALTER PUBLICATION supabase_realtime
                  ADD TABLE public.task_execution_logs;
            END IF;
        END
        $$
        """
    )


def downgrade() -> None:
    _drop_cron_jobs()
    op.execute("DROP FUNCTION IF EXISTS public.mark_expired_subscriptions()")
    op.execute("DROP FUNCTION IF EXISTS public.enforce_task_timeouts()")
    op.execute("DROP FUNCTION IF EXISTS public.recover_orphaned_sessions()")