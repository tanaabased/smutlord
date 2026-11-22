## {{ UNRELEASED_VERSION }} - [{{ UNRELEASED_DATE }}]({{ UNRELEASED_LINK }})

## v1.1.0 - [November 22, 2026](https://github.com/tanaabased/smutlord/releases/tag/v1.1.0)

### Features

- Added nightly `update-agent` to advance workspace source, install locked dependencies, reconcile Agent System without setup, and run Doctor. [#77](https://github.com/tanaabased/smutlord/pull/77)
- Added project issue pickup and migrated scheduling to Agent System scans. [#73](https://github.com/tanaabased/smutlord/pull/73) [#81](https://github.com/tanaabased/smutlord/pull/81)

### Improvements

- Moved nightly `backup-agent` to 01:00 scheduler-local time and retained run reports in persistent chat. [#78](https://github.com/tanaabased/smutlord/pull/78) [#92](https://github.com/tanaabased/smutlord/pull/92) [#93](https://github.com/tanaabased/smutlord/pull/93)
- Moved weekly phrase review to issue-first proposals instead of direct palette edits. [#63](https://github.com/tanaabased/smutlord/pull/63)
- Removed local nightly archives after successful Drive upload; failed uploads retain local copies. [#86](https://github.com/tanaabased/smutlord/pull/86)
- Simplified `backup-agent` and `update-agent` so each run reports its own result and old locks or checkpoints no longer block new runs. [#107](https://github.com/tanaabased/smutlord/pull/107)
- Updated OpenClaw development and hosted test baseline to `2026.11.6`. [#102](https://github.com/tanaabased/smutlord/pull/102) [#106](https://github.com/tanaabased/smutlord/pull/106)
- Updated routed models to GPT-6.2 Sol. [#97](https://github.com/tanaabased/smutlord/pull/97)

### Bug Fixes

- Fixed Canon setup health checks to accept installed skill inventory without requiring specific skill names. [#84](https://github.com/tanaabased/smutlord/pull/84)

### Notes

- Clarified Update Agent failure reporting and documented recovery without replaying uncertain changes. [#99](https://github.com/tanaabased/smutlord/pull/99) [#104](https://github.com/tanaabased/smutlord/pull/104)
- Made article-free English mandatory in `smutlord` voice guidance. [#95](https://github.com/tanaabased/smutlord/pull/95)

# Changelog

## v1.0.0 - [October 27, 2026](https://github.com/tanaabased/smutlord/releases/tag/v1.0.0)

### New Features

- Added explicit Google account and credential bindings through `GOG_ACCOUNT`. [#31](https://github.com/tanaabased/smutlord/pull/31)
- Added private memory initialization. Existing notes stay intact. [#18](https://github.com/tanaabased/smutlord/pull/18)
- Added `smutlord`'s identity and Cyrillic-first voice palette. [#9](https://github.com/tanaabased/smutlord/pull/9) [#16](https://github.com/tanaabased/smutlord/pull/16)
- Added verified Drive backups, nightly scheduling, and recoverable delivery. [#33](https://github.com/tanaabased/smutlord/pull/33) [#54](https://github.com/tanaabased/smutlord/pull/54)
- Configured isolated 1Password, GitHub, SSH signing, and memory credential sources. [#9](https://github.com/tanaabased/smutlord/pull/9)

### Improvements

- Allowed bounded Bugs, Tasks, and Features. Larger work still requires direction. [#22](https://github.com/tanaabased/smutlord/pull/22)
- Delegated shared Codex installation and model configuration to Agent System. [#9](https://github.com/tanaabased/smutlord/pull/9) [#28](https://github.com/tanaabased/smutlord/pull/28)
- Migrated GitHub workflows to Agent System's v3 configuration and default stages. [#42](https://github.com/tanaabased/smutlord/pull/42) [#55](https://github.com/tanaabased/smutlord/pull/55)
- Removed automatic `imessage` setup and the `imsg` dependency. [#9](https://github.com/tanaabased/smutlord/pull/9)
- Renamed the nightly backup automation to `backup-agent-nightly`. [#52](https://github.com/tanaabased/smutlord/pull/52)
- Updated the workspace baseline to Node `26.12.1` and OpenClaw `2026.10.6`. [#50](https://github.com/tanaabased/smutlord/pull/50)

### Bug Fixes

- Fixed interrupted backups blocking fresh captures. [#41](https://github.com/tanaabased/smutlord/pull/41)
- Fixed setup errors blaming missing commands when output buffer filled or execution permission was denied.
- Preserved shared host memory and Workshop settings during setup. [#31](https://github.com/tanaabased/smutlord/pull/31)

### Notes

- Documented agent-specific model authorization. [#15](https://github.com/tanaabased/smutlord/pull/15)
- Documented locked workspace dependency installation.
- Seeded public workspace tooling from [EMORI commit `789df21b4aba17ddce56bffff64112f910aea85e`](https://github.com/tanaabased/emori/commit/789df21b4aba17ddce56bffff64112f910aea85e).
