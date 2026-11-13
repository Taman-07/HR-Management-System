import { prisma } from "../src/db/client.js";

const count = await prisma.department.count();
console.log(`Connected. Departments in database: ${count}`);

await prisma.$disconnect();