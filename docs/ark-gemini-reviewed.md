# Gemini's own image-guided ark revision

The first actual render failed visual review: fog hid the opening and the cabin roof hid the animals. Four actual PNG frames and the complete original model response were sent back to Gemini. The second response changes its scene and PCM synthesis itself. Both responses remain unedited.

The revision has valid direction metadata, valid JavaScript and a twenty-second scene, but it uses its own literal timing rather than reading `DIRECTOR_SCORE.shots`. The production provider correctly rejects that as `direction_error`. That gate is **not weakened** here. To fulfil the user's explicit request to see Gemini's scene, the original self-contained revision is instead prepared for the existing explicit code-import route, with `providerAccepted:false`, `scoreConsumed:false` and its original failure retained in the render provenance. Syntax, opaque-origin isolation, CSP, duration and repeatability checks still apply.

This is an experimental rendering of actual Gemini output, not proof that the production directed-generation route autonomously accepted it. There have been two actual provider calls for the task: initial generation and image-guided revision. Later rendering of the retained response uses no provider requests. No agent-authored changes are made to the wave, ark, animals, camera, choir, notes or synthesis.
