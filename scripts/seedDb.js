import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { prisma } from "../src/db/client.js";

const COUNTRY_CODES = {
  India: "IN",
  Argentina: "AR",
  Brazil: "BR",
  Pakistan: "PK",
  USA: "US",
  "United States": "US",
};

function readCsv(fileName) {
  const filePath = path.join(process.cwd(), "data", fileName);
  const text = fs.readFileSync(filePath, "utf-8");
  return parse(text, {
    columns: (header) => header.map((h) => h.trim()),
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true,
  });
}

const toBool = (v) =>
  ["true", "yes", "y", "1"].includes(String(v).trim().toLowerCase());

const toKeywords = (v) =>
  String(v)
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);

const cleanEmail = (v) => String(v).replace(/\s+/g, "").toLowerCase();

const toDisplayName = (key) =>
  key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

async function main() {
  const docs = readCsv("hr_document_metadata.csv");
  const employees = readCsv("employee_data.csv");
  console.log(`Read ${docs.length} policy rows and ${employees.length} employee rows`);

  // 1. Departments: one per unique mailbox_function
  const deptMap = new Map();
  for (const d of docs) {
    if (!d.mailbox_function || !d.owner_channel) {
      throw new Error(`Policy ${d.record_id} has no owner department`);
    }
    deptMap.set(d.mailbox_function, {
      key: d.mailbox_function,
      name: toDisplayName(d.mailbox_function),
      email: cleanEmail(d.owner_channel),
    });
  }

  // 2. Country checks before touching the database
  const docCodes = new Set(docs.map((d) => d.country_code.toUpperCase()));
  const employeeRows = employees.map((e) => {
    const countryCode = COUNTRY_CODES[e.country];
    if (!countryCode) {
      throw new Error(`Unknown country "${e.country}" (employee ${e.employee_id})`);
    }
    if (!docCodes.has(countryCode)) {
      throw new Error(`No policies exist for ${countryCode} (employee ${e.employee_id})`);
    }
    return {
      employeeId: e.employee_id,
      name: e.employee_name,
      email: cleanEmail(e.employee_email),
      grade: e.employee_grade,
      isManager: toBool(e.is_manager),
      department: e.employee_department,
      country: e.country,
      countryCode,
    };
  });

  console.log("Clearing old data...");
  await prisma.policyDocument.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.department.deleteMany();

  console.log("Seeding departments...");
  await prisma.department.createMany({ data: [...deptMap.values()] });
  const deptRows = await prisma.department.findMany();
  const deptIdByKey = Object.fromEntries(deptRows.map((d) => [d.key, d.id]));

  console.log("Seeding employees...");
  await prisma.employee.createMany({ data: employeeRows });

  console.log("Seeding policy documents...");
  await prisma.policyDocument.createMany({
    data: docs.map((p) => ({
      recordId: p.record_id,
      baseCode: p.base_code,
      countryCode: p.country_code.toUpperCase(),
      country: p.country,
      title: p.title,
      docType: p.doc_type,
      category: p.category,
      filename: p.filename,
      keywords: toKeywords(p.keywords),
      version: Number(p.version),
      active: toBool(p.active),
      ownerDepartmentId: deptIdByKey[p.mailbox_function],
    })),
  });

  console.log("Done. Row counts:", {
    departments: await prisma.department.count(),
    employees: await prisma.employee.count(),
    policyDocuments: await prisma.policyDocument.count(),
  });
}

main()
  .catch((err) => {
    console.error("Seeding failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());