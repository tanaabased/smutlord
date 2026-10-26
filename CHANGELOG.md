# Changelog

## {{ UNRELEASED_VERSION }} - [{{ UNRELEASED_DATE }}]({{ UNRELEASED_LINK }})

- Added explicit Google account and credential bindings through `GOG_ACCOUNT`. [#31](https://github.com/tanaabased/smutlord/pull/31)
- Added private workspace memory initialization that preserves existing notes. [#18](https://github.com/tanaabased/smutlord/pull/18)
- Added smutlord's identity and Cyrillic-first voice palette. [#9](https://github.com/tanaabased/smutlord/pull/9) [#16](https://github.com/tanaabased/smutlord/pull/16)
- Added verified Drive backups, nightly scheduling, and recoverable delivery. [#33](https://github.com/tanaabased/smutlord/pull/33) [#54](https://github.com/tanaabased/smutlord/pull/54)
- Allowed bounded Bugs, Tasks, and Features while retaining escalation for larger work. [#22](https://github.com/tanaabased/smutlord/pull/22)
- Configured isolated 1Password, GitHub, SSH signing, and memory credential sources. [#9](https://github.com/tanaabased/smutlord/pull/9)
- Delegated shared Codex installation and model configuration to Agent System. [#9](https://github.com/tanaabased/smutlord/pull/9) [#28](https://github.com/tanaabased/smutlord/pull/28)
- Documented agent-specific model authorization. [#15](https://github.com/tanaabased/smutlord/pull/15)
- Documented locked workspace dependency installation.
- Fixed interrupted backups blocking fresh captures. [#41](https://github.com/tanaabased/smutlord/pull/41)
- Fixed setup diagnostics misreporting output-buffer and permission failures as unavailable commands.
- Migrated GitHub workflows to Agent System's v3 configuration and default stages. [#42](https://github.com/tanaabased/smutlord/pull/42) [#55](https://github.com/tanaabased/smutlord/pull/55)
- Preserved shared host memory and Workshop settings during setup. [#31](https://github.com/tanaabased/smutlord/pull/31)
- Removed automatic `imessage` setup and the `imsg` dependency. [#9](https://github.com/tanaabased/smutlord/pull/9)
- Renamed the nightly backup automation to `backup-agent-nightly`. [#52](https://github.com/tanaabased/smutlord/pull/52)
- Seeded public workspace tooling from [EMORI commit `789df21b4aba17ddce56bffff64112f910aea85e`](https://github.com/tanaabased/emori/commit/789df21b4aba17ddce56bffff64112f910aea85e).
- Updated the workspace baseline to Node `26.12.1` and OpenClaw `2026.10.6`. [#50](https://github.com/tanaabased/smutlord/pull/50)
