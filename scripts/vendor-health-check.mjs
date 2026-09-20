#!/usr/bin/env node
/**
 * Vendors @still-running/health-check into a checked-in TypeScript source
 * file instead of a package.json runtime dependency.
 *
 * Why: n8n rejects verified community nodes that declare any runtime
 * dependency (see this repo's README). But `n8n-node build` is a plain
 * `tsc` pass — not a bundler — so a normal `import` of a real dependency
 * would compile to a literal `require('@still-running/health-check')`
 * that resolves to nothing once the package isn't installed downstream
 * (only `dependencies` get installed for consumers, not `devDependencies`,
 * and this repo declares it only as the latter). And the package itself
 * publishes ESM-only, so even a working require() would risk ERR_REQUIRE_ESM
 * on an n8n instance running an older Node.
 *
 * This script sidesteps both problems in one step: esbuild bundles the
 * installed package into one self-contained blob, which gets written out
 * with a *.ts extension so this project's own `tsc` compiles it exactly
 * like any other source file — through the project's normal CJS output,
 * no separate copy-to-dist step, no module-format mismatch.
 *
 * Run this again, and commit the result, whenever the pinned
 * devDependency version in package.json is deliberately bumped. It is not
 * run automatically as part of `build`/`dev` — the generated file is
 * checked in like any other source file.
 */
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'));
const pinnedVersion = pkg.devDependencies['@still-running/health-check'];

const installedPkg = JSON.parse(
	readFileSync(
		join(rootDir, 'node_modules/@still-running/health-check/package.json'),
		'utf8',
	),
);

if (installedPkg.version !== pinnedVersion) {
	throw new Error(
		`node_modules has @still-running/health-check@${installedPkg.version}, but package.json ` +
			`pins ${pinnedVersion}. Run "npm install" to match the pin before re-vendoring, or update ` +
			'the pin first if the bump is deliberate.',
	);
}

const result = await build({
	entryPoints: [join(rootDir, 'node_modules/@still-running/health-check/dist/index.js')],
	bundle: true,
	platform: 'node',
	format: 'esm',
	target: 'es2019',
	write: false,
});

const outputFile = result.outputFiles[0];
if (!outputFile) {
	throw new Error('esbuild produced no output for @still-running/health-check.');
}

const header = `/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Bundled from @still-running/health-check@${installedPkg.version} (pinned
 * exact in package.json's devDependencies — never a range, never a
 * workspace link) by scripts/vendor-health-check.mjs. Regenerate with
 * \`node scripts/vendor-health-check.mjs\` after bumping that pin.
 *
 * package.json's own dependencies stays empty — n8n verified nodes may not
 * declare a runtime dependency — while the code that actually runs is still
 * built from one specific, reproducible, published npm version.
 */
/* eslint-disable */
// @ts-nocheck

`;

writeFileSync(
	join(rootDir, 'nodes/StillRunning/vendor/healthCheck.generated.ts'),
	header + outputFile.text,
);

console.log(
	`Vendored @still-running/health-check@${installedPkg.version} -> ` +
		'nodes/StillRunning/vendor/healthCheck.generated.ts',
);
