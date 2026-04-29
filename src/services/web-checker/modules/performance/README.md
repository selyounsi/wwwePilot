# Performance module

Page-load timings, resource counts and PageSpeed Insights audit.

## What it checks

### From `performance.timing` / Resource Timing API
- TTFB, DOMContentLoaded, Load events
- Counts of CSS / JS / Font / Image / Other resources
- Total transferred bytes

### From PageSpeed Insights API
Two items: **Mobile** and **Desktop**. For each strategy:
- Overall Performance score (0-100)
- Core Web Vitals (LCP, INP, CLS, TBT, FCP, TTFB) with score colour
- Top opportunities ("Bilder optimieren", "JS reduzieren", …) with
  estimated savings

## API config

The PageSpeed URL is exported via `apiConfig` so the page-context
checker can read it without a bundler import:

```js
import { API } from '@/config/api.js'
export const apiConfig = { pagespeedUrl: API.pagespeed.url }
```

The framework passes this object as the first argument to `check()`.

## Custom display

`PerformanceItem` has special expand views for the PSI items (`psi-mobile`
/ `psi-desktop`) showing the Vitals grid and Opportunities list. Other
items use the standard ModuleItem expand.

## Limitations

- PSI requires the page to be publicly accessible (Google's crawler
  needs to reach it). Localhost or password-protected pages won't get
  PSI results.
- One PSI call per strategy — Mobile and Desktop run in parallel via
  `Promise.all`.
- Results are not cached — every check makes fresh API calls.
