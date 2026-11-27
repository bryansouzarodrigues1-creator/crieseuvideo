/** The one error every direction path throws (cast+verbs, actor choreography, compact semantic plan), written for the model: it is quoted back in the repair round. */
export class DirectionError extends Error {
  readonly code = "invalid_direction";
  constructor(message: string) {
    super(message);
    this.name = "DirectionError";
  }
}
