import PhaseIndicator from "../PhaseIndicator";

export default function PhaseIndicatorExample() {
  const phases = [
    { id: 1, title: "Introduction", completed: true },
    { id: 2, title: "Main Tour", completed: false },
    { id: 3, title: "Closing", completed: false },
  ];

  return <PhaseIndicator currentPhase={2} phases={phases} />;
}
