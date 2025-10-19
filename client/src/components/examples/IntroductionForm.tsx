import { useState } from "react";
import IntroductionForm from "../IntroductionForm";

export default function IntroductionFormExample() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  return (
    <IntroductionForm
      name={name}
      email={email}
      onNameChange={setName}
      onEmailChange={setEmail}
    />
  );
}
