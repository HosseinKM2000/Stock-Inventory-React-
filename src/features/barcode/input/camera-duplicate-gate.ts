export class CameraDuplicateGate {
  private current: string | null = null;
  private missingFrames = 0;
  private readonly requiredMissingFrames: number;

  constructor(requiredMissingFrames = 3) {
    this.requiredMissingFrames = requiredMissingFrames;
  }

  observe(value: string) {
    this.missingFrames = 0;
    if (this.current === value) return false;
    this.current = value;
    return true;
  }

  absent() {
    if (this.current == null) return;
    this.missingFrames += 1;
    if (this.missingFrames >= this.requiredMissingFrames) this.rearm();
  }

  rearm() {
    this.current = null;
    this.missingFrames = 0;
  }
}
