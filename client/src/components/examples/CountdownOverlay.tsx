import CountdownOverlay from "../CountdownOverlay";

export default function CountdownOverlayExample() {
  return <CountdownOverlay onComplete={() => console.log("Countdown complete")} />;
}
