const prisma = require('./prisma');

const CONTACT_SELECT = { id: true, name: true, email: true, role: true };

/**
 * Who may chat with whom:
 * mentee ↔ own mentor; HR and Admin ↔ everyone; mentor ↔ HR, Admin, and own mentees.
 * Inactive users and self are excluded.
 */
function contactWhere(user) {
  const activeOther = { id: { not: user.id }, isActive: true };

  if (user.role === 'ADMIN' || user.role === 'HR') return activeOther;

  if (user.role === 'MENTOR') {
    return {
      AND: [
        activeOther,
        {
          OR: [
            { role: { in: ['ADMIN', 'HR'] } },
            { role: 'MENTEE', mentorId: user.id },
          ],
        },
      ],
    };
  }

  if (user.role === 'MENTEE') {
    const or = [{ role: { in: ['ADMIN', 'HR'] } }];
    if (user.mentorId) or.push({ id: user.mentorId, role: 'MENTOR' });
    return { AND: [activeOther, { OR: or }] };
  }

  return { id: -1 };
}

async function allowedContacts(user) {
  return prisma.user.findMany({
    where: contactWhere(user),
    select: CONTACT_SELECT,
    orderBy: { name: 'asc' },
  });
}

async function findAllowedContact(user, otherId) {
  const id = parseInt(otherId, 10);
  if (!Number.isInteger(id)) return null;
  return prisma.user.findFirst({
    where: { AND: [{ id }, contactWhere(user)] },
    select: CONTACT_SELECT,
  });
}

module.exports = { allowedContacts, findAllowedContact, contactWhere };
