const fs = require('fs');

const fixImports = (file, additions) => {
  let content = fs.readFileSync(file, 'utf8');
  for (const add of additions) {
    if (!content.includes(` ${add}`)) {
      content = content.replace(/import { db, /, `import { db, ${add}, `);
    }
  }
  fs.writeFileSync(file, content);
};

fixImports('apps/dashboard/src/app/api/calendar/route.ts', ['properties']);
fixImports('apps/dashboard/src/app/api/housekeeping/route.ts', ['properties']);
fixImports('apps/dashboard/src/app/api/payments/route.ts', ['properties']);

let onboard = fs.readFileSync('apps/dashboard/src/app/api/onboarding/route.ts', 'utf8');
onboard = onboard.replace(/users , propertyMembers, organizationMembers }/g, 'users }');
fs.writeFileSync('apps/dashboard/src/app/api/onboarding/route.ts', onboard);
