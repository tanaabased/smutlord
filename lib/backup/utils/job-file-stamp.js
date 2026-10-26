/** Only new job-namespaced captures are eligible for automatic remote cleanup. */
export default function jobFileStamp(name) {
  const match =
    /^smutlord-nightly-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.tar\.gz$/.exec(
      name,
    );
  if (!match) return undefined;
  const stamp = match[1];
  const iso = stamp.replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, 'T$1:$2:$3.$4Z');
  const time = Date.parse(iso);
  return Number.isFinite(time) && new Date(time).toISOString() === iso ? stamp : undefined;
}
