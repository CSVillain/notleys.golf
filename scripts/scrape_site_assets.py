#!/usr/bin/env python3
"""Crawl a site with Playwright and save reusable static assets locally."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path


NODE_HELPER = r"""
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium } = require(require.resolve('playwright', { paths: [process.cwd()] }));

const configPath = process.argv[2];

function log(message) {
  process.stdout.write(`${message}\n`);
}

function normalizeUrl(raw, baseUrl) {
  if (!raw) return null;
  if (raw.startsWith('data:') || raw.startsWith('javascript:') || raw.startsWith('mailto:') || raw.startsWith('tel:')) {
    return null;
  }

  try {
    const resolved = new URL(raw, baseUrl);
    resolved.hash = '';
    return resolved.toString();
  } catch {
    return null;
  }
}

function isSameOrigin(urlString, origin) {
  try {
    return new URL(urlString).origin === origin;
  } catch {
    return false;
  }
}

function sanitizeSegment(value) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'file';
}

function extensionFromContentType(contentType) {
  const type = (contentType || '').split(';')[0].trim().toLowerCase();
  const mapping = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/avif': '.avif',
    'image/svg+xml': '.svg',
    'image/x-icon': '.ico',
    'image/vnd.microsoft.icon': '.ico',
    'text/css': '.css',
    'application/javascript': '.js',
    'text/javascript': '.js',
    'application/x-javascript': '.js',
    'application/pdf': '.pdf',
    'font/woff': '.woff',
    'font/woff2': '.woff2',
    'font/ttf': '.ttf',
    'font/otf': '.otf',
    'application/font-woff': '.woff',
    'application/font-woff2': '.woff2',
    'application/vnd.ms-fontobject': '.eot',
    'audio/mpeg': '.mp3',
    'audio/wav': '.wav',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'application/manifest+json': '.webmanifest',
  };

  return mapping[type] || '';
}

function hasAllowedExtension(urlString) {
  try {
    const pathname = new URL(urlString).pathname.toLowerCase();
    return [
      '.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg', '.ico',
      '.css', '.js', '.mjs', '.woff', '.woff2', '.ttf', '.otf', '.eot',
      '.pdf', '.mp4', '.webm', '.mp3', '.wav', '.webmanifest',
    ].some((extension) => pathname.endsWith(extension));
  } catch {
    return false;
  }
}

function matchesAllowedPath(urlString, allowedPathPrefixes) {
  if (!allowedPathPrefixes || !allowedPathPrefixes.length) {
    return true;
  }

  try {
    const pathname = new URL(urlString).pathname;
    return allowedPathPrefixes.some((prefix) => pathname.startsWith(prefix));
  } catch {
    return false;
  }
}

function shouldSaveAsset(urlString, contentType, origin, includeOffsite, allowedPathPrefixes) {
  if (!includeOffsite && !isSameOrigin(urlString, origin)) {
    return false;
  }

  if (!matchesAllowedPath(urlString, allowedPathPrefixes)) {
    return false;
  }

  const type = (contentType || '').split(';')[0].trim().toLowerCase();
  if (!type) {
    return hasAllowedExtension(urlString);
  }

  if (type.startsWith('text/html')) {
    return false;
  }

  if (
    type.startsWith('image/') ||
    type.startsWith('font/') ||
    type.startsWith('audio/') ||
    type.startsWith('video/')
  ) {
    return true;
  }

  return [
    'text/css',
    'application/javascript',
    'text/javascript',
    'application/x-javascript',
    'application/pdf',
    'image/svg+xml',
    'application/font-woff',
    'application/font-woff2',
    'application/vnd.ms-fontobject',
    'application/manifest+json',
  ].includes(type) || hasAllowedExtension(urlString);
}

