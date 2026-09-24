const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const files = execSync('grep -rl "findFirst" apps/dashboard/src/app/api/').toString().trim().split('\n');

for (const file of files) {
  if (!file) continue;
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace the leaky fallback
  const leakyPattern = /if \(!propertyId\) \{\s*const firstProp = await db\.query\.properties\.findFirst\(\);\s*if \(firstProp\) propertyId = firstProp\.id;\s*\}/g;
  
  content = content.replace(leakyPattern, `if (!propertyId) {
      // Securely fetch property for this user instead of leaking firstProp
      const userId = session?.user?.id;
      if (userId) {
        const membership = await db.query.propertyMembers.findFirst({
          where: eq(propertyMembers.userId, userId)
        });
        if (membership) {
          propertyId = membership.propertyId;
        } else {
          // Try organization fallback
          const orgMembership = await db.query.organizationMembers.findFirst({
            where: eq(organizationMembers.userId, userId)
          });
          if (orgMembership) {
            const orgProp = await db.query.properties.findFirst({
              where: eq(properties.organizationId, orgMembership.organizationId)
            });
            if (orgProp) propertyId = orgProp.id;
          }
        }
      }
    }`);
    
  fs.writeFileSync(file, content);
  console.log('Fixed', file);
}
