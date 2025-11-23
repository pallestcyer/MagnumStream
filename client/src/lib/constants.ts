// Shared constants for MagnumStream

// Staff members grouped by role
export const STAFF_MEMBERS = [
  // Customer Service Representatives (CSR)
  { value: "kiana_machado", label: "Kiana Machado", role: "CSR" },
  { value: "jessicha_kealoha", label: "Jessicha Kealoha", role: "CSR" },
  { value: "asa_nagata", label: "Asa Nagata", role: "CSR" },
  { value: "kylen_malepeai", label: "Kylen Malepeai", role: "CSR" },
  { value: "nelin_cadena", label: "Nelin Cadena", role: "CSR" },
  // Customer Service Managers
  { value: "ian_mothered", label: "Ian Mothered", role: "Manager" },
  { value: "rubi_guerra", label: "Rubi Guerra", role: "Manager" },
  // Shift Supervisors
  { value: "kevin_pedersen", label: "Kevin Pedersen", role: "Supervisor" },
] as const;

// Helper function to get staff member display name from ID
export function getStaffMemberName(id: string): string {
  const member = STAFF_MEMBERS.find(m => m.value === id);
  return member?.label || id;
}

// Pilots with initials for Google Drive folder structure
export const PILOTS = [
  { value: "SK", label: "Shawn Konzal", initials: "SK" },
  { value: "JP", label: "Jeff Protocolo", initials: "JP" },
  { value: "HR", label: "Herbert Rafol", initials: "HR" },
  { value: "JO", label: "Jaedon Oliver", initials: "JO" },
  { value: "TB", label: "Travis Bartholomew", initials: "TB" },
  { value: "JL", label: "Josh LaBonte", initials: "JL" },
  { value: "TC", label: "Tianna Castillo", initials: "TC" },
] as const;

export function getPilotName(id: string): string {
  const pilot = PILOTS.find(p => p.value === id);
  return pilot?.label || id;
}

export function getPilotInitials(id: string): string {
  const pilot = PILOTS.find(p => p.value === id);
  return pilot?.initials || id;
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
