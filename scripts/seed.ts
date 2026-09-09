import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("Missing MONGODB_URI");
  process.exit(1);
}

async function main() {
  await mongoose.connect(MONGODB_URI!, { serverSelectionTimeoutMS: 5000 });
  const db = mongoose.connection.db!;
  console.log("Connected. Clearing collections…");

  // Drop legacy unique primary index if present
  try {
    await db.collection("users").dropIndex("type_1_primary_1");
  } catch {
    /* ignore */
  }

  const names = [
    "users",
    "orgs",
    "projects",
    "shifts",
    "attendances",
    "leavetypes",
    "leaves",
    "payrolls",
    "payslips",
  ];
  for (const name of names) {
    try {
      await db.collection(name).deleteMany({});
    } catch {
      /* ignore */
    }
  }
  // mongoose pluralization variants
  for (const name of await db.listCollections().toArray()) {
    if (
      [
        "users",
        "orgs",
        "projects",
        "shifts",
        "attendances",
        "leavetypes",
        "leaves",
        "payrolls",
        "payslips",
      ].includes(name.name.toLowerCase())
    ) {
      await db.collection(name.name).deleteMany({});
    }
  }

  // Import models after connect
  const { User } = await import("../src/models/User");
  const { Org } = await import("../src/models/Org");
  const { Project } = await import("../src/models/Project");
  const { Shift } = await import("../src/models/Shift");
  const { LeaveType } = await import("../src/models/LeaveType");
  const { Attendance } = await import("../src/models/Attendance");

  const passHash = await bcrypt.hash("password123", 10);

  const superAdmin = await User.create({
    email: "super@hrm.local",
    passHash,
    name: "Super Admin",
    type: "superAdmin",
    primary: false,
    active: true,
  });

  const primaryAdmin = await User.create({
    email: "primary@hrm.local",
    passHash,
    name: "Primary Org Admin",
    type: "orgAdmin",
    primary: true,
    active: true,
    orgIds: [],
  });

  const org = await Org.create({
    name: "Figics Labs",
    code: "FIG",
    timezone: "Asia/Karachi",
    status: "active",
    currency: "PKR",
    secondaryCurrency: "USD",
    fxRate: 280,
    createdBy: primaryAdmin._id,
  });

  const org2 = await Org.create({
    name: "SideHustle Co",
    code: "SHC",
    timezone: "UTC",
    status: "active",
    currency: "PKR",
    secondaryCurrency: "USD",
    fxRate: 280,
    createdBy: primaryAdmin._id,
  });

  // Link primary OA to both seeded orgs (OA1 style)
  primaryAdmin.orgId = org._id;
  primaryAdmin.orgIds = [org._id, org2._id];
  await primaryAdmin.save();

  const secondaryAdmin = await User.create({
    email: "orgadmin@hrm.local",
    passHash,
    name: "Secondary Org Admin",
    type: "orgAdmin",
    primary: false,
    active: true,
    orgIds: [org._id],
  });

  const shift = await Shift.create({
    orgId: org._id,
    name: "General",
    startTime: "09:00",
    endTime: "18:00",
    graceMinutes: 15,
  });
  org.defaultShiftId = shift._id;
  await org.save();

  const overnight = await Shift.create({
    orgId: org._id,
    name: "Night",
    startTime: "21:00",
    endTime: "01:00",
    graceMinutes: 15,
  });
  void overnight;

  const shift2 = await Shift.create({
    orgId: org2._id,
    name: "General",
    startTime: "09:00",
    endTime: "18:00",
    graceMinutes: 15,
  });
  org2.defaultShiftId = shift2._id;
  await org2.save();

  const annual = await LeaveType.create({
    orgId: org._id,
    name: "Annual",
    defaultCredits: 14,
    paid: true,
  });
  const unpaid = await LeaveType.create({
    orgId: org._id,
    name: "Unpaid",
    defaultCredits: 5,
    paid: false,
  });

  const p1 = await Project.create({
    orgId: org._id,
    name: "HRM Platform",
    code: "HRM",
    managerIds: [],
    status: "active",
  });
  const p2 = await Project.create({
    orgId: org._id,
    name: "Mobile App",
    code: "MOB",
    managerIds: [],
    status: "active",
  });

  const pm = await User.create({
    email: "pm@hrm.local",
    passHash,
    name: "Project Manager",
    type: "projectManager",
    orgId: org._id,
    scope: "projects",
    projIds: [p1._id],
    code: "PM001",
    designation: "Engineering Manager",
    shiftId: shift._id,
    salary: { basic: 120000, allowances: 15000, deductions: 2000 },
    credits: [
      { typeId: annual._id, balance: 14 },
      { typeId: unpaid._id, balance: 5 },
    ],
    joinDate: new Date(),
  });

  await Project.findByIdAndUpdate(p1._id, { managerIds: [pm._id] });

  const memberOrg = await User.create({
    email: "member@hrm.local",
    passHash,
    name: "Org-wide Member",
    type: "member",
    orgId: org._id,
    scope: "org",
    projIds: [],
    code: "MB001",
    designation: "Developer",
    shiftId: shift._id,
    salary: { basic: 80000, allowances: 8000, deductions: 1500 },
    credits: [
      { typeId: annual._id, balance: 14 },
      { typeId: unpaid._id, balance: 5 },
    ],
    joinDate: new Date(),
  });

  const memberProj = await User.create({
    email: "member2@hrm.local",
    passHash,
    name: "Project-only Member",
    type: "member",
    orgId: org._id,
    scope: "projects",
    projIds: [p2._id],
    code: "MB002",
    designation: "Designer",
    shiftId: shift._id,
    salary: { basic: 70000, allowances: 5000, deductions: 1000 },
    credits: [
      { typeId: annual._id, balance: 10 },
      { typeId: unpaid._id, balance: 3 },
    ],
    joinDate: new Date(),
  });

  const today = new Date().toISOString().slice(0, 10);
  await Attendance.create({
    userId: memberOrg._id,
    orgId: org._id,
    date: today,
    clockIn: new Date(),
    status: "present",
    lateMinutes: 0,
    workedMinutes: 0,
  });

  console.log("Seed complete.\n");
  console.log("Demo accounts (password: password123)");
  console.log("--------------------------------------");
  console.log(`superAdmin     ${superAdmin.email}`);
  console.log(`orgAdmin (P)   ${primaryAdmin.email}`);
  console.log(`orgAdmin       ${secondaryAdmin.email} (org: ${org.code} only)`);
  console.log(`projectManager ${pm.email}`);
  console.log(`member (org)   ${memberOrg.email}`);
  console.log(`member (proj)  ${memberProj.email}`);
  console.log(`Orgs: ${org.name} (${org.code}), ${org2.name} (${org2.code})`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
