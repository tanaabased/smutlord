/** Status is code/metadata only: never persist raw child output or arbitrary error prose. */
export default function safeFailure(error) {
  const code =
    /^(?:backup|drive|archive|receipt|upload|remote|local|delivery|managed|retention|capture|legacy|agent|private|journal|storage)-[a-z0-9-]{1,64}$/.test(
      error?.message,
    )
      ? error.message
      : 'task-failed';
  const diagnostic = error?.diagnostic;
  return {
    code,
    ...(diagnostic
      ? {
          diagnostic: {
            exitCode: Number.isInteger(diagnostic.exitCode) ? diagnostic.exitCode : null,
            signal: /^SIG[A-Z]{1,12}$/.test(diagnostic.signal) ? diagnostic.signal : null,
            timedOut: diagnostic.timedOut === true,
            ...(diagnostic.code &&
            ['ETIMEDOUT', 'ENOBUFS', 'ENOENT', 'EACCES', 'EPERM'].includes(diagnostic.code)
              ? { code: diagnostic.code }
              : {}),
            ...(diagnostic.upstreamCode &&
            [
              'backup-retained-verification-failed',
              'backup-archive-invalid',
              'backup-archive-changed',
              'backup-prune-race',
              'backup-prune-delete-failed',
              'backup-openclaw-state-required',
              'backup-source-changed',
              'backup-source-lost',
              'google-account-mismatch',
              'google-authentication-failed',
              'google-permission-denied',
            ].includes(diagnostic.upstreamCode)
              ? { upstreamCode: diagnostic.upstreamCode }
              : {}),
          },
        }
      : {}),
  };
}
