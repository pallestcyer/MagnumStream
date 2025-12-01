// Shared constants for MagnumStream

// Staff members (salespeople)
export const STAFF_MEMBERS = [
  { value: "ian_methered", label: "Ian Methered" },
  { value: "rubi_guerra", label: "Rubi Guerra" },
  { value: "kevin_petersen", label: "Kevin Petersen" },
  { value: "kanani_keliipuleole", label: "Kanani Keliipuleole" },
  { value: "khristlyne_miashiro", label: "Khristlyne Miashiro" },
  { value: "brittany_pimente", label: "Brittany Pimente" },
  { value: "lina_tiumalu", label: "Lina Tiumalu" },
] as const;

// Helper function to get staff member display name from ID
export function getStaffMemberName(id: string): string {
  const member = STAFF_MEMBERS.find(m => m.value === id);
  return member?.label || id;
}

// Pilots with initials for Google Drive folder structure
export const PILOTS = [
  { value: "JP", label: "Jeff Protacio", initials: "JP" },
  { value: "HR", label: "Herbert Rafol", initials: "HR" },
  { value: "TB", label: "Travis Bartholomew", initials: "TB" },
  { value: "JL", label: "Josh Lang", initials: "JL" },
  { value: "TC", label: "Tianna Castillo", initials: "TC" },
  { value: "TyB", label: "Tyler Bledsoe", initials: "TyB" },
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