function fileNameForUrl(urlString, contentType) {
  const url = new URL(urlString);
  let fileName = sanitizeSegment(path.basename(url.pathname)) || 'index';
  const existingExtension = path.extname(fileName);
  if (!existingExtension) {
    fileName += extensionFromContentType(contentType) || '.bin';
  }

  if (url.search) {
    const hash = crypto.createHash('sha1').update(url.search).digest('hex').slice(0, 8);
    const ext = path.extname(fileName);
    const base = ext ? fileName.slice(0, -ext.length) : fileName;
    fileName = `${base}__${hash}${ext}`;
  }

  return fileName;
}

function destinationPath(outputDir, urlString, contentType, origin, flattenMatchingAssets, reservedRelativePaths) {
  const url = new URL(urlString);
  const segments = url.pathname.split('/').filter(Boolean).map(sanitizeSegment);
  const fileName = fileNameForUrl(urlString, contentType);
  let relativePath;

  if (flattenMatchingAssets && url.origin === origin) {
    relativePath = fileName;
  } else if (url.origin === origin) {
    relativePath = path.join(...segments.slice(0, -1), fileName);
  } else {
    relativePath = path.join('_offsite', sanitizeSegment(url.hostname), ...segments.slice(0, -1), fileName);
  }

  if (reservedRelativePaths.has(relativePath)) {
    const ext = path.extname(fileName);
    const base = ext ? fileName.slice(0, -ext.length) : fileName;
    const hash = crypto.createHash('sha1').update(urlString).digest('hex').slice(0, 8);
    const uniqueFileName = `${base}__${hash}${ext}`;
    if (flattenMatchingAssets && url.origin === origin) {
      relativePath = uniqueFileName;
    } else if (url.origin === origin) {
      relativePath = path.join(...segments.slice(0, -1), uniqueFileName);
    } else {
      relativePath = path.join('_offsite', sanitizeSegment(url.hostname), ...segments.slice(0, -1), uniqueFileName);
    }
  }

  reservedRelativePaths.add(relativePath);

  if (url.origin === origin) {
    return path.join(outputDir, relativePath);
  }

  return path.join(outputDir, relativePath);
}

async function pathExists(pathname) {
  try {
    await fs.access(pathname);
    return true;
  } catch {
    return false;
  }
}

async function waitForVerifiedPage(page, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await page.waitForTimeout(2000);

    let title = '';
    let html = '';
    try {
      title = await page.title();
      html = await page.content();
    } catch {
      continue;
    }

    const combined = `${title}\n${html}`;
    const blocked = /Security Verification/i.test(combined) || /verify you'?re not a robot/i.test(combined);
    if (!blocked) {
      try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
      } catch {
        // Some pages keep connections open. The content is still usable.
      }
      return;
    }
  }

  throw new Error(`Timed out waiting for the security gate to clear after ${timeoutMs}ms`);
}

async function extractLinks(page, pageUrl) {
  const hrefs = await page.$$eval('a[href]', (anchors) => anchors.map((anchor) => anchor.href));
  return hrefs
    .map((href) => normalizeUrl(href, pageUrl))
    .filter(Boolean);
}

