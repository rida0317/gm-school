# SCHOOL MANAGEMENT SYSTEM
## Master Development Plan — Next.js + Supabase

## 1. Project Objective

Build a complete modern School Management System for a school.

The application must manage:

- Students
- Teachers
- Staff
- Classes
- Subjects
- Rooms
- Academic years
- Timetables
- Automatic timetable generation
- Student attendance
- Teacher attendance
- Teacher replacement
- Stock management
- Suppliers
- Purchases
- Expenses and budget
- Notifications
- Reports
- Users and permissions
- Dashboard and statistics

The application must be production-ready, secure, scalable and easy to maintain.

---

# 2. Technology Stack

Use:

- Next.js 16+
- TypeScript
- App Router
- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Storage
- Row Level Security (RLS)
- Tailwind CSS
- shadcn/ui
- React Hook Form
- Zod
- Recharts
- Lucide Icons

Do not introduce unnecessary libraries.

Use server-side operations where appropriate.

---

# 3. Architecture

Use a clean modular architecture.

Recommended structure:

```text
src/
├── app/
│   ├── [locale]/
│   │   ├── dashboard/
│   │   ├── students/
│   │   ├── teachers/
│   │   ├── staff/
│   │   ├── classes/
│   │   ├── subjects/
│   │   ├── rooms/
│   │   ├── timetable/
│   │   ├── attendance/
│   │   ├── substitutions/
│   │   ├── stock/
│   │   ├── suppliers/
│   │   ├── purchases/
│   │   ├── expenses/
│   │   ├── reports/
│   │   └── settings/
│
├── components/
├── features/
│   ├── students/
│   ├── teachers/
│   ├── timetable/
│   ├── attendance/
│   ├── substitutions/
│   ├── stock/
│   ├── finance/
│   └── reports/
│
├── lib/
│   ├── supabase/
│   ├── auth/
│   ├── validations/
│   └── utils/
│
├── hooks/
├── types/
└── config/
```

Keep business logic outside UI components whenever possible.

---

# 4. Authentication & Roles

Implement Supabase Authentication.

Roles:

### SUPER_ADMIN
Full access.

### ADMIN
School administration.

Access:
- Students
- Teachers
- Classes
- Timetable
- Attendance
- Substitutions
- Stock
- Suppliers
- Purchases
- Expenses
- Reports

### TEACHER
Access:
- Own profile
- Own timetable
- Student attendance for assigned classes
- Teacher absence request
- Replacement information

### SUPERVISOR
Access:
- Student attendance
- Student delays
- Teacher attendance
- Daily monitoring

### STOCK_MANAGER
Access:
- Stock
- Products
- Suppliers
- Purchases
- Stock movements
- Stock reports

Implement proper authorization.

Never rely only on frontend role checks.

Use Supabase RLS policies.

---

# 5. Database Design

Create normalized PostgreSQL tables.

Main tables:

```text
profiles
roles
academic_years
terms

students
student_parents
student_enrollments

teachers
staff

classes
class_students
subjects
teacher_subjects

rooms

timetable
timetable_slots

student_attendance
teacher_attendance

substitutions
substitution_requests

stock_categories
stock_products
stock_locations
stock_movements

suppliers
purchase_orders
purchase_order_items

expenses
budgets

notifications

audit_logs
```

Use UUID primary keys.

Use timestamps:

```text
created_at
updated_at
```

Where appropriate use:

```text
created_by
updated_by
```

Add foreign keys and indexes.

---

# 6. Students Module

Create complete CRUD.

Student fields:

```text
first_name
last_name
student_code
date_of_birth
gender
class_id
photo
address
phone
email
status
```

Features:

- Add student
- Edit student
- Delete/archive student
- Search
- Filter
- Pagination
- Student profile
- Enrollment history
- Attendance history
- Timetable
- Reports

Never permanently delete important historical records unless explicitly required.

Prefer archive/status fields.

---

# 7. Teachers Module

Teacher fields:

```text
first_name
last_name
teacher_code
email
phone
specialization
hire_date
status
photo
```

Features:

- CRUD
- Teacher profile
- Assigned subjects
- Assigned classes
- Timetable
- Attendance
- Absences
- Replacement history

---

# 8. Classes Module

Manage:

- Class name
- Level
- Academic year
- Main teacher
- Students
- Room
- Capacity

Example:

```text
6AP-1
6AP-2
3AC-1
3AC-2
```

Show class statistics.

---

# 9. Subjects Module

Manage:

- Subject name
- Code
- Weekly hours
- Teacher assignments
- Classes

Example:

```text
Math
French
Arabic
English
Science
History
Geography
Physical Education
```

---

# 10. Rooms Module

Manage:

