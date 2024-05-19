import path from "path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { unstable_dev } from "wrangler";
import type { UnstableDevWorker } from "wrangler";

describe.each`
	remote   | experimentalDevenvRuntime
	${false} | ${false}
	${false} | ${true}
	${true}  | ${false}
	${true}  | ${true}
`(
	"unstable_dev: remote: $remote; experimentalDevenvRuntime: $experimentalDevenvRuntime;",
	({ remote, experimentalDevenvRuntime }) => {
		let worker: UnstableDevWorker;

		beforeAll(async () => {
			worker = await unstable_dev(path.resolve(__dirname, "index.js"), {
				logLevel: "none",
				ip: "127.0.0.1",
				experimental: {
					disableExperimentalWarning: true,
				},
				remote,
				experimentalDevenvRuntime,
			});
		}, 30_000);

		afterAll(() => worker.stop());

		test("module traversal results in correct response", async () => {
			const resp = await worker.fetch();
			const text = await resp.text();
			expect(text).toBe("Hello Jane Smith and Hello John Smith");
		});

		test("module traversal results in correct response for CommonJS", async () => {
			const resp = await worker.fetch("/cjs");
			const text = await resp.text();
			expect(text).toBe("CJS: Hello Jane Smith and Hello John Smith");
		});

		test.skipIf(remote && experimentalDevenvRuntime)(
			"correct response for CommonJS which imports ESM",
			async () => {
				const resp = await worker.fetch("/cjs-loop");
				const text = await resp.text();
				expect(text).toBe("CJS: cjs-string");
			}
		);

		test("support for dynamic imports", async () => {
			const resp = await worker.fetch("/dynamic");
			const text = await resp.text();
			expect(text).toBe("dynamic");
		});

		test("basic wasm support", async () => {
			const resp = await worker.fetch("/wasm");
			const text = await resp.text();
			expect(text).toBe("42");
		});

		test("resolves wasm import paths relative to root", async () => {
			const resp = await worker.fetch("/wasm-nested");
			const text = await resp.text();
			expect(text).toBe("nested42");
		});

		test("wasm can be imported from a dynamic import", async () => {
			const resp = await worker.fetch("/wasm-dynamic");
			const text = await resp.text();
			expect(text).toBe("sibling42subdirectory42");
		});

		test("text data can be imported", async () => {
			const resp = await worker.fetch("/txt");
			const text = await resp.text();
			expect(text).toBe("TEST DATA");
		});

		test("binary data can be imported", async () => {
			const resp = await worker.fetch("/bin");
			const bin = await resp.arrayBuffer();
			const expected = new Uint8Array(new ArrayBuffer(4));
			expected.set([0, 1, 2, 10]);
			expect(new Uint8Array(bin)).toEqual(expected);
		});

		test("actual dynamic import (that cannot be inlined by an esbuild run)", async () => {
			const resp = await worker.fetch("/lang/fr.json");
			const text = await resp.text();
			expect(text).toBe("Bonjour");
		});
	}
);
