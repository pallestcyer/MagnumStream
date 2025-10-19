import RecordingControls from "../RecordingControls";

export default function RecordingControlsExample() {
  return (
    <RecordingControls
      isRecording={true}
      isPaused={false}
      hasRecording={false}
      onStart={() => console.log("Start")}
      onStop={() => console.log("Stop")}
      onPause={() => console.log("Pause")}
      onResume={() => console.log("Resume")}
      onRetake={() => console.log("Retake")}
    />
  );
}
