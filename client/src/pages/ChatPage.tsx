import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Send, Bot, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "Hello! I'm your AI assistant for Magnum Dashboard. I can help answer questions about:\n\n• How to use the recording system\n• Troubleshooting camera issues\n• Understanding the editing workflow\n• Export and sharing process\n\nWhat would you like to know?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: getAIResponse(input),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiResponse]);
    }, 1000);
  };

  const getAIResponse = (question: string): string => {
    const q = question.toLowerCase();

    if (q.includes("camera") || q.includes("preview")) {
      return "To check your cameras:\n\n1. Go to the Info page (Home)\n2. Look at the live camera preview at the top\n3. Both Camera 1 and Camera 2 should show live feeds\n4. If a camera isn't working, check your browser permissions and ensure cameras are connected\n\nNeed more specific help?";
    }

    if (q.includes("30 second") || q.includes("minimum") || q.includes("too short")) {
      return "Each scene requires a minimum of 30 seconds:\n\n• This ensures you have enough footage to select quality clips\n• If you try to stop before 30 seconds, you'll see a warning message\n• Aim for 45-60 seconds per scene for best results\n\nThe 30-second minimum applies to all three scenes: Cruising, Chase, and Arrival.";
    }

    if (q.includes("slot") || q.includes("edit") || q.includes("clip")) {
      return "To edit your clips:\n\n1. After recording, navigate to the Editing phase\n2. You'll see 3 separate pages (Cruising, Chase, Arrival)\n3. Click on a slot card to activate it\n4. The video preview will play your selected clip window\n5. Drag the timeline slider to choose the timing for your clip\n6. Click another slot to continue\n\nEach slot has a specific duration optimized for DaVinci Resolve and is color-coded by scene!";
    }

    if (q.includes("export") || q.includes("share") || q.includes("send")) {
      return "The export process:\n\n1. Complete all slot selections in the Arrival editor\n2. Click 'Export Video'\n3. Enter flight date and time (auto-rounded to nearest hour/half-hour)\n4. System will:\n   • Export to DaVinci Resolve format\n   • Upload to Google Drive\n   • Send SMS link to customer\n\nYou can review past exports in the History page!";
    }

    if (q.includes("phase") || q.includes("navigation") || q.includes("tab")) {
      return "Phase Navigation tabs let you jump between workflow stages:\n\n• Info → Recording → Editing → Export\n\nClick any tab at the top to move between phases. Completed phases are highlighted, and you can return to any previous phase at any time.";
    }

    return "I can help with:\n\n• Camera setup and troubleshooting\n• Recording requirements (30-second minimum)\n• Editing slots and selecting clips\n• Export and sharing process\n• Navigation and workflow\n\nCould you rephrase your question or ask something more specific about Magnum Dashboard?";
  };

  return (
    <div className="h-screen bg-background flex flex-col">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-purple-blue flex items-center justify-center">
            <MessageSquare className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">AI Chat Assistant</h1>
            <p className="text-sm text-muted-foreground">Ask questions about Magnum Dashboard</p>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {message.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-gradient-purple-blue flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot className="w-5 h-5 text-white" />
                </div>
              )}
              <Card
                className={`p-4 max-w-[80%] ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card/30 backdrop-blur-md"
                }`}
              >
                <p className="text-sm whitespace-pre-line">{message.content}</p>
                <p className="text-xs opacity-60 mt-2">
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </Card>
              {message.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 mt-1">
                  <User className="w-5 h-5" />
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="p-6 border-t border-border bg-card/30 backdrop-blur-md">
        <div className="max-w-3xl mx-auto flex gap-3">
          <Input
            placeholder="Type your question here..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            className="flex-1"
            data-testid="input-chat-message"
          />
          <Button
            onClick={handleSend}
            className="bg-gradient-purple-blue"
            data-testid="button-send-message"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
