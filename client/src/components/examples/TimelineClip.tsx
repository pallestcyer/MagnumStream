import TimelineClip from "../TimelineClip";

export default function TimelineClipExample() {
  return (
    <div className="w-64">
      <TimelineClip
        id="1"
        title="Phase 1: Introduction"
        duration={45}
      />
    </div>
  );
}