- Room number
- Name
- Capacity
- Type
- Equipment
- Availability

Types:

```text
Classroom
Laboratory
Computer Room
Sports Room
Meeting Room
```

---

# 11. Timetable System

This is a core module.

Create:

### Manual Timetable

Admin can:

- Add course
- Select class
- Select teacher
- Select subject
- Select room
- Select day
- Select time

Use drag & drop where practical.

### Conflict Detection

The system MUST prevent:

```text
Teacher double booking
Class double booking
Room double booking
```

Example:

Teacher Ahmed cannot teach:

```text
08:00 → Class A
08:00 → Class B
```

at the same time.

Show clear conflict messages.

---

# 12. Automatic Timetable Generator

Create a timetable generation engine.

Inputs:

```text
Classes
Teachers
Subjects
Weekly subject hours
Rooms
Available periods
Teacher availability
```

Constraints:

- No teacher conflicts
- No class conflicts
- No room conflicts
- Respect weekly subject hours
- Respect teacher availability
- Respect room capacity
- Avoid unnecessary gaps where possible

The algorithm should generate a valid timetable.

Admin must be able to:

```text
Generate
Preview
Accept
Regenerate
Manually modify
```

Never overwrite an existing approved timetable without confirmation.

---

# 13. Student Attendance

Teachers or supervisors can record:

```text
Present
Absent
Late
Excused
```

Attendance must contain:

```text
student_id
class_id
timetable_slot_id
date
status
reason
comment
recorded_by
```

Features:

- Daily attendance
- Class attendance
- Student attendance history
- Monthly statistics
- Absence reports
- Late reports
- Justifications

---

# 14. Teacher Attendance

Teacher can be:

```text
Present
Absent
Late
Excused
```

When a teacher is absent:

1. Register absence.
2. Find affected timetable slots.
3. Identify affected classes.
4. Search available replacement teachers.
5. Create replacement suggestions.

---

# 15. Teacher Replacement System

Replacement engine should check:

```text
Teacher availability
Existing timetable
Teacher workload
Subject compatibility
Class compatibility
```

Example:

```text
Absent:
Teacher Ahmed

Date:
Monday

Time:
10:00 - 11:00

Class:
3AP-2

Subject:
Mathematics
```

System proposes:

```text
Teacher Youssef
Available: YES
Conflict: NO
Subject compatible: YES
```

Admin can:

```text
Accept
Reject
Choose another teacher
```

Store every replacement in history.

---

# 16. Stock Management

Create complete school inventory management.

### Categories

Examples:

```text
School Supplies
Office Supplies
Cleaning
IT Equipment
Teaching Equipment
Furniture
Uniforms
Sports Equipment
```

### Products

Fields:

```text
name
SKU
category_id
quantity
minimum_quantity
unit
location_id
supplier_id
purchase_price
selling/value_price
status
```

### Stock Movements

Types:

```text
IN
OUT
ADJUSTMENT
TRANSFER
RETURN
```

Every movement must create an immutable history record.

Example:

```text
Product:
A4 Paper

Before:
20 boxes

Movement:
IN +50

After:
70 boxes
```

Never directly modify stock without creating a movement when the modification represents a real stock operation.

---

# 17. Low Stock Alerts

If:

```text
quantity <= minimum_quantity
```

create a low-stock warning.

Dashboard should show:

```text
Critical Stock
Low Stock
Out of Stock
```

---

# 18. Suppliers

Manage:

```text
Supplier name
Company
Phone
Email
Address
Tax information
Notes
Status
```

Supplier profile should show:

- Purchases
- Total spending
- Products
- Purchase history

---

# 19. Purchases

Create:

```text
Purchase Order
```

Fields:

```text
supplier
date
status
items
quantity
unit_price
total
notes
```

Statuses:

```text
Draft
Pending
Approved
Received
Cancelled
```

When a purchase is marked:

```text
RECEIVED
```

automatically create stock IN movements.

---

# 20. Expenses

Manage school expenses.

Categories:

```text
Salaries
Supplies
Maintenance
Electricity
Water
Internet
Equipment
Transport
Other
```

Fields:

```text
amount
category
date
description
supplier
invoice_number
attachment
created_by
```

Add monthly and yearly statistics.

---

# 21. Budget

Create budget management.

Example:

```text
Annual Budget
1,000,000 DH
```

Track:

```text
Budget
Spent
Remaining
```

Allow budget categories.

Show warnings when spending approaches the budget limit.

---

# 22. Dashboard

Create professional admin dashboard.

Cards:

```text
Students
Teachers
Classes
Today's Absences
Teacher Absences
Today's Replacements
Low Stock
Monthly Expenses
```

Charts:

