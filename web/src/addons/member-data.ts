export type MemberStatus = "Active" | "Inactive";

export const MEMBER_STATUS_OPTIONS: MemberStatus[] = ["Active", "Inactive"];

export type MemberRecord = {
  id: string;
  memberId: string;
  email: string;
  joined: string;
  phoneNumber: string;
  status: MemberStatus;
};

export type PaymentHistoryRow = {
  id: string;
  month: string;
  amountPaid: string;
  status: "Paid" | "Unpaid";
  paymentDate: string;
};

export type MemberDetailRecord = {
  memberId: string;
  name: string;
  email: string;
  phoneNumber: string;
  address: string;
  attendance: string;
  voteRole: string;
  monthlyDues: string;
  totalPaid: string;
  outstanding: string;
  status: MemberStatus;
  paymentHistory: PaymentHistoryRow[];
};

export const MEMBER_ROWS: MemberRecord[] = [
  { id: "member-1", memberId: "2944", email: "Andrew.karl@gmail.com", joined: "12 Jan 2024", phoneNumber: "09198489383", status: "Active" },
  { id: "member-2", memberId: "2945", email: "Susan.efe@gmail.com", joined: "15 Jan 2024", phoneNumber: "08023456781", status: "Active" },
  { id: "member-3", memberId: "2946", email: "Peter.ogaga@gmail.com", joined: "19 Jan 2024", phoneNumber: "08134567892", status: "Inactive" },
  { id: "member-4", memberId: "2947", email: "Mabel.okoro@gmail.com", joined: "02 Feb 2024", phoneNumber: "09045678903", status: "Active" },
  { id: "member-5", memberId: "2948", email: "Daniel.uche@gmail.com", joined: "09 Feb 2024", phoneNumber: "07056789014", status: "Active" },
  { id: "member-6", memberId: "2949", email: "Joy.oghene@gmail.com", joined: "18 Feb 2024", phoneNumber: "09167890125", status: "Inactive" },
  { id: "member-7", memberId: "2950", email: "Kelvin.ose@gmail.com", joined: "25 Feb 2024", phoneNumber: "08078901236", status: "Active" },
  { id: "member-8", memberId: "2951", email: "Naomi.oro@gmail.com", joined: "04 Mar 2024", phoneNumber: "08189012347", status: "Active" },
  { id: "member-9", memberId: "2952", email: "Blessing.edo@gmail.com", joined: "11 Mar 2024", phoneNumber: "09090123458", status: "Inactive" },
  { id: "member-10", memberId: "2953", email: "Rita.ife@gmail.com", joined: "17 Mar 2024", phoneNumber: "07001234569", status: "Active" },
  { id: "member-11", memberId: "2954", email: "Henry.obi@gmail.com", joined: "22 Mar 2024", phoneNumber: "09112345670", status: "Active" },
  { id: "member-12", memberId: "2955", email: "Ese.tonye@gmail.com", joined: "03 Apr 2024", phoneNumber: "08023456711", status: "Inactive" },
  { id: "member-13", memberId: "2956", email: "Vivian.koko@gmail.com", joined: "10 Apr 2024", phoneNumber: "08134567822", status: "Active" },
  { id: "member-14", memberId: "2957", email: "Collins.asa@gmail.com", joined: "15 Apr 2024", phoneNumber: "09045678933", status: "Active" },
  { id: "member-15", memberId: "2958", email: "Tari.ofili@gmail.com", joined: "21 Apr 2024", phoneNumber: "07056789044", status: "Inactive" },
  { id: "member-16", memberId: "2959", email: "Oma.seimor@gmail.com", joined: "29 Apr 2024", phoneNumber: "09167890155", status: "Active" },
  { id: "member-17", memberId: "2960", email: "Zion.okon@gmail.com", joined: "05 May 2024", phoneNumber: "08078901266", status: "Active" },
  { id: "member-18", memberId: "2961", email: "Amaka.nelo@gmail.com", joined: "13 May 2024", phoneNumber: "08189012377", status: "Inactive" },
  { id: "member-19", memberId: "2962", email: "Paul.iyke@gmail.com", joined: "20 May 2024", phoneNumber: "09090123488", status: "Active" },
  { id: "member-20", memberId: "2963", email: "Ejiro.mefa@gmail.com", joined: "27 May 2024", phoneNumber: "07001234599", status: "Active" },
  { id: "member-21", memberId: "2964", email: "Ruth.kene@gmail.com", joined: "06 Jun 2024", phoneNumber: "09112345610", status: "Inactive" },
  { id: "member-22", memberId: "2965", email: "Aghogho.ize@gmail.com", joined: "14 Jun 2024", phoneNumber: "08023456721", status: "Active" },
  { id: "member-23", memberId: "2966", email: "Sonia.rex@gmail.com", joined: "22 Jun 2024", phoneNumber: "08134567832", status: "Active" },
  { id: "member-24", memberId: "2967", email: "Victor.anene@gmail.com", joined: "01 Jul 2024", phoneNumber: "09045678943", status: "Inactive" },
];

