import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface IntroductionFormProps {
  name: string;
  email: string;
  onNameChange: (name: string) => void;
  onEmailChange: (email: string) => void;
}

export default function IntroductionForm({ name, email, onNameChange, onEmailChange }: IntroductionFormProps) {
  return (
    <div className="space-y-6 max-w-md">
      <div className="space-y-2">
        <Label htmlFor="name" className="text-sm font-medium uppercase tracking-wide">
          Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          type="text"
          placeholder="Enter your name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className="h-12 bg-card/50 backdrop-blur-md border-border"
          data-testid="input-name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email" className="text-sm font-medium uppercase tracking-wide">
          Email <span className="text-muted-foreground text-xs">(Optional)</span>
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          className="h-12 bg-card/50 backdrop-blur-md border-border"
          data-testid="input-email"
        />
      </div>
    </div>
  );
}
