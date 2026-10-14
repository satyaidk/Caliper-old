# Architecture decision records

Each record captures one decision: the context that forced it, the options
weighed, what was chosen, and what follows from it. Records are not edited after
they are accepted; a later decision that changes one supersedes it with a new
record.

| ADR | Decision | Status |
| --- | --- | --- |
| [0001](0001-bambu-studio-interface.md) | Follow Bambu Studio's interface, palette and keys | Accepted |
| [0002](0002-website-and-app-split.md) | Ship a website at `/` and the app at `/app/` from one build | Accepted |
| [0003](0003-generated-service-worker.md) | Generate the service worker per build instead of using Workbox | Accepted |
| [0004](0004-stencil-section-caps.md) | Fill section cuts with a stencil-buffer cap | Accepted |
| [0005](0005-crease-normals-for-stl.md) | Shade STL files with crease-angle normals | Accepted |

To add one, copy the shape of an existing record, number it next, and add a row
here.
