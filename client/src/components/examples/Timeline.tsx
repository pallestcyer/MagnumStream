import Timeline from "../Timeline";

export default function TimelineExample() {
  const clips = [
    { id: "1", title: "Phase 1: Introduction", duration: 45 },
    { id: "2", title: "Phase 2: Main Tour", duration: 120 },
    { id: "3", title: "Phase 3: Closing", duration: 30 },
  ];

  return <Timeline clips={clips} />;
}
