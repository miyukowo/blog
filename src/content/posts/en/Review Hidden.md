---
title: 'Review Hidden fixture'
description: 'Permanent unlisted fixture whose mixed-case, space-containing filename must match its normalized route and stay out of discovery surfaces.'
pubDate: 2026-11-13
unlisted: true
---

This unlisted post exists so the real build exercises filename identity normalization:
the loader emits `/posts/review-hidden/`, the sitemap exclusion must use that same
identity, the page stays directly reachable and noindex, and it never appears in
listings, feeds, search or the sitemap.