- Student attendance
- Teacher attendance
- Monthly expenses
- Stock value
- Student distribution
- Absence trends

Add quick actions:

```text
Add Student
Add Teacher
Record Absence
Generate Timetable
Add Stock
Create Purchase
```

---

# 23. Notifications

Create notification system.

Examples:

```text
Teacher absence detected
Replacement required
Stock below minimum
Purchase received
Student absence recorded
Budget warning
```

Notifications should be role-aware.

---

# 24. Reports

Create reports for:

### Students
- Student list
- Attendance
- Absences
- Classes

### Teachers
- Teacher attendance
- Absences
- Replacements
- Workload

### Timetable
- Class timetable
- Teacher timetable
- Room timetable

### Stock
- Inventory
- Stock movements
- Low stock
- Stock valuation

### Finance
- Expenses
- Purchases
- Budget
- Supplier spending

Allow export:

```text
PDF
Excel
CSV
```

---

# 25. Audit Logs

Every important administrative action should be logged.

Example:

```text
User:
Admin

Action:
STUDENT_UPDATED

Entity:
Student

Date:
2026-08-18

Changes:
class_id: 3 → 5
```

Track:

```text
create
update
delete/archive
approve
reject
login
stock movement
purchase
expense
replacement
attendance modification
```

---

# 26. Security

Security is mandatory.

Implement:

- Supabase RLS
- Role-based authorization
- Server-side validation
- Zod validation
- Secure file uploads
- Protected routes
- No sensitive data exposed to client unnecessarily
- Audit logs
- Input sanitization
- Proper database constraints

Never put service-role keys in client-side code.

Use environment variables.

---

# 27. UI/UX

Design should look like a professional SaaS dashboard.

Requirements:

- Responsive
- Desktop-first admin experience
- Mobile-friendly teacher interface
- Sidebar navigation
- Topbar
- Breadcrumbs
- Search
- Filters
- Tables
- Cards
- Modals
- Toast notifications
- Loading states
- Empty states
- Error states
- Confirmation dialogs

Use consistent design tokens.

Avoid unnecessary animations.

---

# 28. Internationalization

Prepare the application for:

```text
French
Arabic
English
```

Arabic must support RTL correctly.

Do not hardcode user-facing text.

Use translation files.

---

# 29. Database Rules

Before creating tables:

1. Design relationships.
2. Identify foreign keys.
3. Add indexes.
4. Add constraints.
5. Create RLS policies.
6. Test permissions.

Avoid duplicated data.

Use database transactions for operations involving multiple tables.

---

# 30. Development Order

DO NOT build everything at once.

Follow this order:

## Phase 1
Project architecture

## Phase 2
Supabase setup

## Phase 3
Authentication + roles

## Phase 4
Students

## Phase 5
Teachers

## Phase 6
Classes + subjects + rooms

## Phase 7
Timetable

## Phase 8
Automatic timetable generator

## Phase 9
Student attendance

## Phase 10
Teacher attendance

## Phase 11
Replacement system

## Phase 12
Stock

## Phase 13
Suppliers

## Phase 14
Purchases

## Phase 15
Expenses + Budget

## Phase 16
Notifications

## Phase 17
Reports

## Phase 18
Audit logs

## Phase 19
Dashboard improvements

## Phase 20
Security audit + testing

## Phase 21
Production deployment

---

# 31. Antigravity Rules

IMPORTANT:

Do not randomly modify the architecture.

Before implementing a feature:

1. Inspect the existing project.
2. Understand the current architecture.
3. Check existing Supabase configuration.
4. Check existing components.
5. Check existing authentication.
6. Reuse existing components when possible.
7. Do not duplicate functionality.
8. Keep changes modular.
9. Do not break existing features.
10. Run TypeScript checks after major changes.
11. Run linting.
12. Test database operations.
13. Test RLS policies.
14. Fix errors before moving to the next phase.

Never claim a feature is complete if it has not been tested.

---

# 32. Definition of Done

A module is considered complete only when:

- UI works
- Database works
- Validation works
- Authentication works
- RLS works
- CRUD works
- Loading states exist
- Error handling exists
- Empty states exist
- Responsive layout works
- TypeScript has no relevant errors
- No console errors
- Main user flows have been tested

---

# 33. First Task for Antigravity

DO NOT start coding the entire application.

First perform an architecture audit.

Return:

1. Current project structure
2. Current technology stack
3. Existing Supabase configuration
4. Existing authentication
5. Existing database tables
6. Existing routes
7. Existing reusable components
8. Existing problems
9. Recommended architecture
10. Complete database schema proposal
11. Required migrations
12. Implementation roadmap

Then WAIT for approval before implementing Phase 1.

The goal is to build a serious, scalable School Management System, not a simple CRUD demo.