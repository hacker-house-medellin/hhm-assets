# hhm-assets
Versioned product images, CSS, CDN exports, and static assets; app branding is isolated from marketing sites.


## Public asset catalog

`asset-manifest.json` enumerates stable asset IDs, paths, media types and accessible descriptions.
Downstream consumers can read it instead of hard-coding branding paths.

Validate catalog entries and reject broken, unsafe or duplicate paths with Node.js 22:

```sh
node scripts/verify-assets.mjs
node --test tests/assets.test.mjs
```
