#!/usr/bin/env python3
"""Download and verify the selected Quiet Vale GitHub release assets."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import shutil
import stat
import sys
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def verify(path: Path, asset: dict) -> None:
    if path.stat().st_size != asset['bytes'] or digest(path) != asset['sha256']:
        raise ValueError(f'Checksum mismatch: {path}; no extraction performed.')


def extract(archive: Path, destination: Path) -> None:
    destination = destination.resolve()
    with zipfile.ZipFile(archive) as z:
        pending = []
        # Check every destination before writing any member of this archive.
        for item in z.infolist():
            target = (destination / item.filename).resolve()
            if not target.is_relative_to(destination) or stat.S_ISLNK(item.external_attr >> 16):
                raise ValueError(f'Unsafe archive member: {item.filename}')
            if item.is_dir():
                continue
            if target.exists():
                h = hashlib.sha256()
                with z.open(item) as source:
                    for block in iter(lambda: source.read(1024 * 1024), b''):
                        h.update(block)
                if not target.is_file() or digest(target) != h.hexdigest():
                    raise FileExistsError(f'Preserving changed local file: {target}. Extract into a clean checkout instead.')
            else:
                pending.append((item, target))
        for item, target in pending:
            target.parent.mkdir(parents=True, exist_ok=True)
            with z.open(item) as source, target.open('xb') as output:
                shutil.copyfileobj(source, output, length=1024 * 1024)
    print(f'Extracted {len(pending)} new files to {destination}', flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--group', choices=['all', 'print', 'rules', 'authoring'], required=True)
    parser.add_argument('--extract', action='store_true', help='Restore repository-relative files; refuses to overwrite changed files.')
    parser.add_argument('--cache-dir', type=Path, default=ROOT / 'output/handoff-downloads')
    args = parser.parse_args()
    manifest = json.loads((ROOT / 'handoff/release-assets.json').read_text())
    assets = [a for a in manifest['assets'] if args.group == 'all' or a['group'] == args.group]
    args.cache_dir.mkdir(parents=True, exist_ok=True)
    for asset in assets:
        path = args.cache_dir / asset['name']
        if not path.exists():
            part = path.with_suffix(path.suffix + '.part')
            print(f"Downloading {asset['name']} ({asset['bytes']/1e6:.1f} MB)", flush=True)
            request = urllib.request.Request(asset['url'], headers={'User-Agent': 'Quiet-Vale-handoff'})
            with urllib.request.urlopen(request, timeout=120) as response, part.open('wb') as output:
                shutil.copyfileobj(response, output, length=1024 * 1024)
            verify(part, asset)
            part.rename(path)
        verify(path, asset)
        print(f'Verified {path.name}', flush=True)
        if args.extract:
            extract(path, ROOT / asset['extract_to'])


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(f'Handoff download stopped: {error}', file=sys.stderr)
        raise SystemExit(1)
