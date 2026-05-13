// ─────────────────────────────────────────────────────────────
// Seed Script — Internship Platform
// Populates the database with initial test data.
// Idempotent: safe to run multiple times (uses upsert).
// ─────────────────────────────────────────────────────────────

import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database...');

  // ── Admin User ────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: 'admin@internship-platform.et' },
    update: {},
    create: {
      email: 'admin@internship-platform.et',
      passwordHash: '$2b$10$placeholder_hashed_admin_password_abc123',
      firstName: 'System',
      lastName: 'Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
      isVerified: true,
    },
  });
  console.log(`  ✓ Admin user created: ${admin.email}`);

  // ── Schools ──────────────────────────────────────────────
  const schoolData = [
    {
      email: 'info@bahirdaracademy.edu.et',
      name: 'Bahir Dar Academy',
      type: 'PUBLIC' as const,
      city: 'Bahir Dar',
      gradesOffered: [9, 10, 11, 12],
      isVerified: true,
    },
    {
      email: 'info@addisketema.edu.et',
      name: 'Addis Ketema High School',
      type: 'PUBLIC' as const,
      city: 'Addis Ababa',
      gradesOffered: [9, 10, 11, 12],
      isVerified: true,
    },
    {
      email: 'info@shegeracademy.edu.et',
      name: 'Sheger Academy',
      type: 'PRIVATE' as const,
      city: 'Addis Ababa',
      gradesOffered: [9, 10, 11, 12],
      isVerified: true,
    },
    {
      email: 'info@hawassa.edu.et',
      name: 'Hawassa Comprehensive School',
      type: 'PUBLIC' as const,
      city: 'Hawassa',
      gradesOffered: [9, 10, 11, 12],
      isVerified: false,
    },
  ];

  const schools = [];
  for (const school of schoolData) {
    const user = await prisma.user.upsert({
      where: { email: school.email },
      update: {},
      create: {
        email: school.email,
        passwordHash: '$2b$10$placeholder_hashed_password_abc123',
        firstName: school.name.split(' ')[0],
        lastName: 'School',
        role: 'SCHOOL',
        status: 'ACTIVE',
        isVerified: true,
      },
    });

    const created = await prisma.school.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        name: school.name,
        type: school.type,
        city: school.city,
        gradesOffered: school.gradesOffered,
        isVerified: school.isVerified,
      },
    });
    schools.push(created);
    console.log(`  ✓ School created: ${created.name}`);
  }

  // ── Companies ────────────────────────────────────────────
  const companyData = [
    {
      email: 'info@techsolve.et',
      name: 'TechSolve Ethiopia',
      industry: 'Technology',
      city: 'Addis Ababa',
      size: 'SMALL' as const,
      isVerified: true,
    },
    {
      email: 'info@greenagri.et',
      name: 'Green Agri PLC',
      industry: 'Agriculture',
      city: 'Bahir Dar',
      size: 'MEDIUM' as const,
      isVerified: true,
    },
    {
      email: 'info@innovate.et',
      name: 'Innovate Hub',
      industry: 'Technology',
      city: 'Addis Ababa',
      size: 'STARTUP' as const,
      isVerified: true,
    },
    {
      email: 'info@ethioconsult.et',
      name: 'EthioConsult',
      industry: 'Consulting',
      city: 'Addis Ababa',
      size: 'SMALL' as const,
      isVerified: false,
    },
    {
      email: 'info@medtech.et',
      name: 'MedTech Solutions',
      industry: 'Healthcare',
      city: 'Hawassa',
      size: 'SMALL' as const,
      isVerified: true,
    },
  ];

  const companies = [];
  for (const company of companyData) {
    const user = await prisma.user.upsert({
      where: { email: company.email },
      update: {},
      create: {
        email: company.email,
        passwordHash: '$2b$10$placeholder_hashed_password_abc123',
        firstName: company.name.split(' ')[0],
        lastName: 'Company',
        role: 'COMPANY',
        status: 'ACTIVE',
        isVerified: true,
      },
    });

    const created = await prisma.company.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        name: company.name,
        industry: company.industry,
        city: company.city,
        size: company.size,
        isVerified: company.isVerified,
      },
    });
    companies.push(created);
    console.log(`  ✓ Company created: ${created.name}`);
  }

  // ── Students ─────────────────────────────────────────────
  const studentData = [
    {
      email: 'abebe.kebede@student.et',
      firstName: 'Abebe',
      lastName: 'Kebede',
      grade: 11,
      schoolIndex: 0,
      skills: ['JavaScript', 'Python', 'HTML/CSS'],
      interests: ['Software Development', 'AI'],
      languages: ['Amharic', 'English'],
    },
    {
      email: 'sara.ahmed@student.et',
      firstName: 'Sara',
      lastName: 'Ahmed',
      grade: 12,
      schoolIndex: 1,
      skills: ['Public Speaking', 'Writing', 'Research'],
      interests: ['Journalism', 'Law'],
      languages: ['Amharic', 'English', 'Oromo'],
    },
    {
      email: 'david.tesfaye@student.et',
      firstName: 'David',
      lastName: 'Tesfaye',
      grade: 10,
      schoolIndex: 2,
      skills: ['Graphic Design', 'Video Editing', 'Photography'],
      interests: ['Design', 'Media'],
      languages: ['Amharic', 'English'],
    },
    {
      email: 'marta.haile@student.et',
      firstName: 'Marta',
      lastName: 'Haile',
      grade: 12,
      schoolIndex: 0,
      skills: ['Data Analysis', 'Excel', 'Statistics'],
      interests: ['Business', 'Economics'],
      languages: ['Amharic', 'English'],
    },
    {
      email: 'yonas.bekele@student.et',
      firstName: 'Yonas',
      lastName: 'Bekele',
      grade: 11,
      schoolIndex: 1,
      skills: ['Java', 'Kotlin', 'Android'],
      interests: ['Mobile Development', 'Gaming'],
      languages: ['Amharic', 'English'],
    },
    {
      email: 'hanna.wondimu@student.et',
      firstName: 'Hanna',
      lastName: 'Wondimu',
      grade: 9,
      schoolIndex: 2,
      skills: ['Writing', 'Communication'],
      interests: ['Literature', 'Education'],
      languages: ['Amharic', 'English', 'French'],
    },
    {
      email: 'gemechu.abera@student.et',
      firstName: 'Gemechu',
      lastName: 'Aberaa',
      grade: 11,
      schoolIndex: 3,
      skills: ['Biology', 'Chemistry', 'Lab Work'],
      interests: ['Medicine', 'Research'],
      languages: ['Amharic', 'English', 'Oromo'],
    },
  ];

  const students = [];
  for (const student of studentData) {
    const user = await prisma.user.upsert({
      where: { email: student.email },
      update: {},
      create: {
        email: student.email,
        passwordHash: '$2b$10$placeholder_hashed_password_abc123',
        firstName: student.firstName,
        lastName: student.lastName,
        role: 'STUDENT',
        status: 'ACTIVE',
        isVerified: true,
      },
    });

    const created = await prisma.student.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        schoolId: schools[student.schoolIndex]?.id ?? null,
        grade: student.grade,
        skills: student.skills,
        interests: student.interests,
        languages: student.languages,
      },
    });
    students.push(created);
    console.log(`  ✓ Student created: ${user.firstName} ${user.lastName}`);
  }

  // ── Internships ──────────────────────────────────────────
  const internshipData = [
    {
      companyIndex: 0,
      title: 'Junior Software Developer Intern',
      description:
        'Join our development team and work on real-world projects using modern web technologies.',
      requirements: ['Basic JavaScript knowledge', 'Enrolled in grade 10+'],
      preferredSkills: ['React', 'Node.js', 'TypeScript'],
      type: 'HYBRID' as const,
      city: 'Addis Ababa',
      durationMonths: 3,
      tags: ['tech', 'software', 'web'],
      status: 'ACTIVE' as const,
    },
    {
      companyIndex: 0,
      title: 'IT Support Intern',
      description:
        'Help maintain our IT infrastructure and provide technical support to staff.',
      requirements: ['Basic IT knowledge', 'Problem-solving skills'],
      preferredSkills: ['Networking', 'Hardware', 'Windows/Linux'],
      type: 'ON_SITE' as const,
      city: 'Addis Ababa',
      durationMonths: 3,
      tags: ['tech', 'it', 'support'],
      status: 'ACTIVE' as const,
    },
    {
      companyIndex: 1,
      title: 'Agricultural Research Assistant',
      description:
        'Assist in field research and data collection for sustainable farming practices.',
      requirements: ['Interest in agriculture', 'Grade 11+'],
      preferredSkills: ['Data entry', 'Field research'],
      type: 'ON_SITE' as const,
      city: 'Bahir Dar',
      durationMonths: 4,
      tags: ['agriculture', 'research', 'environment'],
      status: 'ACTIVE' as const,
    },
    {
      companyIndex: 1,
      title: 'Marketing Intern',
      description:
        'Support our marketing team with social media management and content creation.',
      requirements: ['Good communication skills', 'Grade 10+'],
      preferredSkills: ['Social media', 'Content writing', 'Photography'],
      type: 'ON_SITE' as const,
      city: 'Bahir Dar',
      durationMonths: 3,
      tags: ['marketing', 'social media', 'content'],
      status: 'ACTIVE' as const,
    },
    {
      companyIndex: 2,
      title: 'UI/UX Design Intern',
      description:
        'Learn and practice user interface and user experience design for digital products.',
      requirements: ['Basic design knowledge', 'Creativity'],
      preferredSkills: ['Figma', 'Adobe XD', 'Design thinking'],
      type: 'REMOTE' as const,
      city: 'Addis Ababa',
      durationMonths: 3,
      tags: ['design', 'ui/ux', 'creative'],
      status: 'ACTIVE' as const,
    },
    {
      companyIndex: 2,
      title: 'Community Manager Intern',
      description:
        'Help grow and engage our community of innovators and entrepreneurs.',
      requirements: ['Active on social media', 'Good interpersonal skills'],
      preferredSkills: ['Community management', 'Event planning'],
      type: 'HYBRID' as const,
      city: 'Addis Ababa',
      durationMonths: 2,
      tags: ['community', 'events', 'tech'],
      status: 'ACTIVE' as const,
    },
    {
      companyIndex: 3,
      title: 'Business Analyst Intern',
      description:
        'Assist in analyzing business processes and preparing consulting reports.',
      requirements: ['Analytical skills', 'Grade 11+'],
      preferredSkills: ['Excel', 'Data analysis', 'Report writing'],
      type: 'ON_SITE' as const,
      city: 'Addis Ababa',
      durationMonths: 3,
      tags: ['consulting', 'business', 'analytics'],
      status: 'DRAFT' as const,
    },
    {
      companyIndex: 4,
      title: 'Healthcare Administration Intern',
      description:
        'Support administrative operations in a healthcare technology company.',
      requirements: ['Interest in healthcare', 'Grade 10+'],
      preferredSkills: ['Organization', 'Communication', 'MS Office'],
      type: 'ON_SITE' as const,
      city: 'Hawassa',
      durationMonths: 3,
      tags: ['healthcare', 'administration', 'tech'],
      status: 'ACTIVE' as const,
    },
    {
      companyIndex: 4,
      title: 'Lab Assistant Intern',
      description:
        'Assist in laboratory setup and basic medical research documentation.',
      requirements: ['Biology background', 'Grade 11+'],
      preferredSkills: ['Lab safety', 'Data recording'],
      type: 'ON_SITE' as const,
      city: 'Hawassa',
      durationMonths: 4,
      tags: ['healthcare', 'lab', 'research'],
      status: 'ACTIVE' as const,
    },
  ];

  const internships = [];
  for (const internship of internshipData) {
    const created = await prisma.internship.create({
      data: {
        companyId: companies[internship.companyIndex].id,
        title: internship.title,
        description: internship.description,
        requirements: internship.requirements,
        preferredSkills: internship.preferredSkills,
        type: internship.type,
        city: internship.city,
        durationMonths: internship.durationMonths,
        tags: internship.tags,
        status: internship.status,
      },
    });
    internships.push(created);
    console.log(`  ✓ Internship created: ${created.title}`);
  }

  // ── Applications ─────────────────────────────────────────
  const applicationData = [
    { studentIndex: 0, internshipIndex: 0, status: 'PENDING' as const },
    { studentIndex: 0, internshipIndex: 1, status: 'REVIEWED' as const },
    { studentIndex: 1, internshipIndex: 3, status: 'SHORTLISTED' as const },
    { studentIndex: 1, internshipIndex: 2, status: 'PENDING' as const },
    { studentIndex: 2, internshipIndex: 4, status: 'ACCEPTED' as const },
    { studentIndex: 2, internshipIndex: 5, status: 'PENDING' as const },
    { studentIndex: 3, internshipIndex: 2, status: 'REJECTED' as const },
    { studentIndex: 3, internshipIndex: 6, status: 'PENDING' as const },
    { studentIndex: 4, internshipIndex: 0, status: 'PENDING' as const },
    { studentIndex: 5, internshipIndex: 5, status: 'PENDING' as const },
    { studentIndex: 6, internshipIndex: 7, status: 'SHORTLISTED' as const },
  ];

  for (const app of applicationData) {
    const application = await prisma.application.create({
      data: {
        studentId: students[app.studentIndex].id,
        internshipId: internships[app.internshipIndex].id,
        status: app.status,
      },
    });
    console.log(
      `  ✓ Application created: Student ${app.studentIndex} → Internship ${app.internshipIndex} (${app.status})`,
    );

    // Create status history entry
    await prisma.applicationStatusHistory.create({
      data: {
        applicationId: application.id,
        fromStatus: 'PENDING',
        toStatus: app.status,
        changedById: admin.id,
      },
    });
  }

  console.log('\n✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
