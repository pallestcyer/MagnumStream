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
