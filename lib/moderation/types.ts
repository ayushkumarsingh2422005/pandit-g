export type ViolationKind =
  | "severe_abuse"
  | "mild_abuse"
  | "spam"
  | "repetitive"
  | "off_topic"
  | "prank";

export type ViolationResult = {
  kind: ViolationKind;
  /** Immediate block without strike accumulation. */
  immediateBlock: boolean;
};
