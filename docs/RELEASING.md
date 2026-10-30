# Packaging and npm releases

Repository: https://github.com/toppk/lalune

Package: `@toppk/lalune` (public, under the `toppk` user scope). Verify the
account and published versions before each release; never overwrite an
existing version or publish under the unscoped `lalune` name.

## Local checks

```sh
npm ci
npm run check
npm test
npm run build
npm run test:bundles
npm publish --dry-run --cache /tmp/lalune-npm-cache
```

Dry run does not publish or reserve a package name, and it does not prove that
your account has permission to publish. It builds and inspects the archive.
The archive must include `dist/`, the 2K/4K NASA maps and their manifest, README,
programming/science guides, LICENSE, THIRD_PARTY_NOTICES.txt, and ASSETS.md. It must exclude source TIFF
caches, credentials, `node_modules/`, and any third-party reference images.

`npm pack` produces an installable `.tgz` for testing without publishing. Test
that tarball in a separate application, including `@toppk/lalune/core` imports and
bundler imports from `@toppk/lalune/assets/*`. The repository's **Package** workflow
runs checks and a dry run and uploads the tarball as an Actions artifact. It
does not publish to npm and requires no npm token.

## First publication

1. Confirm the intended package name, npm account, version, and public access.
   If the name must change, update examples and imports as well as package metadata.
2. Authenticate interactively on the machine performing the release:
   `npm login`. Complete npm's browser login and any 2FA steps there. Do not
   paste access tokens or one-time passwords into issues or chat.
3. Run `npm whoami` and review the dry-run contents above.
4. When ready to make the version public, run `npm publish --access public`.
   Complete any required npm confirmation. A published name/version cannot be
   reused for a different archive; do not treat publication as a throwaway test.
5. Verify the version with `npm view @toppk/lalune@0.2.1`, then create the matching
   GitHub release/tag and update the installation documentation to reflect
   the actual public package. These steps require deliberate release actions;
   the dry-run workflow does not perform them.

Code uses MIT; asset status and NASA credits are recorded separately in
ASSETS.md. Keep both notices in the archive.

## Subsequent automated releases

Prefer [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/)
from GitHub-hosted Actions with OIDC over storing a reusable write token.
Configure the exact owner (`toppk`), repository (`lalune`), and publishing
workflow filename in the npm package's settings. A real publishing workflow
needs `id-token: write` and a supported npm/Node version, plus a deliberate
release trigger. The current `package.yml` is only a packaging check: it is
not a trusted publisher and cannot perform a release.

If tokens are needed instead, use npm's current [granular token
instructions](https://docs.npmjs.com/creating-and-viewing-access-tokens/),
minimum necessary scope and a short expiry, with credentials held in a local
session or GitHub Actions secret. No token is needed to test packaging.
