The shader preparation changes removed the observed hall and kitchen arrival Long Tasks in the final short capture. A single **55.6 ms hall frame interval remained**, so this result does not establish that every hitch is resolved.

The captures used headless Edge 152, an NVIDIA RTX 5080 through ANGLE/D3D11, a 1440×960 drawing buffer, high graphics quality and brightness 1.35. They ran on 8 September 2026 in Sydney using `scripts/no-input-world-review.mjs --run --cpu`: direct camera fixtures at child eye height, two seconds of arrival, three seconds settled, then a screenshot. No mouse, keyboard, focus or pointer-lock input was used. These fixtures do not establish walked traversal or gameplay FPS; profiling adds overhead.

| Preparation | Hall arrival Long Task | Kitchen arrival Long Task | Longest hall arrival interval | Longest kitchen arrival interval | `getProgramInfoLog` sampled time, hall / kitchen |
|---|---:|---:|---:|---:|---:|
| Original screen-target warmup | 591 ms | 275 ms | 580.7 ms | 265.3 ms | 580.065 / 266.003 ms |
| Correct composer target | 67 ms | None observed | 53.7 ms | 16.9 ms | 57.735 / 3.103 ms |
| Composer target, normal variants and program finalization | None observed | None observed | 55.6 ms | 16.8 ms | 4.496 / 0 sampled ms |

Long Task observation was supported throughout. “None observed” means no recorded Long Task intersected that window. CPU values use the complete arrival profiles; zero sampled time does not prove a function was never called. The first arrival interval can be a partial frame. Final settled windows also contained no Long Tasks, with maximum intervals of 16.8 ms in the hall and 16.9 ms in the kitchen.

The original warmup compiled for the screen, while RenderPass uses the composer's linear target. Output colour space and tone mapping affect Three's program key, leaving actual world variants unprepared. Correcting the target removed most of the delay. The remaining hall profile contained 31.401 ms of shader diagnostic samples in the colour pass, 21.780 ms in GTAO's normal override and 4.554 ms in a later shadow pass.

`src/shader-preparation.js` prepares colour and normal variants for all four torch/battle-light combinations, then waits for and finalizes every generated program. It temporarily substitutes actual mesh materials to compile GTAO normals, restoring material references, render target and light visibility in `finally`. Shader error checks remain enabled.

This relies on pinned **Three 0.185.1** internals `isReady()` and `getUniforms()`, which need review on upgrades. Without `KHR_parallel_shader_compile`, readiness returns immediately and finalization can still block during loading. The three-millisecond budget yields between batches; it cannot interrupt a native GL call.

Normals are deliberately prepared even when GTAO starts disabled, to reduce shader work on later quality increases. This adds loading work and allocates the existing normal framebuffer; it does not duplicate GLTF textures or geometry or render the disabled pass every frame. Finalization discovers shader locations without uploading sampler textures. Quality-switch performance was not measured here.

Local evidence is retained in the ignored artifact directories below; each contains `report.json`, screenshots and separate arrival/settled CPU profiles:

- `artifacts/no-input-world-release-six-views/`: valid baseline; the hall and kitchen were the first two fixtures.
- `artifacts/no-input-world-shader-target-fix-retry/`: valid target-only capture.
- `artifacts/no-input-world-shader-complete-retry/`: valid complete-preparation capture.

Valid runs recorded one navigation, no HMR or page errors, and unchanged local source hashes; reports retain served-module hashes. The preceding `shader-target-fix` and `shader-complete` attempts captured zero views after Vite full reloads. They remain preserved and excluded, rather than treated as gameplay failures.

The final release suite passes **157 unit and geometry checks**, including shader preparation, phone shortcuts, treatment guards and the exported animal animations. The 167-asset Blender source audit and production build also pass. The README records the final integration result; the performance evidence above remains limited to the stated captures.
