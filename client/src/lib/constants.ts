// Shared constants for MagnumStream

export const STAFF_MEMBERS = [
  { value: "john", label: "John Smith" },
  { value: "sarah", label: "Sarah Johnson" },
  { value: "michael", label: "Michael Chen" },
  { value: "emily", label: "Emily Rodriguez" },
  { value: "david", label: "David Williams" },
] as const;

// Helper function to get staff member display name from ID
export function getStaffMemberName(id: string): string {
  const member = STAFF_MEMBERS.find(m => m.value === id);
  return member?.label || id;
}

export const PILOTS = [
  { value: "captain_mike", label: "Captain Mike" },
  { value: "captain_sarah", label: "Captain Sarah" },
  { value: "captain_tom", label: "Captain Tom" },
  { value: "captain_lisa", label: "Captain Lisa" },
] as const;

export function getPilotName(id: string): string {
  const pilot = PILOTS.find(p => p.value === id);
  return pilot?.label || id;
}

export const FLIGHT_TIMES = [
  { value: "08:00", label: "8:00 AM" },
  { value: "09:00", label: "9:00 AM" },
  { value: "10:00", label: "10:00 AM" },
  { value: "11:00", label: "11:00 AM" },
  { value: "12:00", label: "12:00 PM" },
  { value: "13:00", label: "1:00 PM" },
  { value: "14:00", label: "2:00 PM" },
  { value: "15:00", label: "3:00 PM" },
  { value: "16:00", label: "4:00 PM" },
  { value: "17:00", label: "5:00 PM" },
] as const;
