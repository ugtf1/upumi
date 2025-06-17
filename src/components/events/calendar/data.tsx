function getFourthSaturday(year: number, month: number): Date {
  const firstDay = new Date(year, month, 1);
  const dayOfWeek = firstDay.getDay();
  const offset = (6 - dayOfWeek + 7) % 7; // Find the first Saturday
  const fourthSaturday = 1 + offset + 21; // Add 21 days to get the fourth Saturday
  return new Date(year, month, fourthSaturday);
}

export const events = [
  {
    title: "UPUMI FUNDRAISER",
    start: new Date(2025, 3, 12),
    end: new Date(2025, 3, 12),
    allDay: true,
    description: " Description for UPUMI FUNDRAISER",
    location:
      "Devine Providence Lithuanian 25335 W Nine Mile Rd, Southfield, MI 48033",
  },
  {
    title: "2025 UPUA Convention",
    start: new Date(2025, 3, 12),
    end: new Date(2025, 3, 12),
    allDay: true,
    description: " Description for 2025 UPUA Convention",
    location:
      "Devine Providence Lithuanian 25335 W Nine Mile Rd, Southfield, MI 48033",
  },
];

// Generate UPUMI Monthly Meeting events for the year 2025
for (let month = 0; month < 12; month++) {
  const date = getFourthSaturday(2025, month);
  events.push({
    title: "UPUMI Monthly Meeting",
    start: date,
    end: date,
    allDay: true,
    description:
      "UPUMI monthly meeting is where we meet to fellowship as brothers/sisters every month",
    location: "17500 Northland Park Ct Southfield, MI 48075",
  });
}
