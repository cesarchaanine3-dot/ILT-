# Security Specification - ILTexas Loaner Portal

## Data Invariants
1. **User Identity:** Every operation must be authenticated.
2. **Campus Isolation:** Techs can only access data (students/loans) associated with their assigned `campusId`.
3. **Role-Based Access:** 
    - `admin`: Full access to everything.
    - `tech`: Read-only for students, CRUD for loans (with immutable field restrictions), restricted to their campus.
4. **Schema Integrity:**
    - Students must have `id`, `name`, `campusId`.
    - Loans must have `studentId`, `assetTag`, `type`, `checkoutDate`, `status`, `campusId`.
    - Roles are strictly `admin` or `tech`.

## The "Dirty Dozen" Payloads (Test Cases)
1. **Identity Spoofing:** User A trying to create `users/UserB` with their own UID.
2. **Privilege Escalation:** New user trying to set `role: 'admin'` during self-registration.
3. **Campus Hopping:** Tech from Campus A trying to query `students` where `campusId == 'CampusB'`.
4. **Campus Hopping (Read):** Tech from Campus A trying to `get` a specific student from Campus B.
5. **Orphaned Student:** Creating a student with a non-existent or invalid `campusId`.
6. **Shadow Update (Loan):** Tech trying to change the `studentId` of an existing loan record.
7. **Bypassing Status:** Tech trying to change a loan status to something other than `active` or `returned`.
8. **Resource Poisoning:** Injecting a 1MB string into the `assetTag` field.
9. **Illegal ID:** Using `../../../system/config` as a student ID.
10. **Admin Lockout:** Tech trying to delete themselves or change their own role.
11. **PII Leak:** Unauthenticated user trying to list all users.
12. **Terminal State Lock:** Attempting to update a loan that is already `returned` (if applicable, though techs might need to fix mistakes, we'll see).

## Test Runner (Draft)
```typescript
// firestore.rules.test.ts
// (Internal logic for verification)
```