const DEFAULT_PAYMENT_HISTORY: PaymentHistoryRow[] = [
  { id: "payment-jan-2026", month: "January 2026", amountPaid: "$20", status: "Paid", paymentDate: "Jan 16, 2026" },
  { id: "payment-feb-2026", month: "February 2026", amountPaid: "$20", status: "Paid", paymentDate: "Feb 17, 2026" },
  { id: "payment-mar-2026", month: "March 2026", amountPaid: "$20", status: "Paid", paymentDate: "Mar 24, 2026" },
  { id: "payment-apr-2026", month: "April 2026", amountPaid: "$0", status: "Unpaid", paymentDate: "-" },
  { id: "payment-may-2026", month: "May 2026", amountPaid: "$0", status: "Unpaid", paymentDate: "-" },
  { id: "payment-jun-2026", month: "June 2026", amountPaid: "$20", status: "Paid", paymentDate: "Jun 30, 2026" },
  { id: "payment-jul-2026", month: "July 2026", amountPaid: "$0", status: "Unpaid", paymentDate: "-" },
];

const DETAIL_OVERRIDES: Record<string, MemberDetailRecord> = {
  "2944": {
    memberId: "2944",
    name: "Andrew Karl",
    email: "Andrew.karl@gmail.com",
    phoneNumber: "09198489383",
    address: "12 Ring Road, Benin City, Edo State",
    attendance: "March",
    voteRole: "YES",
    monthlyDues: "$20",
    totalPaid: "$1500",
    outstanding: "$80",
    status: "Active",
    paymentHistory: DEFAULT_PAYMENT_HISTORY,
  },
};

function titleCaseName(value: string) {
  return value
    .split(/[.\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function deriveNameFromEmail(email: string) {
  const localPart = email.split("@")[0] ?? "";
  return titleCaseName(localPart) || "Member";
}

function deriveAttendanceFromJoined(joined: string) {
  const parts = joined.trim().split(/\s+/);
  if (parts.length >= 2) {
    return titleCaseName(parts[1]);
  }
  return "March";
}

export function getMemberDetailByMemberId(memberId: string): MemberDetailRecord {
  const member = MEMBER_ROWS.find((entry) => entry.memberId === memberId);
  const override = DETAIL_OVERRIDES[memberId];

  if (override) return override;

  if (!member) {
    return {
      memberId,
      name: "Member Not Found",
      email: "unknown@upumi.org",
      phoneNumber: "-",
      address: "",
      attendance: "March",
      voteRole: "NO",
      monthlyDues: "$20",
      totalPaid: "$0",
      outstanding: "$0",
      status: "Inactive",
      paymentHistory: DEFAULT_PAYMENT_HISTORY,
    };
  }

  return {
    memberId: member.memberId,
    name: deriveNameFromEmail(member.email),
    email: member.email,
    phoneNumber: member.phoneNumber,
    address: "",
    attendance: deriveAttendanceFromJoined(member.joined),
    voteRole: member.status === "Active" ? "YES" : "NO",
    monthlyDues: "$20",
    totalPaid: "$1500",
    outstanding: member.status === "Active" ? "$80" : "$120",
    status: member.status,
    paymentHistory: DEFAULT_PAYMENT_HISTORY,
  };
}