async function main() {
  const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
  const outputDir = config.outputDir;
  const startUrl = normalizeUrl(config.startUrl, config.startUrl);
  if (!startUrl) {
    throw new Error('Invalid start URL');
  }

  const origin = new URL(startUrl).origin;
  const pageQueue = [startUrl];
  const visitedPages = new Set();
  const seenAssets = new Set();
  const existingManifestPath = path.join(outputDir, 'manifest.json');
  let existingManifest = null;
  try {
    existingManifest = JSON.parse(await fs.readFile(existingManifestPath, 'utf8'));
  } catch {
    existingManifest = null;
  }

  const existingAssetPathByUrl = new Map(
    (existingManifest?.assets || [])
      .filter((asset) => asset.url && asset.path)
      .map((asset) => [asset.url, asset.path]),
  );
  const manifest = {
    start_url: startUrl,
    output_dir: outputDir,
    include_offsite: config.includeOffsite,
    allowed_path_prefixes: config.allowedPathPrefixes,
    flatten_matching_assets: config.flattenMatchingAssets,
    visited_pages: [],
    assets: [],
    failures: [],
  };

  let stopCrawl = false;

  await fs.mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 2200 },
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();
  const pendingWrites = new Set();
  let reservedAssetSlots = 0;
  const reservedRelativePaths = new Set();

  page.on('response', (response) => {
    const promise = (async () => {
      if (stopCrawl) {
        return;
      }

      const url = response.url();
      const headers = response.headers();
      const contentType = headers['content-type'] || '';
      const status = response.status();

      if (status >= 400 || seenAssets.has(url)) {
        return;
      }

      if (!shouldSaveAsset(url, contentType, origin, config.includeOffsite, config.allowedPathPrefixes)) {
        return;
      }

      if (config.maxAssets && reservedAssetSlots >= config.maxAssets) {
        stopCrawl = true;
        return;
      }

      seenAssets.add(url);
      reservedAssetSlots += 1;

      try {
        let destination;
        const existingRelativePath = existingAssetPathByUrl.get(url);
        if (existingRelativePath) {
          destination = path.resolve(process.cwd(), existingRelativePath);
          reservedRelativePaths.add(path.relative(outputDir, destination));
        } else {
          destination = destinationPath(
            outputDir,
            url,
            contentType,
            origin,
            config.flattenMatchingAssets,
            reservedRelativePaths,
          );
        }

        if (!config.overwriteExisting && await pathExists(destination)) {
          const stat = await fs.stat(destination);
          const relativePath = path.relative(process.cwd(), destination);
          manifest.assets.push({
            url,
            path: relativePath,
            bytes: stat.size,
            content_type: contentType,
            status,
            skipped_existing: true,
          });
          log(`[skip] ${url} -> ${relativePath}`);
          return;
        }

        const body = await response.body();
        if (!body || !body.length) {
          return;
        }

        await fs.mkdir(path.dirname(destination), { recursive: true });
        await fs.writeFile(destination, body);

        const relativePath = path.relative(process.cwd(), destination);
        manifest.assets.push({
          url,
          path: relativePath,
          bytes: body.length,
          content_type: contentType,
          status,
        });
        log(`[asset] ${url} -> ${relativePath}`);
      } catch (error) {
        manifest.failures.push({ url, error: error.message });
      }
    })().finally(() => pendingWrites.delete(promise));

    pendingWrites.add(promise);
  });

  try {
    while (pageQueue.length && visitedPages.size < config.maxPages && !stopCrawl) {
      const currentUrl = pageQueue.shift();
      if (!currentUrl || visitedPages.has(currentUrl)) {
        continue;
      }

      visitedPages.add(currentUrl);
      manifest.visited_pages.push(currentUrl);
      log(`[page] ${currentUrl}`);

      try {
        await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: config.navigationTimeoutMs });
        await waitForVerifiedPage(page, config.challengeTimeoutMs);
        await page.waitForTimeout(config.postLoadWaitMs);
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(config.postScrollWaitMs);

        const links = await extractLinks(page, currentUrl);
        for (const link of links) {
          if (!isSameOrigin(link, origin)) {
            continue;
          }
          if (!visitedPages.has(link) && !pageQueue.includes(link)) {
            pageQueue.push(link);
          }
        }
      } catch (error) {
        manifest.failures.push({ url: currentUrl, error: error.message });
      }
    }

    await Promise.allSettled([...pendingWrites]);
  } finally {
    await browser.close();
  }

  const manifestPath = path.join(outputDir, 'manifest.json');
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  log(`[done] pages=${manifest.visited_pages.length} assets=${manifest.assets.length} failures=${manifest.failures.length}`);
  log(`[manifest] ${path.relative(process.cwd(), manifestPath)}`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
"""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Visit a website in a real Playwright browser session and save discovered "
            "static assets for reuse."
        )
    )
    parser.add_argument(
        "start_url",
        nargs="?",
        default="https://notleysgolfclub.co.uk/",
        help="Site entrypoint to crawl. Defaults to the live Notleys Golf Club site.",
    )
    parser.add_argument(
        "--output-dir",
        default="scraped-assets/notleysgolfclub.co.uk-uploads",
        help="Directory to store the downloaded assets and manifest.",
    )
    parser.add_argument(
        "--path-prefix",
        action="append",
        dest="path_prefixes",
        help=(
            "Restrict saved assets to URLs whose path starts with this prefix. "
            "Repeat to allow multiple prefixes."
        ),
    )
    parser.add_argument(
        "--overwrite-existing",
        action="store_true",
        help="Redownload assets even if the target file already exists.",
    )
    parser.add_argument(
        "--max-pages",
        type=int,
        default=20,
        help="Maximum number of same-origin pages to visit while discovering assets.",
    )
    parser.add_argument(
        "--max-assets",
        type=int,
        default=0,
        help="Optional cap on downloaded assets. Use 0 for no cap.",
    )
    parser.add_argument(
        "--include-offsite",
        action="store_true",
        help="Also save third-party assets such as CDN-hosted fonts or scripts.",
    )
    parser.add_argument(
        "--navigation-timeout-ms",
        type=int,
        default=45000,
        help="Navigation timeout per page.",
    )
    parser.add_argument(
        "--challenge-timeout-ms",
        type=int,
        default=25000,
        help="How long to wait for the anti-bot gate to clear on a page.",
    )
    parser.add_argument(
        "--post-load-wait-ms",
        type=int,
        default=2500,
        help="Extra wait after the page becomes usable, before discovery.",
    )
    parser.add_argument(
        "--post-scroll-wait-ms",
        type=int,
        default=2000,
        help="Extra wait after scrolling to trigger lazy-loaded assets.",
    )
    return parser.parse_args()


def ensure_playwright_available(repo_root: Path) -> None:
    result = subprocess.run(
        ["node", "-e", "require.resolve('playwright')"],
        cwd=repo_root,
        capture_output=True,
        text=True,
    )
    if result.returncode == 0:
        return

    print(
        "Playwright is not available in this repo. Install the existing Node dependencies first, "
        "for example with `npm install`, then rerun this script.",
        file=sys.stderr,
    )
    raise SystemExit(1)


def run_scraper(args: argparse.Namespace, repo_root: Path) -> int:
    output_dir = (repo_root / args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    config = {
        "startUrl": args.start_url,
        "outputDir": str(output_dir),
        "maxPages": args.max_pages,
        "maxAssets": args.max_assets,
        "includeOffsite": args.include_offsite,
        "allowedPathPrefixes": args.path_prefixes or ["/wp-content/uploads/"],
        "flattenMatchingAssets": True,
        "overwriteExisting": args.overwrite_existing,
        "navigationTimeoutMs": args.navigation_timeout_ms,
        "challengeTimeoutMs": args.challenge_timeout_ms,
        "postLoadWaitMs": args.post_load_wait_ms,
        "postScrollWaitMs": args.post_scroll_wait_ms,
    }

    with tempfile.TemporaryDirectory(prefix="site-scrape-") as temp_dir:
        temp_path = Path(temp_dir)
        config_path = temp_path / "config.json"
        helper_path = temp_path / "scrape_assets.cjs"
        config_path.write_text(json.dumps(config), encoding="utf-8")
        helper_path.write_text(NODE_HELPER, encoding="utf-8")

        completed = subprocess.run(
            ["node", str(helper_path), str(config_path)],
            cwd=repo_root,
        )
        return completed.returncode


def main() -> int:
    args = parse_args()
    repo_root = Path(__file__).resolve().parent.parent
    ensure_playwright_available(repo_root)
    return run_scraper(args, repo_root)


if __name__ == "__main__":
    raise SystemExit(main())
